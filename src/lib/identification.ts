import type { Guest, Identification } from "@/lib/types";

function normalizeDocument(n: string | null | undefined) {
  return (n ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Il riconoscimento valido più recente per l'ospite. Vale solo se non è stato
 * revocato e se riguarda il documento che l'ospite ha ancora registrato.
 */
export function currentIdentification(guest: Pick<Guest, "id" | "document_number">, identifications: Identification[]) {
  const doc = normalizeDocument(guest.document_number);
  if (!doc) return null;
  return (
    identifications
      .filter((i) => i.guest_id === guest.id && !i.revoked_at && normalizeDocument(i.document_number) === doc)
      .sort((a, b) => b.verified_at.localeCompare(a.verified_at))[0] ?? null
  );
}

/** Tutti gli ospiti attesi sono inseriti e riconosciuti. */
export function allIdentified(guests: Pick<Guest, "id" | "document_number">[], identifications: Identification[], expected: number) {
  return guests.length >= expected && guests.length > 0 && guests.every((g) => currentIdentification(g, identifications));
}
