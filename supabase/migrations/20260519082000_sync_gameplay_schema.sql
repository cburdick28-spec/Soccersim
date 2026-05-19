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

alter table standings
  add column if not exists goal_difference integer not null default 0;

alter table clubs
  add column if not exists transfer_budget bigint not null default 250000,
  add column if not exists wage_budget bigint not null default 350000;

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

do $$
begin
  if (
    select count(*)
    from seasons
    where completed = false
  ) <= 1 then
    execute 'create unique index if not exists seasons_single_incomplete_idx on seasons ((1)) where completed = false';
  else
    raise notice 'Skipping seasons_single_incomplete_idx because existing incomplete seasons would violate the constraint.';
  end if;
end $$;

create index if not exists seasons_created_at_idx on seasons(created_at desc);
create index if not exists seasons_save_idx on seasons(save_id, created_at desc);
