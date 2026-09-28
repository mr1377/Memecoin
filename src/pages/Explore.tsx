import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Flame, MapPin, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import Mascot from '../components/Mascot'
import ProfileCard, { ProfileCardSkeleton } from '../components/ProfileCard'
import { dailyInfo, relationWith, useStore } from '../lib/store'
import type { Gender } from '../lib/types'

const FILTERS = [
  { id: 'all', label: 'All', icon: Compass },
  { id: 'nearby', label: 'Nearby', icon: MapPin },
  { id: 'new', label: 'New', icon: Sparkles },
  { id: 'popular', label: 'Popular', icon: Flame },
] as const
type FilterId = (typeof FILTERS)[number]['id']

const GENDERS: (Gender | 'Everyone')[] = ['Everyone', 'Woman', 'Man', 'Non-binary']
const GENDER_LABEL = { Everyone: 'Everyone', Woman: 'Women', Man: 'Men', 'Non-binary': 'Non-binary', Other: 'Other' }
const norm = (c: string) => c.trim().toLowerCase()
const region = (c: string) => norm(c.split(',')[1] ?? '')
const WEEK = 7 * 86400_000

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const f = (FILTERS.some((x) => x.id === params.get('f')) ? params.get('f') : 'all') as FilterId
  const g = (params.get('g') ?? 'Everyone') as Gender | 'Everyone'
  const s = useStore((x) => x)
  const [loading, setLoading] = useState(true)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const update = (k: string, v: string, def: string) => {
    const next = new URLSearchParams(params)
    if (v && v !== def) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const myCity = s.session ? s.profiles[s.session]?.city ?? '' : ''

  const list = useMemo(() => {
    const now = Date.now()
    const needle = q.trim().toLowerCase()
    let arr = Object.values(s.profiles).filter((p) => p.id !== s.session)
    if (g !== 'Everyone') arr = arr.filter((p) => p.gender === g)
    if (needle)
      arr = arr.filter((p) =>
        [p.name, p.city, p.nerdClass, p.tagline, p.bio, ...p.interests].some((t) => t.toLowerCase().includes(needle)),
      )
    switch (f) {
      case 'nearby':
        if (myCity) {
          // Same city first, then same state/region (the part after the comma).
          const score = (c: string) => (norm(c) === norm(myCity) ? 2 : region(c) && region(c) === region(myCity) ? 1 : 0)
          arr = arr.filter((p) => score(p.city) > 0).sort((a, b) => score(b.city) - score(a.city))
        } else arr = arr.sort((a, b) => a.city.localeCompare(b.city))
        break
      case 'new':
        arr = arr.filter((p) => now - p.joinedAt < WEEK * 2).sort((a, b) => b.joinedAt - a.joinedAt)
        break
      case 'popular':
        arr = arr.sort((a, b) => b.rejectionsReceived - a.rejectionsReceived)
        break
      default:
        arr = arr.sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0) || b.joinedAt - a.joinedAt)
    }
    return arr
  }, [s.profiles, s.session, q, f, g, myCity])

  const daily = s.session && s.profiles[s.session] ? dailyInfo(s, s.session) : null

  return (
    <Page className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 md:pt-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-carrot">Explore</p>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Find your nerd.</h1>
        </div>
        {daily ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
            <div className="flex gap-1">
              {Array.from({ length: daily.limit }, (_, i) => (
                <span key={i} className={clsx('h-2.5 w-6 rounded-full transition', i < daily.left ? 'bg-carrot' : 'bg-white/10')} />
              ))}
            </div>
            <span className="text-sm text-white/70">
              <b className="text-white">{daily.left}</b> request{daily.left === 1 ? '' : 's'} left today
            </span>
          </div>
        ) : (
          <Link to="/signup" className="text-sm text-white/60 hover:text-white">
            <span className="text-carrot">Join free</span> to send requests →
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="sticky top-16 z-30 -mx-4 mt-6 bg-ink-900/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <label className="group relative block">
          <span className="sr-only">Search profiles</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40 transition group-focus-within:text-carrot" />
          <input
            ref={input}
            value={q}
            onChange={(e) => update('q', e.target.value, '')}
            placeholder="Search names, interests, cities…"
            className="input h-14 pl-12 pr-24 text-base"
            enterKeyHint="search"
          />
          {q ? (
            <button onClick={() => update('q', '', '')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border border-white/15 px-2 py-0.5 font-mono text-xs text-white/40 sm:block">/</kbd>
          )}
        </label>

        <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((x) => {
            const active = f === x.id
            return (
              <button
                key={x.id}
                onClick={() => update('f', x.id, 'all')}
                className={clsx('relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition', active ? 'text-ink-950' : 'text-white/70 hover:text-white')}
                aria-pressed={active}
              >
                {active && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-carrot shadow-carrot" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
                {!active && <span className="absolute inset-0 rounded-full border border-white/10 bg-white/5" />}
                <x.icon className="relative h-4 w-4" />
                <span className="relative">{x.label}</span>
              </button>
            )
          })}
          <span className="mx-1 h-6 w-px shrink-0 bg-white/10" />
          <select
            value={g}
            onChange={(e) => update('g', e.target.value, 'Everyone')}
            className="shrink-0 appearance-none rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 outline-none focus:border-carrot"
            aria-label="Filter by gender"
            style={{ fontSize: 14 }}
          >
            {GENDERS.map((x) => (
              <option key={x} value={x} className="bg-ink-800">
                {GENDER_LABEL[x]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-4 mt-2 text-sm text-white/40" aria-live="polite">
        {loading ? 'Scanning the town…' : `${list.length} nerd${list.length === 1 ? '' : 's'} found`}
        {!loading && f === 'nearby' && (myCity ? ` near ${myCity}` : ' · log in to see nerds in your city')}
      </p>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProfileCardSkeleton key={i} />
          ))}
        </div>
      ) : list.length ? (
        <motion.div layout className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {list.map((p, i) => (
              <ProfileCard key={p.id} profile={p} index={i} me={s.session} relation={relationWith(s, p.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card mx-auto mt-6 flex max-w-md flex-col items-center p-8 text-center">
          <Mascot className="h-40 w-40" />
          <h2 className="mt-4 text-2xl font-bold">No nerds match that.</h2>
          <p className="mt-2 text-white/60">Try a different spell. Maybe “chess”, “anime”, or “rust”?</p>
          <button onClick={() => setParams({}, { replace: true })} className="btn-ghost mt-6">
            Clear filters
          </button>
        </motion.div>
      )}
    </Page>
  )
}
