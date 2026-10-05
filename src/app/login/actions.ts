"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function sendMagicLink(_: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "/host");
  if (!email) return "Inserisci la tua email";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Solo gli host già registrati possono entrare: nessuna iscrizione libera.
      shouldCreateUser: false,
      emailRedirectTo: `${env.appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return "Non è stato possibile inviare il link. Controlla l'indirizzo.";
  redirect("/login?sent=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
