import Link from "next/link";

type SoloGamePageProps = {
  searchParams: Promise<{ club?: string }>;
};

export default async function SoloGamePage({ searchParams }: SoloGamePageProps) {
  const { club } = await searchParams;
  const selectedClub = club?.trim();

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
      </section>

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
