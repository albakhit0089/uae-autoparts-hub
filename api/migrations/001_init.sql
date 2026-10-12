-- UAE AutoParts Hub — initial schema (PostgreSQL 14+ / Supabase)
-- Applied by scripts/migrate.py in filename order; each file runs once.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- reference data
create table makes (
  id          text primary key,
  name        text not null,
  name_ar     text not null,
  aliases     jsonb not null default '[]'
);

create table models (
  id          text primary key,              -- e.g. "mercedes-benz/c-class"
  make_id     text not null references makes(id) on delete cascade,
  slug        text not null,
  name        text not null,
  name_ar     text not null,
  aliases     jsonb not null default '[]',
  unique (make_id, slug)
);

create table generations (
  id          text primary key,              -- e.g. "mercedes-benz/c-class/W205"
  model_id    text not null references models(id) on delete cascade,
  code        text not null,
  year_from   int  not null,
  year_to     int  not null,
  check (year_to >= year_from)
);

create table variants (
  id            text primary key,
  generation_id text not null references generations(id) on delete cascade,
  name          text not null,
  engine_code   text not null,
  capacity_l    numeric(4,1),
  fuel          text not null default 'petrol',
  transmission  text,
  market_spec   text not null default 'Unknown' check (market_spec in ('GCC','Imported','Unknown')),
  source        text not null default 'seed',   -- seed | nhtsa | tecdoc | supplier
  external_ref  text
);
create index variants_engine_idx on variants(engine_code);

create table part_categories (
  id     text primary key,
  name   text not null,
  name_ar text not null
);

create table part_types (
  id              text primary key,
  category_id     text not null references part_categories(id),
  name            text not null,
  name_ar         text not null,
  synonyms        jsonb not null default '[]',
  safety_critical boolean not null default false
);

-- ---------------------------------------------------------------- accounts
create table users (
  id                text primary key default gen_random_uuid()::text,
  email             text not null unique,
  name              text not null,
  phone             text,
  role              text not null check (role in ('customer','supplier','admin')),
  password_hash     text not null,
  marketing_consent boolean not null default false,
  whatsapp_consent  boolean not null default false,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create table suppliers (
  id              text primary key default gen_random_uuid()::text,
  owner_id        text references users(id) on delete set null,
  name            text not null,
  name_ar         text,
  trade_licence   text not null,
  contact_name    text not null,
  phone           text not null default '',
  whatsapp        text not null default '',
  email           text not null,
  emirate         text not null,
  area            text not null,
  address         text not null,
  lat             double precision not null,
  lng             double precision not null,
  emirates_served jsonb not null default '[]',
  makes           jsonb not null default '[]',
  categories      jsonb not null default '[]',
  status          text not null default 'pending' check (status in ('pending','approved','suspended','rejected')),
  delivery        boolean not null default false,
  featured        boolean not null default false,
  plan            text not null default 'free',
  api_key_hash    text,
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index suppliers_emirate_idx on suppliers(emirate, area) where status = 'approved';

create table supplier_documents (
  id           text primary key default gen_random_uuid()::text,
  supplier_id  text not null references suppliers(id) on delete cascade,
  name         text not null,
  kind         text not null default 'other',
  size_kb      int not null default 0,
  storage_key  text,                       -- object-storage key; never public
  uploaded_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- inventory
create table parts (
  id             text primary key default gen_random_uuid()::text,
  supplier_id    text not null references suppliers(id) on delete cascade,
  sku            text,
  name           text not null,
  category_id    text not null references part_categories(id),
  part_type_id   text not null references part_types(id),
  oem            text,                      -- normalized (upper-case, no separators)
  make           text not null references makes(id),
  model          text not null,             -- model slug
  generation     text,
  year_from      int not null,
  year_to        int not null,
  engine         text,
  transmission   text,
  market_spec    text not null default 'Unknown',
  condition      text not null check (condition in ('used','tested','refurbished')),
  price          int not null check (price > 0),     -- AED, whole dirhams
  quantity       int not null default 1 check (quantity >= 0),
  warranty_days  int not null default 0 check (warranty_days between 0 and 730),
  emirate        text not null,
  area           text not null,
  description    text not null default '',
  donor_vehicle  text,
  status         text not null default 'available' check (status in ('available','reserved','sold')),
  fitment        text not null default 'likely' check (fitment in ('verified','likely','confirm')),
  moderation     text not null default 'approved' check (moderation in ('approved','pending','rejected')),
  featured       boolean not null default false,
  views          int not null default 0,
  source         text not null default 'dashboard' check (source in ('dashboard','csv','api','partner','sample')),
  is_sample      boolean not null default false,
  last_verified  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (year_to >= year_from)
);
create unique index parts_supplier_sku_uq on parts(supplier_id, sku) where sku is not null;
create index parts_search_idx on parts(make, model, part_type_id, emirate) where moderation = 'approved' and status <> 'sold';
create index parts_oem_idx on parts(oem) where oem is not null;
create index parts_text_trgm on parts using gin ((name || ' ' || description) gin_trgm_ops);

create table part_images (
  id          text primary key default gen_random_uuid()::text,
  part_id     text not null references parts(id) on delete cascade,
  url         text not null,               -- object-storage URL (or sample:<category>)
  position    int not null default 0,
  usage_rights text not null default 'supplier-owned'
);

-- Explicit fitment records (OEM catalogue / supplier-confirmed) beyond the listing's range.
create table part_compatibility (
  id          text primary key default gen_random_uuid()::text,
  part_id     text not null references parts(id) on delete cascade,
  variant_id  text references variants(id),
  make        text not null,
  model       text not null,
  year_from   int not null,
  year_to     int not null,
  engine      text,
  evidence    text not null check (evidence in ('oem-catalogue','supplier-confirmed','inferred')),
  created_at  timestamptz not null default now()
);

create table inventory_events (
  id          bigserial primary key,
  part_id     text not null references parts(id) on delete cascade,
  kind        text not null,               -- created | price | quantity | status | verified | deleted
  old_value   text,
  new_value   text,
  source      text not null,
  at          timestamptz not null default now()
);

-- Provenance for records received from partners / external sources (Method D).
create table external_records (
  id                  text primary key default gen_random_uuid()::text,
  source              text not null,
  external_id         text not null,
  part_id             text references parts(id) on delete set null,
  collected_at        timestamptz not null default now(),
  verification_status text not null default 'unverified',
  usage_rights        text not null,
  payload             jsonb not null default '{}',
  unique (source, external_id)
);

-- ---------------------------------------------------------------- marketplace
create table inquiries (
  id           text primary key default gen_random_uuid()::text,
  part_id      text not null references parts(id) on delete cascade,
  supplier_id  text not null references suppliers(id) on delete cascade,
  customer_id  text references users(id) on delete set null,
  guest_name   text,
  message      text not null,
  channel      text not null default 'whatsapp',
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index inquiries_supplier_idx on inquiries(supplier_id, created_at desc);

create table part_requests (
  id              text primary key default gen_random_uuid()::text,
  customer_id     text references users(id) on delete set null,
  contact_name    text not null,
  contact_phone   text not null,
  contact_email   text,
  contact_method  text not null default 'whatsapp',
  make            text not null,
  model           text not null,
  year            int not null,
  engine          text,
  part_type_id    text not null references part_types(id),
  part_text       text not null default '',
  oem             text,
  emirate         text not null,
  budget          int,
  description     text not null default '',
  images          jsonb not null default '[]',
  status          text not null default 'open' check (status in ('open','closed')),
  created_at      timestamptz not null default now()
);

create table request_matches (
  request_id   text not null references part_requests(id) on delete cascade,
  supplier_id  text not null references suppliers(id) on delete cascade,
  notified_at  timestamptz,
  primary key (request_id, supplier_id)
);

create table quotations (
  id             text primary key default gen_random_uuid()::text,
  request_id     text not null references part_requests(id) on delete cascade,
  supplier_id    text not null references suppliers(id) on delete cascade,
  price          int not null check (price > 0),
  availability   text not null,
  condition      text not null,
  warranty_days  int not null default 0,
  delivery_days  int not null default 0,
  note           text not null default '',
  images         jsonb not null default '[]',
  status         text not null default 'submitted' check (status in ('submitted','accepted','declined')),
  created_at     timestamptz not null default now(),
  unique (request_id, supplier_id)
);

create table saved_vehicles (
  id        text primary key default gen_random_uuid()::text,
  user_id   text not null references users(id) on delete cascade,
  make      text not null,
  model     text not null,
  year      int not null,
  engine    text,
  vin       text
);

create table favourites (
  user_id  text not null references users(id) on delete cascade,
  part_id  text not null references parts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, part_id)
);

create table reports (
  id           text primary key default gen_random_uuid()::text,
  part_id      text not null references parts(id) on delete cascade,
  reporter_id  text references users(id) on delete set null,
  reason       text not null,
  status       text not null default 'open',
  created_at   timestamptz not null default now()
);

create table import_jobs (
  id           text primary key default gen_random_uuid()::text,
  supplier_id  text not null references suppliers(id) on delete cascade,
  filename     text not null,
  total        int not null default 0,
  created      int not null default 0,
  updated      int not null default 0,
  duplicates   int not null default 0,
  errors       jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

create table plans (
  id              text primary key,
  name            text not null,
  price_aed       int not null default 0,
  listing_limit   int not null default 200,
  featured_slots  int not null default 0,
  active          boolean not null default false
);

create table search_events (
  id          bigserial primary key,
  query       text not null,
  parsed      jsonb not null default '{}',
  results     int not null default 0,
  created_at  timestamptz not null default now()
);

create table audit_logs (
  id         bigserial primary key,
  actor_id   text,
  action     text not null,
  target     text not null,
  meta       jsonb not null default '{}',
  at         timestamptz not null default now()
);
create index audit_logs_at_idx on audit_logs(at desc);
