import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Client con chiave di servizio, ignora le RLS. Usarlo solo lato server per il
 * flusso ospite (dopo aver verificato il token) e per i job pianificati.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
