import type { Club, MatchResult, Player } from "@/lib/game/types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const averageSquadQuality = (players: Player[]) => {
  const weights = players.map((player) =>
    (player.attributes.pace +
      player.attributes.shooting +
      player.attributes.passing +
      player.attributes.dribbling +
      player.attributes.defending +
      player.attributes.physical) /
    6,
  );
  return weights.reduce((total, value) => total + value, 0) / Math.max(weights.length, 1);
};

const seededRandom = (seed: number) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

export const simulateMatch = (
  homeClub: Club,
  awayClub: Club,
  homeSquad: Player[],
  awaySquad: Player[],
  seed: number,
): MatchResult => {
  const homeQuality = averageSquadQuality(homeSquad);
  const awayQuality = averageSquadQuality(awaySquad);

  const homeMomentum =
    homeClub.managerQuality * 0.15 +
    homeClub.reputation * 0.1 +
    homeQuality * 0.45 +
    4;
  const awayMomentum =
    awayClub.managerQuality * 0.15 + awayClub.reputation * 0.1 + awayQuality * 0.45;

  const randomSwingHome = seededRandom(seed + 1) * 1.2;
  const randomSwingAway = seededRandom(seed + 2) * 1.2;

  const xgHome = clamp((homeMomentum + randomSwingHome - awayMomentum * 0.35) / 18, 0.3, 4.2);
  const xgAway = clamp((awayMomentum + randomSwingAway - homeMomentum * 0.3) / 18, 0.2, 3.8);

  const homeGoals = Math.max(0, Math.round(xgHome + seededRandom(seed + 3) - 0.4));
  const awayGoals = Math.max(0, Math.round(xgAway + seededRandom(seed + 4) - 0.45));
  const possessionHome = clamp(
    Math.round(50 + (homeQuality - awayQuality) * 0.4 + (seededRandom(seed + 5) - 0.5) * 12),
    33,
    67,
  );

  const commentary = [
    `Kick-off: ${homeClub.name} vs ${awayClub.name}.`,
    `${homeClub.name} settle quickly with ${possessionHome}% possession.`,
    `xG watch: ${homeClub.name} ${xgHome.toFixed(2)} - ${awayClub.name} ${xgAway.toFixed(2)}.`,
    `Full-time: ${homeClub.name} ${homeGoals} - ${awayGoals} ${awayClub.name}.`,
  ];

  return {
    homeGoals,
    awayGoals,
    possessionHome,
    xgHome: Number(xgHome.toFixed(2)),
    xgAway: Number(xgAway.toFixed(2)),
    assists: ["Midfield creator", "Wide playmaker"],
    cards: seededRandom(seed + 6) > 0.62 ? ["Yellow card - tactical foul"] : [],
    injuries: seededRandom(seed + 7) > 0.9 ? ["Minor hamstring strain"] : [],
    substitutions: ["60' fresh winger", "72' defensive reinforcement"],
    commentary,
  };
};
