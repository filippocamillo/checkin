import type { Booking, DocumentType, Guest, PartyType } from "@/lib/types";

/**
 * Tracciato record Alloggiati Web: una riga a lunghezza fissa per ospite.
 *
 *   Tipo alloggiato          2   16 singolo, 17 capofamiglia, 18 capogruppo, 19 familiare, 20 membro gruppo
 *   Data arrivo             10   gg/mm/aaaa
 *   Giorni di permanenza     2   massimo 30
 *   Cognome                 50
 *   Nome                    30
 *   Sesso                    1   1 maschio, 2 femmina
 *   Data di nascita         10   gg/mm/aaaa
 *   Comune di nascita        9   codice; vuoto se nato all'estero
 *   Provincia di nascita     2   sigla; vuoto se nato all'estero
 *   Stato di nascita         9   codice
 *   Cittadinanza             9   codice
 *   Tipo documento           5   solo per 16, 17, 18
 *   Numero documento        20   solo per 16, 17, 18
 *   Luogo rilascio doc.      9   codice comune o stato; solo per 16, 17, 18
 *                          ---
 *                          168   (+ ID appartamento, 6, per gli account "gestione appartamenti")
 *
 * I codici di comuni, stati e documenti sono quelli delle tabelle ufficiali
 * scaricabili dal portale, importate nella tabella `alloggiati_codes`.
 */

export const RECORD_LENGTH = 168;

export type GuestRole = 16 | 17 | 18 | 19 | 20;

export interface CodeLookup {
  /** Codice comune Alloggiati per nome e provincia, null se non trovato. */
  comune(name: string, province: string | null): string | null;
  /** Codice stato Alloggiati per codice ISO alpha-3, null se non mappato. */
  stato(iso3: string): string | null;
}

export interface RecordIssue {
  guestId: string;
  guestName: string;
  field: string;
  message: string;
}

const DOCUMENT_CODES: Record<DocumentType, string | null> = {
  id_card: "IDENT",
  passport: "PASOR",
  driving_licence: "PATEN",
  other: null,
};

const ITALY = "ITA";
const MAX_DAYS = 30;

export function guestRole(party: PartyType, position: number, guestCount: number): GuestRole {
  if (guestCount <= 1 || party === "single") return position === 0 ? 16 : 20;
  if (party === "family") return position === 0 ? 17 : 19;
  return position === 0 ? 18 : 20;
}

export function stayDays(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.min(MAX_DAYS, Math.max(1, Math.round(ms / 86_400_000)));
}

function italianDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function field(value: string | null | undefined, length: number): string {
  const clean = (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase();
  return clean.slice(0, length).padEnd(length, " ");
}

export interface BuildResult {
  lines: string[];
  issues: RecordIssue[];
}

/** Costruisce le righe del tracciato per una prenotazione e segnala i dati mancanti. */
export function buildAlloggiatiRecords(
  booking: Pick<Booking, "check_in" | "check_out" | "party">,
  guests: Guest[],
  codes: CodeLookup,
  apartmentId?: string | null,
): BuildResult {
  const sorted = [...guests].sort((a, b) => a.position - b.position);
  const issues: RecordIssue[] = [];
  const days = stayDays(booking.check_in, booking.check_out);

  const lines = sorted.map((g, index) => {
    const name = `${g.first_name} ${g.last_name}`;
    const problem = (fieldName: string, message: string) =>
      issues.push({ guestId: g.id, guestName: name, field: fieldName, message });

    const role = guestRole(booking.party, index, sorted.length);
    const needsDocument = role === 16 || role === 17 || role === 18;

    if (!g.sex) problem("sex", "Sesso mancante");
    if (!g.birth_date) problem("birth_date", "Data di nascita mancante");
    if (!g.birth_country) problem("birth_country", "Stato di nascita mancante");
    if (!g.citizenship) problem("citizenship", "Cittadinanza mancante");

    let birthComune = "";
    let birthProvince = "";
    if (g.birth_country === ITALY) {
      birthProvince = g.birth_province ?? "";
      const code = g.birth_place ? codes.comune(g.birth_place, g.birth_province) : null;
      if (!code) problem("birth_place", `Comune di nascita non trovato: ${g.birth_place ?? "vuoto"}`);
      birthComune = code ?? "";
    }

    const birthState = g.birth_country ? codes.stato(g.birth_country) : null;
    if (g.birth_country && !birthState) problem("birth_country", `Codice stato mancante per ${g.birth_country}`);
    const citizenship = g.citizenship ? codes.stato(g.citizenship) : null;
    if (g.citizenship && !citizenship) problem("citizenship", `Codice stato mancante per ${g.citizenship}`);

    let docType = "";
    let docNumber = "";
    let docPlace = "";
    if (needsDocument) {
      docType = (g.document_type && DOCUMENT_CODES[g.document_type]) ?? "";
      if (!docType) problem("document_type", "Tipo documento mancante o non accettato");
      docNumber = g.document_number ?? "";
      if (!docNumber) problem("document_number", "Numero documento mancante");
      if (g.document_issue_country === ITALY) {
        const code = g.document_issue_place ? codes.comune(g.document_issue_place, null) : null;
        if (!code) problem("document_issue_place", `Comune di rilascio non trovato: ${g.document_issue_place ?? "vuoto"}`);
        docPlace = code ?? "";
      } else if (g.document_issue_country) {
        const code = codes.stato(g.document_issue_country);
        if (!code) problem("document_issue_country", `Codice stato mancante per ${g.document_issue_country}`);
        docPlace = code ?? "";
      } else {
        problem("document_issue_country", "Luogo di rilascio del documento mancante");
      }
    }

    const record =
      field(String(role), 2) +
      field(italianDate(booking.check_in), 10) +
      field(String(days).padStart(2, "0"), 2) +
      field(g.last_name, 50) +
      field(g.first_name, 30) +
      field(g.sex === "M" ? "1" : g.sex === "F" ? "2" : "", 1) +
      field(g.birth_date ? italianDate(g.birth_date) : "", 10) +
      field(birthComune, 9) +
      field(birthProvince, 2) +
      field(birthState, 9) +
      field(citizenship, 9) +
      field(docType, 5) +
      field(docNumber, 20) +
      field(docPlace, 9);

    return apartmentId ? record + field(apartmentId, 6) : record;
  });

  if (sorted.length === 0) {
    issues.push({ guestId: "", guestName: "", field: "guests", message: "Nessun ospite inserito" });
  }

  return { lines, issues };
}

export function toAlloggiatiFile(lines: string[]): string {
  return lines.join("\r\n") + "\r\n";
}

/** Normalizza un nome di comune o stato per il confronto con le tabelle ufficiali. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
