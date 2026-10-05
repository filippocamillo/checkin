-- Schema iniziale: appartamenti, prenotazioni, ospiti, invii agli enti.
-- Le foto dei documenti NON vengono mai salvate: si estraggono i dati e si scartano.

create extension if not exists pgcrypto;

create type booking_channel as enum ('airbnb', 'booking', 'direct', 'other');
create type booking_status as enum ('pending', 'in_progress', 'ready', 'registered', 'cancelled');
create type party_type as enum ('single', 'family', 'group');
create type document_type as enum ('passport', 'id_card', 'driving_licence', 'other');
create type sex as enum ('M', 'F');

-- Appartamenti -----------------------------------------------------------------

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  host_name text,                   -- locatore, come appare nel contratto
  host_tax_code text,
  address text,
  city text,
  province char(2),
  cin text,                         -- Codice Identificativo Nazionale
  check_in_time time default '15:00',
  check_out_time time default '10:00',
  -- Alloggiati Web: l'identificativo dell'appartamento se l'account gestisce più appartamenti
  alloggiati_apartment_id text,
  -- Tassa di soggiorno (usata nella fase 3)
  tax_rate_per_night numeric(6, 2),
  tax_max_nights int,
  tax_exempt_under_age int,
  -- Contratto: testo con segnaposto {{ospite_nome}}, {{check_in}}, ...
  contract_template text,
  -- Istruzioni per l'ospite, per lingua: {"it": "...", "en": "..."}
  guest_instructions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table ical_feeds (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  channel booking_channel not null,
  url text not null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

-- Prenotazioni -----------------------------------------------------------------

create table bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  channel booking_channel not null default 'direct',
  external_ref text,                -- codice prenotazione del portale
  ical_uid text,                    -- UID dell'evento iCal, per non duplicare
  check_in date not null,
  check_out date not null,
  adults int not null default 1,
  children int not null default 0,
  infants int not null default 0,
  party party_type not null default 'single',
  lead_name text,
  lead_email text,
  lead_phone text,
  total_amount numeric(10, 2),
  notes text,
  status booking_status not null default 'pending',
  guest_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  extraction_count int not null default 0,  -- limite di letture documento dal link ospite
  contract_accepted_at timestamptz,
  contract_accepted_name text,
  contract_accepted_ip text,
  contract_accepted_user_agent text,
  created_at timestamptz not null default now(),
  constraint bookings_dates check (check_out > check_in),
  constraint bookings_ical_unique unique (property_id, ical_uid)
);

create index bookings_property_dates on bookings (property_id, check_in);

-- Incrementa il contatore di letture e dice se il limite è ancora rispettato.
create function consume_extraction(p_booking_id uuid, p_limit int) returns boolean
language sql security definer set search_path = public as $$
  update bookings set extraction_count = extraction_count + 1
  where id = p_booking_id and extraction_count < p_limit
  returning true;
$$;
revoke execute on function consume_extraction(uuid, int) from public, anon, authenticated;
grant execute on function consume_extraction(uuid, int) to service_role;

-- Ospiti -----------------------------------------------------------------------

create table guests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  position int not null default 0,  -- 0 = capogruppo/capofamiglia/ospite singolo
  first_name text not null,
  last_name text not null,
  sex sex,
  birth_date date,
  birth_place text,                 -- comune (se nato in Italia) o città
  birth_province char(2),           -- solo per nati in Italia
  birth_country char(3),            -- ISO 3166-1 alpha-3
  citizenship char(3),              -- ISO 3166-1 alpha-3
  tax_code text,                    -- codice fiscale, se presente
  residence_address text,
  residence_city text,
  residence_country char(3),
  document_type document_type,
  document_number text,
  document_issue_place text,        -- comune di rilascio (documenti italiani)
  document_issue_country char(3),
  document_expiry date,
  extraction jsonb,                 -- esito estrazione: fonte (mrz/visione), confidenza, avvisi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guests_booking on guests (booking_id, position);

-- Invii a Questura (Alloggiati Web) e ISTAT --------------------------------------

create table submissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  kind text not null check (kind in ('alloggiati', 'istat')),
  payload text not null,
  status text not null default 'generated' check (status in ('generated', 'sent', 'accepted', 'rejected')),
  receipt text,
  created_at timestamptz not null default now()
);

-- Tabelle ufficiali Alloggiati Web (comuni, stati, documenti) ------------------
-- Si importano dai CSV scaricabili dal portale: vedi scripts/import-alloggiati-tables.mjs

create table alloggiati_codes (
  kind text not null check (kind in ('comune', 'stato', 'documento')),
  code text not null,
  name text not null,
  province char(2),
  valid_to date,
  primary key (kind, code)
);

create index alloggiati_codes_name on alloggiati_codes (kind, upper(name));

-- Corrispondenza ISO alpha-3 -> codice stato Alloggiati, completata dall'host
-- la prima volta che serve e poi riusata.
create table country_codes (
  iso3 char(3) primary key,
  alloggiati_code text not null
);

-- Sicurezza --------------------------------------------------------------------
-- L'host vede solo i propri appartamenti e ciò che ne dipende.
-- L'ospite non accede mai al database direttamente: passa dal server, che
-- verifica il token del link.

alter table properties enable row level security;
alter table ical_feeds enable row level security;
alter table bookings enable row level security;
alter table guests enable row level security;
alter table submissions enable row level security;
alter table alloggiati_codes enable row level security;
alter table country_codes enable row level security;

create policy "host owns properties" on properties
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "host owns feeds" on ical_feeds
  for all using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "host owns bookings" on bookings
  for all using (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "host owns guests" on guests
  for all using (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()))
  with check (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()));

create policy "host owns submissions" on submissions
  for all using (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()))
  with check (exists (
    select 1 from bookings b join properties p on p.id = b.property_id
    where b.id = booking_id and p.owner_id = auth.uid()));

create policy "authenticated read codes" on alloggiati_codes
  for select to authenticated using (true);

create policy "authenticated manage country codes" on country_codes
  for all to authenticated using (true) with check (true);
