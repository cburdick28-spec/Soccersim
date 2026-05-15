insert into competitions (name, type, prize_money, reputation) values
  ('UEFA Champions League', 'continental', 85000000, 98),
  ('UEFA Europa League', 'continental', 42000000, 90),
  ('UEFA Conference League', 'continental', 26000000, 84),
  ('FIFA World Cup', 'international', 120000000, 99),
  ('UEFA Euros', 'international', 70000000, 96),
  ('Copa America', 'international', 50000000, 94),
  ('AFCON', 'international', 30000000, 88),
  ('CONCACAF Gold Cup', 'international', 24000000, 82),
  ('Domestic Cup', 'domestic', 12000000, 78)
on conflict (name) do nothing;

create temporary table if not exists _league_seed (
  name text not null,
  country text not null,
  reputation integer not null,
  tier integer not null
) on commit drop;

truncate _league_seed;

insert into _league_seed (name, country, reputation, tier) values
  ('Premier League', 'England', 95, 1),
  ('Championship', 'England', 84, 2),
  ('League One', 'England', 75, 3),
  ('La Liga', 'Spain', 94, 1),
  ('La Liga 2', 'Spain', 82, 2),
  ('Primera RFEF', 'Spain', 72, 3),
  ('Serie A', 'Italy', 93, 1),
  ('Serie B', 'Italy', 81, 2),
  ('Bundesliga', 'Germany', 92, 1),
  ('2. Bundesliga', 'Germany', 80, 2),
  ('Ligue 1', 'France', 90, 1),
  ('Ligue 2', 'France', 78, 2),
  ('Eredivisie', 'Netherlands', 88, 1),
  ('Primeira Liga', 'Portugal', 86, 1),
  ('Belgian Pro League', 'Belgium', 83, 1),
  ('Super Lig', 'Turkey', 82, 1),
  ('Brasileirao', 'Brazil', 91, 1),
  ('Serie B Brasil', 'Brazil', 78, 2),
  ('Liga Profesional', 'Argentina', 89, 1),
  ('Primera Nacional', 'Argentina', 76, 2),
  ('MLS', 'United States', 80, 1),
  ('Liga MX', 'Mexico', 84, 1),
  ('Scottish Premiership', 'Scotland', 79, 1),
  ('Scottish Championship', 'Scotland', 70, 2),
  ('Saudi Pro League', 'Saudi Arabia', 81, 1),
  ('J1 League', 'Japan', 80, 1),
  ('J2 League', 'Japan', 72, 2),
  ('K League 1', 'South Korea', 79, 1),
  ('A-League', 'Australia', 74, 1),
  ('Danish Superliga', 'Denmark', 78, 1),
  ('Swiss Super League', 'Switzerland', 78, 1),
  ('Austrian Bundesliga', 'Austria', 77, 1),
  ('Greek Super League', 'Greece', 76, 1),
  ('Polish Ekstraklasa', 'Poland', 75, 1),
  ('Czech First League', 'Czech Republic', 74, 1),
  ('Ukrainian Premier League', 'Ukraine', 74, 1),
  ('Romanian SuperLiga', 'Romania', 72, 1),
  ('Serbian SuperLiga', 'Serbia', 73, 1),
  ('Croatian League', 'Croatia', 73, 1),
  ('Norwegian Eliteserien', 'Norway', 74, 1),
  ('Swedish Allsvenskan', 'Sweden', 75, 1),
  ('Finnish Veikkausliiga', 'Finland', 70, 1),
  ('Chinese Super League', 'China', 76, 1),
  ('Indian Super League', 'India', 68, 1),
  ('South African Premiership', 'South Africa', 71, 1),
  ('Egyptian Premier League', 'Egypt', 73, 1),
  ('Moroccan Botola', 'Morocco', 71, 1),
  ('Colombian Primera A', 'Colombia', 77, 1),
  ('Chilean Primera Division', 'Chile', 75, 1),
  ('Peruvian Liga 1', 'Peru', 72, 1);

insert into leagues (name, country, reputation, tier)
select ls.name, ls.country, ls.reputation, ls.tier
from _league_seed ls
where not exists (
  select 1
  from leagues l
  where l.name = ls.name and l.country = ls.country
);

with target_leagues as (
  select l.id, l.name, l.country, l.reputation
  from leagues l
  join _league_seed ls on ls.name = l.name and ls.country = l.country
)
insert into clubs (league_id, name, reputation, finances)
select
  tl.id,
  format('%s Club %s', tl.name, club_index.i),
  greatest(45, tl.reputation - ((club_index.i - 1) % 18)),
  25000000 + club_index.i * 800000
from target_leagues tl
cross join generate_series(1, 20) as club_index(i)
where not exists (
  select 1
  from clubs c
  where c.league_id = tl.id and c.name = format('%s Club %s', tl.name, club_index.i)
);

with target_clubs as (
  select c.id, c.name, l.country
  from clubs c
  join leagues l on l.id = c.league_id
  join _league_seed ls on ls.name = l.name and ls.country = l.country
)
insert into players (
  club_id, name, age, nationality, preferred_position, potential,
  pace, shooting, passing, dribbling, defending, physical
)
select
  tc.id,
  format('%s Player %s', tc.name, player_index.i),
  18 + ((player_index.i * 3 + length(tc.name)) % 17),
  tc.country,
  case
    when player_index.i <= 2 then 'GK'
    when player_index.i <= 8 then 'DEF'
    when player_index.i <= 16 then 'MID'
    else 'ATT'
  end,
  58 + ((player_index.i * 2 + length(tc.name)) % 35),
  50 + ((player_index.i * 3 + length(tc.name)) % 45),
  50 + ((player_index.i * 5 + length(tc.name)) % 45),
  50 + ((player_index.i * 7 + length(tc.name)) % 45),
  50 + ((player_index.i * 11 + length(tc.name)) % 45),
  50 + ((player_index.i * 13 + length(tc.name)) % 45),
  50 + ((player_index.i * 17 + length(tc.name)) % 45)
from target_clubs tc
cross join generate_series(1, 25) as player_index(i)
where not exists (
  select 1
  from players p
  where p.club_id = tc.id and p.name = format('%s Player %s', tc.name, player_index.i)
);

insert into national_team_jobs (nation, reputation_required)
select
  format('National Team %s', s.i),
  case when s.i <= 10 then 88 when s.i <= 40 then 70 else 52 end
from generate_series(1, 110) as s(i)
on conflict (nation) do nothing;

insert into seasons (label, current_matchday)
values ('2026/2027', 1)
on conflict (label) do nothing;
