import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { syncFeed } from "@/lib/ical";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IcalFeed } from "@/lib/types";

// Chiamato ogni ora dal cron (vercel.json) per importare le prenotazioni da tutti i calendari.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: feeds } = await supabase.from("ical_feeds").select("*");
  const results = await Promise.allSettled(((feeds ?? []) as IcalFeed[]).map((f) => syncFeed(supabase, f)));

  return NextResponse.json({
    feeds: results.length,
    failed: results.filter((r) => r.status === "rejected").length,
    added: results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.added : 0), 0),
  });
}
