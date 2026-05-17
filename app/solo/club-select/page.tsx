"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLeagues, type Club, type League } from "@/lib/players";
import { supabase } from "@/lib/supabase/client";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const REPUTATION_PER_STAR = 20;
const CARD_HOVER_GLOW_CLASS =
  "hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_12px_24px_rgba(15,23,42,0.45)]";

function getReputationStars(reputation: number) {
  const filled = Math.max(0, Math.min(5, Math.round(reputation / REPUTATION_PER_STAR)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

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
  return initials || "FC";
}

function getBoardObjective(reputation: number) {
  if (reputation >= 80) {
    return "Compete for the title and qualify for continental football.";
  }
  if (reputation >= 65) {
    return "Push for a top-half finish and challenge for continental spots.";
  }
  return "Stabilize the club, avoid relegation risk, and build squad value.";
}

export default function ClubSelectPage() {
  const router = useRouter();
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [clubsInSelectedLeague, setClubsInSelectedLeague] = useState<Club[]>([]);
  const latestClubRequestId = useRef(0);
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
          .select("*")
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
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Clubs in {selectedLeague?.name ?? "Selected league"}</h2>
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
                        {getReputationStars(club.reputation)} Reputation
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
                  Board objective:{" "}
                  <strong className="text-slate-200">{getBoardObjective(club.reputation)}</strong>
                </p>
              </button>
            ))}
          </div>
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
