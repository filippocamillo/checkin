import "server-only";

/**
 * Server STUN/TURN per la videochiamata. Senza TURN la chiamata funziona sulla
 * maggior parte delle reti, ma alcune reti mobili la bloccano: per affidabilità
 * impostare TURN_URLS (separati da virgola), TURN_USERNAME e TURN_CREDENTIAL.
 */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
  const urls = process.env.TURN_URLS?.split(",").map((u) => u.trim()).filter(Boolean);
  if (urls?.length) servers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  return servers;
}
