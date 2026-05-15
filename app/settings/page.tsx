"use client";

import Link from "next/link";
import { LanguageSelect } from "@/components/language-select";
import { t } from "@/lib/i18n/translations";
import { useAppStore } from "@/stores/useAppStore";

export default function SettingsPage() {
  const language = useAppStore((state) => state.language);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">{t(language, "settings")}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Localization, performance, and simulation pacing settings for desktop and mobile devices.
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold">{t(language, "languageSelect")}</h2>
        <p className="mt-2 text-sm text-slate-300">Switch language instantly; preference is saved to profile.</p>
        <div className="mt-4">
          <LanguageSelect />
        </div>
      </section>

      <Link href="/" className="w-fit rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
        Back
      </Link>
    </main>
  );
}
