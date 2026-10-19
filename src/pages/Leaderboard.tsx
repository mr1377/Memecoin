import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Flame, Loader2, Share2, Sparkles, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Layout'
import ProfilePhoto from '../components/ProfilePhoto'
import { loadLeaderboard, selectMe, useStore } from '../lib/store'
import type { Leaderboard as Board } from '../lib/types'

type Tab = 'rejectedWeek' | 'pointsWeek' | 'pointsAll'
const TABS: { id: Tab; label: string; unit: string; empty: string }[] = [
  { id: 'rejectedWeek', label: 'Most rejected · 7 days', unit: 'L', empty: 'Nobody got rejected this week. Go shoot your shot and claim the crown.' },
  { id: 'pointsWeek', label: 'Top points · 7 days', unit: 'pts', empty: 'No points earned this week yet. Every request is a chance.' },
  { id: 'pointsAll', label: 'All-time points', unit: 'pts', empty: 'The board is empty. Be the first legend.' },
]

export default function Leaderboard() {
  const profiles = useStore((s) => s.profiles)
  const me = useStore(selectMe)
  const [tab, setTab] = useState<Tab>('rejectedWeek')
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLeaderboard().then(setBoard, (e: Error) => setError(e.message))
  }, [])

  const rows = (board?.[tab] ?? []).filter((r) => profiles[r.id])
  const t = TABS.find((x) => x.id === tab)!
  const max = rows[0]?.n || 1
  const myRank = me ? rows.findIndex((r) => r.id === me.id) : -1

  return (
    <Page className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 md:pt-10">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-carrot">Leaderboard</p>
        <h1 className="mt-2 text-4xl font-extrabold sm:text-6xl">The town’s legends.</h1>
        <p className="mx-auto mt-3 max-w-md text-white/60">Elsewhere rejection is a secret. Here it’s a scoreboard, and every point counts when $NERDY arrives.</p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-1">
        {TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={clsx('relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition', tab === x.id ? 'text-ink-950' : 'text-white/60 hover:text-white')}>
            {tab === x.id && <motion.span layoutId="lb-tab" className="absolute inset-0 rounded-full bg-carrot" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
            <span className="relative">{x.label}</span>
          </button>
        ))}
      </div>

      {myRank >= 0 && (
        <Link to="/dashboard?share=1" className="mt-4 flex items-center gap-3 rounded-2xl border border-lime/30 bg-lime/10 p-3 text-sm text-white/80 hover:bg-lime/15">
          <Trophy className="h-5 w-5 shrink-0 text-lime" />
          <span className="flex-1">You’re <b className="text-white">#{myRank + 1}</b> here. Brag about it.</span>
          <Share2 className="h-4 w-4 text-lime" />
        </Link>
      )}

      <ol className="card mt-4 divide-y divide-white/5 overflow-hidden">
        {!board && !error && (
          <li className="grid place-items-center p-10 text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </li>
        )}
        {error && <li className="p-6 text-center text-sm text-rizz">{error}</li>}
        {board && !rows.length && (
          <li className="flex flex-col items-center p-10 text-center">
            <Trophy className="h-10 w-10 text-carrot" />
            <p className="mt-3 text-white/60">{t.empty}</p>
          </li>
        )}
        {rows.map((r, i) => {
          const p = profiles[r.id]
          return (
            <motion.li key={tab + r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              <Link to={`/u/${p.id}`} className={clsx('group flex items-center gap-4 p-4 transition hover:bg-white/[0.03] sm:p-5', me?.id === p.id && 'bg-lime/[0.05]')}>
                <span className={clsx('w-7 text-center font-display text-2xl font-black', i === 0 ? 'text-carrot' : i < 3 ? 'text-white/70' : 'text-white/30')}>{i + 1}</span>
                <ProfilePhoto small profile={p} className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-carrot">
                    {p.name} {i === 0 && '👑'} {me?.id === p.id && <span className="text-xs font-normal text-lime">(you)</span>}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(r.n / max) * 100}%` }} transition={{ duration: 0.9, delay: Math.min(i, 10) * 0.04 }} className={clsx('h-full rounded-full bg-gradient-to-r', tab === 'rejectedWeek' ? 'from-rizz to-carrot' : 'from-lime to-byte')} />
                  </div>
                </div>
                <span className={clsx('flex items-center gap-1 font-mono text-sm font-bold', tab === 'rejectedWeek' ? 'text-rizz' : 'text-lime')}>
                  {tab === 'rejectedWeek' ? <Flame className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {r.n.toLocaleString()} {t.unit}
                </span>
              </Link>
            </motion.li>
          )
        })}
      </ol>
      <p className="mt-4 text-center text-xs text-white/40">“7 days” boards count the last 7 days and refresh constantly.</p>
    </Page>
  )
}
