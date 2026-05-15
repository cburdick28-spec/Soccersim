export type PlayerAttributes = {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
};

export type Player = {
  id: string;
  name: string;
  age: number;
  nationality: string;
  preferredPosition: string;
  potential: number;
  morale: number;
  fitness: number;
  form: number;
  contractYears: number;
  weeklyWage: number;
  injuryStatus: "fit" | "injured";
  suspensionStatus: "available" | "suspended";
  attributes: PlayerAttributes;
  personality: "leader" | "professional" | "temperamental" | "ambitious";
};

export type Club = {
  id: string;
  name: string;
  leagueId: string;
  reputation: number;
  financeBalance: number;
  managerQuality: number;
  tacticalStyle: "balanced" | "pressing" | "counter" | "possession";
};

export type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  possessionHome: number;
  xgHome: number;
  xgAway: number;
  assists: string[];
  cards: string[];
  injuries: string[];
  substitutions: string[];
  commentary: string[];
};
