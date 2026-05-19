import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export const SEASON_STATUS_VALUES = ["active", "paused", "completed"] as const;
export const ACTIVE_SEASON_STATUS_VALUES = ["active", "paused"] as const;
export type SupportedSeasonStatus = (typeof SEASON_STATUS_VALUES)[number];

const GAMEPLAY_TABLE_COLUMNS = {
  seasons: ["id", "save_id", "league_id", "current_matchday", "status", "completed", "created_at"] as const,
  matches: [
    "id",
    "season_id",
    "league_id",
    "home_club_id",
    "away_club_id",
    "matchday",
    "status",
    "home_goals",
    "away_goals",
    "xg_home",
    "xg_away",
    "possession_home",
    "commentary",
    "played_at",
  ] as const,
  standings: [
    "id",
    "league_id",
    "season_id",
    "club_id",
    "played",
    "won",
    "drawn",
    "lost",
    "goals_for",
    "goals_against",
    "goal_difference",
    "points",
  ] as const,
  saves: ["id", "user_id", "mode", "data", "updated_at"] as const,
  clubs: ["id", "league_id", "name", "reputation", "finances", "transfer_budget", "wage_budget", "manager_id"] as const,
} as const;

type GameplayTable = keyof typeof GAMEPLAY_TABLE_COLUMNS;
type GameplayColumn<T extends GameplayTable> = (typeof GAMEPLAY_TABLE_COLUMNS)[T][number];

type GameplaySchemaValidationResult = {
  ok: boolean;
  message: string;
  failures: Array<{ table: GameplayTable | "supabase"; details: string }>;
};

export function gameplayColumns<T extends GameplayTable>(_: T, columns: readonly GameplayColumn<T>[]) {
  return columns.join(", ");
}

const REQUIRED_GAMEPLAY_SCHEMA_SELECTS: Record<GameplayTable, string> = {
  seasons: gameplayColumns("seasons", GAMEPLAY_TABLE_COLUMNS.seasons),
  matches: gameplayColumns("matches", GAMEPLAY_TABLE_COLUMNS.matches),
  standings: gameplayColumns("standings", GAMEPLAY_TABLE_COLUMNS.standings),
  saves: gameplayColumns("saves", GAMEPLAY_TABLE_COLUMNS.saves),
  clubs: gameplayColumns("clubs", GAMEPLAY_TABLE_COLUMNS.clubs),
};

let gameplaySchemaValidationPromise: Promise<GameplaySchemaValidationResult> | null = null;

const formatGameplaySchemaMessage = (
  failures: GameplaySchemaValidationResult["failures"],
  fallback: string,
) => {
  if (failures.length === 0) {
    return fallback;
  }

  const details = failures.map(({ table, details: failure }) => `${table}: ${failure}`).join("; ");
  return `Gameplay schema validation failed. Apply the Supabase gameplay schema migrations. ${details}`;
};

async function validateGameplaySchema(): Promise<GameplaySchemaValidationResult> {
  if (!isSupabaseConfigured) {
    const failures = [
      {
        table: "supabase" as const,
        details: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
    ];
    return {
      ok: false,
      message: formatGameplaySchemaMessage(failures, "Gameplay schema validation failed."),
      failures,
    };
  }

  const supabase = getSupabase();
  const checks = await Promise.all(
    (Object.keys(REQUIRED_GAMEPLAY_SCHEMA_SELECTS) as GameplayTable[]).map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select(REQUIRED_GAMEPLAY_SCHEMA_SELECTS[table], { head: true, count: "exact" })
        .limit(1);

      if (!error) {
        return null;
      }

      return {
        table,
        details: error.message,
      };
    }),
  );

  const failures = checks.filter((value): value is NonNullable<typeof value> => value !== null);

  return {
    ok: failures.length === 0,
    message: formatGameplaySchemaMessage(failures, "Gameplay schema validation succeeded."),
    failures,
  };
}

async function getGameplaySchemaValidation(): Promise<GameplaySchemaValidationResult> {
  if (!gameplaySchemaValidationPromise) {
    gameplaySchemaValidationPromise = validateGameplaySchema();
  }

  return gameplaySchemaValidationPromise;
}

export async function warmGameplaySchemaValidation() {
  const validation = await getGameplaySchemaValidation();

  if (!validation.ok) {
    console.error("[gameplay schema] validation failed:", validation.message);
  }
}

export async function assertGameplaySchemaReady(context: string) {
  const validation = await getGameplaySchemaValidation();

  if (!validation.ok) {
    console.error(`[${context}] ${validation.message}`);
    throw new Error(validation.message);
  }
}
