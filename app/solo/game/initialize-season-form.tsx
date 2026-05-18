"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const STAGES = ["Initializing season...", "Generating fixtures...", "Building standings...", "Finalizing season setup..."];
const STAGE_TRANSITION_MS = 900;

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
    }, STAGE_TRANSITION_MS);
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
    </>
  );
}

export default function InitializeSeasonForm({
  leagueId,
  clubId,
  action,
}: {
  leagueId: string;
  clubId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="clubId" value={clubId} />
      <SeasonInitControls />
    </form>
  );
}
