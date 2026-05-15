"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { topLeagues } from "@/lib/game/world";

export default function ClubSelectPage() {
  const router = useRouter();
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allLeagues = useMemo(() => topLeagues, []);

  const filteredLeagues = useMemo(
    () =>
      allLeagues.filter((league) =>
        league.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        league.country.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [allLeagues, searchQuery]
  );

  const handleStartCareer = () => {
    if (selectedClub) {
      router.push(`/solo/game?club=${encodeURIComponent(selectedClub)}`);
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
          <span className="text-sm font-semibold">Search Leagues or Countries</span>
          <input
            type="text"
            placeholder="e.g., Premier League, England, La Liga..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLeagues.map((league) => (
            <button
              key={`${league.name}-${league.country}`}
              onClick={() => setSelectedClub(`${league.name} • ${league.country}`)}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                selectedClub === `${league.name} • ${league.country}`
                  ? "border-sky-400 bg-sky-500/15 text-sky-200"
                  : "border-slate-700 text-slate-200 hover:border-slate-600"
              }`}
            >
              <span className="font-medium">{league.name}</span>
              <p className="mt-1 text-xs text-slate-400">{league.country}</p>
            </button>
          ))}
        </div>

        {filteredLeagues.length === 0 && (
          <p className="mt-4 text-center text-sm text-slate-400">
            No leagues found matching &quot;{searchQuery}&quot;
          </p>
        )}
      </section>

      <section className="panel p-6">
        <p className="text-xs text-slate-400">
          <strong>{filteredLeagues.length}</strong> leagues available
          {searchQuery && ` matching &quot;${searchQuery}&quot;`}
        </p>
      </section>

      <div className="flex gap-3">
        <button
          onClick={handleStartCareer}
          disabled={!selectedClub}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          Start Career as {selectedClub ? selectedClub.split(" •")[0] : "..."}
        </button>
        <Link href="/solo" className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back
        </Link>
      </div>
    </main>
  );
}
