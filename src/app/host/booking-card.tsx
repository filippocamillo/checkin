import Link from "next/link";
import { Card } from "@/components/ui";
import { formatDate, nights } from "@/lib/format";
import { CHANNEL_LABEL, type Booking, type Property } from "@/lib/types";
import { StatusBadge } from "./status-badge";

export type BookingRow = Booking & { properties: Pick<Property, "name"> | null; guests: { count: number }[] };

/** Riga di elenco: usare con select("*, properties(name), guests(count)"). */
export function BookingCard({ b }: { b: BookingRow }) {
  const total = b.adults + b.children + b.infants;
  return (
    <Link href={`/host/bookings/${b.id}`} className="block">
      <Card className="transition hover:border-accent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{b.lead_name || "Ospite da identificare"}</p>
            <p className="text-sm text-fg-muted">
              {b.properties?.name} · {CHANNEL_LABEL[b.channel]}
            </p>
          </div>
          <StatusBadge status={b.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            {formatDate(b.check_in)} → {formatDate(b.check_out)} ({nights(b.check_in, b.check_out)} notti)
          </span>
          <span className="text-fg-muted">
            {b.guests[0]?.count ?? 0}/{total} ospiti
          </span>
          {b.infants > 0 && <span className="text-warn">Neonato: prepara la culla</span>}
        </div>
      </Card>
    </Link>
  );
}
