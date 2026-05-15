import Link from "next/link";
import { getClubById, getClubsByLeague, getLeagueById, getPlayersByClub } from "@/lib/players";

type SoloGamePageProps = {
  searchParams: Promise<{ clubId?: string; leagueId?: string }>;
};

export default async function SoloGamePage({ searchParams }: SoloGamePageProps) {
  const { clubId, leagueId } = await searchParams;
  const selectedClubId = clubId?.trim();
  const selectedLeagueId = leagueId?.trim();

  const selectedClub = selectedClubId ? await getClubById(selectedClubId) : null;
  const selectedLeague = selectedLeagueId ? await getLeagueById(selectedLeagueId) : null;
  const selectedClubPlayers =
    selectedClubId
      ? await getPlayersByClub(selectedClubId)
      : [];
  const clubsInLeague = selectedLeagueId ? await getClubsByLeague(selectedLeagueId) : [];
  const opponent = clubsInLeague.find((club) => club.id !== selectedClubId) ?? null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="panel p-6">
        <h1 className="text-2xl font-bold">Solo Career</h1>
        {selectedClub ? (
          <p className="mt-2 text-sm text-slate-300">
            Career started as <strong>{selectedClub.name}</strong>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-300">
            No club was selected. Choose a club to begin your career.
          </p>
        )}
        {selectedLeague && <p className="mt-2 text-xs text-slate-400">League: {selectedLeague.name}</p>}
      </section>

      {selectedClubPlayers.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Squad Preview</h2>
          <p className="mt-1 text-xs text-slate-400">{selectedClubPlayers.length} players loaded</p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
            {selectedClubPlayers.slice(0, 18).map((player) => (
              <li key={player.id} className="rounded-md border border-slate-800 px-3 py-2">
                <span className="font-medium">{player.name}</span>
                <p className="text-xs text-slate-400">
                  {player.preferred_position} • {player.age} • {player.nationality}
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
        {selectedClubId && selectedLeagueId && opponent && (
          <Link
            href={`/solo/live-match?leagueId=${encodeURIComponent(selectedLeagueId)}&homeClubId=${encodeURIComponent(selectedClubId)}&awayClubId=${encodeURIComponent(opponent.id)}`}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Play Live Match vs {opponent.name}
          </Link>
        )}
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
