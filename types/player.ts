export interface Player {
  id: number;
  short_name: string;
  long_name: string;
  age: number;
  nationality_name: string | null;
  club_name: string | null;
  league_name: string | null;
  player_positions: string | null;
  overall: number | null;
  potential: number | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physic: number | null;
  value_eur: number | null;
  wage_eur: number | null;
}
