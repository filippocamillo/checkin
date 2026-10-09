import type { Metadata } from "next";
import { headers } from "next/headers";
import { fillTemplate, DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contract";
import { expectedGuests, leadGuestProblems } from "@/lib/guests";
import { dictionaries } from "@/lib/i18n";
import { iceServers } from "@/lib/ice";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Guest } from "@/lib/types";
import { bookingForToken } from "./data";
import { GuestFlow } from "./guest-flow";

export const metadata: Metadata = { title: "Check-in", robots: { index: false, follow: false } };

export default async function GuestPage({ params }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const booking = await bookingForToken(token);

  if (!booking) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center px-5">
        <p className="text-center">
          {dictionaries.it.linkExpired}
          <br />
          <span className="text-fg-muted">{dictionaries.en.linkExpired}</span>
        </p>
      </main>
    );
  }

  const { data } = await createAdminClient().from("guests").select("*").eq("booking_id", booking.id).order("position");
  const guests = (data ?? []) as Guest[];
  const lead = guests.find((g) => g.position === 0) ?? null;
  const p = booking.properties;
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  const initialLang = acceptLanguage.toLowerCase().startsWith("it") ? "it" : "en";

  return (
    <GuestFlow
      token={token}
      initialLang={initialLang}
      property={{ name: p.name, city: p.city, checkInTime: p.check_in_time?.slice(0, 5) ?? null, instructions: p.guest_instructions ?? {} }}
      booking={{ checkIn: booking.check_in, checkOut: booking.check_out, expected: expectedGuests(booking), contractAcceptedAt: booking.contract_accepted_at }}
      guests={guests}
      leadComplete={!!lead && leadGuestProblems(lead).length === 0}
      contractText={fillTemplate(p.contract_template || DEFAULT_CONTRACT_TEMPLATE, { property: p, booking, lead })}
      identification={{
        identified: !!booking.identified_at,
        request: booking.identification_request,
        slotAt: booking.identification_slot_at,
        // Codice e istruzioni d'ingresso arrivano al browser solo dopo il riconoscimento.
        accessCode: booking.identified_at ? booking.access_code : null,
        accessInstructions: booking.identified_at ? (p.access_instructions ?? {}) : {},
        iceServers: iceServers(),
      }}
    />
  );
}
