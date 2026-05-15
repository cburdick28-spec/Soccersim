"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLeagues, type League } from "@/lib/players";
import { t } from "@/lib/i18n/translations";
import { useAppStore, type Difficulty } from "@/stores/useAppStore";

const difficulties: Difficulty[] = ["Easy", "Normal", "Hard", "Legendary"];

const cheatOptions = [
  "Infinite money",
  "Edit player attributes",
  "Instant season simulation",
  "Disable injuries",
  "Transfer override control",
  "Unlock all clubs instantly",
] as const;

export default function SoloPage() {
  const router = useRouter();
  const language = useAppStore((state) => state.language);
  const setDifficulty = useAppStore((state) => state.setDifficulty);
  const [difficulty, chooseDifficulty] = useState<Difficulty>("Normal");
  const [enabledCheats, setEnabledCheats] = useState<Record<string, boolean>>({});
  const [previewLeagues, setPreviewLeagues] = useState<League[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadLeagues() {
      try {
        const leagues = await getLeagues();
        if (!isMounted) {
          return;
        }
        setPreviewLeagues(leagues.slice(0, 8));
      } catch {
        if (!isMounted) {
          return;
        }
        setPreviewLeagues([]);
      }
    }

    void loadLeagues();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">{t(language, "createSolo")}</h1>
        <p className="mt-2 text-sm text-slate-300">{t(language, "soloIntro")}</p>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">{t(language, "difficulty")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {difficulties.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                chooseDifficulty(option);
                setDifficulty(option);
              }}
              className={`rounded-lg border px-4 py-3 text-left transition ${
                difficulty === option
                  ? "border-sky-400 bg-sky-500/15 text-sky-200"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              <span className="font-medium">{option}</span>
              <p className="mt-1 text-xs text-slate-400">
                Influences AI transfer logic, injuries, finances, morale pressure, and board goals.
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">{t(language, "soloSandbox")}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {cheatOptions.map((cheat) => (
            <label key={cheat} className="flex items-center gap-2 rounded-md border border-slate-800 p-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(enabledCheats[cheat])}
                onChange={(event) =>
                  setEnabledCheats((current) => ({
                    ...current,
                    [cheat]: event.target.checked,
                  }))
                }
              />
              {cheat}
            </label>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">Available Leagues</h2>
        <ul className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          {previewLeagues.map((league) => (
            <li key={league.id} className="rounded-md border border-slate-800 px-3 py-2">
              {league.name}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          All clubs are unlocked in solo mode and can be selected immediately.
        </p>
      </section>

      <div className="flex gap-3">
        <button
          onClick={() => router.push("/solo/club-select")}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
          type="button"
        >
          {t(language, "startCareer")}
        </button>
        <Link href="/" className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back
        </Link>
      </div>
    </main>
  );
}
