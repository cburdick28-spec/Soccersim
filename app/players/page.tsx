"use client";

import { useEffect, useMemo, useState } from "react";
import { getLeagues, getPlayers, getPlayersByLeague, searchPlayers } from "@/lib/players";
import type { Player } from "@/types/player";

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsLoading(true);
      setError(null);

      try {
        const [initialPlayers, availableLeagues] = await Promise.all([getPlayers(50), getLeagues()]);

        if (!isMounted) {
          return;
        }

        setPlayers(initialPlayers);
        setLeagues(availableLeagues);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load players.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasFilters = useMemo(
    () => searchQuery.trim().length > 0 || selectedLeague.length > 0,
    [searchQuery, selectedLeague],
  );

  async function handleApplyFilters() {
    setIsLoading(true);
    setError(null);

    try {
      let result: Player[];

      if (searchQuery.trim().length > 0) {
        result = await searchPlayers(searchQuery);
        if (selectedLeague) {
          result = result.filter((player) => player.league_name === selectedLeague);
        }
      } else if (selectedLeague) {
        result = await getPlayersByLeague(selectedLeague);
      } else {
        result = await getPlayers(50);
      }

      setPlayers(result);
    } catch (filterError) {
      setError(filterError instanceof Error ? filterError.message : "Failed to filter players.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetFilters() {
    setSearchQuery("");
    setSelectedLeague("");
    setIsLoading(true);
    setError(null);

    try {
      const result = await getPlayers(50);
      setPlayers(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load players.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">FC 26 Players</h1>
        <p className="mt-2 text-sm text-slate-300">
          Search players and filter by league directly from Supabase.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, club, or nationality"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-300 transition focus:ring-2"
            aria-label="Search players"
          />

          <select
            value={selectedLeague}
            onChange={(event) => setSelectedLeague(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-300 transition focus:ring-2"
            aria-label="Filter by league"
          >
            <option value="">All leagues</option>
            {leagues.map((league) => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleApplyFilters()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isLoading}
          >
            Apply
          </button>

          <button
            type="button"
            onClick={() => void handleResetFilters()}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isLoading || !hasFilters}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-300">Loading players...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-300">{error}</div>
        ) : players.length === 0 ? (
          <div className="p-6 text-sm text-slate-300">No players found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Nationality</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">League</th>
                  <th className="px-4 py-3">OVR</th>
                  <th className="px-4 py-3">POT</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Wage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {players.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{player.short_name}</div>
                      <div className="text-xs text-slate-400">{player.player_positions ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{player.age}</td>
                    <td className="px-4 py-3 text-slate-200">{player.nationality_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{player.club_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{player.league_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{player.overall ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{player.potential ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-200">{formatCurrency(player.value_eur)}</td>
                    <td className="px-4 py-3 text-slate-200">{formatCurrency(player.wage_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
