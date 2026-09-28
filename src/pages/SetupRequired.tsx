import Mascot from '../components/Mascot'

/** Shown when the Supabase env vars are missing (e.g. a fresh Vercel deploy). */
export default function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <Mascot className="h-40 w-40" />
      <h1 className="mt-6 text-3xl font-extrabold">Nerdy Town is almost ready</h1>
      <p className="mt-3 text-white/60">
        The backend isn’t connected yet. Add <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-carrot">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-carrot">VITE_SUPABASE_ANON_KEY</code> in your Vercel project’s Environment Variables, then redeploy.
      </p>
      <p className="mt-4 text-sm text-white/40">See SETUP.md in the repository for the full checklist.</p>
    </main>
  )
}
