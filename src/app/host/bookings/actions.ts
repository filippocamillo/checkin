"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ExtractResult, SaveResult } from "@/components/guest-form";
import { extractFromForm, extractionFromForm } from "@/lib/document-actions";
import { parseGuestForm, refreshBookingStatus, saveGuest } from "@/lib/guests";
import { createClient } from "@/lib/supabase/server";
import type { BookingChannel, PartyType } from "@/lib/types";

function str(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function bookingFields(fd: FormData) {
  const int = (k: string, d: number) => Math.max(0, Number(str(fd, k) ?? d) || 0);
  const amount = str(fd, "total_amount");
  return {
    property_id: str(fd, "property_id")!,
    channel: (str(fd, "channel") ?? "direct") as BookingChannel,
    external_ref: str(fd, "external_ref"),
    check_in: str(fd, "check_in")!,
    check_out: str(fd, "check_out")!,
    adults: Math.max(1, int("adults", 1)),
    children: int("children", 0),
    infants: int("infants", 0),
    party: (str(fd, "party") ?? "single") as PartyType,
    lead_name: str(fd, "lead_name"),
    lead_email: str(fd, "lead_email"),
    lead_phone: str(fd, "lead_phone"),
    total_amount: amount ? Number(amount.replace(",", ".")) : null,
    notes: str(fd, "notes"),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function createBooking(formData: FormData) {
  const supabase = await requireUser();
  const { data, error } = await supabase.from("bookings").insert(bookingFields(formData)).select("id").single();
  if (error) throw error;
  redirect(`/host/bookings/${data.id}`);
}

export async function updateBooking(id: string, formData: FormData) {
  const supabase = await requireUser();
  const { error } = await supabase.from("bookings").update(bookingFields(formData)).eq("id", id);
  if (error) throw error;
  await refreshBookingStatus(supabase, id);
  revalidatePath(`/host/bookings/${id}`);
}

export async function setBookingStatus(id: string, status: "registered" | "cancelled" | "pending") {
  const supabase = await requireUser();
  await supabase.from("bookings").update({ status }).eq("id", id);
  if (status === "pending") await refreshBookingStatus(supabase, id);
  revalidatePath(`/host/bookings/${id}`);
  revalidatePath("/host");
}

export async function hostExtract(formData: FormData): Promise<ExtractResult> {
  await requireUser();
  return extractFromForm(formData);
}

export async function hostSaveGuest(bookingId: string, guestId: string | null, formData: FormData): Promise<SaveResult> {
  const supabase = await requireUser();
  const parsed = parseGuestForm(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dati non validi" };
  try {
    await saveGuest(supabase, bookingId, guestId, parsed.data, guestId ? null : extractionFromForm(formData));
  } catch {
    return { ok: false, message: "Salvataggio non riuscito" };
  }
  // Il nome dell'intestatario serve negli elenchi.
  const { data: lead } = await supabase.from("guests").select("first_name, last_name").eq("booking_id", bookingId).eq("position", 0).maybeSingle();
  if (lead) await supabase.from("bookings").update({ lead_name: `${lead.first_name} ${lead.last_name}` }).eq("id", bookingId);
  await refreshBookingStatus(supabase, bookingId);
  revalidatePath(`/host/bookings/${bookingId}`);
  return { ok: true };
}

export async function deleteGuest(bookingId: string, guestId: string) {
  const supabase = await requireUser();
  await supabase.from("guests").delete().eq("id", guestId).eq("booking_id", bookingId);
  // Le posizioni restano compatte: il primo ospite rimasto diventa l'intestatario.
  const { data: rest } = await supabase.from("guests").select("id").eq("booking_id", bookingId).order("position");
  for (const [i, g] of (rest ?? []).entries()) await supabase.from("guests").update({ position: i }).eq("id", g.id);
  await refreshBookingStatus(supabase, bookingId);
  revalidatePath(`/host/bookings/${bookingId}`);
}

export async function setCountryCode(bookingId: string, formData: FormData) {
  const supabase = await requireUser();
  const iso3 = str(formData, "iso3");
  const code = str(formData, "code");
  if (iso3 && code) await supabase.from("country_codes").upsert({ iso3, alloggiati_code: code });
  revalidatePath(`/host/bookings/${bookingId}`);
}
