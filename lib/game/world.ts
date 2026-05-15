export type LeagueSeed = {
  name: string;
  country: string;
  reputation: number;
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
