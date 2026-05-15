export type InternationalOfferInput = {
  lastTenResultsPoints: number;
  trophiesWon: number;
  managerReputation: number;
  leagueStrength: number;
  clubPerformance: number;
};

export type NationalTeamOffer = {
  nation: string;
  minimumReputation: number;
};

export const nationalTeamTiers: NationalTeamOffer[] = [
  { nation: "Brazil", minimumReputation: 90 },
  { nation: "France", minimumReputation: 90 },
  { nation: "England", minimumReputation: 88 },
  { nation: "Argentina", minimumReputation: 88 },
  { nation: "Portugal", minimumReputation: 82 },
  { nation: "Mexico", minimumReputation: 70 },
  { nation: "Japan", minimumReputation: 68 },
  { nation: "South Africa", minimumReputation: 60 },
  { nation: "Iceland", minimumReputation: 52 },
  { nation: "Jamaica", minimumReputation: 50 },
];

export const calculateManagerReputation = ({
  lastTenResultsPoints,
  trophiesWon,
  managerReputation,
  leagueStrength,
  clubPerformance,
}: InternationalOfferInput) =>
  Math.min(
    99,
    Math.round(
      managerReputation * 0.45 +
        trophiesWon * 6 +
        (lastTenResultsPoints / 30) * 25 +
        leagueStrength * 0.15 +
        clubPerformance * 0.15,
    ),
  );

export const getAvailableInternationalOffers = (score: number) =>
  nationalTeamTiers.filter((offer) => score >= offer.minimumReputation);
