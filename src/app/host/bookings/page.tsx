import Link from "next/link";
import { PageHeader, buttonClass, cx } from "@/components/ui";
import { todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BookingCard, type BookingRow } from "../booking-card";

export default async function BookingsPage({ searchParams }: PageProps<"/host/bookings">) {
  const params = await searchParams;
  const view = params.view === "past" ? "past" : "upcoming";
  const propertyId = typeof params.property === "string" ? params.property : null;
  const supabase = await createClient();
  const today = todayIso();

  let query = supabase.from("bookings").select("*, properties(name), guests(count)");
  query = view === "past" ? query.lt("check_out", today).order("check_in", { ascending: false }).limit(100) : query.gte("check_out", today).order("check_in");
  if (propertyId) query = query.eq("property_id", propertyId);

  const [{ data }, { data: properties }] = await Promise.all([query, supabase.from("properties").select("id, name").order("name")]);
  const rows = (data ?? []) as BookingRow[];

  const tab = (v: string, label: string) => (
    <Link
      href={{ query: { view: v, ...(propertyId ? { property: propertyId } : {}) } }}
      className={cx("rounded-xl px-3 py-2 text-sm", view === v ? "bg-surface font-semibold shadow-sm" : "text-fg-muted")}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Prenotazioni" actions={<Link href="/host/bookings/new" className={buttonClass()}>Nuova</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-2xl bg-muted p-1">
          {tab("upcoming", "In arrivo")}
          {tab("past", "Passate")}
        </div>
        {(properties?.length ?? 0) > 1 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={{ query: { view } }} className={cx("rounded-full border border-line px-3 py-1.5", !propertyId && "border-accent text-accent")}>
              Tutti
            </Link>
            {properties!.map((p) => (
              <Link
                key={p.id}
                href={{ query: { view, property: p.id } }}
                className={cx("rounded-full border border-line px-3 py-1.5", propertyId === p.id && "border-accent text-accent")}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">Nessuna prenotazione.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </>
  );
}
