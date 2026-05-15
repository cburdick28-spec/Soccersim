"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n/translations";

export type Difficulty = "Easy" | "Normal" | "Hard" | "Legendary";

type Profile = {
  username: string;
  isAdmin: boolean;
};

type AppState = {
  language: Language;
  profile: Profile | null;
  guestMode: boolean;
  difficulty: Difficulty;
  setLanguage: (language: Language) => void;
  setProfile: (profile: Profile | null) => void;
  setGuestMode: (guestMode: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: "en",
      profile: null,
      guestMode: false,
      difficulty: "Normal",
      setLanguage: (language) => set({ language }),
      setProfile: (profile) => set({ profile }),
      setGuestMode: (guestMode) => set({ guestMode }),
      setDifficulty: (difficulty) => set({ difficulty }),
    }),
    { name: "pocket-manager-online" },
  ),
);
