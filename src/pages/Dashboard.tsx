import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Check, Clock, Coins, Flame, GraduationCap, HeartHandshake, Inbox, Loader2, Lock, LockOpen, LogOut, Minus, PencilLine, Plus, Rocket, Send, ShieldCheck, Swords, Trash2, Wallet as WalletIcon, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AnimatedNumber from '../components/AnimatedNumber'
import { confetti } from '../components/Confetti'
import { Page } from '../components/Layout'
import Modal from '../components/Modal'
import OutcomeModal from '../components/Outcome'
import { Scramble, SocialIcon } from '../components/SocialsReveal'
import { displayHandle, socialUrl } from '../lib/socials'
import ProfilePhoto from '../components/ProfilePhoto'
import { useToast } from '../components/Toast'
import { api, dailyInfo, selectMe, useStore } from '../lib/store'
import { shortAddress, type WalletOption } from '../lib/wallets'
import WalletPicker from '../components/WalletPicker'
import type { PartnerRequest, Profile } from '../lib/types'

function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function useResetCountdown() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  const d = next.getTime() - now
  const h = Math.floor(d / 3600000)
  const m = Math.floor((d % 3600000) / 60000)
  const s = Math.floor((d % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function StatTile({ icon: Icon, label, value, tone, hint, delay = 0 }: { icon: typeof Flame; label: string; value: number; tone: string; hint: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} whileHover={{ y: -4 }} className="card relative overflow-hidden p-4 sm:p-5">
      <div className={clsx('absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl', tone.replace('text-', 'bg-'))} />
      <Icon className={clsx('h-5 w-5', tone)} />
      <p className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-white/40">{hint}</p>
    </motion.div>
  )
}

function Ring({ left, limit }: { left: number; limit: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = limit ? left / limit : 0
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a1a" />
            <stop offset="1" stopColor="#ff4d8d" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-4xl font-extrabold leading-none">{left}</p>
          <p className="mt-1 text-[11px] text-white/50">of {limit} left</p>
        </div>
      </div>
    </div>
  )
}

type Tab = 'incoming' | 'sent' | 'matches' | 'ls'

const monthName = (ymd: string, opts: Intl.DateTimeFormatOptions = { month: 'long' }) => new Date(ymd + 'T00:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })

/** This month's revenue pool and the share my rejections earn so far. */
function RevenueShare() {
  const rev = useStore((s) => s.revenue)
  if (!rev) return null
  const share = rev.rejections > 0 ? Math.floor((rev.pool * rev.mine) / rev.rejections) : 0
  const pct = rev.rejections > 0 ? (rev.mine / rev.rejections) * 100 : 0
  const [y, m] = rev.month.split('-').map(Number)
  const payday = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  return (
    <div className="mt-5 rounded-2xl border border-carrot/25 bg-carrot/[0.06] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{monthName(rev.month)} revenue pool</p>
        <p className="shrink-0 font-mono text-[11px] text-white/45">pays {monthName(payday, { month: 'short', day: 'numeric' })}</p>
      </div>
      <p className="mt-1 font-display text-3xl font-extrabold">
        <AnimatedNumber value={rev.pool} />
        <span className="ml-1.5 text-sm text-carrot">$N</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-gradient-to-r from-rizz to-carrot" />
      </div>
      <p className="mt-2 text-xs text-white/60">
        {rev.mine > 0 ? (
          <>
            Your <b className="text-white">{rev.mine}</b> of {rev.rejections} rejection{rev.rejections === 1 ? '' : 's'} this month → about <b className="text-carrot">{share.toLocaleString()} $NERDY</b>
          </>
        ) : (
          'Get rejected this month to claim a slice.'
        )}
      </p>
      {rev.last && rev.last.paid > 0 && (
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-white/45">
          {monthName(rev.last.month)}: {rev.last.paid.toLocaleString()} $NERDY shared among {rev.last.recipients} nerd{rev.last.recipients === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}

/** Verification = $NERDY locked with the platform. Needed to send, accept and reject requests. */
function VerifyCard({ onVerify, onUnlock }: { onVerify: () => void; onUnlock: () => void }) {
  const me = useStore(selectMe)
  const locked = useStore((s) => s.locked)
  const ledger = useStore((s) => s.ledger)
  const { verifyLockAmount: LOCK, tokenMint } = useStore((s) => s.settings)
  const wallet = useStore((s) => s.wallet)
  const returning = ledger.find((e) => e.kind === 'unlock' && (e.status === 'requested' || e.status === 'processing'))
  if (me?.verified)
    return (
      <section className="card border-lime/30 bg-lime/[0.06] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime/20 text-lime">
            <BadgeCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">You’re verified</p>
            <p className="text-sm text-white/60">{locked > 0 ? `${locked.toLocaleString()} $NERDY locked` : 'Verified by the town hall'}</p>
          </div>
          {locked > 0 && (
            <button onClick={onUnlock} className="chip shrink-0 py-2 text-white/60 hover:text-white">
              <LockOpen className="h-3.5 w-3.5" /> Unlock
            </button>
          )}
        </div>
      </section>
    )
  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-ink-950 bg-gradient-to-br from-lime via-byte to-grape p-[2px] shadow-pop-lg">
      <div className="rounded-[1.4rem] bg-ink-900/95 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime/15 text-lime">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold">Get verified</h2>
            <p className="text-sm text-white/60">Needed to send, accept and reject requests.</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-white/70">
          <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-lime" /> Lock {LOCK} $NERDY with Nerdy Town</li>
          <li className="flex gap-2"><LockOpen className="mt-0.5 h-4 w-4 shrink-0 text-lime" /> Unlock any time and get it back</li>
          <li className="flex gap-2"><Coins className="mt-0.5 h-4 w-4 shrink-0 text-lime" /> No SOL needed. We pay the network fee</li>
        </ul>
        {returning ? (
          <p className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-white/70">
            <Clock className="mr-1 inline h-4 w-4 text-byte" /> {Math.abs(returning.amount).toLocaleString()} $NERDY is on its way back to your wallet. You can lock again any time.
          </p>
        ) : null}
        <button onClick={onVerify} disabled={!tokenMint || !wallet} className="btn-primary mt-5 w-full">
          <ShieldCheck className="h-5 w-5" /> {tokenMint ? `Verify · lock ${LOCK} $NERDY` : 'Opens when $NERDY launches'}
        </button>
        {!wallet && <p className="mt-2 text-center text-xs text-rizz">This account has no Solana wallet. Log in with a wallet or Google / X / email.</p>}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const s = useStore((x) => x)
  const me = useStore(selectMe)!
  const nav = useNavigate()
  const toast = useToast()
  const countdown = useResetCountdown()
  const [tab, setTab] = useState<Tab>('incoming')
  const [buyN, setBuyN] = useState(1)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState<string | false>(false)
  const [outcome, setOutcome] = useState<PartnerRequest | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  const daily = dailyInfo(s)
  const { balance, wallet, ledger } = s
  const { extraRequestCost: EXTRA_REQUEST_COST, minWithdraw: MIN_WITHDRAW, realUserGoal: GOAL, verifyLockAmount: LOCK } = s.settings

  const { incoming, sent, matches, ls, pendingSent } = useMemo(() => {
    const mine = s.requests.filter((r) => r.from === me.id || r.to === me.id)
    return {
      incoming: mine.filter((r) => r.to === me.id && r.status === 'pending'),
      sent: mine.filter((r) => r.from === me.id),
      matches: mine.filter((r) => r.status === 'accepted'),
      ls: mine.filter((r) => r.from === me.id && r.status === 'rejected'),
      pendingSent: mine.filter((r) => r.from === me.id && r.status === 'pending').length,
    }
  }, [s.requests, me.id])

  // Surface answers that came in while you were away (or while you're watching).
  const unseen = useMemo(() => sent.filter((r) => r.status !== 'pending' && !r.seen), [sent])
  useEffect(() => {
    if (!unseen.length || outcome) return
    setOutcome(unseen[0])
    api.markSeen(unseen.map((r) => r.id))
  }, [unseen, outcome])

  const P = (id: string) => s.profiles[id] as Profile | undefined
  const socialsOf = (id: string) => s.contacts[id] ?? []

  const respond = async (r: PartnerRequest, st: 'accepted' | 'rejected') => {
    try {
      await api.respond(r.id, st === 'accepted')
    } catch (e) {
      return toast('error', (e as Error).message)
    }
    const n = P(r.from)?.name.split(' ')[0]
    if (st === 'accepted') {
      confetti({ count: 80, emoji: ['💘', '💬'] })
      toast('success', `Matched with ${n}!`, 'They can now see your socials.')
    } else toast('info', `You passed on ${n}.`, 'Their popularity just went up. You’re a good person.')
  }

  const buy = async () => {
    try {
      await api.buyRequests(buyN)
      toast('win', `+${buyN} request${buyN > 1 ? 's' : ''} unlocked`, `Spent ${(buyN * EXTRA_REQUEST_COST).toLocaleString()} $NERDY`)
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const verify = async (o: WalletOption) => {
    setBusy(o.id)
    try {
      await api.verify(o)
      setVerifyOpen(false)
      confetti({ count: 120, colors: ['#b6ff3b', '#38bdf8', '#fff'], emoji: ['✅', '🤓'] })
      toast('win', 'You’re verified!', 'Go shoot your shot.')
    } catch (e) {
      if (!(e as { quiet?: boolean }).quiet) toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const unlock = async () => {
    setBusy('unlock')
    try {
      await api.unlock()
      setUnlockOpen(false)
      toast('info', 'Unlocked', 'Your $NERDY is on its way back to your wallet.')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy('withdraw')
    try {
      await api.withdraw(Number(amount))
      setWithdrawOpen(false)
      setAmount('')
      confetti({ colors: ['#ff7a1a', '#ffd166', '#fff'], emoji: ['🪙'] })
      toast('win', 'Withdrawal requested!', `${Number(amount).toLocaleString()} $NERDY — payouts are reviewed and sent, usually within 24h.`)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'incoming', label: 'Incoming', count: incoming.length },
    { id: 'sent', label: 'Sent', count: sent.length },
    { id: 'matches', label: 'Matches', count: matches.length },
    { id: 'ls', label: 'L Log', count: ls.length },
  ]
  const list = { incoming, sent, matches, ls }[tab]

  return (
    <Page className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 md:pt-10">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={`/u/${me.id}`} className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-carrot shadow-carrot transition hover:rotate-3">
            <ProfilePhoto profile={me} className="h-full w-full" />
          </Link>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-carrot">Dashboard</p>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Hey, {me.name.split(' ')[0]} 👋</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/onboarding" className="chip py-2 hover:text-white">
            <PencilLine className="h-3.5 w-3.5" /> Edit profile
          </Link>
          <button
            onClick={async () => {
              await api.logout()
              nav('/')
            }}
            className="chip py-2 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
          <button onClick={() => setDeleteOpen(true)} className="chip py-2 text-white/50 hover:border-rizz/50 hover:text-rizz">
            <Trash2 className="h-3.5 w-3.5" /> Delete account
          </button>
        </div>
      </div>

      {/* phase banner */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={clsx('mt-6 flex flex-col gap-3 rounded-3xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5', s.phase === 1 ? 'border-grape/30 bg-grape/10' : 'border-lime/30 bg-lime/10')}>
        <div className="flex items-center gap-3">
          <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', s.phase === 1 ? 'bg-grape/20 text-grape-300' : 'bg-lime/20 text-lime')}>
            {s.phase === 1 ? <Lock className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-semibold">{s.phase === 1 ? `Phase 1 · ${Math.min(s.stats.verified, GOAL).toLocaleString()} / ${GOAL.toLocaleString()} verified residents` : `Phase 2 · ${GOAL.toLocaleString()} verified residents reached 🎉`}</p>
            <p className="text-sm text-white/60">
              {s.phase === 1
                ? `Phase 2 starts by itself when ${GOAL.toLocaleString()} verified nerds live here. Until then, rejections count as popularity.`
                : 'Every rejection earns you a share of the monthly revenue pool.'}
            </p>
          </div>
        </div>
        {s.isAdmin && (
          <Link to="/admin" className="chip shrink-0 self-start py-2 hover:text-white sm:self-auto">
            <Rocket className="h-3.5 w-3.5" /> Admin panel
          </Link>
        )}
      </motion.div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={Flame} label="Popularity" value={me.rejectionsReceived} tone="text-rizz" hint="Rejections received — public" />
        <StatTile icon={HeartHandshake} label="Matches" value={me.accepts} tone="text-lime" hint="Accepted requests" delay={0.05} />
        <StatTile icon={Send} label="Pending" value={pendingSent} tone="text-byte" hint="Waiting on an answer" delay={0.1} />
        <StatTile icon={Swords} label="Hearts broken" value={me.rejectionsGiven} tone="text-grape-300" hint="Requests you rejected" delay={0.15} />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* requests */}
        <section className="card order-2 p-4 sm:p-6 lg:order-1">
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={clsx('relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition', tab === t.id ? 'text-ink-950' : 'text-white/60 hover:text-white')}>
                {tab === t.id && <motion.span layoutId="dash-tab" className="absolute inset-0 rounded-full bg-carrot" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <span className="relative">{t.label}</span>
                <span className={clsx('relative rounded-full px-1.5 text-[11px]', tab === t.id ? 'bg-ink-950/15' : 'bg-white/10')}>{t.count}</span>
              </button>
            ))}
          </div>

          {tab === 'incoming' && !me.verified && incoming.length > 0 && (
            <button onClick={() => setVerifyOpen(true)} className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-lime/30 bg-lime/10 p-3 text-left text-sm text-white/80 hover:bg-lime/15">
              <ShieldCheck className="h-5 w-5 shrink-0 text-lime" /> Get verified to answer these. Lock {LOCK} $NERDY, get it back any time.
            </button>
          )}
          <div className="mt-4 min-h-[260px]">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.length === 0 ? (
                <motion.div key={`empty-${tab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-12 text-center">
                  <Inbox className="h-10 w-10 text-white/20" />
                  <p className="mt-3 font-semibold">{{ incoming: 'No incoming requests', sent: 'You haven’t shot your shot yet', matches: 'No matches yet', ls: 'No Ls yet. Go collect some!' }[tab]}</p>
                  <Link to="/explore" className="btn-primary mt-5 !py-2.5 text-sm">
                    Explore nerds
                  </Link>
                </motion.div>
              ) : (
                list.map((r) => {
                  const otherId = r.from === me.id ? r.to : r.from
                  const o = P(otherId)
                  if (!o) return null
                  const outgoing = r.from === me.id
                  return (
                    <motion.div key={r.id + tab} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} className="mb-2 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]">
                      <Link to={`/u/${o.id}`} className="shrink-0">
                        <ProfilePhoto profile={o} className="h-14 w-14 rounded-2xl" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={`/u/${o.id}`} className="block truncate font-semibold hover:text-carrot">
                          {o.name}, {o.age}
                        </Link>
                        {tab === 'matches' ? (
                          outgoing ? (
                            <p className="truncate text-sm text-lime">
                              <Scramble text={socialsOf(o.id)[0] ? displayHandle(socialsOf(o.id)[0]) : '…'} className="font-mono" />
                              {socialsOf(o.id).length > 1 && <span className="text-xs text-white/40"> +{socialsOf(o.id).length - 1} more</span>}
                            </p>
                          ) : (
                            <p className="text-xs text-white/50">You accepted — they can see your socials</p>
                          )
                        ) : (
                          <p className="truncate text-xs text-white/50">
                            {tab === 'ls' ? `Rejected you · ${timeAgo(r.resolvedAt ?? r.createdAt)}` : `${o.nerdClass} · ${timeAgo(r.createdAt)}`}
                          </p>
                        )}
                      </div>
                      {tab === 'incoming' ? (
                        <div className="flex gap-2">
                          <motion.button whileTap={{ scale: 0.85 }} onClick={() => respond(r, 'rejected')} className="grid h-11 w-11 place-items-center rounded-2xl border border-rizz/40 bg-rizz/10 text-rizz hover:bg-rizz/20" aria-label={`Reject ${o.name}`}>
                            <X className="h-5 w-5" />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.85 }} onClick={() => respond(r, 'accepted')} className="grid h-11 w-11 place-items-center rounded-2xl border-2 border-ink-950 bg-lime text-ink-950 shadow-pop active:shadow-none" aria-label={`Accept ${o.name}`}>
                            <Check className="h-5 w-5" />
                          </motion.button>
                        </div>
                      ) : tab === 'matches' && outgoing ? (
                        <div className="flex gap-1.5">
                          {socialsOf(o.id).slice(0, 3).map((so) => {
                            const url = socialUrl(so)
                            const copy = () => navigator.clipboard?.writeText(displayHandle(so)).then(() => toast('success', `${so.platform} copied`, displayHandle(so)))
                            return url ? (
                              <a key={so.platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${so.platform}`} className="transition hover:scale-110">
                                <SocialIcon platform={so.platform} className="h-9 w-9" />
                              </a>
                            ) : (
                              <button key={so.platform} onClick={copy} aria-label={`Copy ${so.platform}`} className="transition hover:scale-110">
                                <SocialIcon platform={so.platform} className="h-9 w-9" />
                              </button>
                            )
                          })}
                        </div>
                      ) : tab === 'ls' ? (
                        <span className="rounded-full bg-rizz/15 px-2.5 py-1 font-mono text-xs font-bold text-rizz">+1 🔥</span>
                      ) : (
                        <span
                          className={clsx(
                            'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase',
                            r.status === 'pending' && 'bg-byte/15 text-byte',
                            r.status === 'accepted' && 'bg-lime/15 text-lime',
                            r.status === 'rejected' && 'bg-rizz/15 text-rizz',
                          )}
                        >
                          {r.status === 'pending' ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 animate-spin [animation-duration:3s]" /> Pending
                            </span>
                          ) : r.status === 'accepted' ? (
                            'Matched'
                          ) : (
                            'Rejected'
                          )}
                        </span>
                      )}
                    </motion.div>
                  )
                })
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* side column */}
        <div className="order-1 space-y-6 lg:order-2">
          <VerifyCard onVerify={() => setVerifyOpen(true)} onUnlock={() => setUnlockOpen(true)} />
          {/* daily */}
          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-5">
              <Ring left={daily.left} limit={daily.limit} />
              <div>
                <h2 className="text-xl font-bold">Daily requests</h2>
                <p className="mt-1 text-sm text-white/60">
                  {daily.limit - daily.bonus} free{daily.bonus ? ` + ${daily.bonus} bought` : ''} per day.
                </p>
                <p className="mt-3 flex items-center gap-1.5 font-mono text-xs text-white/50">
                  <Clock className="h-3.5 w-3.5" /> Resets in {countdown}
                </p>
              </div>
            </div>
            <div className={clsx('mt-5 rounded-2xl border p-4', s.phase === 2 ? 'border-carrot/30 bg-carrot/5' : 'border-white/10 bg-white/[0.02]')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Buy extra requests</p>
                  <p className="text-xs text-white/50">{EXTRA_REQUEST_COST} $NERDY each{s.phase === 1 && ' · unlocks in Phase 2'}</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-ink-950/60 p-1">
                  <button disabled={s.phase === 1 || buyN <= 1} onClick={() => setBuyN(buyN - 1)} className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30" aria-label="Less">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold">{buyN}</span>
                  <button disabled={s.phase === 1 || buyN >= 10} onClick={() => setBuyN(buyN + 1)} className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30" aria-label="More">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button onClick={buy} disabled={s.phase === 1} className="btn-primary mt-3 w-full !py-2.5 text-sm">
                {s.phase === 1 ? <Lock className="h-4 w-4" /> : <Coins className="h-4 w-4" />} {s.phase === 1 ? 'Unlocks in Phase 2' : `Buy for ${(buyN * EXTRA_REQUEST_COST).toLocaleString()} $NERDY`}
              </button>
            </div>
          </section>

          {/* wallet */}
          <section className="relative overflow-hidden rounded-3xl border-2 border-ink-950 bg-gradient-to-br from-carrot via-rizz to-grape p-[2px] shadow-pop-lg">
            <div className="rounded-[1.4rem] bg-ink-900/90 p-5 backdrop-blur sm:p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-widest text-white/50">$NERDY balance</p>
                {s.phase === 1 && <span className="chip text-[10px]"><Lock className="h-3 w-3" /> Phase 2</span>}
              </div>
              <p className="mt-2 font-display text-5xl font-extrabold">
                <AnimatedNumber value={balance} />
                <span className="ml-2 text-lg text-carrot">$N</span>
              </p>
              <p className="mt-1 text-xs text-white/50">
                {s.phase === 1 ? `${me.rejectionsReceived} rejections banked as popularity. Revenue share starts in Phase 2.` : `Paid monthly from the revenue share · min withdraw ${MIN_WITHDRAW}`}
              </p>

              {s.phase === 2 && <RevenueShare />}

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-grape/20 text-grape-300">
                  <WalletIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/50">Your sign-in wallet · payouts go here</p>
                  {wallet ? (
                    <button onClick={() => navigator.clipboard?.writeText(wallet).then(() => toast('success', 'Wallet address copied', wallet))} title="Copy full address" className="block max-w-full truncate font-mono text-sm hover:text-carrot">
                      {wallet.slice(0, 6)}…{wallet.slice(-6)}
                    </button>
                  ) : (
                    <p className="font-mono text-sm">No wallet on this account</p>
                  )}
                </div>
              </div>
              <button onClick={() => setWithdrawOpen(true)} disabled={s.phase === 1 || !wallet} className="btn-primary mt-3 w-full">
                <ArrowUpRight className="h-4 w-4" /> Withdraw
              </button>

              {ledger.length > 0 && (
                <div className="mt-5">
                  <p className="label">Activity</p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {ledger.slice(0, 20).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-white/70">
                          {e.note}
                          {(e.kind === 'withdraw' || e.kind === 'unlock') && (
                            <span className={clsx('ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase', e.status === 'sent' ? 'bg-lime/15 text-lime' : e.status === 'failed' || e.status === 'rejected' ? 'bg-rizz/15 text-rizz' : 'bg-byte/15 text-byte')}>
                              {e.txSig ? (
                                <a href={`https://solscan.io/tx/${e.txSig}`} target="_blank" rel="noopener noreferrer" className="underline">{e.status}</a>
                              ) : (
                                e.status
                              )}
                            </span>
                          )}
                        </span>
                        <span className={clsx('shrink-0 font-mono font-semibold', e.amount > 0 ? 'text-lime' : 'text-white/50', (e.status === 'failed' || e.status === 'rejected') && 'line-through opacity-50')}>
                          {e.amount > 0 ? '+' : ''}
                          {e.amount.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* verify modal */}
      <Modal open={verifyOpen} onClose={() => setVerifyOpen(false)} title="Get verified">
        <h2 className="text-2xl font-bold">Lock {LOCK} $NERDY</h2>
        <p className="mt-1 text-sm text-white/60">
          Pick the login you used to sign in{wallet ? <> (<span className="font-mono">{shortAddress(wallet)}</span>)</> : null}. It asks you to approve sending {LOCK} $NERDY to Nerdy Town. We pay the network fee.
        </p>
        <div className="mt-6">
          <WalletPicker onPick={verify} busyId={typeof busy === 'string' ? busy : null} disabled={!!busy} />
        </div>
        <p className="mt-4 text-center text-xs text-white/40">Unlock whenever you like: your {LOCK} $NERDY is sent back to this wallet and the badge goes away.</p>
      </Modal>

      {/* unlock modal */}
      <Modal open={unlockOpen} onClose={() => setUnlockOpen(false)} title="Unlock">
        <div className="text-center">
          <LockOpen className="mx-auto h-10 w-10 text-carrot" />
          <h2 className="mt-3 text-2xl font-bold">Unlock {s.locked.toLocaleString()} $NERDY?</h2>
          <p className="mt-2 text-white/60">It’s sent back to {wallet ? <span className="font-mono">{shortAddress(wallet)}</span> : 'your wallet'} after a quick review (usually within 24h). You lose the verified badge right away, so you can’t send or answer requests until you lock again.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => setUnlockOpen(false)} className="btn-ghost">Keep it locked</button>
            <button onClick={unlock} disabled={busy === 'unlock'} className="btn-primary">
              {busy === 'unlock' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} Unlock
            </button>
          </div>
        </div>
      </Modal>

      {/* withdraw modal */}
      <Modal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} title="Withdraw">
        <h2 className="text-2xl font-bold">Withdraw $NERDY</h2>
        <p className="mt-1 text-sm text-white/60">Available: <b className="text-white">{balance.toLocaleString()}</b></p>
        <div className="relative mt-5">
          <input className="input pr-20 font-mono text-xl" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" aria-label="Amount" />
          <button onClick={() => setAmount(String(balance))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-carrot/15 px-3 py-1.5 text-xs font-bold text-carrot">MAX</button>
        </div>
        {wallet && <p className="mt-3 text-xs text-white/50">To your sign-in wallet · {wallet.slice(0, 6)}…{wallet.slice(-6)}</p>}
        <button onClick={withdraw} disabled={busy === 'withdraw' || !amount} className="btn-primary mt-6 w-full py-4">
          {busy === 'withdraw' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUpRight className="h-5 w-5" />} Request withdrawal
        </button>
        <p className="mt-3 text-center text-xs text-white/40">Withdrawals are reviewed for abuse before they’re sent on-chain, usually within 24h.</p>
      </Modal>

      {/* delete account modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <div className="text-center">
          <Trash2 className="mx-auto h-10 w-10 text-rizz" />
          <h2 className="mt-3 text-2xl font-bold">Delete your account?</h2>
          <p className="mt-2 text-white/60">Your profile, photos, socials, requests and $NERDY balance are permanently removed. This can’t be undone.</p>
          <label className="label mt-5 text-left" htmlFor="del">Type DELETE to confirm</label>
          <input id="del" className="input font-mono" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
          <button
            disabled={deleteText !== 'DELETE' || busy === 'delete'}
            onClick={async () => {
              setBusy('delete')
              try {
                await api.deleteAccount()
                toast('info', 'Account deleted', 'Sorry to see you go, legend.')
                nav('/', { replace: true })
              } catch (e) {
                toast('error', (e as Error).message)
                setBusy(false)
              }
            }}
            className="btn mt-5 w-full bg-rizz py-4 text-ink-950"
          >
            {busy === 'delete' && <Loader2 className="h-5 w-5 animate-spin" />} Delete forever
          </button>
        </div>
      </Modal>

      {outcome && P(outcome.to) && (
        <OutcomeModal open onClose={() => setOutcome(null)} status={outcome.status as 'accepted' | 'rejected'} other={P(outcome.to)!} me={me} phase={s.phase} />
      )}
    </Page>
  )
}
