import "server-only";
import { expectedGuests } from "@/lib/guests";
import { allIdentified } from "@/lib/identification";
import { createKeypadCode, romeToUtc } from "@/lib/nuki";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Guest, Identification, Property } from "@/lib/types";

/**
 * Da chiamare dopo ogni riconoscimento o revoca. Quando tutti gli ospiti sono
 * riconosciuti segna la prenotazione e, se l'appartamento ha Nuki, crea il codice
 * del Keypad valido fino al check-out. Prima di quel momento il codice non esiste.
 */
export async function refreshAccess(bookingId: string) {
  const supabase = createAdminClient();
  const [{ data: booking }, { data: guests }, { data: idents }] = await Promise.all([
    supabase.from("bookings").select("*, properties(*)").eq("id", bookingId).single(),
    supabase.from("guests").select("id, document_number").eq("booking_id", bookingId),
    supabase.from("identifications").select("*").eq("booking_id", bookingId),
  ]);
  if (!booking) return;
  const b = booking as Booking & { properties: Property };
  const done = allIdentified((guests ?? []) as Guest[], (idents ?? []) as Identification[], expectedGuests(b));

  if (!done) {
    if (b.identified_at) await supabase.from("bookings").update({ identified_at: null }).eq("id", b.id);
    return;
  }
  if (!b.identified_at) await supabase.from("bookings").update({ identified_at: new Date().toISOString() }).eq("id", b.id);
  if (b.access_code || !b.properties.nuki_smartlock_id) return;

  const { data: secret } = await supabase.from("property_secrets").select("nuki_api_token").eq("property_id", b.properties.id).maybeSingle();
  if (!secret?.nuki_api_token) {
    await supabase.from("bookings").update({ access_code_error: "Token Nuki Web non configurato" }).eq("id", b.id);
    return;
  }

  try {
    const surname = (b.lead_name ?? "Ospite").split(" ").pop() ?? "Ospite";
    const { code, authId } = await createKeypadCode({
      token: secret.nuki_api_token,
      smartlockId: b.properties.nuki_smartlock_id,
      name: `${b.check_in.slice(5)} ${surname}`,
      from: new Date(Date.now() - 5 * 60_000),
      // Un'ora di margine dopo l'orario di check-out.
      until: new Date(romeToUtc(b.check_out, b.properties.check_out_time?.slice(0, 5) ?? "10:00").getTime() + 3_600_000),
    });
    await supabase.from("bookings").update({ access_code: code, access_code_auth_id: authId, access_code_error: null }).eq("id", b.id);
  } catch (err) {
    console.error("Creazione codice Nuki fallita", err);
    await supabase
      .from("bookings")
      .update({ access_code_error: err instanceof Error ? err.message.slice(0, 300) : "Errore Nuki" })
      .eq("id", b.id);
  }
}
