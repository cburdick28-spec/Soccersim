"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { persistMatchAndProgress } from "@/lib/game/matchPersistence";
import { getClubById, getPlayersByClub } from "@/lib/players";
import {
  buildMatchOutput,
  initializeMatchState,
  makeSubstitution,
  pauseMatch,
  resumeMatch,
  startMatch,
  tickMatch,
  updateTactics,
  type MatchState,
} from "@/lib/matchSimulator";
import type { Player } from "@/types/player";

const staminaForMinute = (player: Player, minute: number) =>
  Math.max(1, Math.min(100, Math.round(player.fitness - minute * 0.4)));

export default function SoloLiveMatchPage() {
  const params = useSearchParams();
  const leagueId = params.get("leagueId")?.trim() ?? "";
  const homeClubId = params.get("homeClubId")?.trim() ?? "";
  const awayClubId = params.get("awayClubId")?.trim() ?? "";

  const [homeClubName, setHomeClubName] = useState("Home");
  const [awayClubName, setAwayClubName] = useState("Away");
  const [state, setState] = useState<MatchState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedOut, setSelectedOut] = useState<string>("");
  const [selectedIn, setSelectedIn] = useState<string>("");
  const saveStarted = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function loadMatch() {
      if (!homeClubId || !awayClubId) {
        return;
      }

      const [homeClub, awayClub, homePlayers, awayPlayers] = await Promise.all([
        getClubById(homeClubId),
        getClubById(awayClubId),
        getPlayersByClub(homeClubId, 18),
        getPlayersByClub(awayClubId, 18),
      ]);

      if (!mounted) {
        return;
      }

      setHomeClubName(homeClub?.name ?? "Home");
      setAwayClubName(awayClub?.name ?? "Away");
      setState(initializeMatchState(homePlayers, awayPlayers));
    }

    void loadMatch();
    return () => {
      mounted = false;
    };
  }, [homeClubId, awayClubId]);

  useEffect(() => {
    if (!state?.isLive || state.isPaused || state.phase === "full_time") {
      return;
    }

    const timer = setInterval(() => {
      setState((current) => (current ? tickMatch(current) : current));
    }, 900);

    return () => clearInterval(timer);
  }, [state?.isLive, state?.isPaused, state?.phase]);

  useEffect(() => {
    if (!state || state.phase !== "full_time" || !leagueId || saveStarted.current) {
      return;
    }

    saveStarted.current = true;
    setIsSaving(true);
    setSaveError(null);

    void persistMatchAndProgress({
      leagueId,
      homeClubId,
      awayClubId,
      state,
      homePlayers: state.playersOnFieldHome,
      awayPlayers: state.playersOnFieldAway,
    })
      .then(() => {
        setSaved(true);
      })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : "Failed to save match.");
      })
      .finally(() => setIsSaving(false));
  }, [state, leagueId, homeClubId, awayClubId]);

  const output = useMemo(() => (state ? buildMatchOutput(state) : null), [state]);

  if (!homeClubId || !awayClubId || !leagueId) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6">
        <section className="panel p-6 text-sm text-amber-300">
          Missing match setup. Please return to the career screen and start a live match from there.
        </section>
        <Link href="/solo/game" className="w-fit rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
        <section className="panel w-full p-6 text-sm text-slate-300">Loading live match...</section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Live Match</h1>
            <p className="text-xs text-slate-400">
              {state.phase.replace("_", " ")} • {state.minute}&apos;
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">
              {homeClubName} {state.homeScore} - {state.awayScore} {awayClubName}
            </p>
            <p className="text-xs text-slate-400">Momentum: {(state.momentum * 100).toFixed(0)}%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <section className="panel p-5">
            <div className="flex flex-wrap gap-2">
              {!state.isLive && state.phase === "pre_match" && (
                <button
                  type="button"
                  onClick={() => setState((current) => (current ? startMatch(current) : current))}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Kick Off
                </button>
              )}
              {state.phase === "halftime" && (
                <button
                  type="button"
                  onClick={() => setState((current) => (current ? resumeMatch(current) : current))}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Resume Second Half
                </button>
              )}
              {state.isLive && (
                <button
                  type="button"
                  onClick={() => setState((current) => (current ? pauseMatch(current) : current))}
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200"
                >
                  Pause
                </button>
              )}
              {!state.isLive && state.phase === "second_half" && (
                <button
                  type="button"
                  onClick={() =>
                    setState((current) => (current ? { ...current, isLive: true, isPaused: false } : current))
                  }
                  className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Resume
                </button>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Event Feed</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm text-slate-300">
              {state.events.length === 0 && <li className="text-slate-500">No events yet.</li>}
              {state.events
                .slice()
                .reverse()
                .map((event, index) => (
                  <li key={`${event.minute}-${event.type}-${index}`} className="rounded-md border border-slate-800 px-3 py-2">
                    <span className="mr-2 text-xs text-sky-300">{event.minute}&apos;</span>
                    {event.text}
                  </li>
                ))}
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Live Stats</h2>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md border border-slate-800 p-3">
                <p className="text-xs text-slate-400">Shots</p>
                <p className="font-semibold">
                  {state.statsHome.shots} - {state.statsAway.shots}
                </p>
              </div>
              <div className="rounded-md border border-slate-800 p-3">
                <p className="text-xs text-slate-400">Possession</p>
                <p className="font-semibold">
                  {state.statsHome.possession}% - {state.statsAway.possession}%
                </p>
              </div>
              <div className="rounded-md border border-slate-800 p-3">
                <p className="text-xs text-slate-400">xG</p>
                <p className="font-semibold">
                  {state.statsHome.xGEstimate.toFixed(2)} - {state.statsAway.xGEstimate.toFixed(2)}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Tactics</h2>
            <div className="mt-3 space-y-3 text-sm">
              <label className="block">
                <span className="text-xs text-slate-400">Formation</span>
                <select
                  value={state.tacticsHome.formation}
                  onChange={(event) =>
                    setState((current) =>
                      current ? updateTactics(current, "home", { formation: event.target.value }) : current,
                    )
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2"
                >
                  <option>4-3-3</option>
                  <option>4-4-2</option>
                  <option>3-5-2</option>
                  <option>4-2-3-1</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Balance ({state.tacticsHome.balance})</span>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={1}
                  value={state.tacticsHome.balance}
                  onChange={(event) =>
                    setState((current) =>
                      current ? updateTactics(current, "home", { balance: Number(event.target.value) }) : current,
                    )
                  }
                  className="mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Pressing ({state.tacticsHome.pressing})</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={state.tacticsHome.pressing}
                  onChange={(event) =>
                    setState((current) =>
                      current ? updateTactics(current, "home", { pressing: Number(event.target.value) }) : current,
                    )
                  }
                  className="mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Tempo ({state.tacticsHome.tempo})</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={state.tacticsHome.tempo}
                  onChange={(event) =>
                    setState((current) =>
                      current ? updateTactics(current, "home", { tempo: Number(event.target.value) }) : current,
                    )
                  }
                  className="mt-1 w-full"
                />
              </label>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Substitutions ({state.subsUsedHome}/5)</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <select
                value={selectedOut}
                onChange={(event) => setSelectedOut(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2"
              >
                <option value="">Select player out</option>
                {state.playersOnFieldHome.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedIn}
                onChange={(event) => setSelectedIn(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2"
              >
                <option value="">Select player in</option>
                {state.benchHome.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedOut || !selectedIn || state.subsUsedHome >= 5}
                onClick={() =>
                  setState((current) => {
                    if (!current || !selectedOut || !selectedIn) {
                      return current;
                    }
                    return makeSubstitution(current, "home", selectedOut, selectedIn);
                  })
                }
                className="rounded-md bg-sky-500 px-3 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Make Substitution
              </button>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Stamina</h2>
            <ul className="mt-3 space-y-2 text-xs">
              {state.playersOnFieldHome.map((player) => {
                const stamina = staminaForMinute(player, state.minute);
                return (
                  <li key={player.id}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-slate-300">{player.name}</span>
                      <span className="text-slate-400">{stamina}%</span>
                    </div>
                    <div className="h-2 rounded bg-slate-800">
                      <div className="h-2 rounded bg-emerald-400" style={{ width: `${stamina}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </section>

      {state.phase === "full_time" && output && (
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Full Time</h2>
          <p className="mt-2 text-sm text-slate-300">
            Final: {homeClubName} {output.homeScore} - {output.awayScore} {awayClubName}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Winner: {output.winner === "draw" ? "Draw" : output.winner === "home" ? homeClubName : awayClubName}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Save status: {isSaving ? "Saving..." : saved ? "Saved to Supabase." : saveError ?? "Pending"}
          </p>
          <div className="mt-4">
            <Link
              href={`/solo/game?leagueId=${encodeURIComponent(leagueId)}&clubId=${encodeURIComponent(homeClubId)}`}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200"
            >
              Return to Career
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
