import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { parseMrz } from "@/lib/mrz";
import type { ExtractedGuest, ExtractionInfo } from "@/lib/types";

const iso3 = z.string().nullable().describe("Codice paese ISO 3166-1 alpha-3, es. ITA, DEU, USA");
const isoDate = z.string().nullable().describe("Data in formato YYYY-MM-DD");

const DocumentSchema = z.object({
  is_identity_document: z.boolean().describe("true se l'immagine mostra un documento d'identità leggibile"),
  mrz_lines: z.array(z.string()).describe("Righe MRZ trascritte carattere per carattere, compresi i '<'. Vuoto se non presenti"),
  document_type: z.enum(["passport", "id_card", "driving_licence", "other"]).nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  sex: z.enum(["M", "F"]).nullable(),
  birth_date: isoDate,
  birth_place: z.string().nullable().describe("Città o comune di nascita come scritto sul documento"),
  birth_province: z.string().nullable().describe("Sigla provincia italiana di nascita, se indicata"),
  birth_country: iso3,
  citizenship: iso3,
  tax_code: z.string().nullable().describe("Codice fiscale italiano, se presente"),
  residence_address: z.string().nullable(),
  residence_city: z.string().nullable(),
  residence_country: iso3,
  document_number: z.string().nullable(),
  document_issue_place: z.string().nullable().describe("Comune o autorità di rilascio"),
  document_issue_country: iso3,
  document_expiry: isoDate,
  warnings: z.array(z.string()).describe("Problemi di leggibilità: riflessi, parti tagliate, sfocatura"),
});

const SYSTEM = `Estrai i dati anagrafici da foto di documenti d'identità (passaporti, carte d'identità, patenti) di qualunque paese.
Trascrivi solo ciò che leggi: se un campo non è visibile lascialo null, non dedurlo.
Le righe MRZ vanno copiate esattamente, perché vengono verificate con le cifre di controllo.
Nomi e luoghi vanno riportati con le lettere latine stampate sul documento.`;

export type ExtractionOutcome =
  | { ok: true; data: ExtractedGuest; info: ExtractionInfo }
  | { ok: false; reason: "not_a_document" | "unreadable" | "refused" | "error"; message: string };

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;
type AcceptedType = (typeof ACCEPTED)[number];

/**
 * Legge un documento da una foto. L'immagine resta solo in memoria durante la
 * chiamata e non viene salvata da nessuna parte.
 */
export async function extractDocument(image: Buffer, mediaType: string): Promise<ExtractionOutcome> {
  if (!ACCEPTED.includes(mediaType as AcceptedType)) {
    return { ok: false, reason: "error", message: "Formato immagine non supportato" };
  }

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(DocumentSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as AcceptedType, data: image.toString("base64") } },
            { type: "text", text: "Estrai i dati da questo documento." },
          ],
        },
      ],
    });
  } catch (err) {
    console.error("Estrazione documento fallita", err);
    return { ok: false, reason: "error", message: "Servizio di lettura non disponibile, riprova o inserisci i dati a mano" };
  }

  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "refused", message: "Non è stato possibile leggere il documento, inserisci i dati a mano" };
  }
  const parsed = response.parsed_output;
  if (!parsed) return { ok: false, reason: "unreadable", message: "Documento non leggibile, prova con una foto più nitida" };
  if (!parsed.is_identity_document) {
    return { ok: false, reason: "not_a_document", message: "La foto non sembra un documento d'identità" };
  }

  const { mrz_lines, warnings } = parsed;
  const mrz = mrz_lines.length ? parseMrz(mrz_lines) : null;

  // Se la MRZ supera le cifre di controllo, i suoi campi prevalgono sulla lettura visiva.
  const fromMrz = mrz?.valid ? Object.fromEntries(Object.entries(mrz.fields).filter(([, v]) => v)) : {};
  const merged: ExtractedGuest = {
    first_name: parsed.first_name,
    last_name: parsed.last_name,
    sex: parsed.sex,
    birth_date: parsed.birth_date,
    birth_place: parsed.birth_place,
    birth_province: parsed.birth_province,
    birth_country: parsed.birth_country,
    citizenship: parsed.citizenship,
    tax_code: parsed.tax_code,
    residence_address: parsed.residence_address,
    residence_city: parsed.residence_city,
    residence_country: parsed.residence_country,
    document_type: parsed.document_type,
    document_number: parsed.document_number,
    document_issue_place: parsed.document_issue_place,
    document_issue_country: parsed.document_issue_country,
    document_expiry: parsed.document_expiry,
    ...fromMrz,
  };
  if (mrz && !mrz.valid) {
    warnings.push("Le cifre di controllo della MRZ non tornano: verificare i dati");
  }
  if (merged.tax_code) merged.tax_code = merged.tax_code.replace(/\s/g, "").toUpperCase();
  if (merged.birth_province) merged.birth_province = merged.birth_province.toUpperCase().slice(0, 2);

  return {
    ok: true,
    data: merged,
    info: {
      source: mrz?.valid ? "mrz+vision" : "vision",
      mrz_valid: mrz ? mrz.valid : null,
      warnings,
      extracted_at: new Date().toISOString(),
    },
  };
}
