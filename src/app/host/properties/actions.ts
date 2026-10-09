"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncFeed } from "@/lib/ical";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BookingChannel, IcalFeed } from "@/lib/types";

function str(fd: FormData, key: string) {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

function num(fd: FormData, key: string) {
  const v = str(fd, key);
  return v === null ? null : Number(v.replace(",", "."));
}

function propertyFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Senza nome",
    host_name: str(fd, "host_name"),
    host_tax_code: str(fd, "host_tax_code")?.toUpperCase() ?? null,
    address: str(fd, "address"),
    city: str(fd, "city"),
    province: str(fd, "province")?.toUpperCase().slice(0, 2) ?? null,
    cin: str(fd, "cin"),
    check_in_time: str(fd, "check_in_time"),
    check_out_time: str(fd, "check_out_time"),
    alloggiati_apartment_id: str(fd, "alloggiati_apartment_id"),
    tax_rate_per_night: num(fd, "tax_rate_per_night"),
    tax_max_nights: num(fd, "tax_max_nights"),
    tax_exempt_under_age: num(fd, "tax_exempt_under_age"),
    contract_template: str(fd, "contract_template"),
    guest_instructions: { it: str(fd, "instructions_it") ?? "", en: str(fd, "instructions_en") ?? "" },
    access_instructions: { it: str(fd, "access_it") ?? "", en: str(fd, "access_en") ?? "" },
    nuki_smartlock_id: str(fd, "nuki_smartlock_id"),
  };
}

/** Il token Nuki si salva a parte, leggibile solo dal server. */
async function saveNukiToken(propertyId: string, fd: FormData) {
  const token = str(fd, "nuki_api_token");
  if (!token) return;
  const { error } = await createAdminClient()
    .from("property_secrets")
    .upsert({ property_id: propertyId, nuki_api_token: token, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").insert(propertyFields(formData)).select("id").single();
  if (error) throw error;
  await saveNukiToken(data.id, formData);
  redirect(`/host/properties/${data.id}`);
}

export async function updateProperty(id: string, formData: FormData) {
  const supabase = await createClient();
  // L'update passa dalle policy: se non restituisce la riga, l'appartamento non è dell'host.
  const { data, error } = await supabase.from("properties").update(propertyFields(formData)).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (data) await saveNukiToken(id, formData);
  revalidatePath(`/host/properties/${id}`);
}

export async function addFeed(propertyId: string, formData: FormData) {
  const url = str(formData, "url");
  const channel = (str(formData, "channel") ?? "other") as BookingChannel;
  if (!url || !/^https:\/\//.test(url)) return;
  const supabase = await createClient();
  const { data: feed, error } = await supabase
    .from("ical_feeds")
    .insert({ property_id: propertyId, url, channel })
    .select("*")
    .single();
  if (error) throw error;
  await syncFeed(supabase, feed as IcalFeed).catch(() => undefined);
  revalidatePath(`/host/properties/${propertyId}`);
}

export async function deleteFeed(propertyId: string, feedId: string) {
  const supabase = await createClient();
  await supabase.from("ical_feeds").delete().eq("id", feedId);
  revalidatePath(`/host/properties/${propertyId}`);
}

export async function syncFeedNow(propertyId: string, feedId: string) {
  const supabase = await createClient();
  const { data: feed } = await supabase.from("ical_feeds").select("*").eq("id", feedId).single();
  if (feed) await syncFeed(supabase, feed as IcalFeed).catch(() => undefined);
  revalidatePath(`/host/properties/${propertyId}`);
  revalidatePath("/host");
}
