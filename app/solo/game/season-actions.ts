"use server";

import { redirect } from "next/navigation";
import { initializeSeason, quickSimUserFixture, runMatchday } from "@/lib/game/seasonEngine";
import { getSupabase } from "@/lib/supabase/client";

const getRequired = (value: FormDataEntryValue | null, field: string) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new Error(`Missing ${field}.`);
  }
  return normalized;
};

const toGamePath = (leagueId: string, clubId: string, status?: { initStatus?: string; initError?: string }) => {
  const params = new URLSearchParams({
    leagueId,
    clubId,
  });
  if (status?.initStatus) {
    params.set("initStatus", status.initStatus);
  }
  if (status?.initError) {
    params.set("initError", status.initError);
  }
  return `/solo/game?${params.toString()}`;
};
// Keep URL query payload short and readable while preserving useful context.
const MAX_INITIALIZATION_ERROR_LENGTH = 240;

async function logInitializationFixtureAudit(seasonId: string, selectedClubId: string, currentMatchday: number) {
  const supabase = getSupabase();

  const [{ data: allFixtures, error: allFixturesError }, { data: md1, error: md1Error }, { data: userFixtures, error: userFixturesError }] =
    await Promise.all([
      supabase.from("matches").select("*").eq("season_id", seasonId),
      supabase.from("matches").select("*").eq("season_id", seasonId).eq("matchday", 1),
      supabase
        .from("matches")
        .select("*")
        .eq("season_id", seasonId)
        .eq("matchday", currentMatchday)
        .or(`home_club_id.eq.${selectedClubId},away_club_id.eq.${selectedClubId}`),
    ]);

  if (allFixturesError || md1Error || userFixturesError) {
    console.warn("[initializeCareerAction] Fixture audit query failed", {
      allFixturesError: allFixturesError?.message,
      md1Error: md1Error?.message,
      userFixturesError: userFixturesError?.message,
    });
    return;
  }

  console.info("ALL FIXTURES", allFixtures);
  console.info("MATCHDAY 1", md1);
  console.info("USER FIXTURES", userFixtures);
}

export async function initializeCareerAction(formData: FormData) {
  const leagueId = getRequired(formData.get("leagueId"), "league");
  const clubId = getRequired(formData.get("clubId"), "club");
  try {
    console.info("[initializeCareerAction] Initializing season...");
    const season = await initializeSeason();
    await logInitializationFixtureAudit(season.id, clubId, season.current_matchday);
    console.info(`[initializeCareerAction] Season ready season=${season.id}`);
    redirect(toGamePath(leagueId, clubId, { initStatus: "success" }));
  } catch (err) {
    console.error("[Initialize Season Failed]");
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown initialization failure";
    redirect(toGamePath(leagueId, clubId, { initError: message.slice(0, MAX_INITIALIZATION_ERROR_LENGTH) }));
  }
}

export async function quickSimUpcomingFixtureAction(formData: FormData) {
  const seasonId = getRequired(formData.get("seasonId"), "season");
  const leagueId = getRequired(formData.get("leagueId"), "league");
  const clubId = getRequired(formData.get("clubId"), "club");
  const fixtureId = getRequired(formData.get("fixtureId"), "fixture");
  try {
    await quickSimUserFixture({ seasonId, leagueId, fixtureId });
    await runMatchday(seasonId, leagueId, clubId);
  } catch (err) {
    console.error("[quickSimUpcomingFixtureAction] Quick sim failed:", err);
  }
  redirect(toGamePath(leagueId, clubId));
}

export async function advanceMatchdayAction(formData: FormData) {
  const seasonId = getRequired(formData.get("seasonId"), "season");
  const leagueId = getRequired(formData.get("leagueId"), "league");
  const clubId = getRequired(formData.get("clubId"), "club");
  try {
    await runMatchday(seasonId, leagueId, clubId);
  } catch (err) {
    console.error("[advanceMatchdayAction] Matchday advance failed:", err);
  }
  redirect(toGamePath(leagueId, clubId));
}
