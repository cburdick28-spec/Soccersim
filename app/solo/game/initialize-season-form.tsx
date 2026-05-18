"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

const STAGES = ["Initializing season...", "Generating fixtures...", "Building standings...", "Finalizing season setup..."];

function SeasonInitControls() {
  const { pending } = useFormStatus();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!pending) {
      setStageIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, STAGES.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [pending]);

  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? STAGES[stageIndex] : "Initialize Season"}
      </button>
      {pending && <p className="mt-2 text-xs text-sky-300">{STAGES[stageIndex]}</p>}
    </>
  );
}

export default function InitializeSeasonForm({
  leagueId,
  clubId,
  initStatus,
  initError,
  action,
}: {
  leagueId: string;
  clubId: string;
  initStatus?: string;
  initError?: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const hasSuccess = useMemo(() => initStatus === "success", [initStatus]);

  return (
    <form action={action}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="clubId" value={clubId} />
      <SeasonInitControls />
      {hasSuccess && <p className="mt-2 text-xs text-emerald-300">Season initialized successfully.</p>}
      {initError && <p className="mt-2 text-xs text-red-300">Initialization failed: {initError}</p>}
    </form>
  );
}

