import { getSupabaseClient } from "@/lib/supabase";

type LeagueRow = {
  id: string;
  reputation: number;
  tier: number;
};

type ClubRow = {
  id: string;
  name: string;
  reputation: number;
  league_id: string | null;
};

type SeasonRow = {
  id: string;
  year: number;
  current_matchday: number;
  status: "active" | "completed";
};

type MatchRow = {
  id: string;
  league_id: string;
  matchday: number;
  home_club_id: string;
  away_club_id: string;
};

type FixtureInput = {
  home_club_id: string;
  away_club_id: string;
  league_id: string;
  season_id: string;
  matchday: number;
  status: "scheduled";
};

function getSeasonLabel(year: number) {
  return `${year}/${year + 1}`;
}

function chunkEvenly<T>(items: T[], bucketCount: number): T[][] {
  const buckets = Array.from({ length: bucketCount }, () => [] as T[]);
  const baseSize = Math.floor(items.length / bucketCount);
  const remainder = items.length % bucketCount;

  let offset = 0;
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const size = baseSize + (bucketIndex < remainder ? 1 : 0);
    buckets[bucketIndex] = items.slice(offset, offset + size);
    offset += size;
  }

  return buckets;
}

async function getOrCreateActiveSeason(): Promise<SeasonRow> {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("seasons")
    .select("id, year, current_matchday, status")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read active season: ${existingError.message}`);
  }

  if (existing) {
    return existing as SeasonRow;
  }

  const year = new Date().getUTCFullYear();
  const { data: created, error: createError } = await supabase
    .from("seasons")
    .insert({
      year,
      label: getSeasonLabel(year),
      current_matchday: 1,
      status: "active",
    } as never)
    .select("id, year, current_matchday, status")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create season: ${createError?.message ?? "Unknown error"}`);
  }

  return created as SeasonRow;
}

function buildRoundRobinFixtures(clubIds: string[], leagueId: string, seasonId: string): FixtureInput[] {
  if (clubIds.length < 2) {
    return [];
  }

  const hasBye = clubIds.length % 2 !== 0;
  const rotation = hasBye ? [...clubIds, "__BYE__"] : [...clubIds];
  const rounds = rotation.length - 1;
  const matchesPerRound = rotation.length / 2;
  const firstLeg: Array<Array<{ home: string; away: string }>> = [];

  for (let round = 0; round < rounds; round += 1) {
    const pairings: Array<{ home: string; away: string }> = [];
    for (let pairing = 0; pairing < matchesPerRound; pairing += 1) {
      const home = rotation[pairing];
      const away = rotation[rotation.length - 1 - pairing];
      if (home !== "__BYE__" && away !== "__BYE__") {
        const shouldFlip = round % 2 === 1;
        pairings.push(shouldFlip ? { home: away, away: home } : { home, away });
      }
    }
    firstLeg.push(pairings);

    const fixed = rotation[0];
    const moved = rotation.pop();
    if (!moved) {
      break;
    }
    rotation.splice(1, 0, moved);
    rotation[0] = fixed;
  }

  const fixtures: FixtureInput[] = [];
  firstLeg.forEach((pairings, roundIndex) => {
    pairings.forEach(({ home, away }) => {
      fixtures.push({
        home_club_id: home,
        away_club_id: away,
        league_id: leagueId,
        season_id: seasonId,
        matchday: roundIndex + 1,
        status: "scheduled",
      });
    });
  });

  firstLeg.forEach((pairings, roundIndex) => {
    pairings.forEach(({ home, away }) => {
      fixtures.push({
        home_club_id: away,
        away_club_id: home,
        league_id: leagueId,
        season_id: seasonId,
        matchday: rounds + roundIndex + 1,
        status: "scheduled",
      });
    });
  });

  return fixtures;
}

export async function assignClubsToLeagues(clubs: ClubRow[], leagues: LeagueRow[]): Promise<void> {
  if (leagues.length === 0) {
    throw new Error("Cannot assign clubs: no leagues found.");
  }

  if (clubs.length < leagues.length) {
    throw new Error("Cannot assign clubs: fewer clubs than leagues.");
  }

  const sortedClubs = [...clubs].sort(
    (a, b) => b.reputation - a.reputation || a.name.localeCompare(b.name, "en"),
  );
  const sortedLeagues = [...leagues].sort(
    (a, b) => a.tier - b.tier || b.reputation - a.reputation || a.id.localeCompare(b.id, "en"),
  );
  const distributed = chunkEvenly(sortedClubs, sortedLeagues.length);

  if (distributed.some((group) => group.length === 0)) {
    throw new Error("Cannot assign clubs: at least one league would be empty.");
  }

  const supabase = getSupabaseClient();
  const updates = distributed.flatMap((group, leagueIndex) =>
    group.map((club) => ({
      id: club.id,
      league_id: sortedLeagues[leagueIndex].id,
    })),
  );

  if (updates.length === 0) {
    return;
  }

  const { error } = await supabase.from("clubs").upsert(updates as never, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to assign clubs to leagues: ${error.message}`);
  }
}

export async function generateFixturesForLeague(leagueId: string, seasonId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const resolvedSeasonId = seasonId ?? (await getOrCreateActiveSeason()).id;
  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("id")
    .eq("league_id", leagueId)
    .order("reputation", { ascending: false })
    .order("name", { ascending: true });

  if (clubsError) {
    throw new Error(`Failed to read clubs for fixtures: ${clubsError.message}`);
  }

  const clubIds = ((clubs ?? []) as Array<{ id: string }>).map((club) => club.id);
  if (clubIds.length < 2) {
    throw new Error("Each league must have at least 2 clubs to generate fixtures.");
  }

  const fixtures = buildRoundRobinFixtures(clubIds, leagueId, resolvedSeasonId);
  const { error: clearError } = await supabase
    .from("matches")
    .delete()
    .eq("season_id", resolvedSeasonId)
    .eq("league_id", leagueId)
    .eq("status", "scheduled");

  if (clearError) {
    throw new Error(`Failed to clear old fixtures: ${clearError.message}`);
  }

  const { error: insertError } = await supabase.from("matches").insert(fixtures as never);
  if (insertError) {
    throw new Error(`Failed to insert fixtures: ${insertError.message}`);
  }
}

export async function generateSeasonMatchdays(seasonId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  const resolvedSeasonId = seasonId ?? (await getOrCreateActiveSeason()).id;

  const { data, error } = await supabase
    .from("matches")
    .select("id, league_id, matchday, home_club_id, away_club_id")
    .eq("season_id", resolvedSeasonId)
    .eq("status", "scheduled")
    .order("league_id", { ascending: true })
    .order("matchday", { ascending: true });

  if (error) {
    throw new Error(`Failed to read fixtures for matchday generation: ${error.message}`);
  }

  const matches = (data ?? []) as MatchRow[];
  if (matches.length === 0) {
    return;
  }

  const byLeague = new Map<string, MatchRow[]>();
  matches.forEach((match) => {
    const list = byLeague.get(match.league_id) ?? [];
    list.push(match);
    byLeague.set(match.league_id, list);
  });

  const updates: Array<{ id: string; matchday: number }> = [];
  byLeague.forEach((leagueMatches) => {
    const sorted = [...leagueMatches].sort(
      (a, b) =>
        a.matchday - b.matchday ||
        a.home_club_id.localeCompare(b.home_club_id, "en") ||
        a.away_club_id.localeCompare(b.away_club_id, "en"),
    );

    let currentSlot = 1;
    let lastKey = "";
    sorted.forEach((match) => {
      const key = `${match.matchday}`;
      if (lastKey && key !== lastKey) {
        currentSlot += 1;
      }
      updates.push({ id: match.id, matchday: currentSlot });
      lastKey = key;
    });
  });

  if (updates.length === 0) {
    return;
  }

  const { error: updateError } = await supabase.from("matches").upsert(updates as never, { onConflict: "id" });
  if (updateError) {
    throw new Error(`Failed to update matchdays: ${updateError.message}`);
  }
}

export async function getCurrentMatchday(seasonId?: string): Promise<number> {
  const supabase = getSupabaseClient();
  const resolvedSeasonId = seasonId ?? (await getOrCreateActiveSeason()).id;
  const { data, error } = await supabase
    .from("seasons")
    .select("current_matchday")
    .eq("id", resolvedSeasonId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to read current matchday: ${error?.message ?? "No season found"}`);
  }

  return (data as { current_matchday: number }).current_matchday;
}

export async function isSeasonComplete(seasonId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const resolvedSeasonId = seasonId ?? (await getOrCreateActiveSeason()).id;

  const [{ count: totalCount, error: totalError }, { count: completedCount, error: completedError }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("season_id", resolvedSeasonId),
      supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("season_id", resolvedSeasonId)
        .eq("status", "completed"),
    ]);

  if (totalError || completedError) {
    throw new Error(
      `Failed to check season completion: ${totalError?.message ?? completedError?.message ?? "Unknown error"}`,
    );
  }

  const total = totalCount ?? 0;
  const completed = completedCount ?? 0;
  return total > 0 && completed >= total;
}

export async function advanceMatchday(seasonId?: string): Promise<number> {
  const supabase = getSupabaseClient();
  const season = seasonId ? ({ id: seasonId } as SeasonRow) : await getOrCreateActiveSeason();
  const currentMatchday = await getCurrentMatchday(season.id);
  const completed = await isSeasonComplete(season.id);

  if (completed) {
    const { error: completeError } = await supabase
      .from("seasons")
      .update({ status: "completed" } as never)
      .eq("id", season.id);
    if (completeError) {
      throw new Error(`Failed to complete season: ${completeError.message}`);
    }
    return currentMatchday;
  }

  const nextMatchday = currentMatchday + 1;
  const { error } = await supabase
    .from("seasons")
    .update({ current_matchday: nextMatchday } as never)
    .eq("id", season.id);

  if (error) {
    throw new Error(`Failed to advance matchday: ${error.message}`);
  }

  return nextMatchday;
}

export async function validateSeasonIntegrity(seasonId?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const resolvedSeasonId = seasonId ?? (await getOrCreateActiveSeason()).id;
  const [{ data: leaguesData, error: leaguesError }, { data: clubsData, error: clubsError }] = await Promise.all([
    supabase.from("leagues").select("id"),
    supabase.from("clubs").select("id, league_id"),
  ]);

  if (leaguesError || clubsError) {
    throw new Error(
      `Failed to validate season integrity: ${leaguesError?.message ?? clubsError?.message ?? "Unknown error"}`,
    );
  }

  const leagues = ((leaguesData ?? []) as Array<{ id: string }>).map((league) => league.id);
  const clubs = (clubsData ?? []) as Array<{ id: string; league_id: string | null }>;

  if (clubs.some((club) => !club.league_id)) {
    return false;
  }

  const leagueClubCount = new Map<string, number>();
  clubs.forEach((club) => {
    if (!club.league_id) {
      return;
    }
    leagueClubCount.set(club.league_id, (leagueClubCount.get(club.league_id) ?? 0) + 1);
  });

  if (leagues.some((leagueId) => (leagueClubCount.get(leagueId) ?? 0) < 2)) {
    return false;
  }

  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select("league_id, home_club_id, away_club_id, matchday")
    .eq("season_id", resolvedSeasonId);

  if (matchesError) {
    throw new Error(`Failed to validate fixtures: ${matchesError.message}`);
  }

  const matches = (matchesData ?? []) as Array<{
    league_id: string | null;
    home_club_id: string | null;
    away_club_id: string | null;
    matchday: number | null;
  }>;

  const fixtureKeys = new Set<string>();
  for (const match of matches) {
    if (!match.league_id || !match.home_club_id || !match.away_club_id || !match.matchday) {
      return false;
    }
    if (!leagues.includes(match.league_id)) {
      return false;
    }
    const key = `${match.league_id}|${match.home_club_id}|${match.away_club_id}|${match.matchday}`;
    if (fixtureKeys.has(key)) {
      return false;
    }
    fixtureKeys.add(key);
  }

  return true;
}

export async function initializeSeason(): Promise<SeasonRow> {
  const supabase = getSupabaseClient();
  const [{ data: leaguesData, error: leaguesError }, { data: clubsData, error: clubsError }] = await Promise.all([
    supabase.from("leagues").select("id, reputation, tier"),
    supabase.from("clubs").select("id, name, reputation, league_id"),
  ]);

  if (leaguesError || clubsError) {
    throw new Error(
      `Failed to initialize season data: ${leaguesError?.message ?? clubsError?.message ?? "Unknown error"}`,
    );
  }

  const leagues = (leaguesData ?? []) as LeagueRow[];
  const clubs = (clubsData ?? []) as ClubRow[];

  if (leagues.length === 0) {
    throw new Error("Cannot initialize season: no leagues found.");
  }
  if (clubs.length < leagues.length * 2) {
    throw new Error("Cannot initialize season: not enough clubs to keep all leagues playable.");
  }

  const clubCountByLeague = new Map<string, number>();
  clubs.forEach((club) => {
    if (!club.league_id) {
      return;
    }
    clubCountByLeague.set(club.league_id, (clubCountByLeague.get(club.league_id) ?? 0) + 1);
  });

  const hasMissingClubAssignments = clubs.some((club) => !club.league_id);
  const hasThinLeague = leagues.some((league) => (clubCountByLeague.get(league.id) ?? 0) < 2);
  if (hasMissingClubAssignments || hasThinLeague) {
    await assignClubsToLeagues(clubs, leagues);
  }

  const season = await getOrCreateActiveSeason();
  const isValidBeforeFixtures = await validateSeasonIntegrity(season.id);
  if (!isValidBeforeFixtures) {
    const { data: refreshedClubs, error: refreshedClubsError } = await supabase
      .from("clubs")
      .select("id, name, reputation, league_id");
    if (refreshedClubsError) {
      throw new Error(`Failed to refresh clubs for repair: ${refreshedClubsError.message}`);
    }
    await assignClubsToLeagues((refreshedClubs ?? []) as ClubRow[], leagues);
  }

  await Promise.all(leagues.map((league) => generateFixturesForLeague(league.id, season.id)));
  await generateSeasonMatchdays(season.id);

  const isValidAfterFixtures = await validateSeasonIntegrity(season.id);
  if (!isValidAfterFixtures) {
    await Promise.all(leagues.map((league) => generateFixturesForLeague(league.id, season.id)));
    await generateSeasonMatchdays(season.id);
    const isValidAfterRegeneration = await validateSeasonIntegrity(season.id);
    if (!isValidAfterRegeneration) {
      throw new Error("Season integrity validation failed after regeneration.");
    }
  }

  const { data: updatedSeason, error: updateSeasonError } = await supabase
    .from("seasons")
    .update({ current_matchday: 1, status: "active" } as never)
    .eq("id", season.id)
    .select("id, year, current_matchday, status")
    .single();

  if (updateSeasonError || !updatedSeason) {
    throw new Error(`Failed to activate season: ${updateSeasonError?.message ?? "Unknown error"}`);
  }

  return updatedSeason as SeasonRow;
}
