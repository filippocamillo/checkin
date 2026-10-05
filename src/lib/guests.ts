import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Booking, BookingStatus, ExtractionInfo, Guest } from "@/lib/types";

const text = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const iso3 = text.refine((v) => v === null || /^[A-Z]{3}$/.test(v), "Paese non valido");
const date = text.refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data non valida");

export const GuestInput = z.object({
  first_name: z.string().trim().min(1, "Nome obbligatorio"),
  last_name: z.string().trim().min(1, "Cognome obbligatorio"),
  sex: z.enum(["M", "F"]).nullable().catch(null),
  birth_date: date,
  birth_place: text,
  birth_province: text.transform((v) => (v ? v.toUpperCase().slice(0, 2) : null)),
  birth_country: iso3,
  citizenship: iso3,
  tax_code: text.transform((v) => (v ? v.replace(/\s/g, "").toUpperCase() : null)),
  residence_address: text,
  residence_city: text,
  residence_country: iso3,
  document_type: z.enum(["passport", "id_card", "driving_licence", "other"]).nullable().catch(null),
  document_number: text.transform((v) => (v ? v.replace(/\s/g, "").toUpperCase() : null)),
  document_issue_place: text,
  document_issue_country: iso3,
  document_expiry: date,
});

export type GuestInputData = z.infer<typeof GuestInput>;

export function parseGuestForm(formData: FormData) {
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  return GuestInput.safeParse(raw);
}

/** Campi in più richiesti per il capogruppo (intestatario del contratto). */
export type LeadProblem = "residenceAddress" | "residenceCity" | "residenceCountry" | "taxCode" | "documentNumber";

export function leadGuestProblems(g: Pick<GuestInputData, "residence_address" | "residence_city" | "residence_country" | "citizenship" | "tax_code" | "document_number">): LeadProblem[] {
  const problems: LeadProblem[] = [];
  if (!g.residence_address) problems.push("residenceAddress");
  if (!g.residence_city) problems.push("residenceCity");
  if (!g.residence_country) problems.push("residenceCountry");
  if (g.citizenship === "ITA" && !g.tax_code) problems.push("taxCode");
  if (!g.document_number) problems.push("documentNumber");
  return problems;
}

export async function saveGuest(
  supabase: SupabaseClient,
  bookingId: string,
  guestId: string | null,
  data: GuestInputData,
  extraction: ExtractionInfo | null,
): Promise<{ id: string; position: number }> {
  if (guestId) {
    const { data: row, error } = await supabase
      .from("guests")
      .update({ ...data, ...(extraction ? { extraction } : {}), updated_at: new Date().toISOString() })
      .eq("id", guestId)
      .eq("booking_id", bookingId)
      .select("id, position")
      .single();
    if (error) throw error;
    return row;
  }

  const { data: last } = await supabase
    .from("guests")
    .select("position")
    .eq("booking_id", bookingId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = last ? last.position + 1 : 0;
  const { data: row, error } = await supabase
    .from("guests")
    .insert({ ...data, booking_id: bookingId, position, extraction })
    .select("id, position")
    .single();
  if (error) throw error;
  return row;
}

export function expectedGuests(b: Pick<Booking, "adults" | "children" | "infants">) {
  return b.adults + b.children + b.infants;
}

export function computeStatus(booking: Booking, guests: Guest[]): BookingStatus {
  if (booking.status === "cancelled" || booking.status === "registered") return booking.status;
  if (guests.length === 0) return "pending";
  const lead = guests.find((g) => g.position === 0);
  const leadOk = lead ? leadGuestProblems(lead).length === 0 : false;
  if (guests.length >= expectedGuests(booking) && leadOk && booking.contract_accepted_at) return "ready";
  return "in_progress";
}

/** Ricalcola e salva lo stato della prenotazione dopo una modifica. */
export async function refreshBookingStatus(supabase: SupabaseClient, bookingId: string) {
  const [{ data: booking }, { data: guests }] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", bookingId).single(),
    supabase.from("guests").select("*").eq("booking_id", bookingId),
  ]);
  if (!booking) return;
  const status = computeStatus(booking as Booking, (guests ?? []) as Guest[]);
  if (status !== booking.status) await supabase.from("bookings").update({ status }).eq("id", bookingId);
}
