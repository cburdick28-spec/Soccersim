export type LeagueSeed = {
  name: string;
  country: string;
  reputation: number;
};

export type PlayerSeed = {
  name: string;
  age: number;
  nationality: string;
  preferredPosition: string;
};

export type ClubSeed = {
  name: string;
  leagueName: string;
  country: string;
  players: PlayerSeed[];
};

const leagueNames = [
  ["Premier League", "England"],
  ["Championship", "England"],
  ["League One", "England"],
  ["La Liga", "Spain"],
  ["La Liga 2", "Spain"],
  ["Primera RFEF", "Spain"],
  ["Serie A", "Italy"],
  ["Serie B", "Italy"],
  ["Bundesliga", "Germany"],
  ["2. Bundesliga", "Germany"],
  ["Ligue 1", "France"],
  ["Ligue 2", "France"],
  ["Eredivisie", "Netherlands"],
  ["Primeira Liga", "Portugal"],
  ["Belgian Pro League", "Belgium"],
  ["Super Lig", "Turkey"],
  ["Brasileirao", "Brazil"],
  ["Serie B Brasil", "Brazil"],
  ["Liga Profesional", "Argentina"],
  ["Primera Nacional", "Argentina"],
  ["MLS", "United States"],
  ["Liga MX", "Mexico"],
  ["Scottish Premiership", "Scotland"],
  ["Scottish Championship", "Scotland"],
  ["Saudi Pro League", "Saudi Arabia"],
  ["J1 League", "Japan"],
  ["J2 League", "Japan"],
  ["K League 1", "South Korea"],
  ["A-League", "Australia"],
  ["Danish Superliga", "Denmark"],
  ["Swiss Super League", "Switzerland"],
  ["Austrian Bundesliga", "Austria"],
  ["Greek Super League", "Greece"],
  ["Polish Ekstraklasa", "Poland"],
  ["Czech First League", "Czech Republic"],
  ["Ukrainian Premier League", "Ukraine"],
  ["Romanian SuperLiga", "Romania"],
  ["Serbian SuperLiga", "Serbia"],
  ["Croatian League", "Croatia"],
  ["Norwegian Eliteserien", "Norway"],
  ["Swedish Allsvenskan", "Sweden"],
  ["Finnish Veikkausliiga", "Finland"],
  ["Chinese Super League", "China"],
  ["Indian Super League", "India"],
  ["South African Premiership", "South Africa"],
  ["Egyptian Premier League", "Egypt"],
  ["Moroccan Botola", "Morocco"],
  ["Colombian Primera A", "Colombia"],
  ["Chilean Primera Division", "Chile"],
  ["Peruvian Liga 1", "Peru"],
] as const;

const nationalTeams = [
  "Argentina", "Australia", "Austria", "Belgium", "Bolivia", "Bosnia and Herzegovina",
  "Brazil", "Bulgaria", "Cameroon", "Canada", "Chile", "China", "Colombia", "Costa Rica",
  "Croatia", "Czech Republic", "Denmark", "Ecuador", "Egypt", "England", "Finland", "France",
  "Germany", "Ghana", "Greece", "Hungary", "Iceland", "India", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kenya", "Mexico", "Morocco",
  "Netherlands", "New Zealand", "Nigeria", "North Macedonia", "Norway", "Paraguay", "Peru",
  "Poland", "Portugal", "Qatar", "Romania", "Saudi Arabia", "Scotland", "Senegal", "Serbia",
  "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain", "Sweden", "Switzerland", "Tunisia",
  "Turkey", "Ukraine", "United States", "Uruguay", "Venezuela", "Wales", "Algeria", "Albania",
  "Angola", "Armenia", "Azerbaijan", "Belarus", "Benin", "Congo", "Cyprus", "DR Congo", "El Salvador",
  "Estonia", "Georgia", "Guatemala", "Honduras", "Kazakhstan", "Kosovo", "Latvia", "Lithuania",
  "Luxembourg", "Mali", "Montenegro", "Mozambique", "Northern Ireland", "Oman", "Panama", "Syria",
  "Tanzania", "Trinidad and Tobago", "Uganda", "United Arab Emirates", "Uzbekistan", "Vietnam",
  "Zambia", "Zimbabwe", "Guinea", "Burkina Faso", "Gabon", "Libya", "Madagascar", "Mauritania",
] as const;

export const topLeagues: LeagueSeed[] = leagueNames.map(([name, country], index) => ({
  name,
  country,
  reputation: Math.max(45, 95 - index),
}));

export const topNationalTeams = nationalTeams.slice(0, 110);

const defaultClubCount = 20;

const clubCountByLeague: Record<string, number> = {
  Championship: 24,
  "League One": 24,
  "La Liga 2": 22,
  "2. Bundesliga": 18,
  "Ligue 1": 18,
  "Ligue 2": 18,
  Eredivisie: 18,
  "Primeira Liga": 18,
  "Belgian Pro League": 16,
  "Scottish Premiership": 12,
  "Scottish Championship": 10,
  "Swiss Super League": 12,
  "Austrian Bundesliga": 12,
  "Danish Superliga": 12,
  "Croatian League": 10,
  "Finnish Veikkausliiga": 12,
  "Indian Super League": 12,
};

export const getLeagueKey = (league: Pick<LeagueSeed, "name" | "country">) =>
  `${league.name} • ${league.country}`;

const getClubName = (league: LeagueSeed, index: number) => `${league.name} Club ${index + 1}`;

const buildPlayers = (clubName: string, country: string): PlayerSeed[] => {
  return Array.from({ length: 25 }, (_, index) => {
    const playerNumber = index + 1;
    const preferredPosition =
      playerNumber <= 2 ? "GK" : playerNumber <= 8 ? "DEF" : playerNumber <= 16 ? "MID" : "ATT";

    return {
      name: `${clubName} Player ${playerNumber}`,
      age: 18 + ((playerNumber * 3 + clubName.length) % 17),
      nationality: country,
      preferredPosition,
    };
  });
};

export const clubsByLeague: Record<string, ClubSeed[]> = topLeagues.reduce(
  (accumulator, league) => {
    const key = getLeagueKey(league);
    const clubCount = clubCountByLeague[league.name] ?? defaultClubCount;

    const clubs = Array.from({ length: clubCount }, (_, index) => {
      const name = getClubName(league, index);
      return {
        name,
        leagueName: league.name,
        country: league.country,
        players: buildPlayers(name, league.country),
      };
    });

    accumulator[key] = clubs;
    return accumulator;
  },
  {} as Record<string, ClubSeed[]>,
);
