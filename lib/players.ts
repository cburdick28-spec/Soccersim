import { getSupabaseClient } from "@/lib/supabase";
import type { Player } from "@/types/player";

export type League = {
  id: string;
  name: string;
  country: string;
  reputation: number;
  tier: number;
};

export type Club = {
  id: string;
  league_id: string;
  name: string;
  reputation: number;
  finances: number;
};

type RawPlayerRow = {
  id: string;
  name: string;
  age: number;
  nationality: string;
  preferred_position: string;
  potential: number;
  morale: number;
  fitness: number;
  form: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  club_id: string | null;
  clubs: null | {
    name: string | null;
    league_id: string | null;
    leagues: null | { name: string | null } | Array<{ name: string | null }>;
  };
};

const playerSelect =
  "id, name, age, nationality, preferred_position, potential, morale, fitness, form, pace, shooting, passing, dribbling, defending, physical, club_id, clubs(name, league_id, leagues(name))";

const toPlayer = (row: RawPlayerRow): Player => {
  const leagueValue = row.clubs?.leagues;
  const leagueName = Array.isArray(leagueValue)
    ? (leagueValue[0]?.name ?? null)
    : (leagueValue?.name ?? null);

  const overall = Math.round(
    (row.pace + row.shooting + row.passing + row.dribbling + row.defending + row.physical) / 6,
  );

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    nationality: row.nationality,
    preferred_position: row.preferred_position,
    potential: row.potential,
    morale: row.morale,
    fitness: row.fitness,
    form: row.form,
    pace: row.pace,
    shooting: row.shooting,
    passing: row.passing,
    dribbling: row.dribbling,
    defending: row.defending,
    physical: row.physical,
    club_id: row.club_id,
    club_name: row.clubs?.name ?? null,
    league_name: leagueName,
    overall,
  };
};

export async function getLeagues(limit = 200): Promise<League[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, country, reputation, tier")
    .order("tier", { ascending: true })
    .order("reputation", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch leagues: ${error.message}`);
  }

  const leagues = (data ?? []) as League[];
  console.log("[getLeagues] result:", leagues.length, "leagues", leagues.slice(0, 3).map((l) => ({ id: l.id, name: l.name })));
  return leagues;
}

export async function getLeagueById(leagueId: string): Promise<League | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, country, reputation, tier")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch league: ${error.message}`);
  }

  return ((data as League | null) ?? null);
}

export async function getClubsByLeague(leagueId: string): Promise<Club[]> {
  console.log("[getClubsByLeague] querying for leagueId:", leagueId);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, league_id, name, reputation, finances")
    .eq("league_id", leagueId)
    .order("reputation", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch clubs by league: ${error.message}`);
  }

  const clubs = (data ?? []) as Club[];
  console.log("[getClubsByLeague] result:", clubs.length, "clubs for leagueId:", leagueId, clubs.slice(0, 3).map((c) => ({ id: c.id, name: c.name })));
  return clubs;
}

export async function getClubById(clubId: string): Promise<Club | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, league_id, name, reputation, finances")
    .eq("id", clubId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch club: ${error.message}`);
  }

  return ((data as Club | null) ?? null);
}

export async function getPlayers(limit = 50): Promise<Player[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select(playerSelect)
    .order("potential", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  return ((data ?? []) as RawPlayerRow[]).map(toPlayer);
}

export async function getPlayersByLeague(leagueId: string): Promise<Player[]> {
  const supabase = getSupabaseClient();
  const { data: clubs, error: clubError } = await supabase
    .from("clubs")
    .select("id")
    .eq("league_id", leagueId);

  if (clubError) {
    throw new Error(`Failed to fetch league clubs: ${clubError.message}`);
  }

  const clubIds = ((clubs ?? []) as Array<{ id: string }>).map((club) => club.id);
  if (clubIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("players")
    .select(playerSelect)
    .in("club_id", clubIds)
    .order("potential", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to fetch players by league: ${error.message}`);
  }

  return ((data ?? []) as RawPlayerRow[]).map(toPlayer);
}

export async function getPlayersByClub(clubId: string, limit = 100): Promise<Player[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select(playerSelect)
    .eq("club_id", clubId)
    .order("potential", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch players by club: ${error.message}`);
  }

  return ((data ?? []) as RawPlayerRow[]).map(toPlayer);
}

export async function searchPlayers(query: string, leagueId?: string): Promise<Player[]> {
  const supabase = getSupabaseClient();
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const likeQuery = `%${trimmedQuery}%`;
  let playerQuery = supabase
    .from("players")
    .select(playerSelect)
    .or(`name.ilike.${likeQuery},nationality.ilike.${likeQuery},preferred_position.ilike.${likeQuery}`)
    .order("potential", { ascending: false })
    .limit(200);

  if (leagueId) {
    const { data: clubs, error: clubError } = await supabase
      .from("clubs")
      .select("id")
      .eq("league_id", leagueId);

    if (clubError) {
      throw new Error(`Failed to fetch league clubs for search: ${clubError.message}`);
    }

    const clubIds = ((clubs ?? []) as Array<{ id: string }>).map((club) => club.id);
    if (clubIds.length === 0) {
      return [];
    }

    playerQuery = playerQuery.in("club_id", clubIds);
  }

  const { data, error } = await playerQuery;
  if (error) {
    throw new Error(`Failed to search players: ${error.message}`);
  }

  return ((data ?? []) as RawPlayerRow[]).map(toPlayer);
}
