import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createBooking } from "../actions";
import { BookingForm } from "../booking-form";

export default async function NewBookingPage() {
  const supabase = await createClient();
  const { data: properties } = await supabase.from("properties").select("id, name").order("name");
  if (!properties?.length) redirect("/host/properties?new=1");
  return (
    <>
      <PageHeader title="Nuova prenotazione" subtitle="Per le prenotazioni dirette o non arrivate dal calendario" />
      <BookingForm properties={properties} action={createBooking} submitLabel="Crea prenotazione" />
    </>
  );
}
