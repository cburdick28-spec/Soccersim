import { getSupabaseClient } from "@/lib/supabase";
import { runMatchday, updateLeagueStandings } from "@/lib/game/seasonEngine";
import type { MatchState } from "@/lib/matchSimulator";
import type { Player } from "@/types/player";

type PersistMatchInput = {
  fixtureId: string;
  leagueId: string;
  userClubId: string;
  homeClubId: string;
  awayClubId: string;
  state: MatchState;
  homePlayers: Player[];
  awayPlayers: Player[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const BASE_FORM_VALUE = 45;
const FORM_POINTS_MULTIPLIER = 16;
const MIN_FITNESS_DROP = 8;
const FITNESS_DROP_VARIANCE = 5;

async function getCurrentSeasonId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const season = (data as { id: string } | null) ?? null;
  if (error || !season?.id) {
    throw new Error(`Failed to fetch current season: ${error?.message ?? "No season available"}`);
  }

  return season.id;
}

async function calculateRecentForm(clubId: string, seasonId: string, leagueId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("matches")
    .select("home_club_id, away_club_id, home_goals, away_goals")
    .eq("season_id", seasonId)
    .eq("league_id", leagueId)
    .eq("status", "completed")
    .or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`)
    .order("played_at", { ascending: false })
    .limit(3);

  if (error) {
    throw new Error(`Failed to calculate recent form: ${error.message}`);
  }

  const matches = (data ?? []) as Array<{
    home_club_id: string;
    away_club_id: string;
    home_goals: number | null;
    away_goals: number | null;
  }>;
  if (matches.length === 0) {
    return 50;
  }

  const totalPoints = matches.reduce((total, match) => {
    if (match.home_goals === null || match.away_goals === null) {
      return total;
    }
    const isHome = match.home_club_id === clubId;
    const goalsFor = isHome ? match.home_goals : match.away_goals;
    const goalsAgainst = isHome ? match.away_goals : match.home_goals;
    if (goalsFor > goalsAgainst) {
      return total + 3;
    }
    if (goalsFor === goalsAgainst) {
      return total + 1;
    }
    return total;
  }, 0);

  const averagePoints = totalPoints / matches.length;
  return clamp(Math.round(BASE_FORM_VALUE + averagePoints * FORM_POINTS_MULTIPLIER), 1, 99);
}

async function updatePlayerMoraleAndForm(
  players: Player[],
  didWin: boolean,
  didDraw: boolean,
  clubId: string,
  seasonId: string,
  leagueId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const moraleDelta = didWin ? 5 : didDraw ? 0 : -5;
  const formValue = await calculateRecentForm(clubId, seasonId, leagueId);

  await Promise.all(
    players.map(async (player) => {
      const fitnessDrop = MIN_FITNESS_DROP + Math.floor(Math.random() * FITNESS_DROP_VARIANCE);
      const { error } = await supabase
        .from("players")
        .update({
          morale: clamp(player.morale + moraleDelta, 1, 99),
          form: formValue,
          fitness: clamp(player.fitness - fitnessDrop, 1, 99),
        } as never)
        .eq("id", player.id);
      if (error) {
        throw new Error(`Failed to update player state: ${error.message}`);
      }
    }),
  );
}

export async function persistMatchAndProgress(input: PersistMatchInput): Promise<void> {
  const supabase = getSupabaseClient();
  const seasonId = await getCurrentSeasonId();
  const {
    fixtureId,
    leagueId,
    userClubId,
    homeClubId,
    awayClubId,
    state,
    homePlayers,
    awayPlayers,
  } = input;

  const { data: fixture, error: fixtureError } = await supabase
    .from("matches")
    .select("id, season_id, league_id, home_club_id, away_club_id, status, matchday")
    .eq("id", fixtureId)
    .maybeSingle();

  if (fixtureError) {
    throw new Error(`Failed to load fixture: ${fixtureError.message}`);
  }
  const fixtureRow = (fixture as {
    id: string;
    season_id: string;
    league_id: string;
    home_club_id: string;
    away_club_id: string;
    status: "scheduled" | "in_progress" | "completed";
    matchday: number;
  } | null);
  if (!fixtureRow) {
    throw new Error("Fixture not found.");
  }
  if (fixtureRow.season_id !== seasonId) {
    throw new Error("Fixture does not belong to the active season.");
  }
  if (fixtureRow.league_id !== leagueId) {
    throw new Error("Fixture does not belong to the selected league.");
  }
  if (fixtureRow.home_club_id !== homeClubId || fixtureRow.away_club_id !== awayClubId) {
    throw new Error("Fixture clubs do not match submitted match clubs.");
  }
  if (![homeClubId, awayClubId].includes(userClubId)) {
    throw new Error("User club is not part of this fixture.");
  }
  if (fixtureRow.status === "completed") {
    return;
  }

  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("id, league_id")
    .in("id", [homeClubId, awayClubId]);
  if (clubsError) {
    throw new Error(`Failed to validate clubs for fixture: ${clubsError.message}`);
  }
  const clubRows = (clubs ?? []) as Array<{ id: string; league_id: string }>;
  if (clubRows.length !== 2 || clubRows.some((club) => club.league_id !== leagueId)) {
    throw new Error("Fixture clubs are not in the same league.");
  }

  const { data: completedRows, error: matchError } = await supabase
    .from("matches")
    .update({
      home_goals: state.homeScore,
      away_goals: state.awayScore,
      xg_home: Number(state.statsHome.xGEstimate.toFixed(2)),
      xg_away: Number(state.statsAway.xGEstimate.toFixed(2)),
      possession_home: state.statsHome.possession,
      commentary: state.events,
      status: "completed",
      played_at: new Date().toISOString(),
    } as never)
    .eq("id", fixtureId)
    .eq("status", "scheduled")
    .select("id");

  if (matchError) {
    throw new Error(`Failed to store match: ${matchError.message}`);
  }
  if ((completedRows ?? []).length === 0) {
    return;
  }

  await updateLeagueStandings(leagueId, seasonId);

  const homeWin = state.homeScore > state.awayScore;
  const awayWin = state.awayScore > state.homeScore;
  const draw = state.homeScore === state.awayScore;

  await Promise.all([
    updatePlayerMoraleAndForm(homePlayers, homeWin, draw, homeClubId, seasonId, leagueId),
    updatePlayerMoraleAndForm(awayPlayers, awayWin, draw, awayClubId, seasonId, leagueId),
  ]);

  await runMatchday(seasonId, leagueId, userClubId);
}
