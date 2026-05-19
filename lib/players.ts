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
  goalkeeper_kicking?: number | string | null;
  gk_diving?: number | string | null;
  gk_handling?: number | string | null;
  gk_reflexes?: number | string | null;
  gk_positioning?: number | string | null;
  gk_kicking?: number | string | null;
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
  const normalized = value.trim().replace(/,/g, ".");
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

const getFirstNumeric = (row: RawPlayerRow, keys: string[]) => {
  for (const key of keys) {
    const parsed = toNumber(row[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const getRoundedClampedNumeric = (row: RawPlayerRow, keys: string[], fallback: number, min = 1, max = 99) =>
  clamp(Math.round(getNumeric(row, keys, fallback)), min, max);

const normalizePosition = (position: string | null | undefined) => {
  if (!position) return "";
  return position.trim().toUpperCase();
};

const positionTokens = (position: string) => position.split(/[^A-Z0-9]+/).filter(Boolean);
const hasPositionToken = (position: string, token: string) => positionTokens(position).includes(token);

const getPositionProfile = (position: string) => {
  if (hasPositionToken(position, "GK")) return "GK";
  if (hasPositionToken(position, "CAM")) return "CAM";
  if (hasPositionToken(position, "CM") || hasPositionToken(position, "CDM") || position === "MID") return "CM";
  if (
    hasPositionToken(position, "CB") ||
    hasPositionToken(position, "LB") ||
    hasPositionToken(position, "RB") ||
    hasPositionToken(position, "LWB") ||
    hasPositionToken(position, "RWB") ||
    position === "DEF"
  ) {
    return "CB";
  }
  return "ST";
};

const weightedOverall = (row: RawPlayerRow) => {
  const storedOverall = getNumeric(row, ["overall", "ovr", "overall_rating", "rating"], NaN);
  if (Number.isFinite(storedOverall) && storedOverall >= 1) {
    return clamp(Math.round(storedOverall), 1, 99);
  }

  const positionProfile = getPositionProfile(normalizePosition(row.preferred_position));
  if (positionProfile === "GK") {
    const diving = getFirstNumeric(row, [
      "goalkeeper_diving",
      "gk_diving",
      "goalkeeping_diving",
      "goalkeeperDiving",
      "gkDiving",
      "diving",
    ]);
    const handling = getFirstNumeric(row, [
      "goalkeeper_handling",
      "gk_handling",
      "goalkeeping_handling",
      "goalkeeperHandling",
      "gkHandling",
      "handling",
    ]);
    const kicking = getFirstNumeric(row, [
      "goalkeeper_kicking",
      "gk_kicking",
      "goalkeeping_kicking",
      "goalkeeperKicking",
      "gkKicking",
      "kicking",
    ]);
    const reflexes = getFirstNumeric(row, [
      "goalkeeper_reflexes",
      "gk_reflexes",
      "goalkeeping_reflexes",
      "goalkeeperReflexes",
      "gkReflexes",
      "reflexes",
    ]);
    const positioning = getFirstNumeric(row, [
      "goalkeeper_positioning",
      "gk_positioning",
      "goalkeeping_positioning",
      "goalkeeperPositioning",
      "gkPositioning",
      "positioning",
    ]);

    console.log({
      name: row.name ?? "Unknown Player",
      diving,
      handling,
      reflexes,
      positioning,
    });

    const safeDiving = diving ?? 50;
    const safeHandling = handling ?? 50;
    const safeKicking = kicking ?? 50;
    const safeReflexes = reflexes ?? 50;
    const safePositioning = positioning ?? 50;
    const overall =
      safeDiving * 0.24 +
      safeHandling * 0.2 +
      safeKicking * 0.12 +
      safeReflexes * 0.28 +
      safePositioning * 0.16;
    return clamp(Math.round(overall), 1, 99);
  }

  const pace = getNumeric(row, ["pace", "acceleration", "speed"], 50);
  const shooting = getNumeric(row, ["shooting", "finishing"], 50);
  const passing = getNumeric(row, ["passing"], 50);
  const dribbling = getNumeric(row, ["dribbling"], 50);
  const defending = getNumeric(row, ["defending"], 50);
  const physical = getNumeric(row, ["physical", "physic", "strength"], 50);
  let overall = 0;
  if (positionProfile === "CAM") {
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

  const pace = getRoundedClampedNumeric(row, ["pace", "acceleration", "speed"], 50);
  const shooting = getRoundedClampedNumeric(row, ["shooting", "finishing"], 50);
  const passing = getRoundedClampedNumeric(row, ["passing"], 50);
  const dribbling = getRoundedClampedNumeric(row, ["dribbling"], 50);
  const defending = getRoundedClampedNumeric(row, ["defending"], 50);
  const physical = getRoundedClampedNumeric(row, ["physical", "physic", "strength"], 50);

  const overall = weightedOverall(row);
  const potential = getRoundedClampedNumeric(row, ["potential"], overall);
  const age = getRoundedClampedNumeric(row, ["age"], 24, 15, 50);
  const morale = getRoundedClampedNumeric(row, ["morale"], 70);
  const fitness = getRoundedClampedNumeric(row, ["fitness"], 90);
  const form = getRoundedClampedNumeric(row, ["form"], 50);

  return {
    id: row.id,
    name: row.name ?? "Unknown Player",
    age,
    nationality: row.nationality ?? "Unknown",
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
