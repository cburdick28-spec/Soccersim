"use client";

import { LanguageSelect } from "@/components/language-select";
import { MenuCard } from "@/components/menu-card";
import { t } from "@/lib/i18n/translations";
import { useAppStore } from "@/stores/useAppStore";

export default function Home() {
  const language = useAppStore((state) => state.language);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel relative overflow-hidden p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_50%)]" />
        <div className="relative flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.4em] text-sky-300">Management Simulation</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{t(language, "title")}</h1>
          <p className="max-w-2xl text-sm text-slate-300 sm:text-base">{t(language, "subtitle")}</p>
          <LanguageSelect />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MenuCard
          title={t(language, "createSolo")}
          description={t(language, "soloIntro")}
          href="/solo"
        />
        <MenuCard
          title={t(language, "createMultiplayer")}
          description={t(language, "multiplayerIntro")}
          href="/multiplayer/create"
        />
        <MenuCard
          title={t(language, "joinMultiplayer")}
          description="Use an invite code to enter an active online franchise lobby."
          href="/multiplayer/join"
        />
        <MenuCard
          title={t(language, "languageSelect")}
          description="Switch instantly between English and Spanish without reload."
          href="/settings"
        />
        <MenuCard
          title={t(language, "settings")}
          description="Tune graphics, notifications, and simulation pacing for low-end devices."
          href="/settings"
        />
        <MenuCard
          title={t(language, "profile")}
          description="Manage account sessions, cloud saves, and guest careers."
          href="/profile"
        />
      </section>
    </main>
  );
}
