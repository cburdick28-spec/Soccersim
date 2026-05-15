import type { Player } from "@/types/player";

export type TeamSide = "home" | "away";
export type MatchPhase = "pre_match" | "first_half" | "halftime" | "second_half" | "full_time";

export type MatchEventType =
  | "goal"
  | "shot"
  | "save"
  | "foul"
  | "yellow_card"
  | "red_card"
  | "injury"
  | "substitution";

export type MatchEvent = {
  minute: number;
  type: MatchEventType;
  team: TeamSide;
  text: string;
  playerId?: string;
};

export type TeamTactics = {
  formation: string;
  balance: number;
  pressing: number;
  tempo: number;
};

export type TeamStats = {
  shots: number;
  onTarget: number;
  xGEstimate: number;
  possession: number;
};

export type MatchState = {
  minute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  isLive: boolean;
  phase: MatchPhase;
  isPaused: boolean;
  subsUsedHome: number;
  subsUsedAway: number;
  playersOnFieldHome: Player[];
  playersOnFieldAway: Player[];
  benchHome: Player[];
  benchAway: Player[];
  momentum: number;
  tacticsHome: TeamTactics;
  tacticsAway: TeamTactics;
  statsHome: TeamStats;
  statsAway: TeamStats;
  winner: "home" | "away" | "draw" | null;
};

export type MatchOutput = {
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
  events: MatchEvent[];
  stats: {
    shots: { home: number; away: number };
    possession: { home: number; away: number };
    xGEstimate: { home: number; away: number };
  };
};

const MAX_SUBS = 5;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));

const initialTactics = (): TeamTactics => ({
  formation: "4-3-3",
  balance: 0,
  pressing: 55,
  tempo: 55,
});

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const calculateTeamStrength = (
  players: Player[],
  tactics: TeamTactics,
  isHome: boolean,
  momentum: number,
) => {
  const attack = average(players.map((p) => p.shooting + p.dribbling + p.passing)) / 3;
  const defense = average(players.map((p) => p.defending + p.physical)) / 2;
  const pace = average(players.map((p) => p.pace));

  const moraleFactor = 1 + (average(players.map((p) => p.morale)) - 70) / 1000;
  const formFactor = 1 + (average(players.map((p) => p.form)) - 50) / 333;
  const fitnessDrop = clamp((100 - average(players.map((p) => p.fitness))) / 100, 0, 0.3);
  const fitnessFactor = 1 - fitnessDrop;
  const homeFactor = isHome ? 1.07 : 1;
  const tacticAttack = 1 + tactics.balance * 0.05 + (tactics.tempo - 55) * 0.002;
  const tacticDefense = 1 - tactics.balance * 0.03 + (tactics.pressing - 55) * 0.001;
  const momentumFactor = 1 + momentum * 0.06;

  const overall =
    (attack * 0.45 + defense * 0.35 + pace * 0.2) *
    moraleFactor *
    formFactor *
    fitnessFactor *
    homeFactor *
    momentumFactor;

  return {
    attack: attack * tacticAttack * moraleFactor * formFactor * fitnessFactor,
    defense: defense * tacticDefense * moraleFactor * formFactor * fitnessFactor,
    pace: pace * fitnessFactor,
    overall,
  };
};

const normalizePossession = (homeControl: number, awayControl: number) => {
  const total = Math.max(homeControl + awayControl, 1);
  const home = clamp(Math.round((homeControl / total) * 100), 30, 70);
  return { home, away: 100 - home };
};

export function initializeMatchState(homePlayers: Player[], awayPlayers: Player[]): MatchState {
  const playersOnFieldHome = homePlayers.slice(0, 11);
  const playersOnFieldAway = awayPlayers.slice(0, 11);

  return {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    events: [],
    isLive: false,
    phase: "pre_match",
    isPaused: false,
    subsUsedHome: 0,
    subsUsedAway: 0,
    playersOnFieldHome,
    playersOnFieldAway,
    benchHome: homePlayers.slice(11, 18),
    benchAway: awayPlayers.slice(11, 18),
    momentum: 0,
    tacticsHome: initialTactics(),
    tacticsAway: initialTactics(),
    statsHome: { shots: 0, onTarget: 0, xGEstimate: 0, possession: 50 },
    statsAway: { shots: 0, onTarget: 0, xGEstimate: 0, possession: 50 },
    winner: null,
  };
}

export function startMatch(state: MatchState): MatchState {
  return { ...state, isLive: true, phase: "first_half", isPaused: false };
}

export function resumeMatch(state: MatchState): MatchState {
  if (state.phase !== "halftime") {
    return state;
  }
  return { ...state, isPaused: false, isLive: true, phase: "second_half" };
}

export function pauseMatch(state: MatchState): MatchState {
  return { ...state, isPaused: true, isLive: false };
}

export function updateTactics(state: MatchState, side: TeamSide, tactics: Partial<TeamTactics>): MatchState {
  if (side === "home") {
    return {
      ...state,
      tacticsHome: {
        ...state.tacticsHome,
        ...tactics,
        balance: clamp(tactics.balance ?? state.tacticsHome.balance, -2, 2),
        pressing: clamp(tactics.pressing ?? state.tacticsHome.pressing, 0, 100),
        tempo: clamp(tactics.tempo ?? state.tacticsHome.tempo, 0, 100),
      },
    };
  }

  return {
    ...state,
    tacticsAway: {
      ...state.tacticsAway,
      ...tactics,
      balance: clamp(tactics.balance ?? state.tacticsAway.balance, -2, 2),
      pressing: clamp(tactics.pressing ?? state.tacticsAway.pressing, 0, 100),
      tempo: clamp(tactics.tempo ?? state.tacticsAway.tempo, 0, 100),
    },
  };
}

export function makeSubstitution(
  state: MatchState,
  side: TeamSide,
  playerOutId: string,
  playerInId: string,
): MatchState {
  if (state.phase === "full_time" || state.phase === "pre_match") {
    return state;
  }

  if (side === "home") {
    if (state.subsUsedHome >= MAX_SUBS) {
      return state;
    }

    const outIndex = state.playersOnFieldHome.findIndex((player) => player.id === playerOutId);
    const inIndex = state.benchHome.findIndex((player) => player.id === playerInId);
    if (outIndex < 0 || inIndex < 0) {
      return state;
    }

    const playersOnFieldHome = [...state.playersOnFieldHome];
    const benchHome = [...state.benchHome];
    const playerOut = playersOnFieldHome[outIndex];
    const playerIn = benchHome[inIndex];
    playersOnFieldHome[outIndex] = playerIn;
    benchHome[inIndex] = playerOut;

    return {
      ...state,
      playersOnFieldHome,
      benchHome,
      subsUsedHome: state.subsUsedHome + 1,
      events: [
        ...state.events,
        {
          minute: state.minute,
          type: "substitution",
          team: "home",
          text: `${playerOut.name} off, ${playerIn.name} on`,
        },
      ],
    };
  }

  if (state.subsUsedAway >= MAX_SUBS) {
    return state;
  }

  const outIndex = state.playersOnFieldAway.findIndex((player) => player.id === playerOutId);
  const inIndex = state.benchAway.findIndex((player) => player.id === playerInId);
  if (outIndex < 0 || inIndex < 0) {
    return state;
  }

  const playersOnFieldAway = [...state.playersOnFieldAway];
  const benchAway = [...state.benchAway];
  const playerOut = playersOnFieldAway[outIndex];
  const playerIn = benchAway[inIndex];
  playersOnFieldAway[outIndex] = playerIn;
  benchAway[inIndex] = playerOut;

  return {
    ...state,
    playersOnFieldAway,
    benchAway,
    subsUsedAway: state.subsUsedAway + 1,
    events: [
      ...state.events,
      {
        minute: state.minute,
        type: "substitution",
        team: "away",
        text: `${playerOut.name} off, ${playerIn.name} on`,
      },
    ],
  };
}

const pushEvent = (state: MatchState, event: MatchEvent): MatchState => ({
  ...state,
  events: [...state.events, event],
});

export function tickMatch(state: MatchState): MatchState {
  if (!state.isLive || state.isPaused || state.phase === "full_time") {
    return state;
  }

  const increment = randomInt(1, 5);
  let minute = Math.min(state.minute + increment, 90);
  let next = { ...state, minute };

  const homeStrength = calculateTeamStrength(
    next.playersOnFieldHome,
    next.tacticsHome,
    true,
    clamp(next.momentum, -1, 1),
  );
  const awayStrength = calculateTeamStrength(
    next.playersOnFieldAway,
    next.tacticsAway,
    false,
    clamp(-next.momentum, -1, 1),
  );

  const possession = normalizePossession(
    homeStrength.pace + homeStrength.attack + randomBetween(-4, 4),
    awayStrength.pace + awayStrength.attack + randomBetween(-4, 4),
  );
  next = {
    ...next,
    statsHome: { ...next.statsHome, possession: possession.home },
    statsAway: { ...next.statsAway, possession: possession.away },
  };

  const resolveTeamAction = (team: TeamSide) => {
    const own = team === "home" ? homeStrength : awayStrength;
    const opp = team === "home" ? awayStrength : homeStrength;
    const attackDiff = own.attack - opp.defense;
    const shotChance = clamp(0.13 + attackDiff / 250 + randomBetween(-0.06, 0.06), 0.04, 0.32);
    const onTargetChance = clamp(0.33 + own.attack / 220 - opp.defense / 260, 0.2, 0.7);
    const goalChance = clamp(0.1 + attackDiff / 270 + randomBetween(-0.04, 0.04), 0.03, 0.45);
    const xgShot = clamp(goalChance * randomBetween(0.7, 1.3), 0.01, 0.7);

    if (Math.random() > shotChance) {
      return;
    }

    if (team === "home") {
      next.statsHome.shots += 1;
      next.statsHome.xGEstimate += xgShot;
    } else {
      next.statsAway.shots += 1;
      next.statsAway.xGEstimate += xgShot;
    }

    next = pushEvent(next, {
      minute,
      team,
      type: "shot",
      text: `${team === "home" ? "Home" : "Away"} side creates a shooting chance.`,
    });

    if (Math.random() > onTargetChance) {
      return;
    }

    if (team === "home") {
      next.statsHome.onTarget += 1;
    } else {
      next.statsAway.onTarget += 1;
    }

    if (Math.random() < goalChance) {
      if (team === "home") {
        next.homeScore += 1;
        next.momentum = clamp(next.momentum + 0.25, -1, 1);
      } else {
        next.awayScore += 1;
        next.momentum = clamp(next.momentum - 0.25, -1, 1);
      }
      next = pushEvent(next, {
        minute,
        team,
        type: "goal",
        text: `GOAL! ${team === "home" ? "Home" : "Away"} team score at ${minute}'.`,
      });
      return;
    }

    next = pushEvent(next, {
      minute,
      team,
      type: "save",
      text: `Big save keeps the score level.`,
    });
  };

  resolveTeamAction("home");
  resolveTeamAction("away");

  const maybeDiscipline = (team: TeamSide) => {
    if (Math.random() < 0.18) {
      next = pushEvent(next, {
        minute,
        team,
        type: "foul",
        text: `${team === "home" ? "Home" : "Away"} commit a foul.`,
      });
    }
    if (Math.random() < 0.07) {
      next = pushEvent(next, {
        minute,
        team,
        type: "yellow_card",
        text: `Yellow card shown to ${team === "home" ? "home" : "away"} side.`,
      });
    }
    if (Math.random() < 0.012) {
      next = pushEvent(next, {
        minute,
        team,
        type: "red_card",
        text: `Red card! ${team === "home" ? "Home" : "Away"} down to ten.`,
      });
    }
    if (Math.random() < 0.01) {
      next = pushEvent(next, {
        minute,
        team,
        type: "injury",
        text: `Injury concern for ${team === "home" ? "home" : "away"} side.`,
      });
    }
  };

  maybeDiscipline("home");
  maybeDiscipline("away");

  next.momentum = clamp(next.momentum * 0.96, -1, 1);

  if (state.minute < 45 && minute >= 45) {
    return {
      ...next,
      minute: 45,
      phase: "halftime",
      isLive: false,
      isPaused: true,
    };
  }

  if (minute >= 90) {
    const winner = next.homeScore === next.awayScore ? "draw" : next.homeScore > next.awayScore ? "home" : "away";
    return { ...next, minute: 90, phase: "full_time", isLive: false, isPaused: true, winner };
  }

  return {
    ...next,
    phase: minute < 45 ? "first_half" : "second_half",
  };
}

export function buildMatchOutput(state: MatchState): MatchOutput {
  const winner = state.homeScore === state.awayScore ? "draw" : state.homeScore > state.awayScore ? "home" : "away";
  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    winner,
    events: state.events,
    stats: {
      shots: { home: state.statsHome.shots, away: state.statsAway.shots },
      possession: { home: state.statsHome.possession, away: state.statsAway.possession },
      xGEstimate: {
        home: Number(state.statsHome.xGEstimate.toFixed(2)),
        away: Number(state.statsAway.xGEstimate.toFixed(2)),
      },
    },
  };
}
