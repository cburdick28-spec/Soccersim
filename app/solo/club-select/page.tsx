"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLeagues, type Club, type League } from "@/lib/players";
import { getReputationProfile, validateLeagueCountry } from "@/lib/clubRealism";
import { supabase } from "@/lib/supabase/client";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const DEFAULT_CLUB_BADGE = "FC";
const CARD_HOVER_GLOW_CLASS =
  "hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_12px_24px_rgba(15,23,42,0.45)]";

type SquadPlayer = {
  id: string;
  name: string;
  age: number;
  preferred_position: string;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
};

function getClubBadgeLabel(clubName: string) {
  const words = clubName
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return initials || DEFAULT_CLUB_BADGE;
}

function getLeagueThemeClass(leagueName: string) {
  const key = leagueName.toLowerCase();
  if (key.includes("premier")) {
    return "from-violet-500/15 to-indigo-500/5 border-violet-400/40";
  }
  if (key.includes("bundesliga")) {
    return "from-rose-500/15 to-red-500/5 border-rose-400/40";
  }
  if (key.includes("liga")) {
    return "from-amber-500/15 to-yellow-500/5 border-amber-400/40";
  }
  if (key.includes("serie")) {
    return "from-sky-500/15 to-cyan-500/5 border-sky-400/40";
  }
  return "from-emerald-500/15 to-teal-500/5 border-emerald-400/40";
}

function toOverall(player: SquadPlayer) {
  return Math.round(
    (player.pace + player.shooting + player.passing + player.dribbling + player.defending + player.physical) / 6,
  );
}

export default function ClubSelectPage() {
  const router = useRouter();
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [clubsInSelectedLeague, setClubsInSelectedLeague] = useState<Club[]>([]);
  const [selectedClubSquad, setSelectedClubSquad] = useState<SquadPlayer[]>([]);
  const latestClubRequestId = useRef(0);
  const latestSquadRequestId = useRef(0);
  const selectedLeague = useMemo(
    () => allLeagues.find((league) => league.id === selectedLeagueId) ?? null,
    [allLeagues, selectedLeagueId],
  );
  const averageReputation = useMemo(
    () => {
      if (clubsInSelectedLeague.length === 0) {
        return 0;
      }
      const totalReputation = clubsInSelectedLeague.reduce((total, club) => total + club.reputation, 0);
      return Math.round(totalReputation / clubsInSelectedLeague.length);
    },
    [clubsInSelectedLeague],
  );
  const totalFinances = useMemo(
    () => clubsInSelectedLeague.reduce((total, club) => total + club.finances, 0),
    [clubsInSelectedLeague],
  );
  const selectedClub = useMemo(
    () => clubsInSelectedLeague.find((club) => club.id === selectedClubId) ?? null,
    [clubsInSelectedLeague, selectedClubId],
  );
  const selectedReputationProfile = useMemo(
    () => getReputationProfile(selectedClub?.reputation ?? 1),
    [selectedClub?.reputation],
  );
  const expectedFinish = useMemo(() => {
    if (!selectedClub) {
      return "N/A";
    }
    const ranked = [...clubsInSelectedLeague].sort((a, b) => b.reputation - a.reputation);
    const position = ranked.findIndex((club) => club.id === selectedClub.id) + 1;
    return position > 0 ? `${position}/${clubsInSelectedLeague.length}` : "N/A";
  }, [clubsInSelectedLeague, selectedClub]);
  const squadOverview = useMemo(() => {
    if (selectedClubSquad.length === 0) {
      return null;
    }

    const totals = selectedClubSquad.reduce(
      (acc, player) => {
        const overall = toOverall(player);
        acc.age += player.age;
        acc.overall += overall;
        acc.attack += Math.round((player.shooting + player.dribbling + player.pace) / 3);
        acc.midfield += Math.round((player.passing + player.dribbling + player.physical) / 3);
        acc.defense += Math.round((player.defending + player.physical + player.pace) / 3);
        if (!acc.strongest || overall > acc.strongest.overall) {
          acc.strongest = { name: player.name, overall };
        }
        return acc;
      },
      {
        age: 0,
        overall: 0,
        attack: 0,
        midfield: 0,
        defense: 0,
        strongest: null as null | { name: string; overall: number },
      },
    );

    const count = selectedClubSquad.length;
    const avgAge = Number((totals.age / count).toFixed(1));
    const avgOverall = Math.round(totals.overall / count);
    const attackRating = Math.round(totals.attack / count);
    const midfieldRating = Math.round(totals.midfield / count);
    const defenseRating = Math.round(totals.defense / count);
    const depthQuality = Math.round((selectedClubSquad.filter((player) => toOverall(player) >= 70).length / count) * 100);
    const weakestArea =
      attackRating <= midfieldRating && attackRating <= defenseRating
        ? "Attack"
        : midfieldRating <= attackRating && midfieldRating <= defenseRating
          ? "Midfield"
          : "Defense";

    return {
      avgAge,
      avgOverall,
      attackRating,
      midfieldRating,
      defenseRating,
      depthQuality,
      strongestPlayer: totals.strongest?.name ?? "N/A",
      weakestArea,
    };
  }, [selectedClubSquad]);

  useEffect(() => {
    let isMounted = true;

    async function loadLeagues() {
      try {
        const leagues = await getLeagues();
        if (!isMounted) {
          return;
        }
        setAllLeagues(leagues);
      } catch {
        if (!isMounted) {
          return;
        }
        setAllLeagues([]);
      }
    }

    void loadLeagues();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const requestId = latestClubRequestId.current + 1;
    latestClubRequestId.current = requestId;

    async function loadLeagueClubs() {
      if (!selectedLeagueId) {
        setClubsInSelectedLeague([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("clubs")
          .select(
            "id, league_id, name, country, reputation, finances, transfer_budget, wage_budget, board_confidence, season_expectation, board_expectation, fan_expectation, stadium_name, club_colors, founded_year, tactical_style, rival_club_id",
          )
          .eq("league_id", selectedLeagueId)
          .order("name");

        if (!isMounted || requestId !== latestClubRequestId.current) {
          return;
        }

        if (error) {
          setClubsInSelectedLeague([]);
          return;
        }

        setClubsInSelectedLeague((data ?? []) as Club[]);
      } catch {
        if (!isMounted || requestId !== latestClubRequestId.current) {
          return;
        }
        setClubsInSelectedLeague([]);
      }
    }

    void loadLeagueClubs();

    return () => {
      isMounted = false;
    };
  }, [selectedLeagueId]);

  useEffect(() => {
    let isMounted = true;
    const requestId = latestSquadRequestId.current + 1;
    latestSquadRequestId.current = requestId;

    async function loadSelectedClubSquad() {
      if (!selectedClubId) {
        setSelectedClubSquad([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("players")
          .select("id, name, age, preferred_position, pace, shooting, passing, dribbling, defending, physical")
          .eq("club_id", selectedClubId)
          .limit(80);

        if (!isMounted || requestId !== latestSquadRequestId.current) {
          return;
        }

        if (error) {
          setSelectedClubSquad([]);
          return;
        }

        setSelectedClubSquad((data ?? []) as SquadPlayer[]);
      } catch {
        if (!isMounted || requestId !== latestSquadRequestId.current) {
          return;
        }
        setSelectedClubSquad([]);
      }
    }

    void loadSelectedClubSquad();

    return () => {
      isMounted = false;
    };
  }, [selectedClubId]);

  const handleStartCareer = () => {
    if (selectedClubId && selectedLeagueId) {
      router.push(
        `/solo/game?leagueId=${encodeURIComponent(selectedLeagueId)}&clubId=${encodeURIComponent(selectedClubId)}`,
      );
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">Select Your Club</h1>
        <p className="mt-2 text-sm text-slate-300">
          Choose a club from any available league to begin your managerial career.
        </p>
      </section>

      <section className="panel p-6">
        <label className="mb-4 block">
          <span className="text-sm font-semibold">Select League</span>
          <select
            value={selectedLeagueId}
            onChange={(event) => {
              setSelectedLeagueId(event.target.value);
              setSelectedClubId("");
            }}
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
          >
            <option value="">Choose a league</option>
            {allLeagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedLeagueId && (
        <section
          className={`panel border bg-gradient-to-br p-6 ${getLeagueThemeClass(selectedLeague?.name ?? "league")}`}
        >
          <h2 className="text-lg font-semibold">Clubs in {selectedLeague?.name ?? "Selected league"}</h2>
          {selectedLeague && (
            <p className="mt-1 text-xs text-slate-300">
              League country: <strong>{selectedLeague.country ?? "Unknown"}</strong>
            </p>
          )}
          <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-300">
            <p>
              <strong>{clubsInSelectedLeague.length}</strong> clubs available in this league.
            </p>
            <p className="mt-1">
              Average club reputation: <strong>{averageReputation}</strong> • Combined finances:{" "}
              <strong>{currencyFormatter.format(totalFinances)}</strong>
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubsInSelectedLeague.map((club) => (
              <button
                key={club.id}
                onClick={() => setSelectedClubId(club.id)}
                className={`rounded-lg border px-4 py-3 text-left transition-all duration-200 ${CARD_HOVER_GLOW_CLASS} ${
                  selectedClubId === club.id
                    ? "border-sky-400 bg-sky-500/15 text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
                    : "border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-900/70"
                }`}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-slate-100">
                      {getClubBadgeLabel(club.name)}
                    </span>
                    <div>
                      <span className="font-medium">{club.name}</span>
                      <p className="mt-1 text-xs text-slate-400">
                        {getReputationProfile(club.reputation).stars} • Rep {club.reputation}
                      </p>
                    </div>
                  </div>
                  {selectedClubId === club.id && (
                    <span className="rounded-full border border-sky-300/60 bg-sky-400/20 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-300">
                  Finances: <strong>{currencyFormatter.format(club.finances)}</strong>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Transfer: <strong className="text-slate-200">{currencyFormatter.format(club.transfer_budget ?? 0)}</strong>{" "}
                  • Wage: <strong className="text-slate-200">{currencyFormatter.format(club.wage_budget ?? 0)}</strong>
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedClub && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Club Overview</h2>
          <p className="mt-1 text-sm text-slate-300">
            {selectedClub.name} • {selectedReputationProfile.label}
          </p>
          <div className="mt-4 grid gap-3 text-xs text-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-slate-400">Reputation</p>
              <p className="mt-1 font-semibold">
                {selectedClub.reputation} ({selectedReputationProfile.stars})
              </p>
              <p className="mt-1 text-slate-400">{selectedReputationProfile.mediaExpectation}</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-slate-400">Financials</p>
              <p className="mt-1 font-semibold">{currencyFormatter.format(selectedClub.finances)}</p>
              <p className="mt-1 text-slate-400">
                Transfer {currencyFormatter.format(selectedClub.transfer_budget ?? 0)} • Wage{" "}
                {currencyFormatter.format(selectedClub.wage_budget ?? 0)}
              </p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-slate-400">Expectations</p>
              <p className="mt-1 font-semibold">{selectedClub.season_expectation ?? "Compete hard each week"}</p>
              <p className="mt-1 text-slate-400">Expected finish: {expectedFinish}</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-slate-400">Stadium</p>
              <p className="mt-1 font-semibold">{selectedClub.stadium_name ?? `${selectedClub.name} Stadium`}</p>
              <p className="mt-1 text-slate-400">
                Founded: {selectedClub.founded_year ?? "Unknown"} • Fans:{" "}
                {selectedClub.fan_expectation ?? "Demand commitment and growth"}
              </p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-slate-400">Squad Quality</p>
              <p className="mt-1 font-semibold">
                Avg OVR {squadOverview?.avgOverall ?? "N/A"} • Avg age {squadOverview?.avgAge ?? "N/A"}
              </p>
              <p className="mt-1 text-slate-400">
                ATT {squadOverview?.attackRating ?? "N/A"} • MID {squadOverview?.midfieldRating ?? "N/A"} • DEF{" "}
                {squadOverview?.defenseRating ?? "N/A"}
              </p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-slate-400">Scouting Snapshot</p>
              <p className="mt-1 font-semibold">
                Strongest: {squadOverview?.strongestPlayer ?? "N/A"} • Weakest: {squadOverview?.weakestArea ?? "N/A"}
              </p>
              <p className="mt-1 text-slate-400">
                Depth quality: {squadOverview?.depthQuality ?? 0}% • Style:{" "}
                {selectedClub.tactical_style ?? "Balanced possession"}
              </p>
            </div>
          </div>
        </section>
      )}

      {selectedClub && selectedLeague && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Board Introduction</h2>
          <p className="mt-2 text-sm text-slate-200">
            Welcome to {selectedClub.name}. The board expects you to{" "}
            {(selectedClub.board_expectation ?? "deliver a competitive season").toLowerCase()}.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Board confidence: {selectedClub.board_confidence ?? 50}/100 • Financial status:{" "}
            {currencyFormatter.format(selectedClub.finances)} • Tactical recommendation:{" "}
            {selectedClub.tactical_style ?? "Balanced possession"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            League validation:{" "}
            {validateLeagueCountry(
              selectedLeague.name,
              selectedLeague.country ?? "",
              selectedClub.country ?? selectedLeague.country ?? null,
            )
              ? "Domestic assignment verified"
              : "Assignment mismatch detected"}
          </p>
        </section>
      )}

      <section className="panel p-6">
        <p className="text-xs text-slate-400">
          <strong>{allLeagues.length}</strong> leagues available
          {selectedLeagueId && (
            <>
              {" "}
              • <strong>{clubsInSelectedLeague.length}</strong> clubs in{" "}
              {selectedLeague?.name ?? "selected league"}
            </>
          )}
        </p>
      </section>

      <div className="flex gap-3">
        <button
          onClick={handleStartCareer}
          disabled={!selectedClubId || !selectedLeagueId}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          Start Career as{" "}
          {clubsInSelectedLeague.find((club) => club.id === selectedClubId)?.name ?? "..."}
        </button>
        <Link href="/solo" className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back
        </Link>
      </div>
    </main>
  );
}
