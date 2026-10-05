import Link from "next/link";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { addDays, formatDate, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BookingCard, type BookingRow as Row } from "./booking-card";

export default async function TodayPage() {
  const supabase = await createClient();
  const today = todayIso();
  const { data } = await supabase
    .from("bookings")
    .select("*, properties(name), guests(count)")
    .neq("status", "cancelled")
    .lte("check_in", addDays(today, 14))
    .gte("check_out", today)
    .order("check_in");
  const rows = (data ?? []) as Row[];

  const arrivals = rows.filter((b) => b.check_in === today);
  const departures = rows.filter((b) => b.check_out === today);
  const toRegister = rows.filter((b) => b.check_in <= today && b.status !== "registered");
  const upcoming = rows.filter((b) => b.check_in > today);

  return (
    <>
      <PageHeader
        title="Oggi"
        subtitle={formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
        actions={<Link href="/host/bookings/new" className={buttonClass()}>Nuova prenotazione</Link>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Arrivi oggi" value={arrivals.length} />
        <Stat label="Partenze oggi" value={departures.length} />
        <Stat label="Da registrare in Questura" value={toRegister.length} tone={toRegister.length ? "warn" : undefined} />
      </div>

      {toRegister.length > 0 && <Section title="Da registrare (entro 24 ore dall'arrivo)" rows={toRegister} />}
      <Section title="Prossimi 14 giorni" rows={upcoming} empty="Nessun arrivo nei prossimi 14 giorni." />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card>
      <p className="text-sm text-fg-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone === "warn" ? "text-warn" : ""}`}>{value}</p>
    </Card>
  );
}

function Section({ title, rows, empty }: { title: string; rows: Row[]; empty?: string }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </section>
  );
}
