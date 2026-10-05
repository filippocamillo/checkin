"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ExtractResult, SaveResult } from "@/components/guest-form";
import { extractFromForm, extractionFromForm } from "@/lib/document-actions";
import { expectedGuests, leadGuestProblems, parseGuestForm, refreshBookingStatus, saveGuest } from "@/lib/guests";
import { dictionaries, type Lang } from "@/lib/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
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
