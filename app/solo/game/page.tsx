import Link from "next/link";
import { getPlayersByLeague } from "@/lib/players";

type SoloGamePageProps = {
  searchParams: Promise<{ club?: string; league?: string }>;
};

export default async function SoloGamePage({ searchParams }: SoloGamePageProps) {
  const { club, league } = await searchParams;
  const selectedClub = club?.trim();
  const selectedLeague = league?.trim();
  const selectedClubPlayers =
    selectedClub && selectedLeague
      ? (await getPlayersByLeague(selectedLeague)).filter((player) => player.club_name === selectedClub)
      : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">Solo Career</h1>
        {selectedClub ? (
          <p className="mt-2 text-sm text-slate-300">
            Career started as <strong>{selectedClub}</strong>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-300">
            No club was selected. Choose a club to begin your career.
          </p>
        )}
        {selectedLeague && <p className="mt-2 text-xs text-slate-400">League: {selectedLeague}</p>}
      </section>

      {selectedClubPlayers.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Squad Preview</h2>
          <p className="mt-1 text-xs text-slate-400">{selectedClubPlayers.length} players loaded</p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
            {selectedClubPlayers.slice(0, 18).map((player) => (
              <li key={player.id} className="rounded-md border border-slate-800 px-3 py-2">
                <span className="font-medium">{player.short_name}</span>
                <p className="text-xs text-slate-400">
                  {player.player_positions ?? "—"} • {player.age} • {player.nationality_name ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  OVR {player.overall} • POT {player.potential} • PAC {player.pace} • SHO {player.shooting} • PAS{" "}
                  {player.passing}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedClub && selectedLeague && selectedClubPlayers.length === 0 && (
        <section className="panel p-6">
          <p className="text-sm text-amber-300">
            No squad data found for this club. Please reselect your league and club.
          </p>
        </section>
      )}

      <div className="flex gap-3">
        <Link
          href={selectedClub ? "/solo/club-select" : "/solo"}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          {selectedClub ? "Change Club" : "Choose Club"}
        </Link>
        <Link href="/" className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
