import { getSupabase } from "@/lib/supabase/client";

type SeasonStatus = "active" | "processing" | "completed";
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

export type SeasonInitializationVerification = {
  ok: boolean;
  seasonExists: boolean;
  seasonStatus: SeasonStatus | null;
  expectedFixtureCount: number;
  actualFixtureCount: number;
  expectedStandingsCount: number;
  actualStandingsCount: number;
  missingArtifacts: string[];
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

export type GameLoopStatus = "idle" | "simulating" | "in-match" | "finished";

export type GameState = {
  seasonId: string;
  leagueId: string;
  currentMatchday: number;
  userClubId: string;
  status: GameLoopStatus;
};

const FIXTURE_BATCH_SIZE = 400;
const MAX_INITIALIZATION_ATTEMPTS = 3;
const GOAL_VARIANCE = 0.55;
const DRAW_BREAK_RATING_GAP_THRESHOLD = 7;
const DRAW_BREAK_FAVOR_STRONGER_PROBABILITY = 0.62;
const BLOWOUT_REDUCTION_RATING_GAP_THRESHOLD = 12;
const BLOWOUT_REDUCTION_GOAL_GAP_THRESHOLD = 2;
const BLOWOUT_REDUCTION_PROBABILITY = 0.5;
const MIN_FINANCES = 1_000_000;
const MIN_TRANSFER_BUDGET = 250_000;
const MIN_WAGE_BUDGET = 350_000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const deterministicHash = (value: string) =>
  value.split("").reduce((acc, char, index) => (acc + char.charCodeAt(0) * (index + 1)) % 1_000_003, 0);

const createSeasonLabel = (year = new Date().getUTCFullYear()) => `${year}/${year + 1}`;

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const gameStateBySeasonId = new Map<string, GameState>();
const matchdayLocks = new Set<string>();

const setGameState = (state: GameState) => {
  gameStateBySeasonId.set(state.seasonId, state);
  return state;
};

const getGameStateStatus = (seasonId: string): GameLoopStatus => gameStateBySeasonId.get(seasonId)?.status ?? "idle";

export async function getActiveSeason(): Promise<SeasonRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, label, current_matchday, status")
    .in("status", ["active", "processing"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active season: ${error.message}`);
  }

  return (data as SeasonRow | null) ?? null;
}

async function createSeason(): Promise<SeasonRow> {
  const supabase = getSupabase();
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

const selectRangeValue = (seed: number, min: number, max: number) => {
  if (min >= max) {
    return min;
  }
  return min + (seed % (max - min + 1));
};

const getReputationBand = (index: number, total: number, leagueTier: number) => {
  const eliteCount = leagueTier <= 1 ? Math.min(3, Math.max(1, Math.floor(total * 0.1))) : 1;
  const highTierCount = Math.min(10, Math.max(5, Math.floor(total * 0.4)));
  const topCount = Math.max(0, highTierCount - eliteCount);
  const strongCount = Math.max(1, Math.floor(total * 0.25));
  const midCount = Math.max(1, Math.floor(total * 0.2));
  const eliteBoundary = eliteCount;
  const topBoundary = eliteBoundary + topCount;
  const strongBoundary = topBoundary + strongCount;
  const midBoundary = strongBoundary + midCount;

  if (index < eliteBoundary) {
    return { min: 90, max: 100 };
  }
  if (index < topBoundary) {
    return { min: 80, max: 89 };
  }
  if (index < strongBoundary) {
    return { min: 70, max: 79 };
  }
  if (index < midBoundary) {
    return { min: 60, max: 69 };
  }
  return { min: 50, max: 59 };
};

const getFinanceRange = (reputation: number) => {
  if (reputation >= 80) {
    return { min: 150_000_000, max: 500_000_000 };
  }
  if (reputation >= 70) {
    return { min: 40_000_000, max: 150_000_000 };
  }
  if (reputation >= 60) {
    return { min: 10_000_000, max: 60_000_000 };
  }
  return { min: 1_000_000, max: 15_000_000 };
};

async function repairClubEconomyAndReputation() {
  const supabase = getSupabase();
  const [{ data: leagues, error: leaguesError }, { data: clubs, error: clubsError }] = await Promise.all([
    supabase.from("leagues").select("id, tier, reputation"),
    supabase.from("clubs").select("id, league_id, name, reputation"),
  ]);

  if (leaguesError || clubsError) {
    throw new Error(`Failed to load clubs for economy repair: ${leaguesError?.message ?? clubsError?.message}`);
  }

  const leagueRows = (leagues ?? []) as Array<{ id: string; tier: number; reputation: number }>;
  const leagueById = new Map(leagueRows.map((league) => [league.id, league]));
  const clubsByLeague = new Map<string, Array<{ id: string; name: string; reputation: number }>>();

  ((clubs ?? []) as Array<{ id: string; league_id: string; name: string; reputation: number }>).forEach((club) => {
    const grouped = clubsByLeague.get(club.league_id) ?? [];
    grouped.push(club);
    clubsByLeague.set(club.league_id, grouped);
  });

  const updates: Array<{
    id: string;
    reputation: number;
    finances: number;
    transfer_budget: number;
    wage_budget: number;
  }> = [];

  clubsByLeague.forEach((leagueClubs, leagueId) => {
    const league = leagueById.get(leagueId);
    if (!league) {
      return;
    }

    const rankedClubs = [...leagueClubs].sort((a, b) => {
      if (b.reputation !== a.reputation) {
        return b.reputation - a.reputation;
      }
      return a.name.localeCompare(b.name);
    });

    rankedClubs.forEach((club, index) => {
      const band = getReputationBand(index, rankedClubs.length, league.tier);
      const reputationSeed = deterministicHash(`${leagueId}:${club.id}:rep`);
      const reputation = clamp(selectRangeValue(reputationSeed, band.min, band.max), 1, 100);
      const financeRange = getFinanceRange(reputation);
      const financeSeed = deterministicHash(`${leagueId}:${club.id}:fin`);
      const tierBoost = league.tier <= 1 ? 1.08 : league.tier === 2 ? 1.03 : 1;
      const finances = Math.max(
        MIN_FINANCES,
        Math.round(selectRangeValue(financeSeed, financeRange.min, financeRange.max) * tierBoost),
      );
      const transferRatio = 0.22 + (deterministicHash(`${club.id}:transfer`) % 19) / 100;
      const wageRatio = 0.3 + (deterministicHash(`${club.id}:wage`) % 26) / 100;
      const transferBudget = Math.max(MIN_TRANSFER_BUDGET, Math.round(finances * transferRatio));
      const wageBudget = Math.max(MIN_WAGE_BUDGET, Math.round(finances * wageRatio));

      updates.push({
        id: club.id,
        reputation,
        finances,
        transfer_budget: transferBudget,
        wage_budget: wageBudget,
      });
    });
  });

  if (updates.length === 0) {
    return;
  }

  const { error } = await supabase.from("clubs").upsert(updates as never, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to repair club economy and reputation: ${error.message}`);
  }
}

export async function seasonAlreadyInitialized(seasonId: string): Promise<boolean> {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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

  const supabase = getSupabase();
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

const toFixtureKey = (fixture: {
  home_club_id: string;
  away_club_id: string;
  season_id: string;
  matchday: number;
}) => `${fixture.home_club_id}:${fixture.away_club_id}:${fixture.season_id}:${fixture.matchday}`;

const expectedFixturesForLeague = (leagueId: string, seasonId: string, clubIds: string[]) =>
  generateRoundRobinFixtures(leagueId, seasonId, clubIds);

const formatVerificationFailure = (verification: SeasonInitializationVerification) =>
  `Season verification failed: missing=${verification.missingArtifacts.join(", ")} fixtures=${verification.actualFixtureCount}/${verification.expectedFixtureCount} standings=${verification.actualStandingsCount}/${verification.expectedStandingsCount}`;

async function ensureSeasonFixturesComplete(
  seasonId: string,
  repair = true,
): Promise<{ insertedFixtures: number; expectedFixtures: number; missingFixtures: number }> {
  const supabase = getSupabase();
  const [{ data: clubs, error: clubsError }, { data: fixtures, error: fixturesError }] = await Promise.all([
    supabase.from("clubs").select("id, league_id"),
    supabase
      .from("matches")
      .select("id, league_id, season_id, home_club_id, away_club_id, matchday")
      .eq("season_id", seasonId),
  ]);

  if (clubsError || fixturesError) {
    throw new Error(`Failed fixture completeness check: ${clubsError?.message ?? fixturesError?.message}`);
  }

  const groupedByLeague = new Map<string, string[]>();
  ((clubs ?? []) as Array<{ id: string; league_id: string }>).forEach((club) => {
    const current = groupedByLeague.get(club.league_id) ?? [];
    current.push(club.id);
    groupedByLeague.set(club.league_id, current);
  });

  const existingFixtureKeys = new Set(
    ((fixtures ?? []) as Array<{
      home_club_id: string;
      away_club_id: string;
      season_id: string;
      matchday: number;
    }>).map((fixture) => toFixtureKey(fixture)),
  );

  const missingFixtures: FixtureInsert[] = [];
  let expectedFixtures = 0;
  groupedByLeague.forEach((clubIds, leagueId) => {
    if (clubIds.length < 2) {
      return;
    }
    const expected = expectedFixturesForLeague(leagueId, seasonId, clubIds.sort((a, b) => a.localeCompare(b)));
    expectedFixtures += expected.length;
    expected.forEach((fixture) => {
      if (!existingFixtureKeys.has(toFixtureKey(fixture))) {
        missingFixtures.push(fixture);
      }
    });
  });

  if (repair && missingFixtures.length > 0) {
    await insertFixtures(missingFixtures);
  }

  return { insertedFixtures: repair ? missingFixtures.length : 0, expectedFixtures, missingFixtures: missingFixtures.length };
}

type IntegrityIssue =
  | "league_without_clubs"
  | "club_without_league"
  | "orphan_players"
  | "duplicate_fixtures"
  | "missing_fixtures"
  | "club_double_booked"
  | "missing_standings"
  | "invalid_season_reference";

export async function validateSeasonIntegrity(seasonId: string): Promise<{
  ok: boolean;
  detectedIssues: IntegrityIssue[];
}> {
  const supabase = getSupabase();
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

  const fixtureCompleteness = await ensureSeasonFixturesComplete(seasonId, false);
  if (fixtureCompleteness.missingFixtures > 0) {
    issues.add("missing_fixtures");
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

export async function verifySeasonInitialization(seasonId: string): Promise<SeasonInitializationVerification> {
  const supabase = getSupabase();
  const [{ data: seasonRow, error: seasonError }, { data: clubs, error: clubsError }] = await Promise.all([
    supabase.from("seasons").select("id, status").eq("id", seasonId).maybeSingle(),
    supabase.from("clubs").select("id, league_id"),
  ]);

  if (seasonError || clubsError) {
    throw new Error(`Failed season verification preflight: ${seasonError?.message ?? clubsError?.message}`);
  }

  const clubRows = (clubs ?? []) as Array<{ id: string; league_id: string }>;
  const clubsByLeague = new Map<string, number>();
  clubRows.forEach((club) => {
    clubsByLeague.set(club.league_id, (clubsByLeague.get(club.league_id) ?? 0) + 1);
  });

  let expectedFixtureCount = 0;
  clubsByLeague.forEach((clubCount) => {
    if (clubCount >= 2) {
      expectedFixtureCount += clubCount * (clubCount - 1);
    }
  });

  const expectedStandingsCount = clubRows.length;
  const [{ count: actualFixtureCount, error: fixtureCountError }, { count: actualStandingsCount, error: standingsCountError }] =
    await Promise.all([
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("season_id", seasonId),
      supabase.from("standings").select("id", { count: "exact", head: true }).eq("season_id", seasonId),
    ]);

  if (fixtureCountError || standingsCountError) {
    throw new Error(`Failed season verification counts: ${fixtureCountError?.message ?? standingsCountError?.message}`);
  }

  const seasonExists = Boolean(seasonRow);
  const seasonStatus = (seasonRow as { status: SeasonStatus } | null)?.status ?? null;
  const verifiedFixtureCount = actualFixtureCount ?? 0;
  const verifiedStandingsCount = actualStandingsCount ?? 0;
  const missingArtifacts: string[] = [];

  if (!seasonExists) {
    missingArtifacts.push("active season row");
  } else if (seasonStatus !== "active" && seasonStatus !== "processing") {
    missingArtifacts.push("active season status");
  }
  if (verifiedFixtureCount < expectedFixtureCount || verifiedFixtureCount === 0) {
    missingArtifacts.push("fixtures schedule");
  }
  if (verifiedStandingsCount < expectedStandingsCount || verifiedStandingsCount === 0) {
    missingArtifacts.push("standings rows");
  }

  return {
    ok: missingArtifacts.length === 0,
    seasonExists,
    seasonStatus,
    expectedFixtureCount,
    actualFixtureCount: verifiedFixtureCount,
    expectedStandingsCount,
    actualStandingsCount: verifiedStandingsCount,
    missingArtifacts,
  };
}

export async function initializeSeason(): Promise<SeasonRow> {
  let lastError: Error = new Error("Season initialization failed.");
  for (let attempt = 1; attempt <= MAX_INITIALIZATION_ATTEMPTS; attempt += 1) {
    try {
      console.info(`[initializeSeason] attempt=${attempt}: start`);
      await repairClubEconomyAndReputation();
      const season = await getOrCreateActiveSeason();
      await ensureStandingsRows(season.id);
      await ensureSeasonFixturesComplete(season.id);

      const integrity = await validateSeasonIntegrity(season.id);
      if (!integrity.ok) {
        console.warn(`[initializeSeason] integrity issues detected: ${integrity.detectedIssues.join(", ")}`);
      }

      const verification = await verifySeasonInitialization(season.id);
      if (!verification.ok) {
        throw new Error(formatVerificationFailure(verification));
      }

      console.info(
        `[initializeSeason] success season=${season.id} fixtures=${verification.actualFixtureCount} standings=${verification.actualStandingsCount}`,
      );
      return season;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[initializeSeason] attempt=${attempt} failed`, error);
    }
  }
  throw lastError;
}

export async function updateLeagueStandings(leagueId: string, seasonId: string): Promise<void> {
  const supabase = getSupabase();
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
  const avgPlayerRating = average(
    context.players.map((player) =>
      (player.pace + player.shooting + player.passing + player.dribbling + player.defending + player.physical) / 6,
    ),
  );
  const form = average(context.players.map((player) => player.form));
  return avgPlayerRating * 0.6 + context.club.reputation * 0.3 + form * 0.1;
};

function simulateFixture(contextHome: ClubSimulationContext, contextAway: ClubSimulationContext) {
  const homeRating = clubRating(contextHome);
  const awayRating = clubRating(contextAway);
  const strengthGap = homeRating - awayRating;

  const homeExpectedGoals = clamp(1.22 + strengthGap * 0.018 + randomBetween(-0.22, 0.22), 0.2, 2.9);
  const awayExpectedGoals = clamp(1.02 - strengthGap * 0.016 + randomBetween(-0.22, 0.22), 0.2, 2.7);

  let homeGoals = clamp(Math.round(homeExpectedGoals + randomBetween(-GOAL_VARIANCE, GOAL_VARIANCE)), 0, 4);
  let awayGoals = clamp(Math.round(awayExpectedGoals + randomBetween(-GOAL_VARIANCE, GOAL_VARIANCE)), 0, 4);

  const strongerSide = strengthGap >= 0 ? "home" : "away";
  const weakerSide = strongerSide === "home" ? "away" : "home";
  const goalGap = Math.abs(homeGoals - awayGoals);
  const ratingGap = Math.abs(strengthGap);
  if (ratingGap > DRAW_BREAK_RATING_GAP_THRESHOLD && goalGap === 0 && Math.random() < DRAW_BREAK_FAVOR_STRONGER_PROBABILITY) {
    if (strongerSide === "home" && homeGoals < 4) {
      homeGoals += 1;
    } else if (strongerSide === "away" && awayGoals < 4) {
      awayGoals += 1;
    }
  }
  if (
    ratingGap > BLOWOUT_REDUCTION_RATING_GAP_THRESHOLD &&
    goalGap > BLOWOUT_REDUCTION_GOAL_GAP_THRESHOLD &&
    Math.random() < BLOWOUT_REDUCTION_PROBABILITY
  ) {
    if (weakerSide === "home" && homeGoals > 0) {
      homeGoals -= 1;
    }
    if (weakerSide === "away" && awayGoals > 0) {
      awayGoals -= 1;
    }
  }

  const homeXg = clamp(homeExpectedGoals + randomBetween(-0.18, 0.18), 0.1, 3.5);
  const awayXg = clamp(awayExpectedGoals + randomBetween(-0.18, 0.18), 0.1, 3.3);
  const commentary: string[] = [];
  if (homeGoals > awayGoals) {
    commentary.push("Home side converts key chances and controls decisive moments.");
  } else if (awayGoals > homeGoals) {
    commentary.push("Away side executes efficiently and edges the key phases.");
  } else {
    commentary.push("Balanced match with limited separating moments.");
  }

  const possessionHome = clamp(
    Math.round(50 + strengthGap * 0.2 + randomBetween(-5, 5)),
    34,
    66,
  );

  return {
    homeGoals,
    awayGoals,
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
  const supabase = getSupabase();
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
}): Promise<boolean> {
  const supabase = getSupabase();
  const { fixtureId, result } = params;

  const { data, error } = await supabase
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
    .eq("status", "scheduled")
    .select("id");

  if (error) {
    throw new Error(`Failed to complete fixture ${fixtureId}: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

export async function simulateOtherLeagueMatches(
  seasonId: string,
  matchday: number,
  excludeFixtureIds: string[] = [],
): Promise<number> {
  const supabase = getSupabase();
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
  let completedCount = 0;

  for (const fixture of fixtureRows) {
    const home = contextByClub.get(fixture.home_club_id);
    const away = contextByClub.get(fixture.away_club_id);
    if (!home || !away) {
      continue;
    }
    const result = simulateFixture(home, away);
    const transitioned = await completeFixture({ fixtureId: fixture.id, result });
    if (transitioned) {
      affectedLeagues.add(fixture.league_id);
      completedCount += 1;
    }
  }

  for (const leagueId of affectedLeagues) {
    await updateLeagueStandings(leagueId, seasonId);
  }

  return completedCount;
}

export async function getUpcomingFixturesForClub(clubId: string, seasonId?: string) {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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

export async function quickSimUserFixture(params: {
  seasonId: string;
  leagueId: string;
  fixtureId: string;
}): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("matches")
    .select("id, status, home_club_id, away_club_id, season_id, league_id")
    .eq("id", params.fixtureId)
    .eq("season_id", params.seasonId)
    .eq("league_id", params.leagueId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user fixture for quick sim: ${error.message}`);
  }

  const fixture = (data as {
    id: string;
    status: MatchStatus;
    home_club_id: string;
    away_club_id: string;
    season_id: string;
    league_id: string;
  } | null);
  if (!fixture || fixture.status !== "scheduled") {
    return false;
  }

  const contextByClub = await buildClubSimulationContext([fixture]);
  const home = contextByClub.get(fixture.home_club_id);
  const away = contextByClub.get(fixture.away_club_id);
  if (!home || !away) {
    return false;
  }

  const transitioned = await completeFixture({
    fixtureId: fixture.id,
    result: simulateFixture(home, away),
  });
  if (transitioned) {
    await updateLeagueStandings(params.leagueId, params.seasonId);
  }
  return transitioned;
}

async function updateSeasonStatus(seasonId: string, fromStatus: SeasonStatus, toStatus: SeasonStatus) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("seasons")
    .update({ status: toStatus } as never)
    .eq("id", seasonId)
    .eq("status", fromStatus);
  if (error) {
    throw new Error(`Failed to update season status: ${error.message}`);
  }
}

export async function runMatchday(
  seasonId: string,
  leagueId: string,
  userClubId: string,
): Promise<{ progressed: boolean; requiresUserMatch: boolean; season: SeasonRow; gameState: GameState; userFixtureId: string | null }> {
  const supabase = getSupabase();
  const { data: seasonData, error: seasonError } = await supabase
    .from("seasons")
    .select("id, label, current_matchday, status")
    .eq("id", seasonId)
    .maybeSingle();

  if (seasonError) {
    throw new Error(`Failed to load season: ${seasonError.message}`);
  }

  const season = (seasonData as SeasonRow | null);
  if (!season) {
    throw new Error("Season not found.");
  }

  if (season.status === "completed") {
    const gameState = setGameState({
      seasonId,
      leagueId,
      currentMatchday: season.current_matchday,
      userClubId,
      status: "finished",
    });
    return { progressed: false, requiresUserMatch: false, season, gameState, userFixtureId: null };
  }
  if (season.status === "processing") {
    const gameState = setGameState({
      seasonId,
      leagueId,
      currentMatchday: season.current_matchday,
      userClubId,
      status: "simulating",
    });
    return { progressed: false, requiresUserMatch: true, season, gameState, userFixtureId: null };
  }

  const currentStatus = getGameStateStatus(seasonId);
  if (currentStatus === "simulating" || matchdayLocks.has(seasonId)) {
    const gameState = setGameState({
      seasonId,
      leagueId,
      currentMatchday: season.current_matchday,
      userClubId,
      status: "simulating",
    });
    return { progressed: false, requiresUserMatch: true, season, gameState, userFixtureId: null };
  }

  if (currentStatus === "in-match") {
    const { data: pendingUserFixture, error: pendingError } = await supabase
      .from("matches")
      .select("id")
      .eq("season_id", seasonId)
      .eq("league_id", leagueId)
      .eq("matchday", season.current_matchday)
      .eq("status", "scheduled")
      .or(`home_club_id.eq.${userClubId},away_club_id.eq.${userClubId}`)
      .limit(1);
    if (pendingError) {
      throw new Error(`Failed to check pending user fixture: ${pendingError.message}`);
    }
    const pendingUserFixtureId = ((pendingUserFixture ?? [])[0] as { id: string } | undefined)?.id ?? null;
    if (pendingUserFixtureId) {
      const gameState = setGameState({
        seasonId,
        leagueId,
        currentMatchday: season.current_matchday,
        userClubId,
        status: "in-match",
      });
      return { progressed: false, requiresUserMatch: true, season, gameState, userFixtureId: pendingUserFixtureId };
    }
  }

  const { data: lockedSeasonRows, error: lockError } = await supabase
    .from("seasons")
    .update({ status: "processing" } as never)
    .eq("id", seasonId)
    .eq("status", "active")
    .select("id, label, current_matchday, status")
    .limit(1);
  if (lockError) {
    throw new Error(`Failed to acquire season lock: ${lockError.message}`);
  }
  const lockedSeason = ((lockedSeasonRows ?? [])[0] as SeasonRow | undefined) ?? null;
  if (!lockedSeason) {
    const gameState = setGameState({
      seasonId,
      leagueId,
      currentMatchday: season.current_matchday,
      userClubId,
      status: "simulating",
    });
    return { progressed: false, requiresUserMatch: true, season, gameState, userFixtureId: null };
  }

  matchdayLocks.add(seasonId);
  try {
    let gameState = setGameState({
      seasonId,
      leagueId,
      currentMatchday: lockedSeason.current_matchday,
      userClubId,
      status: "simulating",
    });

    const { data: fixtures, error: fixturesError } = await supabase
      .from("matches")
      .select("id, home_club_id, away_club_id, league_id, status")
      .eq("season_id", seasonId)
      .eq("league_id", leagueId)
      .eq("matchday", lockedSeason.current_matchday)
      .eq("status", "scheduled");
    if (fixturesError) {
      throw new Error(`Failed to load matchday fixtures: ${fixturesError.message}`);
    }

    const fixtureRows = (fixtures ?? []) as Array<{
      id: string;
      home_club_id: string;
      away_club_id: string;
      league_id: string;
      status: MatchStatus;
    }>;

    console.info(`[matchday start] season=${seasonId} league=${leagueId} matchday=${lockedSeason.current_matchday}`);

    const userMatch = fixtureRows.find(
      (fixture) => fixture.home_club_id === userClubId || fixture.away_club_id === userClubId,
    ) ?? null;
    const aiMatches = fixtureRows.filter((fixture) => fixture.id !== userMatch?.id);

    console.info(`[ai matches count] count=${aiMatches.length}`);

    let completedAiMatches = 0;
    if (aiMatches.length > 0) {
      const contextByClub = await buildClubSimulationContext(aiMatches);
      for (const fixture of aiMatches) {
        const home = contextByClub.get(fixture.home_club_id);
        const away = contextByClub.get(fixture.away_club_id);
        if (!home || !away) {
          continue;
        }
        const transitioned = await completeFixture({
          fixtureId: fixture.id,
          result: simulateFixture(home, away),
        });
        if (transitioned) {
          completedAiMatches += 1;
        }
      }
    }

    if (userMatch && userMatch.status !== "completed") {
      console.info(`[user match detected] fixture=${userMatch.id}`);
      await updateSeasonStatus(seasonId, "processing", "active");
      gameState = setGameState({
        seasonId,
        leagueId,
        currentMatchday: lockedSeason.current_matchday,
        userClubId,
        status: "in-match",
      });
      if (completedAiMatches > 0) {
        await updateLeagueStandings(leagueId, seasonId);
      }
      return { progressed: false, requiresUserMatch: true, season: { ...lockedSeason, status: "active" }, gameState, userFixtureId: userMatch.id };
    }

    if (completedAiMatches > 0) {
      await updateLeagueStandings(leagueId, seasonId);
    }

    const { data: remaining, error: remainingError } = await supabase
      .from("matches")
      .select("id")
      .eq("season_id", lockedSeason.id)
      .eq("league_id", leagueId)
      .eq("matchday", lockedSeason.current_matchday)
      .eq("status", "scheduled")
      .limit(1);
    if (remainingError) {
      throw new Error(`Failed to check pending fixtures: ${remainingError.message}`);
    }
    if ((remaining ?? []).length > 0) {
      await updateSeasonStatus(seasonId, "processing", "active");
      gameState = setGameState({
        seasonId,
        leagueId,
        currentMatchday: lockedSeason.current_matchday,
        userClubId,
        status: "in-match",
      });
      return { progressed: false, requiresUserMatch: true, season: { ...lockedSeason, status: "active" }, gameState, userFixtureId: null };
    }

    const { data: maxMatchdayRows, error: maxMatchdayError } = await supabase
      .from("matches")
      .select("matchday")
      .eq("season_id", lockedSeason.id)
      .eq("league_id", leagueId)
      .order("matchday", { ascending: false })
      .limit(1);
    if (maxMatchdayError) {
      throw new Error(`Failed to determine season length: ${maxMatchdayError.message}`);
    }
    const maxMatchday = ((maxMatchdayRows ?? [])[0] as { matchday: number } | undefined)?.matchday ?? lockedSeason.current_matchday;

    if (lockedSeason.current_matchday >= maxMatchday) {
      const { error } = await supabase
        .from("seasons")
        .update({ status: "completed" } as never)
        .eq("id", lockedSeason.id)
        .eq("status", "processing");
      if (error) {
        throw new Error(`Failed to complete season: ${error.message}`);
      }
      const finishedSeason = { ...lockedSeason, status: "completed" as const };
      gameState = setGameState({
        seasonId,
        leagueId,
        currentMatchday: lockedSeason.current_matchday,
        userClubId,
        status: "finished",
      });
      console.info(`[matchday end] season=${seasonId} matchday=${lockedSeason.current_matchday}`);
      return { progressed: true, requiresUserMatch: false, season: finishedSeason, gameState, userFixtureId: null };
    }

    const nextMatchday = lockedSeason.current_matchday + 1;
    const { error: updateError } = await supabase
      .from("seasons")
      .update({ current_matchday: nextMatchday, status: "active" } as never)
      .eq("id", lockedSeason.id)
      .eq("status", "processing");
    if (updateError) {
      throw new Error(`Failed to advance matchday: ${updateError.message}`);
    }

    const progressedSeason = { ...lockedSeason, current_matchday: nextMatchday, status: "active" as const };
    gameState = setGameState({
      seasonId,
      leagueId,
      currentMatchday: nextMatchday,
      userClubId,
      status: "idle",
    });
    console.info(`[matchday end] season=${seasonId} matchday=${lockedSeason.current_matchday}`);
    return { progressed: true, requiresUserMatch: false, season: progressedSeason, gameState, userFixtureId: null };
  } finally {
    if (getGameStateStatus(seasonId) === "simulating") {
      setGameState({
        seasonId,
        leagueId,
        currentMatchday: season.current_matchday,
        userClubId,
        status: "idle",
      });
    }
    const { data: processingSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("id", seasonId)
      .eq("status", "processing")
      .limit(1);
    if ((processingSeason ?? []).length > 0) {
      await updateSeasonStatus(seasonId, "processing", "active");
    }
    matchdayLocks.delete(seasonId);
  }
}

export async function advanceMatchday(params: {
  seasonId?: string;
  userFixtureId?: string;
  quickSimUserMatch?: boolean;
}): Promise<{ progressed: boolean; requiresUserMatch: boolean; season: SeasonRow }> {
  const supabase = getSupabase();
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

  let targetLeagueId: string | null = null;
  let targetUserClubId: string | null = null;
  if (params.userFixtureId) {
    const { data: fixtureData, error: fixtureError } = await supabase
      .from("matches")
      .select("id, league_id, home_club_id, away_club_id")
      .eq("id", params.userFixtureId)
      .eq("season_id", season.id)
      .maybeSingle();
    if (fixtureError) {
      throw new Error(`Failed to inspect user fixture: ${fixtureError.message}`);
    }
    const fixture = (fixtureData as {
      id: string;
      league_id: string;
      home_club_id: string;
      away_club_id: string;
    } | null);
    if (fixture) {
      targetLeagueId = fixture.league_id;
      targetUserClubId = fixture.home_club_id;
      if (params.quickSimUserMatch) {
        await quickSimUserFixture({
          seasonId: season.id,
          leagueId: fixture.league_id,
          fixtureId: fixture.id,
        });
      }
    }
  }

  if (!targetLeagueId || !targetUserClubId) {
    const { data: fallbackFixture, error: fallbackError } = await supabase
      .from("matches")
      .select("league_id, home_club_id")
      .eq("season_id", season.id)
      .eq("matchday", season.current_matchday)
      .eq("status", "scheduled")
      .limit(1)
      .maybeSingle();
    if (fallbackError) {
      throw new Error(`Failed to determine matchday context: ${fallbackError.message}`);
    }
    const fallback = (fallbackFixture as { league_id: string; home_club_id: string } | null);
    if (!fallback) {
      return { progressed: false, requiresUserMatch: false, season };
    }
    targetLeagueId = fallback.league_id;
    targetUserClubId = fallback.home_club_id;
  }

  const outcome = await runMatchday(season.id, targetLeagueId, targetUserClubId);
  return {
    progressed: outcome.progressed,
    requiresUserMatch: outcome.requiresUserMatch,
    season: outcome.season,
  };
}

export async function getRecentLeagueResults(leagueId: string, seasonId: string, limit = 10) {
  const supabase = getSupabase();
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
