"use client";

/**
 * Aspetta che il browser abbia raccolto i candidati di rete, così offerta e
 * risposta viaggiano in un solo messaggio ciascuna (niente scambio continuo).
 */
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/** Videocamera e microfono, con ripiego sul solo audio se la camera non c'è. */
export async function getMedia(facingMode?: "user" | "environment"): Promise<MediaStream | null> {
  const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, ...(facingMode ? { facingMode } : {}) };
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return null;
    }
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function serialize(desc: RTCSessionDescription | null): string {
  if (!desc) throw new Error("Descrizione di sessione mancante");
  return JSON.stringify({ type: desc.type, sdp: desc.sdp });
}

export function deserialize(text: string): RTCSessionDescriptionInit {
  const { type, sdp } = JSON.parse(text) as RTCSessionDescriptionInit;
  return { type, sdp };
}
