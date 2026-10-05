import { NextResponse } from "next/server";
import { buildAlloggiatiRecords, toAlloggiatiFile } from "@/lib/alloggiati";
import { loadCodeLookup } from "@/lib/alloggiati-codes";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Guest, Property } from "@/lib/types";

export async function GET(_: Request, ctx: RouteContext<"/host/bookings/[id]/alloggiati">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const [{ data: booking }, { data: guests }] = await Promise.all([
    supabase.from("bookings").select("*, properties(*)").eq("id", id).maybeSingle(),
    supabase.from("guests").select("*").eq("booking_id", id).order("position"),
  ]);
  if (!booking) return new NextResponse("Non trovata", { status: 404 });

  const b = booking as Booking & { properties: Property };
  const list = (guests ?? []) as Guest[];
  const codes = await loadCodeLookup(supabase, list);
  const { lines } = buildAlloggiatiRecords(b, list, codes, b.properties.alloggiati_apartment_id);
  const file = toAlloggiatiFile(lines);

  await supabase.from("submissions").insert({ booking_id: id, kind: "alloggiati", payload: file });

  return new NextResponse(file, {
    headers: {
      "Content-Type": "text/plain; charset=windows-1252",
      "Content-Disposition": `attachment; filename="alloggiati-${b.check_in}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
