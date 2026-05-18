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

const toGamePath = (leagueId: string, clubId: string) =>
  `/solo/game?leagueId=${encodeURIComponent(leagueId)}&clubId=${encodeURIComponent(clubId)}`;

export async function initializeCareerAction(formData: FormData) {
  const leagueId = getRequired(formData.get("leagueId"), "league");
  const clubId = getRequired(formData.get("clubId"), "club");
  try {
    const season = await initializeSeason();
    await runMatchday(season.id, leagueId, clubId);
  } catch (err) {
    console.error("[initializeCareerAction] Season initialization failed:", err);
  }
  redirect(toGamePath(leagueId, clubId));
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
