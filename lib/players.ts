import { getSupabaseClient } from "@/lib/supabase";
import type { Player } from "@/types/player";

const TABLE_NAME = "fc26_players";
const PLAYER_SELECT =
  "id, short_name, long_name, age, nationality_name, club_name, league_name, player_positions, overall, potential, pace, shooting, passing, dribbling, defending, physic, value_eur, wage_eur";

export async function getPlayers(limit = 50): Promise<Player[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .order("overall", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  console.log("Supabase player:", data?.[0]);

  return (data ?? []) as Player[];
}

export async function getPlayerById(id: number): Promise<Player | null> {
  const supabase = getSupabaseClient();

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

export async function searchPlayers(query: string, leagueName?: string): Promise<Player[]> {
  const supabase = getSupabaseClient();

  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const likeQuery = `%${trimmedQuery}%`;
  let searchQuery = supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .or(
      `short_name.ilike.${likeQuery},long_name.ilike.${likeQuery},club_name.ilike.${likeQuery},nationality_name.ilike.${likeQuery}`,
    )
    .order("overall", { ascending: false, nullsFirst: false });

  if (leagueName) {
    searchQuery = searchQuery.eq("league_name", leagueName);
  }

  const { data, error } = await searchQuery.limit(100);

  if (error) {
    throw new Error(`Failed to search players: ${error.message}`);
  }

  return (data ?? []) as Player[];
}

export async function getPlayersByLeague(league_name: string): Promise<Player[]> {
  const supabase = getSupabaseClient();

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

export async function getPlayersByClubInLeague(leagueName: string, clubName: string): Promise<Player[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(PLAYER_SELECT)
    .eq("league_name", leagueName)
    .eq("club_name", clubName)
    .order("overall", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch players by club and league: ${error.message}`);
  }

  return (data ?? []) as Player[];
}

export async function getTopPlayers(limit: number): Promise<Player[]> {
  const supabase = getSupabaseClient();

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

export async function getLeagues(pageSize = 1000): Promise<string[]> {
  const supabase = getSupabaseClient();
  const leagues = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("league_name")
      .not("league_name", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch leagues: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ league_name: string | null }>;

    for (const row of rows) {
      const leagueName = row.league_name?.trim();
      if (leagueName) {
        leagues.add(leagueName);
      }
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return Array.from(leagues).sort((a, b) => a.localeCompare(b));
}

export async function getClubsByLeague(leagueName: string, pageSize = 1000): Promise<string[]> {
  const supabase = getSupabaseClient();
  const clubs = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("club_name")
      .eq("league_name", leagueName)
      .not("club_name", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch clubs by league: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ club_name: string | null }>;

    for (const row of rows) {
      const clubName = row.club_name?.trim();
      if (clubName) {
        clubs.add(clubName);
      }
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return Array.from(clubs).sort((a, b) => a.localeCompare(b));
}
