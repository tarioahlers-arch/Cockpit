-- =============================================================================
-- JobCockpit – Initiales Datenbank-Schema
-- Region: eu-central-1 (Frankfurt). RLS ist auf ALLEN Tabellen aktiv.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.subscription_tier as enum ('free', 'pro', 'pro_annual');
create type public.app_language as enum ('de', 'en');
create type public.application_status as enum ('draft', 'sent', 'interview', 'offer', 'rejected', 'withdrawn');
create type public.usage_action_type as enum ('letter_generated', 'pdf_exported', 'cv_uploaded');
create type public.coaching_status as enum ('scheduled', 'completed', 'cancelled');
create type public.cv_file_type as enum ('pdf', 'docx');

-- -----------------------------------------------------------------------------
-- Hilfsfunktionen
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- users – erweitert auth.users (1:1)
-- -----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  subscription_tier public.subscription_tier not null default 'free',
  subscription_expires_at timestamptz,
  preferred_language public.app_language not null default 'de',
  gdpr_consent_at timestamptz,
  -- ANNAHME: für Data-Retention-Policy (24 Monate warnen / 36 Monate löschen)
  last_active_at timestamptz not null default now(),
  -- ANNAHME: für Account-Löschung mit 30-Tage-Grace-Period
  deletion_requested_at timestamptz
);

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references public.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  address text,
  linkedin_url text,
  date_of_birth date,
  nationality text,
  pitch text,
  current_position text,
  availability text,
  languages jsonb not null default '[]'::jsonb check (jsonb_typeof(languages) = 'array'),
  skills jsonb not null default '[]'::jsonb check (jsonb_typeof(skills) = 'array'),
  mobility text,
  phd_topic text,
  highest_degree text,
  university text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- cv_versions
-- -----------------------------------------------------------------------------
create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  file_url text not null, -- Pfad im privaten Storage-Bucket "cvs": <user_id>/<datei>
  file_type public.cv_file_type not null,
  parsed_content jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index cv_versions_user_id_idx on public.cv_versions (user_id);
-- Höchstens ein Standard-CV pro Nutzer
create unique index cv_versions_one_default_idx on public.cv_versions (user_id) where is_default;

-- -----------------------------------------------------------------------------
-- applications (Bewerbungs-Tracker)
-- -----------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_name text not null,
  position_title text not null,
  location text,
  job_description text check (char_length(job_description) <= 10000),
  company_info text check (char_length(company_info) <= 2000),
  -- ANNAHME: aus dem Generator-Flow (Schritt 4: Ansprechpartner, Referenznummer)
  contact_person text,
  reference_number text,
  status public.application_status not null default 'draft',
  applied_at date,
  notes text,
  source text, -- linkedin, stepstone, indeed, xing, company_website, referral, direct, other
  salary_offered numeric(12, 2),
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_id_idx on public.applications (user_id, created_at desc);
create index applications_next_action_idx on public.applications (next_action_at) where next_action_at is not null;

-- ANNAHME: Status-Historie für die Timeline in der Detail-Ansicht (5.4)
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status public.application_status not null,
  created_at timestamptz not null default now()
);
create index application_events_application_idx on public.application_events (application_id, created_at);

-- -----------------------------------------------------------------------------
-- cover_letters
-- -----------------------------------------------------------------------------
create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications (id) on delete set null,
  user_id uuid not null references public.users (id) on delete cascade,
  -- ANNAHME: welche CV-Version als Grundlage diente
  cv_version_id uuid references public.cv_versions (id) on delete set null,
  language public.app_language not null,
  content text not null,
  generation_prompt text,
  -- ANNAHME: Hash über Eingaben für Caching identischer Requests
  request_hash text,
  model_used text,
  tokens_used integer check (tokens_used >= 0),
  user_rating smallint check (user_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cover_letters_user_id_idx on public.cover_letters (user_id, created_at desc);
create index cover_letters_request_hash_idx on public.cover_letters (user_id, request_hash);

-- -----------------------------------------------------------------------------
-- usage_tracking (Rate-Limiting & Analytics)
-- -----------------------------------------------------------------------------
create table public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  action_type public.usage_action_type not null,
  metadata jsonb not null default '{}'::jsonb,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now()
);
create index usage_tracking_user_action_idx on public.usage_tracking (user_id, action_type, created_at desc);

-- -----------------------------------------------------------------------------
-- coaches & coaching_sessions (Phase 2 Marketplace)
-- -----------------------------------------------------------------------------
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  bio text,
  specialization text,
  hourly_rate_cents integer check (hourly_rate_cents >= 0),
  rating_avg numeric(3, 2) not null default 0 check (rating_avg between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete restrict,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  status public.coaching_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coaching_sessions_user_idx on public.coaching_sessions (user_id);
create index coaching_sessions_coach_idx on public.coaching_sessions (coach_id);

-- -----------------------------------------------------------------------------
-- ANNAHME: Karriereseiten-Verzeichnis (5.5) – kuratiert, öffentlich lesbar
-- -----------------------------------------------------------------------------
create table public.career_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null, -- FMCG, Tech, Consulting, Finance, ...
  careers_url text not null check (careers_url ~ '^https://'),
  headquarters text,
  country text not null default 'DE' check (country in ('DE', 'AT', 'CH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index career_companies_category_idx on public.career_companies (category);

create table public.favorite_companies (
  user_id uuid not null references public.users (id) on delete cascade,
  company_id uuid not null references public.career_companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- -----------------------------------------------------------------------------
-- ANNAHME: Push-Tokens für Reminder (5.4 Next-Action-Reminder)
-- -----------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- -----------------------------------------------------------------------------
-- DSGVO: Audit-Log für Datenzugriffe (Abschnitt 9) – nur serverseitig beschreibbar
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.users (id) on delete set null,
  actor text not null default 'user', -- user | service | admin
  action text not null,               -- z.B. data_export, account_deletion_requested
  table_name text,
  record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_user_idx on public.audit_log (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at-Trigger
-- -----------------------------------------------------------------------------
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger cover_letters_updated_at before update on public.cover_letters
  for each row execute function public.set_updated_at();
create trigger coaches_updated_at before update on public.coaches
  for each row execute function public.set_updated_at();
create trigger coaching_sessions_updated_at before update on public.coaching_sessions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Neuer Auth-User -> users + profiles anlegen
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, preferred_language)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'preferred_language' = 'en'
      then 'en'::public.app_language else 'de'::public.app_language end
  );
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Status-Änderung einer Bewerbung -> Timeline-Eintrag
-- -----------------------------------------------------------------------------
create or replace function public.log_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_events (application_id, user_id, status)
    values (new.id, new.user_id, new.status);
  end if;
  return new;
end;
$$;

create trigger applications_status_log
  after insert or update of status on public.applications
  for each row execute function public.log_application_status();

-- -----------------------------------------------------------------------------
-- Nutzer dürfen sicherheitsrelevante Spalten in users nicht selbst ändern
-- (Abo-Status kommt ausschließlich vom Server / RevenueCat-Webhook).
-- -----------------------------------------------------------------------------
create or replace function public.protect_user_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.subscription_tier := old.subscription_tier;
    new.subscription_expires_at := old.subscription_expires_at;
    new.deletion_requested_at := old.deletion_requested_at;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger users_protect_columns before update on public.users
  for each row execute function public.protect_user_columns();

-- -----------------------------------------------------------------------------
-- Tier-Limits serverseitig erzwingen (Free: 1 CV, 20 Bewerbungen)
-- -----------------------------------------------------------------------------
create or replace function public.current_tier(uid uuid)
returns public.subscription_tier
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when u.subscription_tier <> 'free'
      and (u.subscription_expires_at is null or u.subscription_expires_at > now())
    then u.subscription_tier
    else 'free'::public.subscription_tier
  end
  from public.users u
  where u.id = uid;
$$;

create or replace function public.enforce_tier_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tier public.subscription_tier := public.current_tier(new.user_id);
  cnt integer;
begin
  if tg_table_name = 'cv_versions' then
    select count(*) into cnt from public.cv_versions where user_id = new.user_id;
    if cnt >= (case when tier = 'free' then 1 else 5 end) then
      raise exception 'cv_limit_reached' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'applications' then
    if tier = 'free' then
      select count(*) into cnt from public.applications where user_id = new.user_id;
      if cnt >= 20 then
        raise exception 'application_limit_reached' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger cv_versions_tier_limit before insert on public.cv_versions
  for each row execute function public.enforce_tier_limits();
create trigger applications_tier_limit before insert on public.applications
  for each row execute function public.enforce_tier_limits();

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
-- Anzahl generierter Anschreiben im laufenden Kalendermonat (UI-Anzeige; die
-- Edge Function prüft das Limit maßgeblich serverseitig).
create or replace function public.letters_used_this_month()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.usage_tracking
  where user_id = auth.uid()
    and action_type = 'letter_generated'
    and created_at >= date_trunc('month', now());
$$;

-- Account-Löschung beantragen (GDPR Art. 17). Endgültige Löschung nach 30 Tagen
-- durch einen geplanten Job (folgt in Phase 6).
create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ts timestamptz := now();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  update public.users set deletion_requested_at = ts where id = uid;
  insert into public.audit_log (user_id, action) values (uid, 'account_deletion_requested');
  return ts + interval '30 days';
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  update public.users set deletion_requested_at = null where id = uid;
  insert into public.audit_log (user_id, action) values (uid, 'account_deletion_cancelled');
end;
$$;

revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.current_tier(uuid) from public, anon, authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.letters_used_this_month() to authenticated;

-- =============================================================================
-- Row-Level-Security
-- =============================================================================
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.cv_versions enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.cover_letters enable row level security;
alter table public.usage_tracking enable row level security;
alter table public.coaches enable row level security;
alter table public.coaching_sessions enable row level security;
alter table public.career_companies enable row level security;
alter table public.favorite_companies enable row level security;
alter table public.push_tokens enable row level security;
alter table public.audit_log enable row level security;

-- users: lesen & (eingeschränkt) aktualisieren, Anlage nur per Trigger
create policy "users_select_own" on public.users
  for select to authenticated using ((select auth.uid()) = id);
create policy "users_update_own" on public.users
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- profiles
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Eigene Daten: volles CRUD
create policy "cv_versions_all_own" on public.cv_versions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "applications_all_own" on public.applications
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "favorite_companies_all_own" on public.favorite_companies
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_tokens_all_own" on public.push_tokens
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Timeline: nur lesen (wird per Trigger geschrieben)
create policy "application_events_select_own" on public.application_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- cover_letters: lesen, editieren, löschen. Anlage nur über die Edge Function
-- (service_role), damit das Rate-Limit nicht umgangen werden kann.
create policy "cover_letters_select_own" on public.cover_letters
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cover_letters_update_own" on public.cover_letters
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cover_letters_delete_own" on public.cover_letters
  for delete to authenticated using ((select auth.uid()) = user_id);

-- usage_tracking: nur lesen (Schreiben ausschließlich serverseitig)
create policy "usage_tracking_select_own" on public.usage_tracking
  for select to authenticated using ((select auth.uid()) = user_id);

-- audit_log: Nutzer sehen ihre eigenen Einträge (Transparenz), schreiben nur Server
create policy "audit_log_select_own" on public.audit_log
  for select to authenticated using ((select auth.uid()) = user_id);

-- coaches: verifizierte Coaches öffentlich sichtbar, eigenes Profil verwaltbar
create policy "coaches_select_verified_or_own" on public.coaches
  for select to authenticated using (is_verified or (select auth.uid()) = user_id);
create policy "coaches_insert_own" on public.coaches
  for insert to authenticated with check ((select auth.uid()) = user_id and not is_verified);
create policy "coaches_update_own" on public.coaches
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Rating/Verifizierung dürfen Coaches nicht selbst setzen
create or replace function public.protect_coach_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.is_verified := old.is_verified;
    new.rating_avg := old.rating_avg;
    new.review_count := old.review_count;
  end if;
  return new;
end;
$$;
create trigger coaches_protect_columns before update on public.coaches
  for each row execute function public.protect_coach_columns();

-- coaching_sessions: Kund:in oder Coach dürfen lesen; Kund:in bucht
create policy "coaching_sessions_select_participant" on public.coaching_sessions
  for select to authenticated using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = (select auth.uid()))
  );
create policy "coaching_sessions_insert_own" on public.coaching_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "coaching_sessions_update_participant" on public.coaching_sessions
  for update to authenticated using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = (select auth.uid()))
  );

-- career_companies: öffentlich lesbar (auch vor Login), Pflege nur serverseitig
create policy "career_companies_select_all" on public.career_companies
  for select to anon, authenticated using (true);

-- =============================================================================
-- Storage: privater Bucket für Lebensläufe, Ordner = user_id
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs', 'cvs', false, 10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "cvs_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
