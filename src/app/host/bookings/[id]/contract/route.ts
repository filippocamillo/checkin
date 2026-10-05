import { NextResponse } from "next/server";
import { renderContractPdf } from "@/lib/contract";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Guest, Property } from "@/lib/types";

export async function GET(_: Request, ctx: RouteContext<"/host/bookings/[id]/contract">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const [{ data: booking }, { data: lead }] = await Promise.all([
    supabase.from("bookings").select("*, properties(*)").eq("id", id).maybeSingle(),
    supabase.from("guests").select("*").eq("booking_id", id).eq("position", 0).maybeSingle(),
  ]);
  if (!booking) return new NextResponse("Non trovata", { status: 404 });

  const b = booking as Booking & { properties: Property };
  const pdf = await renderContractPdf({ property: b.properties, booking: b, lead: lead as Guest | null });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contratto-${b.check_in}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
