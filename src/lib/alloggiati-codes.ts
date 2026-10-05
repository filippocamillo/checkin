import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName, type CodeLookup } from "@/lib/alloggiati";
import type { Guest } from "@/lib/types";

interface CodeRow {
  code: string;
  name: string;
  province: string | null;
  valid_to: string | null;
}

/**
 * Carica dal database solo i codici che servono per questi ospiti e restituisce
 * una lookup sincrona da passare a buildAlloggiatiRecords.
 * I nomi in `alloggiati_codes` sono salvati già normalizzati dallo script di import.
 */
export async function loadCodeLookup(supabase: SupabaseClient, guests: Guest[]): Promise<CodeLookup> {
  const comuneNames = new Set<string>();
  const isoCodes = new Set<string>();
  for (const g of guests) {
    if (g.birth_place) comuneNames.add(normalizeName(g.birth_place));
    if (g.document_issue_place) comuneNames.add(normalizeName(g.document_issue_place));
    for (const iso of [g.birth_country, g.citizenship, g.document_issue_country]) if (iso) isoCodes.add(iso);
  }

  const [comuni, countries] = await Promise.all([
    comuneNames.size
      ? supabase.from("alloggiati_codes").select("code, name, province, valid_to").eq("kind", "comune").in("name", [...comuneNames])
      : Promise.resolve({ data: [] as CodeRow[] }),
    isoCodes.size
      ? supabase.from("country_codes").select("iso3, alloggiati_code").in("iso3", [...isoCodes])
      : Promise.resolve({ data: [] as { iso3: string; alloggiati_code: string }[] }),
  ]);

  const comuneRows = (comuni.data ?? []) as CodeRow[];
  const stateByIso = new Map((countries.data ?? []).map((r) => [r.iso3, r.alloggiati_code]));

  return {
    comune(name, province) {
      const target = normalizeName(name);
      const matches = comuneRows.filter((r) => r.name === target && (!province || r.province === province));
      // Preferisce il comune ancora attivo rispetto a quelli soppressi.
      const active = matches.find((r) => !r.valid_to) ?? matches[0];
      return matches.length === 1 || (active && !active.valid_to) ? active.code : null;
    },
    stato(iso3) {
      return stateByIso.get(iso3) ?? null;
    },
  };
}
