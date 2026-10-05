import { parse } from "mrz";
import type { DocumentType, ExtractedGuest } from "@/lib/types";

export interface MrzResult {
  valid: boolean;
  fields: Partial<ExtractedGuest>;
}

/** Converte una data MRZ AAMMGG in ISO; per la nascita sceglie il secolo che non cade nel futuro. */
export function mrzDate(value: string | null | undefined, kind: "birth" | "expiry", now = new Date()): string | null {
  if (!value || !/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = value.slice(2, 4);
  const dd = value.slice(4, 6);
  const currentYY = now.getUTCFullYear() % 100;
  const century = kind === "birth" ? (yy > currentYY ? 1900 : 2000) : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

function documentType(code: string | null | undefined): DocumentType | null {
  if (!code) return null;
  if (code.startsWith("P")) return "passport";
  if (code.startsWith("I") || code.startsWith("A") || code.startsWith("C")) return "id_card";
  return "other";
}

/**
 * Legge le righe MRZ (passaporti TD3, carte d'identità TD1/TD2) e restituisce i
 * campi anagrafici. Le cifre di controllo dicono se la lettura è affidabile.
 */
export function parseMrz(lines: string[]): MrzResult | null {
  const cleaned = lines.map((l) => l.replace(/\s/g, "").toUpperCase()).filter(Boolean);
  if (cleaned.length < 2) return null;

  let result;
  try {
    result = parse(cleaned, { autocorrect: true });
  } catch {
    return null;
  }

  const f = result.fields;
  const name = (v: string | null | undefined) => (v ? v.replace(/</g, " ").replace(/\s+/g, " ").trim() : null);
  // Le carte d'identità TD1 a volte mettono il numero documento nel campo opzionale.
  const documentNumber = result.documentNumber ?? f.documentNumber ?? null;

  return {
    valid: result.valid,
    fields: {
      first_name: name(f.firstName),
      last_name: name(f.lastName),
      sex: f.sex === "male" ? "M" : f.sex === "female" ? "F" : null,
      birth_date: mrzDate(f.birthDate, "birth"),
      document_expiry: mrzDate(f.expirationDate, "expiry"),
      citizenship: f.nationality ?? null,
      document_issue_country: f.issuingState ?? null,
      document_number: documentNumber,
      document_type: documentType(f.documentCode),
    },
  };
}
