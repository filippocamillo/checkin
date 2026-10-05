import "server-only";
import { extractDocument } from "@/lib/extract-document";
import type { ExtractResult } from "@/components/guest-form";
import type { ExtractionInfo } from "@/lib/types";

const MAX_BYTES = 6 * 1024 * 1024;

export async function extractFromForm(formData: FormData): Promise<ExtractResult> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, message: "Foto mancante" };
  if (photo.size > MAX_BYTES) return { ok: false, message: "Foto troppo grande" };
  const result = await extractDocument(Buffer.from(await photo.arrayBuffer()), photo.type || "image/jpeg");
  return result.ok ? { ok: true, data: result.data, info: result.info } : { ok: false, message: result.message };
}

export function extractionFromForm(formData: FormData): ExtractionInfo {
  try {
    const raw = JSON.parse(String(formData.get("extraction") ?? ""));
    return {
      source: raw.source === "mrz+vision" || raw.source === "vision" ? raw.source : "manual",
      mrz_valid: typeof raw.mrz_valid === "boolean" ? raw.mrz_valid : null,
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String).slice(0, 10) : [],
      extracted_at: String(raw.extracted_at ?? new Date().toISOString()),
    };
  } catch {
    return { source: "manual", mrz_valid: null, warnings: [], extracted_at: new Date().toISOString() };
  }
}
