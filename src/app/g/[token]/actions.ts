"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ExtractResult, SaveResult } from "@/components/guest-form";
import { extractFromForm, extractionFromForm } from "@/lib/document-actions";
import { expectedGuests, leadGuestProblems, parseGuestForm, refreshBookingStatus, saveGuest } from "@/lib/guests";
import { refreshAccess } from "@/lib/access";
import { dictionaries, type Lang } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IdentificationRequest } from "@/lib/types";
import { bookingForToken } from "./data";

export async function guestExtract(token: string, formData: FormData): Promise<ExtractResult> {
  const booking = await bookingForToken(token);
  if (!booking) return { ok: false, message: dictionaries.it.linkExpired };
  // Limita il numero di letture per link: ogni lettura ha un costo.
  const limit = expectedGuests(booking) * 3 + 5;
  const { data: allowed } = await createAdminClient().rpc("consume_extraction", { p_booking_id: booking.id, p_limit: limit });
  if (!allowed) return { ok: false, message: "Limite di foto raggiunto: inserisci i dati a mano / Photo limit reached: please type the details" };
  return extractFromForm(formData);
}

export async function guestSaveGuest(token: string, lang: Lang, guestId: string | null, formData: FormData): Promise<SaveResult> {
  const t = dictionaries[lang];
  const booking = await bookingForToken(token);
  if (!booking) return { ok: false, message: t.linkExpired };
  const parsed = parseGuestForm(formData);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? t.genericError };

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("guests").select("id, position").eq("booking_id", booking.id);
  const current = existing?.find((g) => g.id === guestId);
  if (guestId && !current) return { ok: false, message: t.genericError };
  if (!guestId && (existing?.length ?? 0) >= expectedGuests(booking) + 2) return { ok: false, message: t.genericError };

  const isLead = current ? current.position === 0 : (existing?.length ?? 0) === 0;
  if (isLead) {
    const missing = leadGuestProblems(parsed.data);
    if (missing.length) return { ok: false, message: t.missingForLead, missing };
  }

  try {
    await saveGuest(supabase, booking.id, guestId, parsed.data, extractionFromForm(formData));
  } catch {
    return { ok: false, message: t.genericError };
  }
  if (isLead) await supabase.from("bookings").update({ lead_name: `${parsed.data.first_name} ${parsed.data.last_name}` }).eq("id", booking.id);
  await refreshBookingStatus(supabase, booking.id);
  // Se è cambiato il documento il riconoscimento decade.
  await refreshAccess(booking.id);
  revalidatePath(`/g/${token}`);
  return { ok: true };
}

export async function acceptContract(token: string, fullName: string): Promise<{ ok: boolean }> {
  const booking = await bookingForToken(token);
  const name = fullName.trim();
  if (!booking || name.length < 3) return { ok: false };
  const h = await headers();
  const supabase = createAdminClient();
  await supabase
    .from("bookings")
    .update({
      contract_accepted_at: new Date().toISOString(),
      contract_accepted_name: name.slice(0, 200),
      contract_accepted_ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      contract_accepted_user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
    })
    .eq("id", booking.id)
    .is("contract_accepted_at", null);
  await refreshBookingStatus(supabase, booking.id);
  revalidatePath(`/g/${token}`);
  return { ok: true };
}

// Riconoscimento all'arrivo -----------------------------------------------------

export async function requestIdentification(token: string, mode: IdentificationRequest, slot: string | null): Promise<{ ok: boolean }> {
  const booking = await bookingForToken(token);
  if (!booking || booking.identified_at) return { ok: false };
  if (!["video_now", "video_slot", "in_person"].includes(mode)) return { ok: false };
  let slotAt: string | null = null;
  if (mode === "video_slot") {
    const d = slot ? new Date(slot) : null;
    if (!d || Number.isNaN(d.getTime())) return { ok: false };
    slotAt = d.toISOString();
  }
  await createAdminClient()
    .from("bookings")
    .update({
      identification_request: mode,
      identification_slot_at: slotAt,
      arrival_requested_at: mode === "video_now" ? new Date().toISOString() : booking.arrival_requested_at,
    })
    .eq("id", booking.id);
  revalidatePath(`/g/${token}`);
  return { ok: true };
}

/** Stato per la pagina dell'ospite: chiamata in arrivo dall'host e riconoscimento completato. */
export async function pollIdentification(token: string): Promise<{ call: { id: string; offer: string } | null; identified: boolean }> {
  const booking = await bookingForToken(token);
  if (!booking) return { call: null, identified: false };
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await createAdminClient()
    .from("calls")
    .select("id, offer")
    .eq("booking_id", booking.id)
    .is("ended_at", null)
    .is("answer", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { call: data ?? null, identified: !!booking.identified_at };
}

export async function answerCall(token: string, callId: string, answer: string): Promise<{ ok: boolean }> {
  const booking = await bookingForToken(token);
  if (!booking || answer.length > 30_000) return { ok: false };
  try {
    const d = JSON.parse(answer);
    if (d?.type !== "answer" || typeof d.sdp !== "string") return { ok: false };
  } catch {
    return { ok: false };
  }
  const { data } = await createAdminClient()
    .from("calls")
    .update({ answer })
    .eq("id", callId)
    .eq("booking_id", booking.id)
    .is("ended_at", null)
    .is("answer", null)
    .select("id")
    .maybeSingle();
  return { ok: !!data };
}

export async function callEnded(token: string, callId: string): Promise<{ ended: boolean }> {
  const booking = await bookingForToken(token);
  if (!booking) return { ended: true };
  const { data } = await createAdminClient().from("calls").select("ended_at").eq("id", callId).eq("booking_id", booking.id).maybeSingle();
  return { ended: !data || !!data.ended_at };
}

export async function hangUp(token: string, callId: string) {
  const booking = await bookingForToken(token);
  if (!booking) return;
  await createAdminClient().from("calls").update({ ended_at: new Date().toISOString() }).eq("id", callId).eq("booking_id", booking.id).is("ended_at", null);
}
