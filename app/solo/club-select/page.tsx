"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getLeagues, type Club, type League } from "@/lib/players";
import { supabase } from "@/lib/supabase/client";

export default function ClubSelectPage() {
  const router = useRouter();
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [clubsInSelectedLeague, setClubsInSelectedLeague] = useState<Club[]>([]);
  const latestClubRequestId = useRef(0);

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
        console.log("selectedLeagueId", selectedLeagueId);
        const { data: testData, error: testError } = await supabase.from("clubs").select("*").limit(5);
        console.log("DIRECT CLUB TEST");
        console.log(testData);
        console.log(testError);

        const { data, error } = await supabase
          .from("clubs")
          .select("*")
          .eq("league_id", selectedLeagueId)
          .order("name");
        console.log("clubs query result", data);
        console.log("clubs length", data?.length);
        console.log("clubs query error", error);

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
    console.log("clubs state", clubsInSelectedLeague);
  }, [clubsInSelectedLeague]);

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
          <pre className="mt-4 overflow-auto rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
            {JSON.stringify(clubsInSelectedLeague, null, 2)}
          </pre>
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
