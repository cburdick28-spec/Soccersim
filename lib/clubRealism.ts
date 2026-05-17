export type ClubReputationProfile = {
  stars: string;
  label: string;
  mediaExpectation: string;
  transferPull: string;
  sponsorshipPower: string;
  boardAmbition: string;
};

const MAX_STARS = 5;
const STAR_SCALE = 20;

export function normalizeClubName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getReputationProfile(reputation: number): ClubReputationProfile {
  const clamped = Math.max(1, Math.min(100, Math.round(reputation)));
  const filled = Math.max(1, Math.min(MAX_STARS, Math.round(clamped / STAR_SCALE)));
  const stars = `${"★".repeat(filled)}${"☆".repeat(MAX_STARS - filled)}`;

  if (clamped >= 95) {
    return {
      stars,
      label: "World-class giant",
      mediaExpectation: "Title charge and deep continental run",
      transferPull: "Global elite pull",
      sponsorshipPower: "Premium global partnerships",
      boardAmbition: "Win major trophies now",
    };
  }
  if (clamped >= 85) {
    return {
      stars,
      label: "Champions League contender",
      mediaExpectation: "Top-four challenge and cup run",
      transferPull: "Strong international pull",
      sponsorshipPower: "High-value sponsorship interest",
      boardAmbition: "Qualify for Europe consistently",
    };
  }
  if (clamped >= 75) {
    return {
      stars,
      label: "Strong top-flight club",
      mediaExpectation: "Top-half finish",
      transferPull: "Reliable top-flight pull",
      sponsorshipPower: "Solid national sponsors",
      boardAmbition: "Push toward continental places",
    };
  }
  if (clamped >= 65) {
    return {
      stars,
      label: "Mid-table side",
      mediaExpectation: "Stable mid-table season",
      transferPull: "Selective pull",
      sponsorshipPower: "Steady regional partners",
      boardAmbition: "Stabilize and develop talent",
    };
  }
  return {
    stars,
    label: "Relegation candidate",
    mediaExpectation: "Relegation battle",
    transferPull: "Limited pull",
    sponsorshipPower: "Modest local support",
    boardAmbition: "Avoid relegation",
  };
}

export function validateLeagueCountry(leagueName: string, leagueCountry: string, clubCountry?: string | null): boolean {
  if (!clubCountry) {
    return true;
  }
  const normalizedLeague = normalizeClubName(leagueName);
  const normalizedLeagueCountry = normalizeClubName(leagueCountry);
  const normalizedClubCountry = normalizeClubName(clubCountry);

  const strictLeagueCountryMap: Record<string, string> = {
    [normalizeClubName("Premier League")]: normalizeClubName("England"),
    [normalizeClubName("Bundesliga")]: normalizeClubName("Germany"),
    [normalizeClubName("La Liga")]: normalizeClubName("Spain"),
    [normalizeClubName("Serie A")]: normalizeClubName("Italy"),
    [normalizeClubName("Ligue 1")]: normalizeClubName("France"),
  };

  const expectedCountry = strictLeagueCountryMap[normalizedLeague] ?? normalizedLeagueCountry;
  return expectedCountry === normalizedClubCountry;
}

