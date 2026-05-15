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

insert into leagues (name, country, reputation, tier)
select
  format('League %s', s.i),
  format('Nation %s', ((s.i - 1) % 50) + 1),
  greatest(45, 95 - s.i),
  case when s.i <= 20 then 1 else 2 end
from generate_series(1, 50) as s(i)
on conflict do nothing;

insert into national_team_jobs (nation, reputation_required)
select
  format('National Team %s', s.i),
  case when s.i <= 10 then 88 when s.i <= 40 then 70 else 52 end
from generate_series(1, 110) as s(i)
on conflict (nation) do nothing;

insert into seasons (label, current_matchday)
values ('2026/2027', 1)
on conflict (label) do nothing;
