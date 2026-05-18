import Link from "next/link";
import {
  getActiveSeason,
  getLeagueTable,
  getRecentLeagueResults,
  getUpcomingFixturesForClub,
  type SeasonRow,
  type LeagueTableRow,
} from "@/lib/game/seasonEngine";
import { getClubById, getClubsByLeague, getLeagueById, getPlayersByClub, type Club, type League } from "@/lib/players";
import type { Player } from "@/types/player";
import { advanceMatchdayAction, initializeCareerAction, quickSimUpcomingFixtureAction } from "./season-actions";
import InitializeSeasonForm from "./initialize-season-form";

type SoloGamePageProps = {
  searchParams: Promise<{ clubId?: string; leagueId?: string; initStatus?: string; initError?: string }>;
};

type UpcomingFixture = {
  id: string;
  league_id: string;
  season_id: string;
  home_club_id: string;
  away_club_id: string;
  matchday: number;
  status: string;
} | null;

type RecentResult = {
  id: string;
  home_club_id: string;
  away_club_id: string;
  home_goals: number;
  away_goals: number;
  matchday: number;
  played_at: string;
};

export default async function SoloGamePage({ searchParams }: SoloGamePageProps) {
  const { clubId, leagueId, initStatus, initError } = await searchParams;
  const selectedClubId = clubId?.trim();
  const selectedLeagueId = leagueId?.trim();

  let selectedClub: Club | null = null;
  let selectedLeague: League | null = null;
  let selectedClubPlayers: Player[] = [];
  let clubsInLeague: Club[] = [];
  let activeSeason: SeasonRow | null = null;
  let upcomingFixture: UpcomingFixture = null;
  let leagueTable: LeagueTableRow[] = [];
  let recentResults: RecentResult[] = [];
  let pageLoadError = false;

  try {
    [selectedClub, selectedLeague, selectedClubPlayers, clubsInLeague] = await Promise.all([
      selectedClubId ? getClubById(selectedClubId) : Promise.resolve(null),
      selectedLeagueId ? getLeagueById(selectedLeagueId) : Promise.resolve(null),
      selectedClubId ? getPlayersByClub(selectedClubId) : Promise.resolve([]),
      selectedLeagueId ? getClubsByLeague(selectedLeagueId) : Promise.resolve([]),
    ]);
  } catch (err) {
    console.error("[SoloGamePage] Failed to load club/league data:", err);
    pageLoadError = true;
  }

  if (!pageLoadError) {
    try {
      activeSeason = selectedClubId ? await getActiveSeason() : null;
    } catch (err) {
      console.error("[SoloGamePage] Failed to load active season:", err);
    }

    try {
      [upcomingFixture, leagueTable, recentResults] = await Promise.all([
        selectedClubId
          ? getUpcomingFixturesForClub(selectedClubId, activeSeason?.id)
          : Promise.resolve(null),
        selectedLeagueId && activeSeason
          ? getLeagueTable(selectedLeagueId, activeSeason.id)
          : Promise.resolve([]),
        selectedLeagueId && activeSeason
          ? getRecentLeagueResults(selectedLeagueId, activeSeason.id, 8)
          : Promise.resolve([]),
      ]);
    } catch (err) {
      console.error("[SoloGamePage] Failed to load fixtures/table/results:", err);
    }
  }

  const clubNameById = new Map(clubsInLeague.map((club) => [club.id, club.name]));

  const upcomingOpponentId =
    upcomingFixture?.home_club_id === selectedClubId
      ? (upcomingFixture?.away_club_id ?? null)
      : upcomingFixture?.home_club_id;
  const upcomingOpponentName = upcomingOpponentId ? clubNameById.get(upcomingOpponentId) ?? "Unknown Club" : null;
  const canPlayUpcomingMatch =
    Boolean(upcomingFixture) &&
    upcomingFixture?.league_id === selectedLeagueId &&
    [upcomingFixture?.home_club_id, upcomingFixture?.away_club_id].includes(selectedClubId ?? "");

  if (pageLoadError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="panel p-6">
          <h1 className="text-2xl font-bold">Solo Career</h1>
          <p className="mt-2 text-sm text-amber-300">
            Unable to load career data. Please check your connection and try again.
          </p>
        </section>
        <div className="flex gap-3">
          <Link href="/solo/club-select" className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">
            Choose Club
          </Link>
          <Link href="/" className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

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
        {initStatus === "success" && (
          <p className="mt-2 text-xs text-emerald-300">Season initialized. Fixtures and standings are ready.</p>
        )}
        {initError && <p className="mt-2 text-xs text-red-300">Initialize Season failed: {initError}</p>}
        {activeSeason && (
          <p className="mt-2 text-xs text-slate-400">
            Season {activeSeason.label} • Matchday {activeSeason.current_matchday} • {activeSeason.status}
          </p>
        )}
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

      {selectedClub && selectedLeague && !activeSeason && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Career Setup</h2>
          <p className="mt-2 text-sm text-slate-300">Initialize your first season to start fixtures and standings.</p>
          <InitializeSeasonForm
            leagueId={selectedLeagueId ?? ""}
            clubId={selectedClubId ?? ""}
            action={initializeCareerAction}
          />
        </section>
      )}

      {selectedClub && selectedLeague && activeSeason && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Next Fixture Preview</h2>
          {!upcomingFixture && (
            <p className="mt-2 text-sm text-slate-300">No upcoming fixture found. The season may be complete.</p>
          )}
          {upcomingFixture && (
            <>
              <p className="mt-2 text-sm text-slate-300">
                Matchday {upcomingFixture.matchday}: {clubNameById.get(upcomingFixture.home_club_id) ?? "Unknown"} vs{" "}
                {clubNameById.get(upcomingFixture.away_club_id) ?? "Unknown"}
              </p>
              {upcomingOpponentName && (
                <p className="mt-1 text-xs text-slate-400">Opponent: {upcomingOpponentName}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {canPlayUpcomingMatch && (
                  <Link
                    href={`/solo/live-match?leagueId=${encodeURIComponent(selectedLeagueId ?? "")}&fixtureId=${encodeURIComponent(upcomingFixture.id)}&userClubId=${encodeURIComponent(selectedClubId ?? "")}&homeClubId=${encodeURIComponent(upcomingFixture.home_club_id)}&awayClubId=${encodeURIComponent(upcomingFixture.away_club_id)}`}
                    className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Play Live Match
                  </Link>
                )}
                {canPlayUpcomingMatch && (
                  <form action={quickSimUpcomingFixtureAction}>
                    <input type="hidden" name="seasonId" value={activeSeason.id} />
                    <input type="hidden" name="leagueId" value={selectedLeagueId ?? ""} />
                    <input type="hidden" name="clubId" value={selectedClubId ?? ""} />
                    <input type="hidden" name="fixtureId" value={upcomingFixture.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200"
                    >
                      Quick Sim Match
                    </button>
                  </form>
                )}
                {!canPlayUpcomingMatch && (
                  <form action={advanceMatchdayAction}>
                    <input type="hidden" name="seasonId" value={activeSeason.id} />
                    <input type="hidden" name="leagueId" value={selectedLeagueId ?? ""} />
                    <input type="hidden" name="clubId" value={selectedClubId ?? ""} />
                    <button
                      type="submit"
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200"
                    >
                      Simulate Matchday
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {selectedLeague && leagueTable.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">League Table</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Club</th>
                  <th className="px-2 py-1">P</th>
                  <th className="px-2 py-1">W</th>
                  <th className="px-2 py-1">D</th>
                  <th className="px-2 py-1">L</th>
                  <th className="px-2 py-1">GF</th>
                  <th className="px-2 py-1">GA</th>
                  <th className="px-2 py-1">GD</th>
                  <th className="px-2 py-1">PTS</th>
                </tr>
              </thead>
              <tbody>
                {leagueTable.map((row, index) => (
                  <tr key={row.club_id} className={row.club_id === selectedClubId ? "bg-sky-500/10" : undefined}>
                    <td className="px-2 py-1">{index + 1}</td>
                    <td className="px-2 py-1">{row.club_name}</td>
                    <td className="px-2 py-1">{row.played}</td>
                    <td className="px-2 py-1">{row.won}</td>
                    <td className="px-2 py-1">{row.drawn}</td>
                    <td className="px-2 py-1">{row.lost}</td>
                    <td className="px-2 py-1">{row.goals_for}</td>
                    <td className="px-2 py-1">{row.goals_against}</td>
                    <td className="px-2 py-1">{row.goal_difference}</td>
                    <td className="px-2 py-1 font-semibold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedLeague && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Top Scorers</h2>
          <p className="mt-2 text-sm text-slate-300">Top scorers feed coming soon.</p>
        </section>
      )}

      {selectedLeague && recentResults.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Recent Results</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {recentResults.map((result) => (
              <li key={result.id} className="rounded-md border border-slate-800 px-3 py-2">
                MD{result.matchday}: {clubNameById.get(result.home_club_id) ?? "Unknown"} {result.home_goals} -{" "}
                {result.away_goals} {clubNameById.get(result.away_club_id) ?? "Unknown"}
              </li>
            ))}
          </ul>
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
