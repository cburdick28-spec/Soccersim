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

const countryNameRoots: Record<string, string[]> = {
  England: ["London", "Manchester", "Liverpool", "Birmingham", "Leeds", "Newcastle", "Bristol", "Sheffield"],
  Spain: ["Madrid", "Barcelona", "Sevilla", "Valencia", "Bilbao", "Vigo", "Zaragoza", "Malaga"],
  Italy: ["Milan", "Rome", "Naples", "Turin", "Bologna", "Florence", "Genoa", "Parma"],
  Germany: ["Berlin", "Munich", "Dortmund", "Leipzig", "Hamburg", "Frankfurt", "Stuttgart", "Bremen"],
  France: ["Paris", "Marseille", "Lyon", "Lille", "Nice", "Nantes", "Bordeaux", "Toulouse"],
  Netherlands: ["Amsterdam", "Rotterdam", "Eindhoven", "Utrecht", "Alkmaar", "Groningen", "Arnhem", "Twente"],
  Portugal: ["Lisbon", "Porto", "Braga", "Coimbra", "Faro", "Setubal", "Aveiro", "Leiria"],
  Belgium: ["Brussels", "Antwerp", "Bruges", "Ghent", "Liege", "Genk", "Mechelen", "Leuven"],
  Turkey: ["Istanbul", "Ankara", "Izmir", "Bursa", "Adana", "Konya", "Trabzon", "Antalya"],
  Brazil: ["Sao Paulo", "Rio", "Santos", "Curitiba", "Salvador", "Recife", "Fortaleza", "Porto Alegre"],
  Argentina: ["Buenos Aires", "Rosario", "Cordoba", "La Plata", "Mendoza", "Tucuman", "Santa Fe", "Mar del Plata"],
  "United States": ["New York", "Los Angeles", "Chicago", "Seattle", "Austin", "Atlanta", "Miami", "Portland"],
  Mexico: ["Mexico City", "Monterrey", "Guadalajara", "Puebla", "Tijuana", "Toluca", "Leon", "Queretaro"],
  Scotland: ["Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Perth", "Inverness", "Kilmarnock", "Paisley"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Taif", "Abha", "Tabuk"],
  Japan: ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Sapporo", "Kobe", "Sendai", "Fukuoka"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Suwon", "Ulsan", "Jeonju"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart", "Newcastle"],
};

const clubSuffixes = [
  "FC",
  "United",
  "City",
  "Athletic",
  "Sporting",
  "SC",
  "Rovers",
  "Town",
  "Real",
  "AC",
] as const;

const firstNames = [
  "Liam",
  "Noah",
  "Oliver",
  "Ethan",
  "Lucas",
  "Mateo",
  "Leo",
  "Kai",
  "Hugo",
  "Mason",
  "Julian",
  "Theo",
  "Nico",
  "Rafael",
  "Adrian",
  "Santiago",
  "Marco",
  "Felix",
  "Ivan",
  "Dario",
] as const;

const lastNames = [
  "Silva",
  "Garcia",
  "Martinez",
  "Santos",
  "Rossi",
  "Muller",
  "Kovac",
  "Hernandez",
  "Khan",
  "Yilmaz",
  "Nakamura",
  "Kim",
  "Lopez",
  "Souza",
  "Pereira",
  "Novak",
  "Jensen",
  "Andersson",
  "Ibrahim",
  "Diallo",
] as const;

const positions = [
  "GK",
  "RB",
  "CB",
  "CB",
  "LB",
  "DM",
  "CM",
  "CM",
  "AM",
  "RW",
  "LW",
  "ST",
  "ST",
] as const;

export const getLeagueKey = (league: Pick<LeagueSeed, "name" | "country">) =>
  `${league.name} • ${league.country}`;

const hashText = (value: string) =>
  Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);

const getClubName = (league: LeagueSeed, index: number) => {
  const roots = countryNameRoots[league.country] ?? [league.country];
  const root = roots[index % roots.length];
  const suffix = clubSuffixes[index % clubSuffixes.length];
  return `${root} ${suffix}`;
};

const buildPlayers = (clubName: string, country: string): PlayerSeed[] => {
  const base = hashText(`${clubName}-${country}`);
  return Array.from({ length: 25 }, (_, index) => {
    const first = firstNames[(base + index * 3) % firstNames.length];
    const last = lastNames[(base + index * 5) % lastNames.length];
    const preferredPosition = positions[index % positions.length];

    return {
      name: `${first} ${last}`,
      age: 17 + ((base + index * 7) % 18),
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
