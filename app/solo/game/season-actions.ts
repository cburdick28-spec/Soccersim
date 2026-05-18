"use server";

import { redirect } from "next/navigation";
import { initializeSeason, quickSimUserFixture, runMatchday } from "@/lib/game/seasonEngine";

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

export async function initializeCareerAction(formData: FormData) {
  const leagueId = getRequired(formData.get("leagueId"), "league");
  const clubId = getRequired(formData.get("clubId"), "club");
  try {
    console.info("[initializeCareerAction] Initializing season...");
    const season = await initializeSeason();
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
