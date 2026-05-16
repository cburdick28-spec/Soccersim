"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getClubsByLeague, getLeagues, type Club, type League } from "@/lib/players";

export default function ClubSelectPage() {
  const router = useRouter();
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [clubsInSelectedLeague, setClubsInSelectedLeague] = useState<Club[]>([]);

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

    async function loadLeagueClubs() {
      if (!selectedLeagueId) {
        setClubsInSelectedLeague([]);
        return;
      }

      try {
        const clubs = await getClubsByLeague(selectedLeagueId);
        console.log("selectedLeagueId", selectedLeagueId);
        console.log("clubs result", clubs);
        if (!isMounted) {
          return;
        }
        setClubsInSelectedLeague(clubs);
      } catch {
        if (!isMounted) {
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
          <h2 className="text-lg font-semibold">
            Clubs in {allLeagues.find((league) => league.id === selectedLeagueId)?.name ?? "Selected league"}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubsInSelectedLeague.map((club) => (
              <button
                key={club.id}
                onClick={() => setSelectedClubId(club.id)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  selectedClubId === club.id
                    ? "border-sky-400 bg-sky-500/15 text-sky-200"
                    : "border-slate-700 text-slate-200 hover:border-slate-600"
                }`}
              >
                <span className="font-medium">{club.name}</span>
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
              {allLeagues.find((league) => league.id === selectedLeagueId)?.name ?? "selected league"}
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
