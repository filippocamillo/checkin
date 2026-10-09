"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import type { IdentificationMethod } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

const SDP_MAX = 30_000;

function validSdp(text: string, type: "offer" | "answer") {
  if (text.length > SDP_MAX) return false;
  try {
    const d = JSON.parse(text);
    return d?.type === type && typeof d.sdp === "string";
  } catch {
    return false;
  }
}

function revalidate(bookingId: string) {
  revalidatePath(`/host/bookings/${bookingId}`);
  revalidatePath(`/host/bookings/${bookingId}/call`);
  revalidatePath("/host");
}

/** Segna un ospite come riconosciuto (in videochiamata o di persona). */
export async function identifyGuest(bookingId: string, guestId: string, method: IdentificationMethod) {
  const supabase = await requireUser();
  const { data: guest } = await supabase
    .from("guests")
    .select("id, document_type, document_number")
    .eq("id", guestId)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!guest) return { ok: false, message: "Ospite non trovato" };
  if (!guest.document_number) return { ok: false, message: "Prima inserisci il numero del documento" };
  const { error } = await supabase.from("identifications").insert({
    guest_id: guest.id,
    booking_id: bookingId,
    method: method === "in_person" ? "in_person" : "video_call",
    document_type: guest.document_type,
    document_number: guest.document_number,
  });
  if (error) return { ok: false, message: "Salvataggio non riuscito" };
  await refreshAccess(bookingId);
  revalidate(bookingId);
  return { ok: true };
}

export async function revokeIdentification(bookingId: string, identificationId: string) {
  const supabase = await requireUser();
  await supabase.from("identifications").update({ revoked_at: new Date().toISOString() }).eq("id", identificationId).eq("booking_id", bookingId);
  await refreshAccess(bookingId);
  revalidate(bookingId);
}

/** Riprova a creare il codice Nuki dopo un errore (es. token sbagliato, serratura offline). */
export async function retryAccessCode(bookingId: string) {
  const supabase = await requireUser();
  const { data } = await supabase.from("bookings").update({ access_code_error: null }).eq("id", bookingId).select("id").maybeSingle();
  if (data) await refreshAccess(bookingId);
  revalidate(bookingId);
}

// Videochiamata ------------------------------------------------------------------

export async function startCall(bookingId: string, offer: string): Promise<{ ok: true; callId: string } | { ok: false }> {
  const supabase = await requireUser();
  if (!validSdp(offer, "offer")) return { ok: false };
  // Una sola chiamata aperta per prenotazione: le precedenti si chiudono.
  await supabase.from("calls").update({ ended_at: new Date().toISOString() }).eq("booking_id", bookingId).is("ended_at", null);
  const { data, error } = await supabase.from("calls").insert({ booking_id: bookingId, offer }).select("id").single();
  if (error || !data) return { ok: false };
  return { ok: true, callId: data.id };
}

export async function pollCall(callId: string): Promise<{ answer: string | null; ended: boolean }> {
  const supabase = await requireUser();
  const { data } = await supabase.from("calls").select("answer, ended_at").eq("id", callId).maybeSingle();
  return { answer: data?.answer ?? null, ended: !data || !!data.ended_at };
}

export async function endCall(callId: string) {
  const supabase = await requireUser();
  await supabase.from("calls").update({ ended_at: new Date().toISOString() }).eq("id", callId).is("ended_at", null);
}

/** Ospiti arrivati che aspettano la videochiamata: alimenta l'avviso nell'area host. */
export async function pendingArrivals(): Promise<{ id: string; name: string; property: string; at: string }[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { data } = await supabase
    .from("bookings")
    .select("id, lead_name, arrival_requested_at, properties(name)")
    .eq("identification_request", "video_now")
    .is("identified_at", null)
    .gte("arrival_requested_at", since)
    .neq("status", "cancelled")
    .order("arrival_requested_at");
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.lead_name ?? "Ospite",
    property: (b.properties as unknown as { name: string } | null)?.name ?? "",
    at: b.arrival_requested_at!,
  }));
}
