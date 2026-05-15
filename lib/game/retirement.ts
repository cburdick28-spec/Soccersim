import type { Player } from "@/lib/game/types";

export type GeneratedManager = {
  name: string;
  nationality: string;
  tacticalStyle: "balanced" | "pressing" | "counter" | "possession";
  reputation: number;
  experience: number;
  salaryExpectation: number;
  contractLengthYears: number;
};

const randomFromSeed = (seed: number) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

export const shouldRetire = (age: number, seed: number) => {
  if (age < 33) return false;
  const retirementChance = Math.min(0.9, (age - 32) * 0.12);
  return randomFromSeed(seed) < retirementChance;
};

export const retiredPlayerToManager = (
  player: Player,
  seed: number,
): GeneratedManager | null => {
  if (randomFromSeed(seed + 11) > 0.05) {
    return null;
  }

  const styles: GeneratedManager["tacticalStyle"][] = [
    "balanced",
    "pressing",
    "counter",
    "possession",
  ];

  return {
    name: `${player.name} (Manager)`,
    nationality: player.nationality,
    tacticalStyle: styles[Math.floor(randomFromSeed(seed + 12) * styles.length)] ?? "balanced",
    reputation: Math.min(90, Math.round(player.potential * 0.75)),
    experience: 1,
    salaryExpectation: Math.round(player.weeklyWage * 0.6),
    contractLengthYears: 2,
  };
};
