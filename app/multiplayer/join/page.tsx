"use client";

import Link from "next/link";
import { useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useAppStore } from "@/stores/useAppStore";

export default function JoinMultiplayerPage() {
  const language = useAppStore((state) => state.language);
  const [inviteCode, setInviteCode] = useState("");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">{t(language, "joinMultiplayer")}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Enter a valid invite code to join an active asynchronous league lobby.
        </p>
      </section>

      <section className="panel p-6">
        <label className="mb-2 block text-sm font-semibold text-slate-200" htmlFor="inviteCode">
          {t(language, "inviteCode")}
        </label>
        <input
          id="inviteCode"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          maxLength={8}
          placeholder="ABC123"
        />
        <button className="mt-4 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950" type="button">
          Join Lobby
        </button>
      </section>

      <Link href="/" className="w-fit rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
        Back
      </Link>
    </main>
  );
}
