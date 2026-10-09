import { notFound } from "next/navigation";
import { iceServers } from "@/lib/ice";
import { currentIdentification } from "@/lib/identification";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Guest, Identification, Property } from "@/lib/types";
import { HostCall } from "./host-call";

export default async function CallPage({ params }: PageProps<"/host/bookings/[id]/call">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: booking }, { data: guestRows }, { data: identRows }] = await Promise.all([
    supabase.from("bookings").select("*, properties(name)").eq("id", id).maybeSingle(),
    supabase.from("guests").select("*").eq("booking_id", id).order("position"),
    supabase.from("identifications").select("*").eq("booking_id", id),
  ]);
  if (!booking) notFound();
  const b = booking as Booking & { properties: Pick<Property, "name"> };
  const guests = (guestRows ?? []) as Guest[];
  const idents = (identRows ?? []) as Identification[];

  return (
    <HostCall
      bookingId={b.id}
      title={`${b.lead_name ?? "Ospite"} · ${b.properties.name}`}
      guests={guests.map((g) => ({ guest: g, identifiedAt: currentIdentification(g, idents)?.verified_at ?? null }))}
      identifiedAt={b.identified_at}
      accessCode={b.access_code}
      accessCodeError={b.access_code_error}
      iceServers={iceServers()}
    />
  );
}
