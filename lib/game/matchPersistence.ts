import { getSupabaseClient } from "@/lib/supabase";
import { advanceMatchday, updateLeagueStandings } from "@/lib/game/seasonEngine";
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

async function getCurrentSeasonId(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const season = (data as { id: string } | null) ?? null;
  if (error || !season?.id) {
    throw new Error(`Failed to fetch current season: ${error?.message ?? "No season available"}`);
  }

  return season.id;
}

async function updatePlayerMoraleAndForm(players: Player[], didWin: boolean, didDraw: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const moraleDelta = didWin ? 4 : didDraw ? 1 : -3;
  const formDelta = didWin ? 5 : didDraw ? 1 : -4;

  await Promise.all(
    players.map(async (player) => {
      const { error } = await supabase
        .from("players")
        .update({
          morale: clamp(player.morale + moraleDelta, 1, 99),
          form: clamp(player.form + formDelta, 1, 99),
          fitness: clamp(player.fitness - 3, 1, 99),
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

  const { error: matchError } = await supabase
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
    .eq("status", "scheduled");

  if (matchError) {
    throw new Error(`Failed to store match: ${matchError.message}`);
  }

  await updateLeagueStandings(leagueId, seasonId);

  const homeWin = state.homeScore > state.awayScore;
  const awayWin = state.awayScore > state.homeScore;
  const draw = state.homeScore === state.awayScore;

  await Promise.all([
    updatePlayerMoraleAndForm(homePlayers, homeWin, draw),
    updatePlayerMoraleAndForm(awayPlayers, awayWin, draw),
  ]);

  await advanceMatchday({
    seasonId,
    userFixtureId: fixtureId,
  });
}
