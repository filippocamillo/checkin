import "server-only";
import { addDays, todayIso } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Property } from "@/lib/types";

export type GuestBooking = Booking & { properties: Property };

/**
 * Il token del link è l'unica credenziale dell'ospite: vale solo per prenotazioni
 * non cancellate e fino al giorno dopo la partenza.
 */
export async function bookingForToken(token: string): Promise<GuestBooking | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("bookings").select("*, properties(*)").eq("guest_token", token).maybeSingle();
  if (!data) return null;
  const booking = data as GuestBooking;
  if (booking.status === "cancelled") return null;
  if (addDays(booking.check_out, 1) < todayIso()) return null;
  return booking;
}
