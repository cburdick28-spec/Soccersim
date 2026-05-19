create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  username text not null unique,
  language text not null default 'en' check (language in ('en', 'es')),
  reputation integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  reputation integer not null,
  tier integer not null default 1
);
create index if not exists leagues_country_idx on leagues(country);

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  reputation integer not null,
  finances bigint not null default 1000000,
  transfer_budget bigint not null default 250000,
  wage_budget bigint not null default 350000,
  manager_id uuid,
  national_team_id uuid,
  unique (league_id, name)
);
create index if not exists clubs_league_idx on clubs(league_id);

create table if not exists managers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  name text not null,
  nationality text not null,
  reputation integer not null,
  tactical_style text not null,
  experience integer not null default 0,
  salary_expectation integer not null default 0,
  contract_length_years integer not null default 2
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete set null,
  name text not null,
  age integer not null,
  nationality text not null,
  preferred_position text not null,
  potential integer not null,
  morale integer not null default 70,
  fitness integer not null default 90,
  form integer not null default 50,
  pace integer not null,
  shooting integer not null,
  passing integer not null,
  dribbling integer not null,
  defending integer not null,
  physical integer not null,
  injury_status text not null default 'fit',
  suspension_status text not null default 'available'
);
create index if not exists players_club_idx on players(club_id);
create index if not exists players_potential_idx on players(potential desc);

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null,
  prize_money bigint not null default 0,
  reputation integer not null default 60
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  label text unique,
  save_id uuid,
  league_id uuid references leagues(id) on delete cascade,
  current_matchday integer not null default 1,
  status text not null default 'active',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  league_id uuid not null references leagues(id) on delete cascade,
  competition_id uuid references competitions(id) on delete set null,
  home_club_id uuid not null references clubs(id) on delete cascade,
  away_club_id uuid not null references clubs(id) on delete cascade,
  matchday integer not null default 1,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed')),
  home_goals integer,
  away_goals integer,
  xg_home numeric,
  xg_away numeric,
  possession_home integer,
  commentary jsonb not null default '[]'::jsonb,
  played_at timestamptz
);
create index if not exists matches_season_idx on matches(season_id);
create index if not exists matches_league_season_matchday_idx on matches(league_id, season_id, matchday);

create table if not exists standings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer not null default 0,
  points integer not null default 0,
  unique (league_id, season_id, club_id)
);

alter table seasons
  add column if not exists save_id uuid,
  add column if not exists league_id uuid references leagues(id) on delete cascade,
  add column if not exists current_matchday integer,
  add column if not exists status text,
  add column if not exists completed boolean,
  add column if not exists created_at timestamptz;

update seasons
set current_matchday = 1
where current_matchday is null or current_matchday < 1;

update seasons
set status = 'paused'
where status = 'processing';

update seasons
set status = 'active'
where status is null;

update seasons
set completed = (status = 'completed')
where completed is distinct from (status = 'completed');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seasons'
      and column_name = 'started_at'
  ) then
    execute 'update seasons set created_at = coalesce(created_at, started_at, now()) where created_at is null';
  else
    execute 'update seasons set created_at = coalesce(created_at, now()) where created_at is null';
  end if;
end $$;

alter table seasons
  alter column current_matchday set default 1,
  alter column status set default 'active',
  alter column completed set default false,
  alter column created_at set default now();

alter table seasons
  alter column current_matchday set not null,
  alter column status set not null,
  alter column completed set not null,
  alter column created_at set not null;

do $$
declare
  status_constraint text;
begin
  for status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'seasons'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table seasons drop constraint if exists %I', status_constraint);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'seasons_status_check'
  ) then
    alter table seasons
      add constraint seasons_status_check check (status in ('active', 'paused', 'completed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seasons_current_matchday_check'
  ) then
    alter table seasons
      add constraint seasons_current_matchday_check check (current_matchday >= 1);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seasons_league_id_fkey'
  ) then
    alter table seasons
      add constraint seasons_league_id_fkey foreign key (league_id) references leagues(id) on delete cascade;
  end if;
end $$;

with club_inputs as (
  select
    c.id,
    c.reputation,
    l.tier,
    abs(hashtext(c.id::text)) as seed
  from clubs c
  join leagues l on l.id = c.league_id
)
update clubs c
set
  reputation = greatest(1, least(100, c.reputation)),
  finances = greatest(
    1000000,
    case
      when ci.reputation >= 80 then 150000000 + (ci.seed % 350000001)
      when ci.reputation >= 70 then 40000000 + (ci.seed % 110000001)
      when ci.reputation >= 60 then 10000000 + (ci.seed % 50000001)
      else 1000000 + (ci.seed % 14000001)
    end
  ),
  transfer_budget = greatest(
    250000,
    round(
      (
        case
          when ci.reputation >= 80 then 150000000 + (ci.seed % 350000001)
          when ci.reputation >= 70 then 40000000 + (ci.seed % 110000001)
          when ci.reputation >= 60 then 10000000 + (ci.seed % 50000001)
          else 1000000 + (ci.seed % 14000001)
        end
      ) * (0.22 + ((ci.seed % 19)::numeric / 100))
    )
  ),
  wage_budget = greatest(
    350000,
    round(
      (
        case
          when ci.reputation >= 80 then 150000000 + (ci.seed % 350000001)
          when ci.reputation >= 70 then 40000000 + (ci.seed % 110000001)
          when ci.reputation >= 60 then 10000000 + (ci.seed % 50000001)
          else 1000000 + (ci.seed % 14000001)
        end
      ) * (0.30 + ((ci.seed % 26)::numeric / 100))
    )
  )
from club_inputs ci
where ci.id = c.id;

alter table clubs
  add column if not exists transfer_budget bigint not null default 250000,
  add column if not exists wage_budget bigint not null default 350000;

alter table clubs
  alter column finances set default 1000000,
  alter column transfer_budget set default 250000,
  alter column wage_budget set default 350000;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clubs_finances_positive_check'
  ) then
    alter table clubs
      add constraint clubs_finances_positive_check check (finances > 0 and transfer_budget > 0 and wage_budget > 0);
  end if;
end $$;

alter table matches
  add column if not exists league_id uuid references leagues(id) on delete cascade,
  add column if not exists matchday integer not null default 1,
  add column if not exists status text not null default 'scheduled',
  add column if not exists home_goals integer,
  add column if not exists away_goals integer,
  add column if not exists xg_home numeric,
  add column if not exists xg_away numeric,
  add column if not exists possession_home integer,
  add column if not exists commentary jsonb not null default '[]'::jsonb,
  add column if not exists played_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'matches_status_check'
  ) then
    alter table matches
      add constraint matches_status_check check (status in ('scheduled', 'in_progress', 'completed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'matches_home_away_diff_check'
  ) then
    alter table matches
      add constraint matches_home_away_diff_check check (home_club_id <> away_club_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'matches_unique_fixture'
  ) then
    alter table matches
      add constraint matches_unique_fixture unique (home_club_id, away_club_id, season_id, matchday);
  end if;
end $$;

alter table standings
  add column if not exists goal_difference integer not null default 0;

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  from_club_id uuid references clubs(id) on delete set null,
  to_club_id uuid references clubs(id) on delete set null,
  fee bigint not null default 0,
  transfer_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists tactics (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references managers(id) on delete cascade,
  formation text not null,
  style text not null,
  pressing integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  mode text not null check (mode in ('solo', 'multiplayer', 'guest')),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists saves_user_idx on saves(user_id, updated_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'seasons_save_id_fkey'
  ) then
    alter table seasons
      add constraint seasons_save_id_fkey foreign key (save_id) references saves(id) on delete cascade;
  end if;
end $$;

create index if not exists seasons_created_at_idx on seasons(created_at desc);
create index if not exists seasons_save_idx on seasons(save_id, created_at desc);

create table if not exists multiplayer_lobbies (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references users(id) on delete cascade,
  invite_code text not null unique,
  settings jsonb not null,
  status text not null default 'open' check (status in ('open', 'locked', 'active', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references multiplayer_lobbies(id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_lobby_idx on messages(lobby_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists youth_players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  potential integer not null
);

create table if not exists national_team_jobs (
  id uuid primary key default gen_random_uuid(),
  nation text not null unique,
  manager_id uuid references managers(id) on delete set null,
  reputation_required integer not null
);

create table if not exists international_offers (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references managers(id) on delete cascade,
  national_team_job_id uuid not null references national_team_jobs(id) on delete cascade,
  offered_salary bigint not null,
  contract_years integer not null,
  created_at timestamptz not null default now()
);

create table if not exists league_settings (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid references multiplayer_lobbies(id) on delete cascade,
  difficulty text not null,
  cheats_enabled boolean not null default false,
  transfer_budget_multiplier numeric not null default 1,
  injury_frequency numeric not null default 1
);

alter table users enable row level security;
alter table saves enable row level security;
alter table multiplayer_lobbies enable row level security;
alter table league_settings enable row level security;

create or replace function is_global_admin()
returns boolean
language sql
stable
as $$
  select split_part(auth.email(), '@', 1) = 'connorb';
$$;

create policy users_self_select on users
for select
using (auth.uid() = auth_user_id);

create policy users_self_update on users
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy saves_owner_rw on saves
for all
using (
  user_id in (select id from users where auth_user_id = auth.uid())
)
with check (
  user_id in (select id from users where auth_user_id = auth.uid())
);

create policy lobby_read on multiplayer_lobbies
for select
using (true);

create policy lobby_host_write on multiplayer_lobbies
for all
using (host_user_id in (select id from users where auth_user_id = auth.uid()) or is_global_admin())
with check (host_user_id in (select id from users where auth_user_id = auth.uid()) or is_global_admin());

create policy league_settings_no_cheat on league_settings
for all
using (not cheats_enabled or is_global_admin())
with check (not cheats_enabled or is_global_admin());
