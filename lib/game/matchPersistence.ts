import { getSupabaseClient } from "@/lib/supabase";
import type { MatchState } from "@/lib/matchSimulator";
import type { Player } from "@/types/player";

type PersistMatchInput = {
  leagueId: string;
  homeClubId: string;
  awayClubId: string;
  state: MatchState;
  homePlayers: Player[];
  awayPlayers: Player[];
};

type StandingRow = {
  id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
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

  if (error || !data?.id) {
    throw new Error(`Failed to fetch current season: ${error?.message ?? "No season available"}`);
  }

  return data.id;
}

async function upsertStanding(params: {
  leagueId: string;
  seasonId: string;
  clubId: string;
  goalsFor: number;
  goalsAgainst: number;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { leagueId, seasonId, clubId, goalsFor, goalsAgainst } = params;

  const isWin = goalsFor > goalsAgainst;
  const isDraw = goalsFor === goalsAgainst;
  const isLoss = goalsFor < goalsAgainst;

  const { data: existing, error: existingError } = await supabase
    .from("standings")
    .select("id, played, won, drawn, lost, goals_for, goals_against, points")
    .eq("league_id", leagueId)
    .eq("season_id", seasonId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read standings: ${existingError.message}`);
  }

  const nextPayload = {
    league_id: leagueId,
    season_id: seasonId,
    club_id: clubId,
    played: (existing as StandingRow | null)?.played ?? 0,
    won: (existing as StandingRow | null)?.won ?? 0,
    drawn: (existing as StandingRow | null)?.drawn ?? 0,
    lost: (existing as StandingRow | null)?.lost ?? 0,
    goals_for: (existing as StandingRow | null)?.goals_for ?? 0,
    goals_against: (existing as StandingRow | null)?.goals_against ?? 0,
    points: (existing as StandingRow | null)?.points ?? 0,
  };

  nextPayload.played += 1;
  nextPayload.won += isWin ? 1 : 0;
  nextPayload.drawn += isDraw ? 1 : 0;
  nextPayload.lost += isLoss ? 1 : 0;
  nextPayload.goals_for += goalsFor;
  nextPayload.goals_against += goalsAgainst;
  nextPayload.points += isWin ? 3 : isDraw ? 1 : 0;

  if (existing) {
    const { error: updateError } = await supabase
      .from("standings")
      .update(nextPayload)
      .eq("id", (existing as StandingRow).id);
    if (updateError) {
      throw new Error(`Failed to update standings: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await supabase.from("standings").insert(nextPayload);
  if (insertError) {
    throw new Error(`Failed to insert standings: ${insertError.message}`);
  }
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
        })
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
    leagueId,
    homeClubId,
    awayClubId,
    state,
    homePlayers,
    awayPlayers,
  } = input;

  const { error: matchError } = await supabase.from("matches").insert({
    season_id: seasonId,
    home_club_id: homeClubId,
    away_club_id: awayClubId,
    home_goals: state.homeScore,
    away_goals: state.awayScore,
    xg_home: Number(state.statsHome.xGEstimate.toFixed(2)),
    xg_away: Number(state.statsAway.xGEstimate.toFixed(2)),
    possession_home: state.statsHome.possession,
    commentary: state.events,
    played_at: new Date().toISOString(),
  });

  if (matchError) {
    throw new Error(`Failed to store match: ${matchError.message}`);
  }

  await Promise.all([
    upsertStanding({
      leagueId,
      seasonId,
      clubId: homeClubId,
      goalsFor: state.homeScore,
      goalsAgainst: state.awayScore,
    }),
    upsertStanding({
      leagueId,
      seasonId,
      clubId: awayClubId,
      goalsFor: state.awayScore,
      goalsAgainst: state.homeScore,
    }),
  ]);

  const homeWin = state.homeScore > state.awayScore;
  const awayWin = state.awayScore > state.homeScore;
  const draw = state.homeScore === state.awayScore;

  await Promise.all([
    updatePlayerMoraleAndForm(homePlayers, homeWin, draw),
    updatePlayerMoraleAndForm(awayPlayers, awayWin, draw),
  ]);
}
