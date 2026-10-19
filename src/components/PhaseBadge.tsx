import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'

export default function PhaseBadge({ className }: { className?: string }) {
  const phase = useStore((s) => s.phase)
  const verified = useStore((s) => s.stats.verified)
  const goal = useStore((s) => s.settings.realUserGoal)
  const live = useStore((s) => !!s.settings.tokenMint)
  const points = useStore((s) => s.points)

  if (!live)
    return (
      <Link
        to={points ? '/dashboard' : '/#roadmap'}
        className={clsx('group relative flex items-center gap-2 overflow-hidden rounded-full border border-carrot/40 bg-carrot/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-carrot', className)}
        title="$NERDY is coming soon. Points convert to $NERDY after launch."
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-carrot opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-carrot" />
        </span>
        {points ? <>{points.total.toLocaleString()} pts · $NERDY soon</> : <>$NERDY soon · stack points</>}
      </Link>
    )

  return (
    <Link
      to="/#roadmap"
      className={clsx(
        'group relative flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider',
        phase === 1 ? 'border-grape/40 bg-grape/10 text-grape-300' : 'border-lime/40 bg-lime/10 text-lime',
        className,
      )}
      title={phase === 1 ? `Phase 2 starts at ${goal.toLocaleString()} verified residents (${verified.toLocaleString()} now)` : 'Phase 2: monthly revenue share is live'}
    >
      <span className="relative flex h-2 w-2">
        <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', phase === 1 ? 'bg-grape' : 'bg-lime')} />
        <span className={clsx('relative inline-flex h-2 w-2 rounded-full', phase === 1 ? 'bg-grape' : 'bg-lime')} />
      </span>
      {phase === 1 ? <>Phase 1 · {verified.toLocaleString()}/{goal.toLocaleString()} verified</> : <>Phase 2 · Live</>}
    </Link>
  )
}
