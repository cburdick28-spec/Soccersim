import { getSupabaseClient } from "@/lib/supabase";

type SeasonStatus = "active" | "completed";
type MatchStatus = "scheduled" | "in_progress" | "completed";

export type SeasonRow = {
  id: string;
  label: string;
  current_matchday: number;
  status: SeasonStatus;
};

type ClubRow = {
  id: string;
  name: string;
  league_id: string;
  reputation: number;
  manager_id: string | null;
};

type FixtureInsert = {
  season_id: string;
  league_id: string;
  home_club_id: string;
  away_club_id: string;
  matchday: number;
  status: MatchStatus;
};

type SimPlayer = {
  club_id: string | null;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  morale: number;
  form: number;
  fitness: number;
};

type TacticRow = {
  manager_id: string;
  style: string;
  pressing: number;
};

export type LeagueTableRow = {
  club_id: string;
  club_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

type StandingAccumulator = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};

const FIXTURE_BATCH_SIZE = 400;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const createSeasonLabel = (year = new Date().getUTCFullYear()) => `${year}/${year + 1}`;

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

export async function getActiveSeason(): Promise<SeasonRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, label, current_matchday, status")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active season: ${error.message}`);
  }

  return (data as SeasonRow | null) ?? null;
}

async function createSeason(): Promise<SeasonRow> {
  const supabase = getSupabaseClient();
  const baseLabel = createSeasonLabel();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const label = attempt === 0 ? baseLabel : `${baseLabel}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("seasons")
      .insert({
        label,
        current_matchday: 1,
        status: "active",
      } as never)
      .select("id, label, current_matchday, status")
      .single();

    if (!error) {
      return data as SeasonRow;
    }

    if (!error.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Failed to create season: ${error.message}`);
    }

    const existing = await getActiveSeason();
    if (existing) {
      return existing;
    }
  }

  throw new Error("Failed to create season after multiple retries.");
}

async function getOrCreateActiveSeason(): Promise<SeasonRow> {
  const active = await getActiveSeason();
  if (active) {
    return active;
  }
  return createSeason();
}

export async function seasonAlreadyInitialized(seasonId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id")
    .eq("season_id", seasonId)
    .limit(1);

  if (error) {
    throw new Error(`Failed to inspect existing fixtures: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

export function generateMatchdays(clubIds: string[]): Array<Array<{ homeClubId: string; awayClubId: string }>> {
  if (clubIds.length < 2) {
    return [];
  }

  const hasBye = clubIds.length % 2 === 1;
  const rotating: Array<string | null> = hasBye ? [...clubIds, null] : [...clubIds];
  const rounds = rotating.length - 1;
  const pairingsPerRound = rotating.length / 2;
  const output: Array<Array<{ homeClubId: string; awayClubId: string }>> = [];

  for (let round = 0; round < rounds; round += 1) {
    const roundFixtures: Array<{ homeClubId: string; awayClubId: string }> = [];

    for (let index = 0; index < pairingsPerRound; index += 1) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      if (!left || !right) {
        continue;
      }

      const swapHomeAway = index === 0 ? round % 2 === 1 : (round + index) % 2 === 0;
      if (swapHomeAway) {
        roundFixtures.push({ homeClubId: right, awayClubId: left });
      } else {
        roundFixtures.push({ homeClubId: left, awayClubId: right });
      }
    }

    output.push(roundFixtures);

    const fixed = rotating[0];
    const rotatingSlice = rotating.slice(1);
    rotatingSlice.unshift(rotatingSlice.pop() ?? null);
    rotating.splice(0, rotating.length, fixed, ...rotatingSlice);
  }

  return output;
}

export function generateRoundRobinFixtures(leagueId: string, seasonId: string, clubIds: string[]): FixtureInsert[] {
  const firstLegMatchdays = generateMatchdays(clubIds);
  const fixtures: FixtureInsert[] = [];

  firstLegMatchdays.forEach((fixturesForDay, dayIndex) => {
    const matchday = dayIndex + 1;
    fixturesForDay.forEach((fixture) => {
      fixtures.push({
        league_id: leagueId,
        season_id: seasonId,
        home_club_id: fixture.homeClubId,
        away_club_id: fixture.awayClubId,
        matchday,
        status: "scheduled",
      });
    });
  });

  const reverseOffset = firstLegMatchdays.length;
  firstLegMatchdays.forEach((fixturesForDay, dayIndex) => {
    const matchday = reverseOffset + dayIndex + 1;
    fixturesForDay.forEach((fixture) => {
      fixtures.push({
        league_id: leagueId,
        season_id: seasonId,
        home_club_id: fixture.awayClubId,
        away_club_id: fixture.homeClubId,
        matchday,
        status: "scheduled",
      });
    });
  });

  return fixtures;
}

async function ensureStandingsRows(seasonId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("id, league_id, name")
    .order("name", { ascending: true });

  if (clubsError) {
    throw new Error(`Failed to load clubs for standings seed: ${clubsError.message}`);
  }

  const rows = ((clubs ?? []) as Array<{ id: string; league_id: string; name: string }>).map((club) => ({
    league_id: club.league_id,
    season_id: seasonId,
    club_id: club.id,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("standings")
    .upsert(rows as never, { onConflict: "league_id,season_id,club_id", ignoreDuplicates: true });
  if (error) {
    throw new Error(`Failed to seed standings rows: ${error.message}`);
  }
}

async function insertFixtures(fixtures: FixtureInsert[]): Promise<void> {
  if (fixtures.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  for (let i = 0; i < fixtures.length; i += FIXTURE_BATCH_SIZE) {
    const chunk = fixtures.slice(i, i + FIXTURE_BATCH_SIZE);
    const { error } = await supabase
      .from("matches")
      .upsert(chunk as never, {
        onConflict: "home_club_id,away_club_id,season_id,matchday",
        ignoreDuplicates: true,
      });
    if (error) {
      throw new Error(`Failed to insert fixtures: ${error.message}`);
    }
  }
}

type IntegrityIssue =
  | "league_without_clubs"
  | "club_without_league"
  | "orphan_players"
  | "duplicate_fixtures"
  | "club_double_booked"
  | "missing_standings"
  | "invalid_season_reference";

export async function validateSeasonIntegrity(seasonId: string): Promise<{
  ok: boolean;
  detectedIssues: IntegrityIssue[];
}> {
  const supabase = getSupabaseClient();
  const issues = new Set<IntegrityIssue>();

  const [{ data: leagues, error: leaguesError }, { data: clubs, error: clubsError }] = await Promise.all([
    supabase.from("leagues").select("id"),
    supabase.from("clubs").select("id, league_id"),
  ]);

  if (leaguesError || clubsError) {
    throw new Error(`Failed integrity preflight: ${leaguesError?.message ?? clubsError?.message}`);
  }

  const clubRows = (clubs ?? []) as Array<{ id: string; league_id: string | null }>;
  const leagueIds = new Set(((leagues ?? []) as Array<{ id: string }>).map((row) => row.id));
  const clubCountsByLeague = new Map<string, number>();

  clubRows.forEach((club) => {
    if (!club.league_id) {
      issues.add("club_without_league");
      return;
    }
    clubCountsByLeague.set(club.league_id, (clubCountsByLeague.get(club.league_id) ?? 0) + 1);
  });

  [...leagueIds].forEach((leagueId) => {
    if (!clubCountsByLeague.get(leagueId)) {
      issues.add("league_without_clubs");
    }
  });

  const { data: players, error: playersError } = await supabase.from("players").select("id, club_id");
  if (playersError) {
    throw new Error(`Failed to inspect players integrity: ${playersError.message}`);
  }
  const clubIdSet = new Set(clubRows.map((club) => club.id));
  const hasOrphanPlayers = ((players ?? []) as Array<{ club_id: string | null }>).some(
    (player) => player.club_id && !clubIdSet.has(player.club_id),
  );
  if (hasOrphanPlayers) {
    issues.add("orphan_players");
  }

  const { data: fixtures, error: fixturesError } = await supabase
    .from("matches")
    .select("id, season_id, league_id, home_club_id, away_club_id, matchday, status, played_at")
    .eq("season_id", seasonId)
    .order("matchday", { ascending: true })
    .order("played_at", { ascending: true });

  if (fixturesError) {
    throw new Error(`Failed to inspect fixture integrity: ${fixturesError.message}`);
  }

  const fixtureRows = (fixtures ?? []) as Array<{
    id: string;
    season_id: string;
    league_id: string;
    home_club_id: string;
    away_club_id: string;
    matchday: number;
    status: MatchStatus;
    played_at: string | null;
  }>;

  if (fixtureRows.some((match) => match.season_id !== seasonId)) {
    issues.add("invalid_season_reference");
  }

  const duplicateMap = new Map<string, typeof fixtureRows>();
  fixtureRows.forEach((fixture) => {
    const key = `${fixture.home_club_id}:${fixture.away_club_id}:${fixture.season_id}:${fixture.matchday}`;
    const list = duplicateMap.get(key) ?? [];
    list.push(fixture);
    duplicateMap.set(key, list);
  });

  const duplicateIdsToDelete: string[] = [];
  duplicateMap.forEach((rows) => {
    if (rows.length <= 1) {
      return;
    }
    issues.add("duplicate_fixtures");
    const sorted = [...rows].sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") {
        return -1;
      }
      if (a.status !== "completed" && b.status === "completed") {
        return 1;
      }
      return (a.played_at ?? "").localeCompare(b.played_at ?? "");
    });
    sorted.slice(1).forEach((fixture) => duplicateIdsToDelete.push(fixture.id));
  });

  if (duplicateIdsToDelete.length > 0) {
    const { error } = await supabase.from("matches").delete().in("id", duplicateIdsToDelete);
    if (error) {
      throw new Error(`Failed to remove duplicate fixtures: ${error.message}`);
    }
  }

  const appearancesByClubDay = new Map<string, number>();
  fixtureRows.forEach((fixture) => {
    const homeKey = `${fixture.matchday}:${fixture.home_club_id}`;
    const awayKey = `${fixture.matchday}:${fixture.away_club_id}`;
    appearancesByClubDay.set(homeKey, (appearancesByClubDay.get(homeKey) ?? 0) + 1);
    appearancesByClubDay.set(awayKey, (appearancesByClubDay.get(awayKey) ?? 0) + 1);
  });
  const hasDoubleBookedClub = [...appearancesByClubDay.values()].some((count) => count > 1);
  if (hasDoubleBookedClub) {
    issues.add("club_double_booked");
  }

  await ensureStandingsRows(seasonId);
  const { data: standings, error: standingsError } = await supabase
    .from("standings")
    .select("club_id")
    .eq("season_id", seasonId);
  if (standingsError) {
    throw new Error(`Failed to inspect standings integrity: ${standingsError.message}`);
  }

  const standingClubIds = new Set(((standings ?? []) as Array<{ club_id: string }>).map((row) => row.club_id));
  const missingStandings = clubRows.some((club) => !standingClubIds.has(club.id));
  if (missingStandings) {
    issues.add("missing_standings");
    await ensureStandingsRows(seasonId);
  }

  return {
    ok: issues.size === 0,
    detectedIssues: [...issues],
  };
}

export async function initializeSeason(): Promise<SeasonRow> {
  const supabase = getSupabaseClient();
  const season = await getOrCreateActiveSeason();
  await ensureStandingsRows(season.id);

  const initialized = await seasonAlreadyInitialized(season.id);
  if (!initialized) {
    const { data: clubs, error: clubsError } = await supabase
      .from("clubs")
      .select("id, league_id")
      .order("league_id", { ascending: true });
    if (clubsError) {
      throw new Error(`Failed to load clubs for fixture generation: ${clubsError.message}`);
    }

    const groupedByLeague = new Map<string, string[]>();
    ((clubs ?? []) as Array<{ id: string; league_id: string }>).forEach((club) => {
      const leagueClubs = groupedByLeague.get(club.league_id) ?? [];
      leagueClubs.push(club.id);
      groupedByLeague.set(club.league_id, leagueClubs);
    });

    const fixtures: FixtureInsert[] = [];
    groupedByLeague.forEach((clubIds, leagueId) => {
      if (clubIds.length < 2) {
        return;
      }
      fixtures.push(...generateRoundRobinFixtures(leagueId, season.id, clubIds));
    });
    await insertFixtures(fixtures);
  }

  await validateSeasonIntegrity(season.id);
  return season;
}

export async function updateLeagueStandings(leagueId: string, seasonId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const [{ data: clubs, error: clubsError }, { data: matches, error: matchesError }] = await Promise.all([
    supabase.from("clubs").select("id, name").eq("league_id", leagueId),
    supabase
      .from("matches")
      .select("home_club_id, away_club_id, home_goals, away_goals")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId)
      .eq("status", "completed"),
  ]);

  if (clubsError || matchesError) {
    throw new Error(`Failed to recalculate standings: ${clubsError?.message ?? matchesError?.message}`);
  }

  const table = new Map<string, StandingAccumulator>();
  ((clubs ?? []) as Array<{ id: string; name: string }>).forEach((club) => {
    table.set(club.id, {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    });
  });

  ((matches ?? []) as Array<{
    home_club_id: string;
    away_club_id: string;
    home_goals: number | null;
    away_goals: number | null;
  }>).forEach((match) => {
    if (match.home_goals === null || match.away_goals === null) {
      return;
    }
    const home = table.get(match.home_club_id);
    const away = table.get(match.away_club_id);
    if (!home || !away) {
      return;
    }

    home.played += 1;
    away.played += 1;
    home.goals_for += match.home_goals;
    home.goals_against += match.away_goals;
    away.goals_for += match.away_goals;
    away.goals_against += match.home_goals;
    home.goal_difference = home.goals_for - home.goals_against;
    away.goal_difference = away.goals_for - away.goals_against;

    if (match.home_goals > match.away_goals) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
      return;
    }
    if (match.home_goals < match.away_goals) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
      return;
    }
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  });

  const rows = [...table.entries()].map(([clubId, row]) => ({
    league_id: leagueId,
    season_id: seasonId,
    club_id: clubId,
    ...row,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("standings")
    .upsert(rows as never, { onConflict: "league_id,season_id,club_id" });
  if (error) {
    throw new Error(`Failed to persist recalculated standings: ${error.message}`);
  }
}

type ClubSimulationContext = {
  club: ClubRow;
  players: SimPlayer[];
  tactic: TacticRow | null;
};

const clubRating = (context: ClubSimulationContext) => {
  const squadBase = average(
    context.players.map((player) =>
      (player.pace + player.shooting + player.passing + player.dribbling + player.defending + player.physical) / 6,
    ),
  );
  const formModifier = average(context.players.map((player) => (player.form - 50) * 0.12));
  const moraleModifier = average(context.players.map((player) => (player.morale - 70) * 0.09));
  const fatiguePenalty = average(context.players.map((player) => (100 - player.fitness) * 0.11));

  const tacticalModifier = context.tactic
    ? context.tactic.style === "pressing"
      ? context.tactic.pressing * 0.02
      : context.tactic.style === "counter"
        ? 1.8
        : context.tactic.style === "possession"
          ? 1.2
          : 0.6
    : 0;

  return context.club.reputation * 0.22 + squadBase * 0.65 + formModifier + moraleModifier + tacticalModifier - fatiguePenalty;
};

function simulateFixture(contextHome: ClubSimulationContext, contextAway: ClubSimulationContext) {
  const homeRating = clubRating(contextHome);
  const awayRating = clubRating(contextAway);
  const strengthGap = (homeRating - awayRating) / 100;

  const baseTotalGoals = clamp(2.2 + randomBetween(-0.25, 0.25), 1.7, 2.5);
  const homeGoalBias = clamp(0.52 + strengthGap * 0.28 + 0.06, 0.34, 0.76);

  const attackingActions = clamp(Math.round(20 + randomBetween(-4, 5)), 12, 26);
  let homeGoals = 0;
  let awayGoals = 0;
  let homeXg = 0;
  let awayXg = 0;
  const commentary: string[] = [];

  for (let action = 0; action < attackingActions; action += 1) {
    const homeAttack = Math.random() < homeGoalBias;
    const attacker = homeAttack ? contextHome : contextAway;
    const defender = homeAttack ? contextAway : contextHome;
    const attackRating = clubRating(attacker);
    const defenseRating = clubRating(defender);

    const shotProbability = clamp(0.34 + (attackRating - defenseRating) / 360 + randomBetween(-0.05, 0.05), 0.16, 0.52);
    if (Math.random() > shotProbability) {
      continue;
    }

    const bigChanceProbability = clamp(0.13 + (attackRating - defenseRating) / 500, 0.04, 0.22);
    const defensiveErrorProbability = clamp(0.04 + (defenseRating - attackRating) / -650, 0.02, 0.12);
    const isBigChance = Math.random() < bigChanceProbability;
    const isError = Math.random() < defensiveErrorProbability;
    const shotXg = isBigChance ? randomBetween(0.22, 0.48) : randomBetween(0.04, 0.16);
    const conversionProbability = clamp(shotXg + (isError ? 0.18 : 0) + randomBetween(-0.05, 0.03), 0.04, 0.62);

    if (homeAttack) {
      homeXg += shotXg;
    } else {
      awayXg += shotXg;
    }

    if (Math.random() < conversionProbability) {
      if (homeAttack) {
        homeGoals += 1;
      } else {
        awayGoals += 1;
      }
      if (commentary.length < 8) {
        commentary.push(isError ? "Defensive error leads to a goal." : "Clinical finish from open play.");
      }
    }
  }

  const expectedTotal = homeXg + awayXg;
  if (expectedTotal > baseTotalGoals * 1.55 && Math.random() < 0.55) {
    if (homeGoals > awayGoals && homeGoals > 0) {
      homeGoals -= 1;
    } else if (awayGoals > 0) {
      awayGoals -= 1;
    }
  }

  const possessionHome = clamp(
    Math.round(50 + (homeRating - awayRating) * 0.16 + randomBetween(-6, 6)),
    35,
    65,
  );

  return {
    homeGoals: clamp(homeGoals, 0, 6),
    awayGoals: clamp(awayGoals, 0, 6),
    possessionHome,
    xgHome: Number(homeXg.toFixed(2)),
    xgAway: Number(awayXg.toFixed(2)),
    commentary: [
      `Possession split ${possessionHome}-${100 - possessionHome}.`,
      ...commentary,
      "Match simulation complete.",
    ],
  };
}

async function buildClubSimulationContext(fixtures: Array<{ home_club_id: string; away_club_id: string }>) {
  const supabase = getSupabaseClient();
  const clubIds = [...new Set(fixtures.flatMap((fixture) => [fixture.home_club_id, fixture.away_club_id]))];
  if (clubIds.length === 0) {
    return new Map<string, ClubSimulationContext>();
  }

  const [{ data: clubs, error: clubsError }, { data: players, error: playersError }] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, league_id, reputation, manager_id")
      .in("id", clubIds),
    supabase
      .from("players")
      .select("club_id, pace, shooting, passing, dribbling, defending, physical, morale, form, fitness")
      .in("club_id", clubIds),
  ]);

  if (clubsError || playersError) {
    throw new Error(`Failed to load simulation context: ${clubsError?.message ?? playersError?.message}`);
  }

  const managerIds = ((clubs ?? []) as ClubRow[]).map((club) => club.manager_id).filter(Boolean) as string[];
  const tacticsByManagerId = new Map<string, TacticRow>();
  if (managerIds.length > 0) {
    const { data: tactics, error: tacticsError } = await supabase
      .from("tactics")
      .select("manager_id, style, pressing")
      .in("manager_id", managerIds)
      .order("updated_at", { ascending: false });
    if (tacticsError) {
      throw new Error(`Failed to load tactics context: ${tacticsError.message}`);
    }

    ((tactics ?? []) as TacticRow[]).forEach((tactic) => {
      if (!tacticsByManagerId.has(tactic.manager_id)) {
        tacticsByManagerId.set(tactic.manager_id, tactic);
      }
    });
  }

  const playersByClub = new Map<string, SimPlayer[]>();
  ((players ?? []) as SimPlayer[]).forEach((player) => {
    if (!player.club_id) {
      return;
    }
    const clubPlayers = playersByClub.get(player.club_id) ?? [];
    clubPlayers.push(player);
    playersByClub.set(player.club_id, clubPlayers);
  });

  const byId = new Map<string, ClubSimulationContext>();
  ((clubs ?? []) as ClubRow[]).forEach((club) => {
    byId.set(club.id, {
      club,
      players: (playersByClub.get(club.id) ?? []).slice(0, 18),
      tactic: club.manager_id ? tacticsByManagerId.get(club.manager_id) ?? null : null,
    });
  });
  return byId;
}

async function completeFixture(params: {
  fixtureId: string;
  result: { homeGoals: number; awayGoals: number; xgHome: number; xgAway: number; possessionHome: number; commentary: string[] };
}) {
  const supabase = getSupabaseClient();
  const { fixtureId, result } = params;

  const { error } = await supabase
    .from("matches")
    .update({
      home_goals: result.homeGoals,
      away_goals: result.awayGoals,
      xg_home: result.xgHome,
      xg_away: result.xgAway,
      possession_home: result.possessionHome,
      status: "completed",
      commentary: result.commentary,
      played_at: new Date().toISOString(),
    } as never)
    .eq("id", fixtureId)
    .eq("status", "scheduled");

  if (error) {
    throw new Error(`Failed to complete fixture ${fixtureId}: ${error.message}`);
  }
}

export async function simulateOtherLeagueMatches(
  seasonId: string,
  matchday: number,
  excludeFixtureIds: string[] = [],
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: fixtures, error: fixturesError } = await supabase
    .from("matches")
    .select("id, home_club_id, away_club_id, league_id")
    .eq("season_id", seasonId)
    .eq("matchday", matchday)
    .eq("status", "scheduled");
  if (fixturesError) {
    throw new Error(`Failed to fetch AI fixtures: ${fixturesError.message}`);
  }

  const excluded = new Set(excludeFixtureIds);
  const fixtureRows = ((fixtures ?? []) as Array<{
    id: string;
    home_club_id: string;
    away_club_id: string;
    league_id: string;
  }>).filter((fixture) => !excluded.has(fixture.id));
  if (fixtureRows.length === 0) {
    return 0;
  }

  const contextByClub = await buildClubSimulationContext(fixtureRows);
  const affectedLeagues = new Set<string>();

  for (const fixture of fixtureRows) {
    const home = contextByClub.get(fixture.home_club_id);
    const away = contextByClub.get(fixture.away_club_id);
    if (!home || !away) {
      continue;
    }
    const result = simulateFixture(home, away);
    await completeFixture({ fixtureId: fixture.id, result });
    affectedLeagues.add(fixture.league_id);
  }

  for (const leagueId of affectedLeagues) {
    await updateLeagueStandings(leagueId, seasonId);
  }

  return fixtureRows.length;
}

export async function getUpcomingFixturesForClub(clubId: string, seasonId?: string) {
  const supabase = getSupabaseClient();
  const season = seasonId
    ? (
        (
          await supabase
            .from("seasons")
            .select("id, label, current_matchday, status")
            .eq("id", seasonId)
            .maybeSingle()
        ).data as SeasonRow | null
      )
    : await getActiveSeason();
  if (!season) {
    return null;
  }

  const { data: fixtures, error } = await supabase
    .from("matches")
    .select("id, league_id, season_id, home_club_id, away_club_id, matchday, status")
    .eq("season_id", season.id)
    .gte("matchday", season.current_matchday)
    .in("status", ["scheduled", "in_progress"])
    .or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`)
    .order("matchday", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch upcoming fixture: ${error.message}`);
  }

  return ((fixtures ?? [])[0] as
    | {
        id: string;
        league_id: string;
        season_id: string;
        home_club_id: string;
        away_club_id: string;
        matchday: number;
        status: MatchStatus;
      }
    | undefined) ?? null;
}

export async function getLeagueTable(leagueId: string, seasonId: string): Promise<LeagueTableRow[]> {
  const supabase = getSupabaseClient();
  const [{ data: standings, error: standingsError }, { data: clubs, error: clubsError }] = await Promise.all([
    supabase
      .from("standings")
      .select("club_id, played, won, drawn, lost, goals_for, goals_against, goal_difference, points")
      .eq("league_id", leagueId)
      .eq("season_id", seasonId),
    supabase.from("clubs").select("id, name").eq("league_id", leagueId),
  ]);

  if (standingsError || clubsError) {
    throw new Error(`Failed to fetch league table: ${standingsError?.message ?? clubsError?.message}`);
  }

  const clubNameById = new Map(((clubs ?? []) as Array<{ id: string; name: string }>).map((club) => [club.id, club.name]));
  const rows = ((standings ?? []) as Array<{
    club_id: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
  }>).map((standing) => ({
    ...standing,
    club_name: clubNameById.get(standing.club_id) ?? "Unknown Club",
  }));

  return rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.club_name.localeCompare(b.club_name);
  });
}

export async function advanceMatchday(params: {
  seasonId?: string;
  userFixtureId?: string;
  quickSimUserMatch?: boolean;
}): Promise<{ progressed: boolean; requiresUserMatch: boolean; season: SeasonRow }> {
  const supabase = getSupabaseClient();
  const season = params.seasonId
    ? (
        (
          await supabase
            .from("seasons")
            .select("id, label, current_matchday, status")
            .eq("id", params.seasonId)
            .maybeSingle()
        ).data as SeasonRow | null
      )
    : await getActiveSeason();

  if (!season) {
    throw new Error("No active season available.");
  }

  if (season.status === "completed") {
    return { progressed: false, requiresUserMatch: false, season };
  }

  if (params.userFixtureId) {
    const { data: userFixture, error: fixtureError } = await supabase
      .from("matches")
      .select("id, status, home_club_id, away_club_id")
      .eq("id", params.userFixtureId)
      .eq("season_id", season.id)
      .maybeSingle();
    if (fixtureError) {
      throw new Error(`Failed to inspect user fixture: ${fixtureError.message}`);
    }

    const fixture = (userFixture as { id: string; status: MatchStatus; home_club_id: string; away_club_id: string } | null) ?? null;
    if (fixture?.status === "scheduled" && !params.quickSimUserMatch) {
      return { progressed: false, requiresUserMatch: true, season };
    }

    if (fixture?.status === "scheduled" && params.quickSimUserMatch) {
      const contextByClub = await buildClubSimulationContext([fixture]);
      const home = contextByClub.get(fixture.home_club_id);
      const away = contextByClub.get(fixture.away_club_id);
      if (home && away) {
        await completeFixture({
          fixtureId: fixture.id,
          result: simulateFixture(home, away),
        });
      }
    }
  }

  await simulateOtherLeagueMatches(season.id, season.current_matchday, params.userFixtureId ? [params.userFixtureId] : []);

  const { data: remaining, error: remainingError } = await supabase
    .from("matches")
    .select("id")
    .eq("season_id", season.id)
    .eq("matchday", season.current_matchday)
    .eq("status", "scheduled")
    .limit(1);
  if (remainingError) {
    throw new Error(`Failed to check pending fixtures: ${remainingError.message}`);
  }

  if ((remaining ?? []).length > 0) {
    return { progressed: false, requiresUserMatch: true, season };
  }

  const { data: maxMatchdayRows, error: maxMatchdayError } = await supabase
    .from("matches")
    .select("matchday")
    .eq("season_id", season.id)
    .order("matchday", { ascending: false })
    .limit(1);
  if (maxMatchdayError) {
    throw new Error(`Failed to determine season length: ${maxMatchdayError.message}`);
  }
  const maxMatchday = ((maxMatchdayRows ?? [])[0] as { matchday: number } | undefined)?.matchday ?? season.current_matchday;

  if (season.current_matchday >= maxMatchday) {
    const { error } = await supabase
      .from("seasons")
      .update({ status: "completed" } as never)
      .eq("id", season.id);
    if (error) {
      throw new Error(`Failed to complete season: ${error.message}`);
    }
    return {
      progressed: true,
      requiresUserMatch: false,
      season: { ...season, status: "completed" },
    };
  }

  const nextMatchday = season.current_matchday + 1;
  const { error: updateError } = await supabase
    .from("seasons")
    .update({ current_matchday: nextMatchday } as never)
    .eq("id", season.id);
  if (updateError) {
    throw new Error(`Failed to advance matchday: ${updateError.message}`);
  }

  return {
    progressed: true,
    requiresUserMatch: false,
    season: { ...season, current_matchday: nextMatchday },
  };
}

export async function getRecentLeagueResults(leagueId: string, seasonId: string, limit = 10) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id, home_club_id, away_club_id, home_goals, away_goals, matchday, played_at, status")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId)
    .eq("status", "completed")
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load recent results: ${error.message}`);
  }

  return (data ??
    []) as Array<{
      id: string;
      home_club_id: string;
      away_club_id: string;
      home_goals: number;
      away_goals: number;
      matchday: number;
      played_at: string;
      status: MatchStatus;
    }>;
}
