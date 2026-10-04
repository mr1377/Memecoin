import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'

export default function PhaseBadge({ className }: { className?: string }) {
  const phase = useStore((s) => s.phase)
  const pct = useStore((s) => s.bondingProgress)
  const residents = useStore((s) => s.stats.residents)
  const goal = useStore((s) => s.settings.realUserGoal)
  // Phase 2 comes at graduation or the resident goal; show whichever is closer.
  const byResidents = (residents / goal) * 100 >= pct
  return (
    <Link
      to="/#roadmap"
      className={clsx(
        'group relative flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider',
        phase === 1 ? 'border-grape/40 bg-grape/10 text-grape-300' : 'border-lime/40 bg-lime/10 text-lime',
        className,
      )}
      title={phase === 1 ? `Phase 2 starts at graduation (${pct.toFixed(0)}% bonded) or ${goal} residents (${residents} now)` : 'Phase 2: monthly revenue share is live'}
    >
      <span className="relative flex h-2 w-2">
        <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', phase === 1 ? 'bg-grape' : 'bg-lime')} />
        <span className={clsx('relative inline-flex h-2 w-2 rounded-full', phase === 1 ? 'bg-grape' : 'bg-lime')} />
      </span>
      {phase === 1 ? byResidents ? <>Phase 1 · {residents}/{goal} nerds</> : <>Phase 1 · {pct.toFixed(0)}% bonded</> : <>Phase 2 · Live</>}
    </Link>
  )
}
