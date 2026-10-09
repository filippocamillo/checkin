import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, PageHeader, Select, buttonClass } from "@/components/ui";
import { buildAlloggiatiRecords } from "@/lib/alloggiati";
import { loadCodeLookup } from "@/lib/alloggiati-codes";
import { countryName } from "@/lib/countries";
import { env } from "@/lib/env";
import { formatDate, nights } from "@/lib/format";
import { expectedGuests } from "@/lib/guests";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL_LABEL, type Booking, type Guest, type Identification, type Property } from "@/lib/types";
import { StatusBadge } from "../../status-badge";
import { setBookingStatus, setCountryCode, updateBooking } from "../actions";
import { BookingForm } from "../booking-form";
import { GuestLink } from "./guest-link";
import { HostGuests } from "./host-guests";
import { IdentificationPanel } from "./identification-panel";

export default async function BookingPage({ params }: PageProps<"/host/bookings/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: booking }, { data: guestRows }, { data: properties }, { data: identRows }] = await Promise.all([
    supabase.from("bookings").select("*, properties(*)").eq("id", id).maybeSingle(),
    supabase.from("guests").select("*").eq("booking_id", id).order("position"),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("identifications").select("*").eq("booking_id", id),
  ]);
  if (!booking) notFound();

  const b = booking as Booking & { properties: Property };
  const guests = (guestRows ?? []) as Guest[];
  const expected = expectedGuests(b);
  const codes = await loadCodeLookup(supabase, guests);
  const { issues } = buildAlloggiatiRecords(b, guests, codes, b.properties.alloggiati_apartment_id);

  // Paesi senza codice Alloggiati: si mappano una volta e restano salvati.
  const missingCountries = [
    ...new Set(
      guests.flatMap((g) => [g.birth_country, g.citizenship, g.document_issue_country !== "ITA" ? g.document_issue_country : null]).filter((c): c is string => !!c && !codes.stato(c)),
    ),
  ];
  const { data: stateCodes } = missingCountries.length
    ? await supabase.from("alloggiati_codes").select("code, name").eq("kind", "stato").is("valid_to", null).order("name")
    : { data: [] as { code: string; name: string }[] };

  const guestUrl = `${env.appUrl()}/g/${b.guest_token}`;

  return (
    <>
      <PageHeader
        title={b.lead_name || "Prenotazione"}
        subtitle={
          <>
            {b.properties.name} · {CHANNEL_LABEL[b.channel]}
            {b.external_ref ? ` · ${b.external_ref}` : ""} · {formatDate(b.check_in, { day: "numeric", month: "long" })} →{" "}
            {formatDate(b.check_out, { day: "numeric", month: "long" })} ({nights(b.check_in, b.check_out)} notti)
          </>
        }
        actions={<StatusBadge status={b.status} />}
      />

      {b.infants > 0 && (
        <Card className="mb-6 border-warn/40 bg-warn/10 text-sm">
          Ci sono {b.infants} neonati: ricordati di preparare la culla.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <h2 className="mb-3 font-semibold">Ospiti</h2>
            <HostGuests bookingId={b.id} guests={guests} expected={expected} />
          </section>

          <section>
            <h2 className="mb-3 font-semibold">Riconoscimento</h2>
            <IdentificationPanel booking={b} guests={guests} identifications={(identRows ?? []) as Identification[]} hasNuki={!!b.properties.nuki_smartlock_id} />
          </section>

          <section>
            <h2 className="mb-3 font-semibold">Alloggiati Web</h2>
            <Card className="flex flex-col gap-4">
              {issues.length === 0 ? (
                <p className="text-sm text-ok">Dati completi: il file è pronto da caricare sul portale.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {issues.map((i, n) => (
                    <li key={n} className="text-warn">
                      {i.guestName && <strong>{i.guestName}: </strong>}
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}

              {missingCountries.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <p className="text-sm text-fg-muted">
                    Abbina i paesi ai codici Alloggiati. Basta farlo una volta, poi vale per tutte le prenotazioni.
                    {!stateCodes?.length && " Prima importa le tabelle ufficiali (vedi README)."}
                  </p>
                  {missingCountries.map((iso) => (
                    <form key={iso} action={setCountryCode.bind(null, b.id)} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="iso3" value={iso} />
                      <span className="w-40 text-sm">{countryName(iso)}</span>
                      <Select name="code" required className="w-auto flex-1">
                        <option value="">Seleziona lo stato…</option>
                        {stateCodes?.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                      <Button variant="secondary">Salva</Button>
                    </form>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <a href={`/host/bookings/${b.id}/alloggiati`} className={buttonClass(issues.length ? "secondary" : "primary")} download>
                  Scarica file Alloggiati
                </a>
                {b.status !== "registered" ? (
                  <form action={setBookingStatus.bind(null, b.id, "registered")}>
                    <Button variant="secondary">Segna come registrata</Button>
                  </form>
                ) : (
                  <Badge tone="ok">Registrata</Badge>
                )}
              </div>
            </Card>
          </section>

          <details>
            <summary className="cursor-pointer font-semibold">Modifica prenotazione</summary>
            <div className="mt-3">
              <BookingForm properties={properties ?? []} booking={b} action={updateBooking.bind(null, b.id)} />
            </div>
          </details>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold">Link per l&apos;ospite</h2>
            <GuestLink url={guestUrl} propertyName={b.properties.name} phone={b.lead_phone} />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">Contratto</h2>
            {b.contract_accepted_at ? (
              <p className="text-sm">
                Accettato da <strong>{b.contract_accepted_name}</strong> il{" "}
                {new Date(b.contract_accepted_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
              </p>
            ) : (
              <p className="text-sm text-fg-muted">Non ancora accettato dall&apos;ospite.</p>
            )}
            <a href={`/host/bookings/${b.id}/contract`} className={buttonClass("secondary")} target="_blank">
              Apri PDF
            </a>
          </Card>

          <Card className="flex flex-col gap-2 text-sm">
            <h2 className="font-semibold">Riepilogo</h2>
            <p>
              {b.adults} adulti · {b.children} bambini · {b.infants} neonati
            </p>
            {b.total_amount != null && <p>Importo: € {b.total_amount.toFixed(2)}</p>}
            {b.lead_email && <p>{b.lead_email}</p>}
            {b.lead_phone && <p>{b.lead_phone}</p>}
            {b.notes && <p className="whitespace-pre-line text-fg-muted">{b.notes}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {b.status === "cancelled" ? (
                <form action={setBookingStatus.bind(null, b.id, "pending")}>
                  <Button variant="secondary">Ripristina</Button>
                </form>
              ) : (
                <form action={setBookingStatus.bind(null, b.id, "cancelled")}>
                  <Button variant="ghost">Segna come cancellata</Button>
                </form>
              )}
              <Link href="/host/bookings" className={buttonClass("ghost")}>
                Torna all&apos;elenco
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
