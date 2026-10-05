import { states } from "mrz";

/** Paesi per codice ISO alpha-3 (nomi in inglese), Italia in cima. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "ITA", name: "Italia" },
  ...Object.entries(states as Record<string, string>)
    .filter(([code]) => code !== "ITA" && /^[A-Z]{3}$/.test(code))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];

export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
