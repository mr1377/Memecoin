import { Link } from 'react-router-dom'

export function Glasses({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 20" className={className} aria-hidden>
      <rect x="2" y="3" width="17" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="29" y="3" width="17" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M19 9 Q24 5 29 9" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M6 7 L10 5 M33 7 L37 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </svg>
  )
}

export default function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2" aria-label="Nerdy Town home">
      <span className="grid h-9 w-9 place-items-center rounded-xl border-2 border-ink-950 bg-carrot text-ink-950 shadow-pop transition-transform group-hover:-rotate-6">
        <Glasses className="h-4 w-8" />
      </span>
      <span className="font-display text-xl font-extrabold leading-none">
        Nerdy<span className="text-carrot">Town</span>
      </span>
    </Link>
  )
}
