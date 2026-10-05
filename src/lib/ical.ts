import "server-only";
import ical from "node-ical";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingChannel, IcalFeed } from "@/lib/types";

export interface IcalBooking {
  uid: string;
  check_in: string;
  check_out: string;
  external_ref: string | null;
  notes: string | null;
}

type DateWithFlag = Date & { dateOnly?: boolean };

function toIsoDate(d: DateWithFlag): string {
  // Le date "solo giorno" sono create a mezzanotte locale: si leggono in locale.
  const y = d.dateOnly ? d.getFullYear() : d.getUTCFullYear();
  const m = (d.dateOnly ? d.getMonth() : d.getUTCMonth()) + 1;
  const day = d.dateOnly ? d.getDate() : d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Estrae le prenotazioni da un calendario iCal di Airbnb o Booking.
 * Airbnb distingue le prenotazioni ("Reserved") dai blocchi ("Not available");
 * Booking esporta tutto come "CLOSED - Not available", quindi si importa tutto.
 */
export function parseIcal(body: string, channel: BookingChannel): IcalBooking[] {
  const data = ical.sync.parseICS(body);
  const result: IcalBooking[] = [];

  for (const event of Object.values(data)) {
    if (!event || event.type !== "VEVENT" || !event.start || !event.end) continue;
    const summary = typeof event.summary === "string" ? event.summary : "";
    const description = typeof event.description === "string" ? event.description : "";

    if (channel === "airbnb" && /not available/i.test(summary)) continue;

    const ref =
      description.match(/reservations\/details\/([A-Z0-9]+)/i)?.[1] ??
      description.match(/\b(HM[A-Z0-9]{6,})\b/)?.[1] ??
      null;
    const phone = description.match(/Last 4 Digits\)?:\s*(\d{4})/i)?.[1];

    result.push({
      uid: event.uid,
      check_in: toIsoDate(event.start as DateWithFlag),
      check_out: toIsoDate(event.end as DateWithFlag),
      external_ref: ref,
      notes: phone ? `Telefono (ultime 4 cifre): ${phone}` : null,
    });
  }
  return result;
}

/** Scarica un calendario e allinea le prenotazioni future dell'appartamento. */
export async function syncFeed(supabase: SupabaseClient, feed: IcalFeed): Promise<{ added: number; cancelled: number }> {
  try {
    const res = await fetch(feed.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Download calendario fallito: HTTP ${res.status}`);
    const events = parseIcal(await res.text(), feed.channel);
    const today = new Date().toISOString().slice(0, 10);

    const upcoming = events.filter((e) => e.check_out >= today);
    let added = 0;
    if (upcoming.length) {
      const { data, error } = await supabase
        .from("bookings")
        .upsert(
          upcoming.map((e) => ({
            property_id: feed.property_id,
            channel: feed.channel,
            ical_uid: e.uid,
            check_in: e.check_in,
            check_out: e.check_out,
            external_ref: e.external_ref,
            notes: e.notes,
          })),
          { onConflict: "property_id,ical_uid", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      added = data?.length ?? 0;

      // Le date possono cambiare: si aggiornano senza toccare i dati inseriti dall'ospite.
      for (const e of upcoming) {
        await supabase
          .from("bookings")
          .update({ check_in: e.check_in, check_out: e.check_out })
          .eq("property_id", feed.property_id)
          .eq("ical_uid", e.uid);
      }
    }

    // Prenotazioni future sparite dal calendario: cancellate sul portale.
    const uids = events.map((e) => e.uid);
    let query = supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("property_id", feed.property_id)
      .eq("channel", feed.channel)
      .not("ical_uid", "is", null)
      .gte("check_in", today)
      .neq("status", "cancelled");
    if (uids.length) query = query.not("ical_uid", "in", `(${uids.map((u) => `"${u.replace(/"/g, "")}"`).join(",")})`);
    const { data: cancelled } = await query.select("id");

    await supabase.from("ical_feeds").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", feed.id);
    return { added, cancelled: cancelled?.length ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("ical_feeds").update({ last_error: message }).eq("id", feed.id);
    throw err;
  }
}
