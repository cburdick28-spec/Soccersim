import { getSupabase } from "@/lib/supabase/client";
import type { Player } from "@/types/player";

export type League = {
  id: string;
  name: string;
  country?: string;
  reputation?: number;
  tier?: number;
};

export type Club = {
  id: string;
  league_id: string;
  name: string;
  reputation: number;
  finances: number;
  transfer_budget: number;
  wage_budget: number;
};

type RawPlayerRow = {
  id: string;
  name: string | null;
  age: number | string | null;
  nationality: string | null;
  preferred_position: string | null;
  potential: number | string | null;
  morale: number | string | null;
  fitness: number | string | null;
  form: number | string | null;
  pace: number | string | null;
  shooting: number | string | null;
  passing: number | string | null;
  dribbling: number | string | null;
  defending: number | string | null;
  physical: number | string | null;
  overall?: number | string | null;
  ovr?: number | string | null;
  goalkeeper_diving?: number | string | null;
  goalkeeper_handling?: number | string | null;
  goalkeeper_reflexes?: number | string | null;
  goalkeeper_positioning?: number | string | null;
  gk_diving?: number | string | null;
  gk_handling?: number | string | null;
  gk_reflexes?: number | string | null;
  gk_positioning?: number | string | null;
  diving?: number | string | null;
  handling?: number | string | null;
  reflexes?: number | string | null;
  positioning?: number | string | null;
  club_id: string | null;
  clubs: null | {
    name: string | null;
    league_id: string | null;
    leagues: null | { name: string | null } | Array<{ name: string | null }>;
  };
  [key: string]: unknown;
};

const playerSelect =
  "*, clubs(name, league_id, leagues(name))";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getNumeric = (row: RawPlayerRow, keys: string[], fallback: number) => {
  for (const key of keys) {
    const parsed = toNumber(row[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return fallback;
};

const normalizePosition = (position: string | null | undefined) => {
  if (!position) return "";
  return position.trim().toUpperCase();
};

const getPositionProfile = (position: string) => {
  if (position.includes("GK")) return "GK";
  if (position.includes("CAM")) return "CAM";
  if (position.includes("CM") || position.includes("CDM") || position === "MID") return "CM";
  if (
    position.includes("CB") ||
    position.includes("LB") ||
    position.includes("RB") ||
    position.includes("LWB") ||
    position.includes("RWB") ||
    position === "DEF"
  ) {
    return "CB";
  }
  return "ST";
};

const weightedOverall = (row: RawPlayerRow) => {
  const storedOverall = getNumeric(row, ["overall", "ovr"], NaN);
  if (Number.isFinite(storedOverall) && storedOverall > 0) {
    return clamp(Math.round(storedOverall), 1, 99);
  }

  const pace = getNumeric(row, ["pace", "acceleration", "speed"], 50);
  const shooting = getNumeric(row, ["shooting", "finishing"], 50);
  const passing = getNumeric(row, ["passing"], 50);
  const dribbling = getNumeric(row, ["dribbling"], 50);
  const defending = getNumeric(row, ["defending"], 50);
  const physical = getNumeric(row, ["physical", "physic", "strength"], 50);

  const diving = getNumeric(row, ["goalkeeper_diving", "gk_diving", "diving"], defending);
  const handling = getNumeric(row, ["goalkeeper_handling", "gk_handling", "handling"], physical);
  const reflexes = getNumeric(row, ["goalkeeper_reflexes", "gk_reflexes", "reflexes"], defending);
  const positioning = getNumeric(row, ["goalkeeper_positioning", "gk_positioning", "positioning"], defending);

  const positionProfile = getPositionProfile(normalizePosition(row.preferred_position));
  let overall = 0;

  if (positionProfile === "GK") {
    overall = diving * 0.28 + handling * 0.24 + reflexes * 0.28 + positioning * 0.2;
  } else if (positionProfile === "CAM") {
    overall = passing * 0.4 + dribbling * 0.35 + shooting * 0.25;
  } else if (positionProfile === "CM") {
    overall = passing * 0.4 + defending * 0.3 + physical * 0.3;
  } else if (positionProfile === "CB") {
    overall = defending * 0.45 + physical * 0.35 + pace * 0.2;
  } else {
    overall = pace * 0.34 + shooting * 0.44 + dribbling * 0.22;
  }

  return clamp(Math.round(overall), 1, 99);
};

const toPlayer = (row: RawPlayerRow): Player => {
  const leagueValue = row.clubs?.leagues;
  const leagueName = Array.isArray(leagueValue)
    ? (leagueValue[0]?.name ?? null)
    : (leagueValue?.name ?? null);

  const pace = clamp(Math.round(getNumeric(row, ["pace", "acceleration", "speed"], 50)), 1, 99);
  const shooting = clamp(Math.round(getNumeric(row, ["shooting", "finishing"], 50)), 1, 99);
  const passing = clamp(Math.round(getNumeric(row, ["passing"], 50)), 1, 99);
  const dribbling = clamp(Math.round(getNumeric(row, ["dribbling"], 50)), 1, 99);
  const defending = clamp(Math.round(getNumeric(row, ["defending"], 50)), 1, 99);
  const physical = clamp(Math.round(getNumeric(row, ["physical", "physic", "strength"], 50)), 1, 99);

  const overall = weightedOverall(row);
  const potential = clamp(Math.round(getNumeric(row, ["potential"], overall)), 1, 99);
  const age = clamp(Math.round(getNumeric(row, ["age"], 24)), 15, 50);
  const morale = clamp(Math.round(getNumeric(row, ["morale"], 70)), 1, 99);
  const fitness = clamp(Math.round(getNumeric(row, ["fitness"], 90)), 1, 99);
  const form = clamp(Math.round(getNumeric(row, ["form"], 50)), 1, 99);

  return {
    id: row.id,
    name: (row.name ?? "Unknown Player").toString(),
    age,
    nationality: (row.nationality ?? "Unknown").toString(),
    preferred_position: normalizePosition(row.preferred_position) || "ST",
    potential,
    morale,
    fitness,
    form,
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    club_id: row.club_id,
    club_name: row.clubs?.name ?? null,
    league_name: leagueName,
    overall,
  };
};

export async function getLeagues(): Promise<League[]> {
  const supabase = getSupabase();
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch leagues: ${error.message}`);
  }

  return (leagues ?? []) as League[];
}

export async function getLeagueById(leagueId: string): Promise<League | null> {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  const { data: clubs, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("league_id", leagueId)
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch clubs by league: ${error.message}`);
  }

  return (clubs ?? []) as Club[];
}

export async function getClubById(clubId: string): Promise<Club | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, league_id, name, reputation, finances, transfer_budget, wage_budget")
    .eq("id", clubId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch club: ${error.message}`);
  }

  return ((data as Club | null) ?? null);
}

export async function getPlayers(limit = 50): Promise<Player[]> {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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
