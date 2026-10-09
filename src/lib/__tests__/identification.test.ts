import { describe, expect, it } from "vitest";
import { allIdentified, currentIdentification } from "@/lib/identification";
import { generateKeypadCode, romeToUtc } from "@/lib/nuki";
import type { Identification } from "@/lib/types";

const ident = (over: Partial<Identification>): Identification => ({
  id: "i1",
  guest_id: "g1",
  booking_id: "b1",
  method: "video_call",
  verified_by: "u1",
  verified_at: "2026-10-09T18:00:00Z",
  document_type: "passport",
  document_number: "YA1234567",
  revoked_at: null,
  ...over,
});

describe("riconoscimento", () => {
  it("vale per lo stesso documento, anche scritto con spazi", () => {
    expect(currentIdentification({ id: "g1", document_number: "ya 123 4567" }, [ident({})])).not.toBeNull();
  });

  it("decade se il documento cambia o se è revocato", () => {
    expect(currentIdentification({ id: "g1", document_number: "ZZ0000000" }, [ident({})])).toBeNull();
    expect(currentIdentification({ id: "g1", document_number: "YA1234567" }, [ident({ revoked_at: "2026-10-09T19:00:00Z" })])).toBeNull();
  });

  it("la prenotazione è completa solo con tutti gli ospiti attesi riconosciuti", () => {
    const guests = [
      { id: "g1", document_number: "YA1234567" },
      { id: "g2", document_number: "CA00000AA" },
    ];
    const idents = [ident({}), ident({ id: "i2", guest_id: "g2", document_number: "CA00000AA" })];
    expect(allIdentified(guests, idents, 2)).toBe(true);
    expect(allIdentified(guests, idents, 3)).toBe(false);
    expect(allIdentified(guests, [ident({})], 2)).toBe(false);
    expect(allIdentified([], [], 0)).toBe(false);
  });
});

describe("Nuki", () => {
  it("genera codici da 6 cifre senza zero e che non iniziano con 12", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateKeypadCode();
      expect(code).toMatch(/^[1-9]{6}$/);
      expect(code.startsWith("12")).toBe(false);
    }
    // Con un generatore che produce "12…" la prima volta, deve scartarlo.
    const seq = [0, 0.15, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    let n = 0;
    expect(generateKeypadCode(() => seq[n++ % seq.length])).toBe("555555");
  });

  it("converte l'ora di Roma in UTC con ora legale e solare", () => {
    expect(romeToUtc("2026-07-15", "10:00").toISOString()).toBe("2026-07-15T08:00:00.000Z");
    expect(romeToUtc("2026-12-15", "10:00").toISOString()).toBe("2026-12-15T09:00:00.000Z");
  });
});
