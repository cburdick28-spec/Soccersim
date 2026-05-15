"use client";

import { t } from "@/lib/i18n/translations";
import { useAppStore } from "@/stores/useAppStore";

export function LanguageSelect() {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        className={`rounded-md border px-3 py-1 ${language === "en" ? "border-sky-400 text-sky-300" : "border-slate-700 text-slate-300"}`}
        onClick={() => setLanguage("en")}
        type="button"
      >
        {t(language, "english")}
      </button>
      <button
        className={`rounded-md border px-3 py-1 ${language === "es" ? "border-sky-400 text-sky-300" : "border-slate-700 text-slate-300"}`}
        onClick={() => setLanguage("es")}
        type="button"
      >
        {t(language, "spanish")}
      </button>
    </div>
  );
}
