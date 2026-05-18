"use server";

import { persistMatchAndProgress } from "@/lib/game/matchPersistence";
import type { MatchState } from "@/lib/matchSimulator";
import type { Player } from "@/types/player";

type PersistLiveMatchInput = {
  fixtureId: string;
  leagueId: string;
  userClubId: string;
  homeClubId: string;
  awayClubId: string;
  state: MatchState;
  homePlayers: Player[];
  awayPlayers: Player[];
};

export async function persistLiveMatchAction(input: PersistLiveMatchInput): Promise<void> {
  await persistMatchAndProgress(input);
}
