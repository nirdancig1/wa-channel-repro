export const metadata = {
  title: 'WA Channel Repro',
  description: 'Ron, the purchasing assistant, gets a nightly summary request at 02:00.',
};

export default function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">WA Channel Repro</h1>
      <p className="text-muted-foreground">
        Ron, the purchasing assistant, gets a nightly summary request at 02:00.
      </p>
    </main>
  );
}