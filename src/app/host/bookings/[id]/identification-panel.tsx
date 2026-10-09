import Link from "next/link";
import { Badge, Button, Card, buttonClass } from "@/components/ui";
import { currentIdentification } from "@/lib/identification";
import { IDENTIFICATION_METHOD_LABEL, type Booking, type Guest, type Identification } from "@/lib/types";
import { identifyGuest, retryAccessCode, revokeIdentification } from "./identification-actions";

function when(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Stato del riconoscimento per ospite, richieste dell'ospite e codice d'accesso. */
export function IdentificationPanel({ booking: b, guests, identifications, hasNuki }: { booking: Booking; guests: Guest[]; identifications: Identification[]; hasNuki: boolean }) {
  const request =
    b.identification_request === "video_now" && b.arrival_requested_at
      ? `L'ospite è arrivato (${when(b.arrival_requested_at)}) e aspetta la videochiamata.`
      : b.identification_request === "video_slot" && b.identification_slot_at
        ? `L'ospite ha chiesto la videochiamata per ${when(b.identification_slot_at)}.`
        : b.identification_request === "in_person"
          ? "L'ospite preferisce il riconoscimento di persona."
          : null;

  return (
    <Card className="flex flex-col gap-4">
      {request && !b.identified_at && <p className="rounded-xl bg-accent/10 p-3 text-sm">{request}</p>}

      {guests.length === 0 ? (
        <p className="text-sm text-fg-muted">Nessun ospite inserito.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {guests.map((g) => {
            const ident = currentIdentification(g, identifications);
            return (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">
                    {g.first_name} {g.last_name}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {ident
                      ? `Riconosciuto ${IDENTIFICATION_METHOD_LABEL[ident.method]} il ${when(ident.verified_at)} · documento ${ident.document_number}`
                      : g.document_number
                        ? "Da riconoscere"
                        : "Manca il numero del documento"}
                  </p>
                </div>
                {ident ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="ok">Riconosciuto</Badge>
                    <form action={revokeIdentification.bind(null, b.id, ident.id)}>
                      <Button variant="ghost" className="min-h-9 px-2 text-xs">
                        Annulla
                      </Button>
                    </form>
                  </div>
                ) : (
                  g.document_number && (
                    <div className="flex flex-wrap gap-2">
                      <form action={async () => { "use server"; await identifyGuest(b.id, g.id, "in_person"); }}>
                        <Button variant="secondary" className="min-h-9 text-xs">
                          Di persona
                        </Button>
                      </form>
                      <form action={async () => { "use server"; await identifyGuest(b.id, g.id, "video_call"); }}>
                        <Button variant="secondary" className="min-h-9 text-xs">
                          In videochiamata
                        </Button>
                      </form>
                    </div>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {b.identified_at ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <p className="text-ok">Tutti gli ospiti sono riconosciuti: l&apos;ospite vede le istruzioni d&apos;ingresso.</p>
          {b.access_code && (
            <p>
              Codice Nuki: <span className="font-mono font-semibold">{b.access_code}</span> (valido fino al check-out)
            </p>
          )}
          {b.access_code_error && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-danger">Codice Nuki non creato: {b.access_code_error}</span>
              <form action={retryAccessCode.bind(null, b.id)}>
                <Button variant="secondary" className="min-h-9 text-xs">
                  Riprova
                </Button>
              </form>
            </div>
          )}
          {!hasNuki && <p className="text-fg-muted">Nuki non è configurato per questo appartamento: nessun codice automatico.</p>}
        </div>
      ) : (
        <Link href={`/host/bookings/${b.id}/call`} className={buttonClass(b.identification_request === "video_now" ? "primary" : "secondary")}>
          Apri la videochiamata
        </Link>
      )}
    </Card>
  );
}
