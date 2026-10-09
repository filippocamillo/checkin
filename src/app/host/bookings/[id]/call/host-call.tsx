"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge, Button, Card, buttonClass } from "@/components/ui";
import { countryName } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import type { Guest } from "@/lib/types";
import { deserialize, getMedia, serialize, stopStream, waitForIceGathering } from "@/lib/webrtc";
import { endCall, identifyGuest, pollCall, startCall } from "../identification-actions";

interface Props {
  bookingId: string;
  title: string;
  guests: { guest: Guest; identifiedAt: string | null }[];
  identifiedAt: string | null;
  accessCode: string | null;
  accessCodeError: string | null;
  iceServers: RTCIceServer[];
}

type State = "idle" | "calling" | "connected" | "ended" | "failed" | "error";

const DOCUMENT_LABEL: Record<string, string> = { passport: "Passaporto", id_card: "Carta d'identità", driving_licence: "Patente", other: "Documento" };

export function HostCall({ bookingId, title, guests, identifiedAt, accessCode, accessCodeError, iceServers }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const active = state === "calling" || state === "connected";

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    stopStream(localRef.current);
    localRef.current = null;
  }

  useEffect(() => () => {
    cleanup();
    if (callIdRef.current) endCall(callIdRef.current).catch(() => undefined);
  }, []);

  // In attesa che l'ospite risponda, e poi per sapere se ha chiuso.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const id = callIdRef.current;
      const pc = pcRef.current;
      if (!id || !pc) return;
      const res = await pollCall(id).catch(() => null);
      if (!res) return;
      if (res.ended) {
        cleanup();
        callIdRef.current = null;
        setState("ended");
        return;
      }
      if (res.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(deserialize(res.answer)).catch(() => setState("failed"));
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [active]);

  async function start() {
    setMessage(null);
    setState("calling");
    const stream = await getMedia();
    localRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
    // Anche senza camera o microfono sul dispositivo dell'host si riceve il video dell'ospite.
    if (!stream?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
    if (!stream?.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });
    pc.ontrack = (e) => {
      if (remoteVideo.current && e.streams[0]) remoteVideo.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setState("connected");
      if (pc.connectionState === "failed") {
        setState("failed");
        hangUp();
      }
    };
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      const res = await startCall(bookingId, serialize(pc.localDescription));
      if (!res.ok) throw new Error();
      callIdRef.current = res.callId;
    } catch {
      cleanup();
      setState("error");
    }
  }

  async function hangUp() {
    const id = callIdRef.current;
    callIdRef.current = null;
    cleanup();
    setState((s) => (s === "failed" ? s : "ended"));
    if (id) await endCall(id).catch(() => undefined);
  }

  function identify(guestId: string) {
    startTransition(async () => {
      const res = await identifyGuest(bookingId, guestId, "video_call");
      setMessage(res.ok ? null : res.message ?? "Salvataggio non riuscito");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Riconoscimento</h1>
          <p className="text-sm text-fg-muted">{title}</p>
        </div>
        <Link href={`/host/bookings/${bookingId}`} className={buttonClass("ghost")}>
          Torna alla prenotazione
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={remoteVideo} autoPlay playsInline className="aspect-[3/4] w-full object-contain sm:aspect-video" />
          <video ref={localVideo} autoPlay playsInline muted className="absolute top-3 right-3 w-28 rounded-xl border border-white/30 object-cover sm:w-40" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-black/70 p-4">
            {active ? (
              <>
                <span className="text-sm text-white/80">{state === "calling" ? "In attesa che l'ospite entri…" : "In collegamento"}</span>
                <Button variant="danger" onClick={hangUp}>
                  Chiudi chiamata
                </Button>
              </>
            ) : (
              <Button onClick={start}>{state === "idle" ? "Avvia videochiamata" : "Richiama"}</Button>
            )}
          </div>
          {!active && state !== "idle" && (
            <p className="absolute inset-x-0 top-0 bg-black/60 p-3 text-center text-sm text-white">
              {state === "ended" && "Chiamata terminata."}
              {state === "failed" && "Connessione non riuscita. Riprova, oppure chiama l'ospite con un'altra app e segna il riconoscimento dalla prenotazione."}
              {state === "error" && "Impossibile avviare la chiamata. Controlla i permessi di camera e microfono."}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-muted">
            Confronta il viso di ogni ospite con il documento che mostra in camera e con i dati qui sotto. Il video non viene registrato.
          </p>
          {message && <p className="text-sm text-danger">{message}</p>}
          {guests.map(({ guest: g, identifiedAt: at }) => (
            <Card key={g.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {g.first_name} {g.last_name}
                </p>
                {at && <Badge tone="ok">Riconosciuto</Badge>}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-fg-muted">Nato il</dt>
                <dd>{formatDate(g.birth_date, { day: "numeric", month: "short", year: "numeric" }) || "—"}</dd>
                <dt className="text-fg-muted">Cittadinanza</dt>
                <dd>{g.citizenship ? countryName(g.citizenship) : "—"}</dd>
                <dt className="text-fg-muted">{DOCUMENT_LABEL[g.document_type ?? "other"]}</dt>
                <dd className="font-mono">{g.document_number || "—"}</dd>
                <dt className="text-fg-muted">Scadenza</dt>
                <dd>{formatDate(g.document_expiry, { day: "numeric", month: "short", year: "numeric" }) || "—"}</dd>
              </dl>
              {!at && (
                <Button variant="secondary" disabled={pending || !g.document_number} onClick={() => identify(g.id)}>
                  Riconosciuto
                </Button>
              )}
            </Card>
          ))}

          {identifiedAt ? (
            <Card className="border-ok/40 bg-ok/10 text-sm">
              <p className="font-semibold text-ok">Tutti gli ospiti sono riconosciuti.</p>
              {accessCode && <p className="mt-1">Codice Nuki inviato all&apos;ospite: <span className="font-mono">{accessCode}</span></p>}
              {accessCodeError && <p className="mt-1 text-danger">Codice Nuki non creato: {accessCodeError}</p>}
            </Card>
          ) : (
            guests.length === 0 && <p className="text-sm text-warn">L&apos;ospite non ha ancora inserito i dati.</p>
          )}
        </div>
      </div>
    </div>
  );
}
