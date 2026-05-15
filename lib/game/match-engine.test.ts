import { describe, expect, test } from "vitest";
import { simulateMatch } from "./match-engine";
import type { Club, Player } from "./types";

const clubA: Club = {
  id: "a",
  name: "Alpha FC",
  leagueId: "l1",
  reputation: 82,
  financeBalance: 90000000,
  managerQuality: 78,
  tacticalStyle: "balanced",
};

const clubB: Club = {
  id: "b",
  name: "Beta FC",
  leagueId: "l1",
  reputation: 70,
  financeBalance: 45000000,
  managerQuality: 69,
  tacticalStyle: "counter",
};

const makePlayer = (id: number, boost = 0): Player => ({
  id: `p-${id}`,
  name: `Player ${id}`,
  age: 24,
  nationality: "England",
  preferredPosition: "CM",
  potential: 80,
  morale: 75,
  fitness: 90,
  form: 70,
  contractYears: 3,
  weeklyWage: 50000,
  injuryStatus: "fit",
  suspensionStatus: "available",
  personality: "professional",
  attributes: {
    pace: 70 + boost,
    shooting: 70 + boost,
    passing: 72 + boost,
    dribbling: 71 + boost,
    defending: 70 + boost,
    physical: 73 + boost,
  },
});

describe("simulateMatch", () => {
  test("returns deterministic output for same seed", () => {
    const squadA = Array.from({ length: 11 }, (_, index) => makePlayer(index, 6));
    const squadB = Array.from({ length: 11 }, (_, index) => makePlayer(index + 30));

    const first = simulateMatch(clubA, clubB, squadA, squadB, 42);
    const second = simulateMatch(clubA, clubB, squadA, squadB, 42);

    expect(first).toEqual(second);
    expect(first.commentary.length).toBeGreaterThan(2);
  });
});
