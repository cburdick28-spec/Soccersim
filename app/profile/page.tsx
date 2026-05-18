"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { isGlobalAdmin, usernameToEmail } from "@/lib/auth/username";
import { t } from "@/lib/i18n/translations";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAppStore } from "@/stores/useAppStore";

export default function ProfilePage() {
  const language = useAppStore((state) => state.language);
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const setGuestMode = useAppStore((state) => state.setGuestMode);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  const upsertProfile = (name: string) => {
    setProfile({
      username: name,
      isAdmin: isGlobalAdmin(name),
    });
    setGuestMode(false);
  };

  const runAuth = async (mode: "login" | "register") => {
    if (!username.trim() || !password) {
      setStatus("Enter username and password.");
      return;
    }

    if (!isSupabaseConfigured) {
      upsertProfile(username.trim());
      setStatus("Supabase credentials not configured. Local profile mode enabled.");
      return;
    }

    const email = usernameToEmail(username);

    const supabase = getSupabase();
    const action =
      mode === "register"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });

    const { error } = await action;

    if (error) {
      setStatus(error.message);
      return;
    }

    upsertProfile(username.trim());
    setStatus("Authenticated successfully.");
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAuth("login");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">{t(language, "profile")}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Username/password authentication, cloud save sync, and guest career management.
        </p>
      </section>

      <section className="panel p-6">
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              {t(language, "username")}
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              {t(language, "password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>
          <div className="flex gap-3">
            <button className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
              {t(language, "login")}
            </button>
            <button
              className="rounded-md border border-slate-700 px-4 py-2 text-sm"
              type="button"
              onClick={() => {
                void runAuth("register");
              }}
            >
              {t(language, "register")}
            </button>
            <button
              className="rounded-md border border-emerald-600/60 px-4 py-2 text-sm text-emerald-300"
              type="button"
              onClick={() => {
                setProfile(null);
                setGuestMode(true);
                setStatus("Guest mode active. Saves are local-only.");
              }}
            >
              {t(language, "guestMode")}
            </button>
          </div>
        </form>

        <p className="mt-4 text-sm text-slate-300">{status}</p>
        {profile ? (
          <p className="mt-2 text-xs text-slate-400">
            Signed in as {profile.username}
            {profile.isAdmin ? " (Global admin access enabled)" : ""}.
          </p>
        ) : null}
      </section>

      <Link href="/" className="w-fit rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
        Back
      </Link>
    </main>
  );
}
