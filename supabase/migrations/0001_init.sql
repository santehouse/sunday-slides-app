-- Church Panels — initial schema
-- Single-tenant MVP. RLS is enabled on every table; admins (auth.users with an admin_users row)
-- get full access; the Sunday team never talks to Supabase directly (server routes use the service role).

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type admin_role as enum ('owner', 'admin');
create type sunday_status as enum ('draft', 'needs_review', 'ready', 'exported');
create type run_sheet_source as enum ('email', 'manual');
create type run_sheet_parse_status as enum ('queued', 'processing', 'ready_to_apply', 'added_to_flow', 'needs_review', 'failed');
create type template_status as enum ('draft', 'published', 'archived');
create type template_category as enum ('general', 'events', 'special', 'giving', 'welcome', 'theme', 'closing');
create type background_type as enum ('color', 'image');
create type overlay_color as enum ('none', 'black', 'white');
create type text_alignment as enum ('left', 'center', 'right');
create type overflow_mode as enum ('fixed', 'auto_fit', 'flex_height');
create type font_style as enum ('normal', 'italic');
create type asset_status as enum ('draft', 'published', 'archived');
create type asset_category as enum ('photography', 'backgrounds', 'special');
create type font_source as enum ('google', 'custom');
create type slide_status as enum ('ready', 'needs_review', 'invalid');
create type slide_background_mode as enum ('color', 'image');
create type structural_insertion_rule as enum ('always', 'default', 'manual');
create type structural_sort_zone as enum ('opening', 'before_announcements', 'after_announcements', 'closing');
create type export_type as enum ('jpg', 'jpg_zip', 'mp4');
create type export_status as enum ('queued', 'processing', 'complete', 'failed');

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- admin users ----------
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  role admin_role not null default 'admin',
  locale text not null default 'en' check (locale in ('en','fr-CA')),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a where a.auth_user_id = auth.uid() and a.disabled_at is null
  );
$$;

-- ---------- settings (single row) ----------
create table app_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  church_name text not null default 'Church Panels',
  timezone text not null default 'America/Toronto',
  default_locale text not null default 'en' check (default_locale in ('en','fr-CA')),
  sunday_pin_hash text,
  sunday_pin_length integer not null default 4 check (sunday_pin_length between 4 and 8),
  /* bumping this invalidates every Sunday session cookie */
  sunday_pin_version integer not null default 1,
  default_slide_hold_seconds integer not null default 5 check (default_slide_hold_seconds between 1 and 30),
  inbound_email text,
  auto_process_inbound boolean not null default true,
  pip_x integer not null default 96,
  pip_y integer not null default 640,
  pip_width integer not null default 640,
  pip_height integer not null default 360,
  temporary_retention_days integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated before update on app_settings for each row execute function set_updated_at();

-- ---------- fonts ----------
create table fonts (
  id uuid primary key default gen_random_uuid(),
  family text not null,
  source font_source not null,
  source_identifier text,
  r2_key text,
  weight integer not null default 400,
  style font_style not null default 'normal',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (family, weight, style)
);

-- ---------- approved colors ----------
create table approved_colors (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_fr text not null,
  hex text not null check (hex ~* '^#[0-9a-f]{6}$'),
  enabled boolean not null default true,
  sort_order integer not null default 0
);

-- ---------- assets ----------
create table assets (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_fr text not null,
  status asset_status not null default 'draft',
  category asset_category not null default 'photography',
  tags text[] not null default '{}',
  r2_key text not null,
  mime_type text not null,
  width integer not null,
  height integer not null,
  focal_x numeric not null default 0.5 check (focal_x between 0 and 1),
  focal_y numeric not null default 0.5 check (focal_y between 0 and 1),
  crop_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger assets_updated before update on assets for each row execute function set_updated_at();

-- ---------- templates ----------
create table templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  category template_category not null default 'general',
  status template_status not null default 'draft',
  renderer_key text not null default 'generic-v1',
  background_type background_type not null default 'color',
  background_value text not null default '#0f172a',
  overlay_color overlay_color not null default 'none',
  overlay_opacity numeric not null default 0 check (overlay_opacity between 0 and 1),
  include_in_video_default boolean not null default true,
  allow_team_background_choice boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger templates_updated before update on templates for each row execute function set_updated_at();

create table template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  field_key text not null,
  field_type text not null default 'text',
  label_en text not null,
  label_fr text not null,
  team_editable boolean not null default true,
  required boolean not null default false,
  x integer not null default 96,
  y integer not null default 96,
  width integer not null default 1200,
  height integer not null default 200,
  font_id uuid references fonts(id) on delete set null,
  font_family text not null default 'Arimo',
  font_size integer not null default 96,
  min_font_size integer not null default 48,
  font_weight integer not null default 700,
  font_style font_style not null default 'normal',
  line_height numeric not null default 1.1,
  letter_spacing numeric not null default 0,
  alignment text_alignment not null default 'left',
  text_color text not null default '#ffffff',
  max_lines integer not null default 2,
  overflow_mode overflow_mode not null default 'auto_fit',
  text_transform text not null default 'none' check (text_transform in ('none','uppercase')),
  sort_order integer not null default 0,
  unique (template_id, field_key)
);

create table template_assets (
  template_id uuid not null references templates(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  primary key (template_id, asset_id)
);

-- ---------- mappings ----------
create table announcement_mappings (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  canonical_key text not null unique,
  template_id uuid not null references templates(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mappings_updated before update on announcement_mappings for each row execute function set_updated_at();

create table announcement_aliases (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references announcement_mappings(id) on delete cascade,
  alias text not null,
  /* normalized (lowercase, accents stripped) — used for matching */
  alias_normalized text not null,
  locale text check (locale in ('en','fr-CA')),
  unique (mapping_id, alias_normalized)
);
create index on announcement_aliases (alias_normalized);

-- suggestions for unmapped announcements seen in run sheets
create table mapping_suggestions (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  source_text_normalized text not null unique,
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1,
  dismissed_at timestamptz
);

-- ---------- default structural slides ----------
create table default_structural_slides (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete restrict,
  name_en text not null,
  name_fr text not null,
  insertion_rule structural_insertion_rule not null default 'default',
  default_sort_zone structural_sort_zone not null default 'opening',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  removable_by_sunday_team boolean not null default true,
  include_in_video_default boolean not null default true,
  default_content jsonb not null default '{}'::jsonb
);

-- ---------- sundays + run sheets ----------
create table sundays (
  id uuid primary key default gen_random_uuid(),
  service_date date not null unique,
  status sunday_status not null default 'draft',
  source_run_sheet_id uuid,
  default_slide_hold_seconds integer not null default 5 check (default_slide_hold_seconds between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sundays_updated before update on sundays for each row execute function set_updated_at();

create table run_sheets (
  id uuid primary key default gen_random_uuid(),
  sunday_id uuid not null references sundays(id) on delete cascade,
  source_type run_sheet_source not null,
  original_filename text not null,
  mime_type text not null,
  r2_key text not null,
  extracted_text text,
  parse_status run_sheet_parse_status not null default 'queued',
  parse_error text,
  parsed_json jsonb,
  /* raw model output kept for debugging */
  model_output jsonb,
  /* dedupe key for inbound email events */
  inbound_event_id text unique,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index on run_sheets (sunday_id, received_at desc);
alter table sundays add constraint sundays_source_run_sheet_fk
  foreign key (source_run_sheet_id) references run_sheets(id) on delete set null;

-- ---------- slides ----------
create table slides (
  id uuid primary key default gen_random_uuid(),
  sunday_id uuid not null references sundays(id) on delete cascade,
  template_id uuid not null references templates(id) on delete restrict,
  headline text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  asset_id uuid references assets(id) on delete set null,
  background_mode slide_background_mode not null default 'color',
  approved_color_id uuid references approved_colors(id) on delete set null,
  sort_order integer not null default 0,
  include_in_video boolean not null default true,
  status slide_status not null default 'ready',
  is_structural boolean not null default false,
  structural_default_id uuid references default_structural_slides(id) on delete set null,
  parser_confidence numeric,
  mapping_id uuid references announcement_mappings(id) on delete set null,
  source_announcement_json jsonb,
  manually_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on slides (sunday_id, sort_order);
create trigger slides_updated before update on slides for each row execute function set_updated_at();

-- ---------- exports ----------
create table export_jobs (
  id uuid primary key default gen_random_uuid(),
  sunday_id uuid not null references sundays(id) on delete cascade,
  type export_type not null,
  status export_status not null default 'queued',
  selection_json jsonb not null default '{}'::jsonb,
  output_r2_key text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------- system checks ----------
create table system_checks (
  id uuid primary key default gen_random_uuid(),
  check_type text not null,
  status text not null check (status in ('ok','warn','error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- sunday PIN rate limiting ----------
create table pin_attempts (
  id bigserial primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);
create index on pin_attempts (ip_hash, attempted_at desc);

-- ---------- RLS ----------
do $$ declare t text; begin
  for t in select unnest(array[
    'admin_users','app_settings','fonts','approved_colors','assets','templates','template_fields','template_assets',
    'announcement_mappings','announcement_aliases','mapping_suggestions','default_structural_slides','sundays','run_sheets',
    'slides','export_jobs','system_checks','pin_attempts'
  ]) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
  end loop;
end $$;

-- admins can read their own row even before is_admin() (needed for bootstrap checks)
create policy admin_users_self_read on admin_users for select to authenticated using (auth_user_id = auth.uid());

-- ---------- seed: settings + fonts + colors ----------
insert into app_settings (church_name) values ('Church Panels');

insert into fonts (family, source, source_identifier, weight, style) values
  ('Arimo','google','Arimo',400,'normal'),
  ('Arimo','google','Arimo',700,'normal'),
  ('Arimo','google','Arimo',400,'italic'),
  ('Arimo','google','Arimo',700,'italic'),
  ('Tinos','google','Tinos',400,'normal'),
  ('Tinos','google','Tinos',700,'normal'),
  ('Tinos','google','Tinos',400,'italic'),
  ('Tinos','google','Tinos',700,'italic');

insert into approved_colors (name_en, name_fr, hex, sort_order) values
  ('Navy','Marine','#0f172a',1),
  ('Indigo','Indigo','#4f46e5',2),
  ('Coral','Corail','#ff4233',3),
  ('Yellow','Jaune','#f5c518',4),
  ('Forest','Forêt','#14532d',5),
  ('Cream','Crème','#f8f5ee',6);
