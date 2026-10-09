-- Riconoscimento degli ospiti (de visu, anche in videochiamata) e accesso
-- concesso solo dopo la verifica. Il video non viene mai registrato.

create type identification_method as enum ('video_call', 'in_person');

-- Registro dei riconoscimenti: chi ha verificato, quando, come e su quale documento.
-- Un riconoscimento vale finché il numero di documento dell'ospite non cambia.
create table identifications (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests (id) on delete cascade,
  booking_id uuid not null references bookings (id) on delete cascade,
  method identification_method not null,
  verified_by uuid not null default auth.uid() references auth.users (id),
  verified_at timestamptz not null default now(),
  document_type document_type,
  document_number text,
  revoked_at timestamptz
);

create index identifications_booking on identifications (booking_id);

-- Videochiamate: lo scambio WebRTC (offerta e risposta) passa dal server,
-- l'audio e il video vanno direttamente tra i due dispositivi.
create table calls (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  offer text not null,
  answer text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index calls_booking on calls (booking_id, created_at desc);

alter table bookings
  add column arrival_requested_at timestamptz,          -- l'ospite ha premuto "Sono arrivato"
  add column identification_request text
    check (identification_request in ('video_now', 'video_slot', 'in_person')),
  add column identification_slot_at timestamptz,        -- orario proposto per la videochiamata
  add column identified_at timestamptz,                 -- tutti gli ospiti riconosciuti
  add column access_code text,                          -- codice Nuki Keypad
  add column access_code_auth_id text,                  -- id dell'autorizzazione su Nuki Web
  add column access_code_error text;

-- Istruzioni d'ingresso, mostrate all'ospite solo dopo il riconoscimento.
alter table properties
  add column access_instructions jsonb not null default '{}'::jsonb,
  add column nuki_smartlock_id text;

-- Credenziali: nessuna policy, quindi le legge e scrive solo il server
-- (service role) dopo aver verificato che l'appartamento sia dell'host.
create table property_secrets (
  property_id uuid primary key references properties (id) on delete cascade,
  nuki_api_token text,
  updated_at timestamptz not null default now()
);

alter table identifications enable row level security;
alter table calls enable row level security;
alter table property_secrets enable row level security;

create policy "host owns identifications" on identifications
  for all using (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()))
  with check (verified_by = auth.uid() and exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()));

create policy "host owns calls" on calls
  for all using (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()))
  with check (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()));
