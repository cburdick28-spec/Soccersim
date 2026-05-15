export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string;
  club_id: string | null;
  club_name: string | null;
  league_name: string | null;
  preferred_position: string;
  potential: number;
  morale: number;
  fitness: number;
  form: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  overall: number;
}
