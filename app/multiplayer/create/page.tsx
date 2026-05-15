"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useAppStore, type Difficulty } from "@/stores/useAppStore";

const difficulties: Difficulty[] = ["Easy", "Normal", "Hard", "Legendary"];

const buildInviteCode = () =>
  Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

export default function CreateMultiplayerPage() {
  const language = useAppStore((state) => state.language);
  const profile = useAppStore((state) => state.profile);
  const difficulty = useAppStore((state) => state.difficulty);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(difficulty);

  const inviteCode = useMemo(() => buildInviteCode(), []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">{t(language, "createMultiplayer")}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Configure lobby clubs, leagues, season rules, and invite up to 20 managers asynchronously.
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">{t(language, "inviteCode")}</h2>
        <p className="mt-2 inline-flex rounded-lg border border-sky-400/50 bg-sky-500/10 px-4 py-2 text-xl font-bold tracking-widest text-sky-200">
          {inviteCode}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Share this code. Remaining clubs become AI-controlled after lobby lock.
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">{t(language, "difficulty")}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {difficulties.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelectedDifficulty(option)}
              className={`rounded-md border px-4 py-2 text-left ${
                selectedDifficulty === option
                  ? "border-sky-400 bg-sky-500/15 text-sky-200"
                  : "border-slate-700 text-slate-200"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Cheats are blocked in multiplayer for all non-admin users.
          {profile?.isAdmin ? " ConnorB admin controls are enabled." : ""}
        </p>
      </section>

      <div className="flex gap-3">
        <button className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950" type="button">
          Create Lobby
        </button>
        <Link href="/" className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back
        </Link>
      </div>
    </main>
  );
}
