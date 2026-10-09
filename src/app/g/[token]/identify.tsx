"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { Dictionary, Lang } from "@/lib/i18n";
import type { IdentificationRequest } from "@/lib/types";
import { deserialize, getMedia, serialize, stopStream, waitForIceGathering } from "@/lib/webrtc";
import { answerCall, callEnded, hangUp, pollIdentification, requestIdentification } from "./actions";

interface Props {
  token: string;
  t: Dictionary;
  lang: Lang;
  identified: boolean;
  accessCode: string | null;
  accessInstructions: string | null;
  request: IdentificationRequest | null;
  slotAt: string | null;
  iceServers: RTCIceServer[];
}

type CallState = "idle" | "connecting" | "connected" | "ended" | "failed" | "denied";

export function Identify({ token, t, lang, identified, accessCode, accessInstructions, request, slotAt, iceServers }: Props) {
  const router = useRouter();
  const [incoming, setIncoming] = useState<{ id: string; offer: string } | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [showSlot, setShowSlot] = useState(false);
  const [slot, setSlot] = useState("");
  const [pending, startTransition] = useTransition();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const facingRef = useRef<"user" | "environment">("user");
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const inCall = callState === "connecting" || callState === "connected";

  // Controlla se l'host sta chiamando e se il riconoscimento è completato.
  useEffect(() => {
    if (identified) return;
    let stopped = false;
    const tick = async () => {
      const res = await pollIdentification(token).catch(() => null);
      if (stopped || !res) return;
      if (res.identified) {
        router.refresh();
        return;
      }
      if (!pcRef.current) setIncoming(res.call);
      if (pcRef.current && callIdRef.current) {
        const { ended } = await callEnded(token, callIdRef.current).catch(() => ({ ended: false }));
        if (ended && !stopped) finish("ended");
      }
    };
    tick();
    const timer = setInterval(tick, request === "video_now" || inCall ? 3000 : 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, identified, request, inCall]);

  // Chiude la chiamata se la pagina viene lasciata.
  useEffect(() => () => cleanup(), []);

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    stopStream(localRef.current);
    localRef.current = null;
    remoteRef.current = null;
  }

  function finish(state: CallState) {
    cleanup();
    callIdRef.current = null;
    setIncoming(null);
    setCallState(state);
  }

  async function join() {
    if (!incoming) return;
    setCallState("connecting");
    const stream = await getMedia("user");
    if (!stream) {
      setCallState("denied");
      return;
    }
    localRef.current = stream;
    facingRef.current = "user";
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    callIdRef.current = incoming.id;
    pc.ontrack = (e) => {
      remoteRef.current = e.streams[0] ?? null;
      if (remoteVideo.current) remoteVideo.current.srcObject = remoteRef.current;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setCallState("connected");
      if (pc.connectionState === "failed") finish("failed");
    };
    try {
      await pc.setRemoteDescription(deserialize(incoming.offer));
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIceGathering(pc);
      const res = await answerCall(token, incoming.id, serialize(pc.localDescription));
      if (!res.ok) finish("ended");
    } catch {
      finish("failed");
    }
  }

  // Il video locale si collega quando l'elemento è in pagina.
  useEffect(() => {
    if (inCall && localVideo.current && localRef.current) localVideo.current.srcObject = localRef.current;
    if (inCall && remoteVideo.current && remoteRef.current) remoteVideo.current.srcObject = remoteRef.current;
  }, [inCall]);

  async function switchCamera() {
    const pc = pcRef.current;
    if (!pc) return;
    const next = facingRef.current === "user" ? "environment" : "user";
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 } } });
      const track = fresh.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(track);
      const old = localRef.current;
      old?.getVideoTracks().forEach((tr) => {
        tr.stop();
        old.removeTrack(tr);
      });
      old?.addTrack(track);
      if (localVideo.current) localVideo.current.srcObject = old;
      facingRef.current = next;
    } catch {
      // Dispositivo con una sola fotocamera: si resta su quella attuale.
    }
  }

  async function leave() {
    const id = callIdRef.current;
    finish("ended");
    if (id) await hangUp(token, id).catch(() => undefined);
  }

  if (identified) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border-ok/40 bg-ok/10">
          <p className="font-semibold text-ok">{t.identified}</p>
        </Card>
        {accessCode && (
          <Card>
            <h2 className="font-semibold">{t.accessCode}</h2>
            <p className="my-3 font-mono text-4xl font-semibold tracking-[0.3em]">{accessCode}</p>
            <p className="text-sm text-fg-muted">{t.accessCodeHint}</p>
          </Card>
        )}
        {accessInstructions && (
          <Card>
            <h2 className="mb-2 font-semibold">{t.accessInstructions}</h2>
            <p className="text-sm whitespace-pre-line">{accessInstructions}</p>
          </Card>
        )}
      </div>
    );
  }

  if (inCall) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
        <video ref={remoteVideo} autoPlay playsInline className="min-h-0 w-full flex-1 object-cover" />
        <video
          ref={localVideo}
          autoPlay
          playsInline
          muted
          className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 w-28 rounded-xl border border-white/30 object-cover shadow-lg"
        />
        <div className="flex flex-col gap-3 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-sm text-white/80">{callState === "connecting" ? t.connecting : t.callTips}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="min-h-14 text-base" onClick={switchCamera}>
              {t.switchCamera}
            </Button>
            <Button variant="danger" className="min-h-14 text-base" onClick={leave}>
              {t.hangUp}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const slotLabel = slotAt
    ? new Date(slotAt).toLocaleString(lang === "it" ? "it-IT" : "en-GB", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">{t.identification}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t.identificationIntro}</p>
      </div>

      {callState === "ended" && <p className="text-sm text-fg-muted">{t.callEnded}</p>}
      {callState === "failed" && <p className="text-sm text-warn">{t.callFailed}</p>}
      {callState === "denied" && <p className="text-sm text-warn">{t.cameraDenied}</p>}

      {incoming ? (
        <div className="flex flex-col gap-3 rounded-xl bg-accent/10 p-4">
          <p className="font-semibold">{t.hostReady}</p>
          <Button className="min-h-14 text-base" onClick={join}>
            {t.joinCall}
          </Button>
        </div>
      ) : (
        <>
          {request === "video_now" && <p className="rounded-xl bg-muted p-3 text-sm">{t.waitingHost}</p>}
          {request === "video_slot" && slotAt && <p className="rounded-xl bg-muted p-3 text-sm">{t.slotBooked(slotLabel)}</p>}
          {request === "in_person" && <p className="rounded-xl bg-muted p-3 text-sm">{t.inPersonBooked}</p>}

          <Button
            className="min-h-14 text-base"
            disabled={pending}
            onClick={() => startTransition(async () => void (await requestIdentification(token, "video_now", null)))}
          >
            {t.imHere}
          </Button>

          {showSlot ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="slot">
                {t.slotTime}
              </label>
              <Input id="slot" type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} />
              <Button
                variant="secondary"
                disabled={!slot || pending}
                onClick={() =>
                  startTransition(async () => {
                    // L'orario scelto è quello locale del telefono: lo si converte prima dell'invio.
                    await requestIdentification(token, "video_slot", new Date(slot).toISOString());
                    setShowSlot(false);
                  })
                }
              >
                {t.confirmSlot}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setShowSlot(true)}>
              {t.bookSlot}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(async () => void (await requestIdentification(token, "in_person", null)))}
          >
            {t.inPerson}
          </Button>
        </>
      )}
    </Card>
  );
}
