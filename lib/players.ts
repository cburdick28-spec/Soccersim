import { supabase } from "@/lib/supabase";
import type { Player } from "@/types/player";

const TABLE_NAME = "fc26_players";
const PLAYER_SELECT =
  "id, short_name, long_name, age, nationality_name, club_name, league_name, player_positions, overall, potential, pace, shooting, passing, dribbling, defending, physic, value_eur, wage_eur";

export async function getPlayers(limit = 50): Promise<Player[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .order("overall", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  return (data ?? []) as Player[];
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch player by id: ${error.message}`);
  }

  return (data as Player | null) ?? null;
}

export async function searchPlayers(query: string): Promise<Player[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const likeQuery = `%${trimmedQuery}%`;
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .or(
      `short_name.ilike.${likeQuery},long_name.ilike.${likeQuery},club_name.ilike.${likeQuery},nationality_name.ilike.${likeQuery}`,
    )
    .order("overall", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to search players: ${error.message}`);
  }

  return (data ?? []) as Player[];
}

export async function getPlayersByLeague(league_name: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .eq("league_name", league_name)
    .order("overall", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch players by league: ${error.message}`);
  }

  return (data ?? []) as Player[];
}

export async function getTopPlayers(limit: number): Promise<Player[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .order("overall", { ascending: false, nullsFirst: false })
    .order("potential", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch top players: ${error.message}`);
  }

  return (data ?? []) as Player[];
}
