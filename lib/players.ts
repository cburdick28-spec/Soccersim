import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Player } from "@/types/player";

const TABLE_NAME = "fc26_players";
const PLAYER_SELECT =
  "id, short_name, long_name, age, nationality_name, club_name, league_name, player_positions, overall, potential, pace, shooting, passing, dribbling, defending, physic, value_eur, wage_eur";

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

export async function getPlayers(limit = 50): Promise<Player[]> {
  assertSupabaseConfigured();

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
  assertSupabaseConfigured();

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
  assertSupabaseConfigured();

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
  assertSupabaseConfigured();

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
  assertSupabaseConfigured();

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

export async function getLeagues(limit = 200): Promise<string[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("league_name")
    .not("league_name", "is", null)
    .order("league_name", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch leagues: ${error.message}`);
  }

  return [
    ...new Set((data ?? []).map((row) => row.league_name).filter((league): league is string => Boolean(league))),
  ];
}
