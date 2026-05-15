export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
      <section className="panel p-8 text-center">
        <h1 className="text-2xl font-bold">Pocket Manager Online</h1>
        <p className="mt-3 text-sm text-slate-300">
          You are offline. Recent saves and local simulation tools remain available until your connection returns.
        </p>
      </section>
    </main>
  );
}
