import clsx from 'clsx'
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Coins, Crown, Heart, Lock, Phone, Rocket, Send, Shield, Sparkles, Trophy, UserPlus, X, Zap } from 'lucide-react'
import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AnimatedNumber from '../components/AnimatedNumber'
import { confetti } from '../components/Confetti'
import { Page } from '../components/Layout'
import { Glasses } from '../components/Logo'
import Mascot from '../components/Mascot'
import NerdAvatar from '../components/NerdAvatar'
import ProfilePhoto from '../components/ProfilePhoto'
import { EXTRA_REQUEST_COST, FREE_DAILY_REQUESTS, REJECT_REWARD, api, useStore } from '../lib/store'
import { seedAvatar } from '../lib/avatar'

const reveal = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
} as const

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('font-mono text-xs font-semibold uppercase tracking-[0.25em] text-carrot', className)}>{children}</p>
}

// ------------------------------------------------------------------ HERO

function FloatCard({ className, children, depth, mx, my }: { className: string; children: ReactNode; depth: number; mx: ReturnType<typeof useSpring>; my: ReturnType<typeof useSpring> }) {
  const x = useTransform(mx, (v) => v * depth)
  const y = useTransform(my, (v) => v * depth)
  return (
    <motion.div style={{ x, y }} className={clsx('absolute', className)}>
      <div className="animate-float">{children}</div>
    </motion.div>
  )
}

function Hero() {
  const profiles = useStore((s) => s.profiles)
  const bots = useMemo(() => Object.values(profiles).filter((p) => p.id.startsWith('bot_')).slice(0, 5), [profiles])
  const mxRaw = useMotionValue(0)
  const myRaw = useMotionValue(0)
  const mx = useSpring(mxRaw, { stiffness: 80, damping: 20 })
  const my = useSpring(myRaw, { stiffness: 80, damping: 20 })
  const onMove = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    mxRaw.set(((e.clientX - r.left) / r.width - 0.5) * 30)
    myRaw.set(((e.clientY - r.top) / r.height - 0.5) * 30)
  }
  const words = ['always', 'still', 'forever']
  const [w, setW] = useState(0)

  return (
    <section onMouseMove={onMove} className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-8 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pb-20">
      <div className="relative z-10 text-center lg:text-left">
        <motion.a
          href="#roadmap"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-xs font-semibold text-white/80 backdrop-blur hover:border-carrot/50"
        >
          <span className="rounded-full bg-carrot px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink-950">$NERDY</span>
          Launching on pump.fun
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.a>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-[2.9rem] font-extrabold leading-[0.95] sm:text-7xl lg:text-[5.2rem]"
        >
          Where nerds
          <br />
          are{' '}
          <button
            type="button"
            onClick={() => setW((w + 1) % words.length)}
            className="relative inline-grid overflow-hidden align-bottom text-gradient"
            aria-label="Shuffle word"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={words[w]} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 26 }} className="pr-1 italic">
                {words[w]}
              </motion.span>
            </AnimatePresence>
          </button>
          <br />
          <span className="relative inline-block">
            winners.
            <svg viewBox="0 0 300 20" className="absolute -bottom-3 left-0 w-full text-carrot" aria-hidden>
              <motion.path d="M4 14 Q80 2 150 10 T296 8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.9 }} />
            </svg>
          </span>
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mx-auto mt-8 max-w-xl text-lg text-white/70 lg:mx-0">
          Send a partner request to anyone in town. They <b className="text-lime">accept</b>? You get their number. They <b className="text-rizz">reject</b>? Your popularity climbs — and after graduation, every L pays out in <b className="text-carrot">$NERDY</b>.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <Link to="/signup" className="btn-primary w-full px-7 py-4 text-base sm:w-auto">
            Move into Nerdy Town <ArrowRight className="h-5 w-5" />
          </Link>
          <Link to="/explore" className="btn-ghost w-full px-7 py-4 text-base sm:w-auto">
            Browse the nerds
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-8 flex items-center justify-center gap-3 lg:justify-start">
          <div className="flex -space-x-3">
            {bots.map((p) => (
              <ProfilePhoto key={p.id} profile={p} className="h-10 w-10 rounded-full border-2 border-ink-900" />
            ))}
          </div>
          <p className="text-left text-sm text-white/60">
            <b className="text-white"><AnimatedNumber value={12480} /></b> rejections logged.
            <br />
            Every single one a W.
          </p>
        </motion.div>
      </div>

      {/* Stage */}
      <div className="relative mx-auto aspect-square w-full max-w-[520px]">
        <div className="absolute inset-[8%] rounded-[3rem] bg-gradient-to-br from-grape via-grape-600 to-byte opacity-90 shadow-[0_40px_120px_-20px_rgba(139,92,246,.7)]" />
        <div className="grid-paper absolute inset-[8%] rounded-[3rem] opacity-60" />
        <div className="absolute inset-[8%] overflow-hidden rounded-[3rem]">
          <div className="absolute inset-x-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        </div>
        <motion.div initial={{ scale: 0.8, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }} className="absolute inset-[8%] cursor-pointer">
          <Mascot className="h-full w-full" />
        </motion.div>

        <FloatCard depth={1.2} mx={mx} my={my} className="-left-2 top-[14%] sm:-left-6">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-ink-950 bg-lime px-3 py-2 text-ink-950 shadow-pop">
            <Phone className="h-4 w-4" />
            <div className="text-left leading-tight">
              <p className="text-[10px] font-bold uppercase">Accepted!</p>
              <p className="font-mono text-xs font-bold">+1 (555) 867-5309</p>
            </div>
          </div>
        </FloatCard>
        <FloatCard depth={-1.5} mx={mx} my={my} className="-right-1 top-[38%] sm:-right-8 [&>div]:[animation-delay:-2s]">
          <div className="rounded-2xl border-2 border-ink-950 bg-rizz px-3 py-2 text-ink-950 shadow-pop">
            <p className="text-[10px] font-bold uppercase">Rejected</p>
            <p className="font-display text-lg font-extrabold leading-none">+1 Popularity</p>
          </div>
        </FloatCard>
        <FloatCard depth={0.8} mx={mx} my={my} className="bottom-[4%] left-[8%] [&>div]:[animation-delay:-3.5s]">
          <div className="flex items-center gap-2 rounded-full border-2 border-ink-950 bg-carrot px-3 py-1.5 font-mono text-sm font-bold text-ink-950 shadow-pop">
            <Coins className="h-4 w-4" /> +{REJECT_REWARD} $NERDY
          </div>
        </FloatCard>
        <FloatCard depth={-0.6} mx={mx} my={my} className="right-[6%] top-[2%] [&>div]:[animation-delay:-1s]">
          <div className="rounded-full border border-white/20 bg-ink-900/80 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            👆 poke me
          </div>
        </FloatCard>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ MARQUEE

function Marquee() {
  const items = ['Nerds always win', 'Get rejected → get popular', 'Get accepted → get the digits', '$NERDY', '3 free shots a day', 'Ls convert to tokens', 'Glasses on. Fear off.']
  const row = [...items, ...items]
  return (
    <div className="overflow-hidden py-8">
    <div className="relative -mx-4 -rotate-2 border-y-2 border-ink-950 bg-carrot py-3 text-ink-950">
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap font-display text-xl font-extrabold uppercase sm:text-2xl">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-8">
            {t} <Glasses className="h-5 w-12" />
          </span>
        ))}
      </div>
    </div>
    </div>
  )
}

// ------------------------------------------------------------------ WIN-WIN DEMO

function WinWinDemo() {
  const [state, setState] = useState<'idle' | 'sending' | 'accepted' | 'rejected'>('idle')
  const [pop, setPop] = useState(41)
  const [tokens, setTokens] = useState(0)
  const [phase2, setPhase2] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const seed = useMemo(() => ({ ...seedAvatar('demo-crush-7'), hairStyle: 'long' as const, mood: 'smug' as const }), [])

  const send = (forced?: 'accepted' | 'rejected') => {
    setState('sending')
    setTimeout(() => {
      const outcome = forced ?? (Math.random() < 0.5 ? 'accepted' : 'rejected')
      setState(outcome)
      const r = btn.current?.getBoundingClientRect()
      const at = r ? { x: r.left + r.width / 2, y: r.top } : {}
      if (outcome === 'accepted') confetti({ ...at, emoji: ['📱', '💘', '🤓'] })
      else {
        setPop((p) => p + 1)
        if (phase2) setTokens((t) => t + REJECT_REWARD)
        confetti({ ...at, colors: ['#ff4d8d', '#ff7a1a', '#8b5cf6'], count: 70, emoji: ['🏆', '🤓'] })
      }
    }, 1300)
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <Eyebrow>The win-win machine</Eyebrow>
        <h2 className="mt-4 text-4xl font-extrabold sm:text-6xl">
          Heads you win.
          <br />
          <span className="text-white/40">Tails you also win.</span>
        </h2>
        <p className="mt-5 text-white/60">Go on, shoot your shot. This one’s a simulator — nobody’s feelings get hurt. Especially not yours.</p>
      </motion.div>

      <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <motion.div {...reveal} className="card order-2 p-6 lg:order-1">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime/15 text-lime">
              <Heart className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-bold">If they accept</h3>
          </div>
          <p className="mt-3 text-white/60">Their phone number is revealed to you instantly. No awkward DMs, no games. Just the digits.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {['Direct contact reveal', 'Numbers stay private until accepted', 'Counts as a Match on your board'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-white/80">
                <Check className="h-4 w-4 text-lime" /> {t}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* phone */}
        <motion.div {...reveal} className="order-1 mx-auto w-[300px] lg:order-2">
          <div className="relative rounded-[3rem] border-[10px] border-ink-950 bg-ink-800 p-4 shadow-[0_30px_80px_-20px_rgba(255,122,26,.45)] ring-1 ring-white/10">
            <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-ink-950" />
            <div className="relative overflow-hidden rounded-[2rem] bg-ink-900">
              <div className="relative aspect-[4/5]">
                <NerdAvatar seed={seed} className="h-full w-full" mood={state === 'accepted' ? 'happy' : state === 'rejected' ? 'smug' : 'smug'} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent p-4 pt-16">
                  <p className="font-display text-2xl font-bold">Stella, 24</p>
                  <p className="text-sm text-white/60">Astrophysics · 2 km away</p>
                </div>
                <AnimatePresence>
                  {(state === 'accepted' || state === 'rejected') && (
                    <motion.div
                      initial={{ scale: 2, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: -12 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 15 }}
                      className={clsx(
                        'absolute left-4 top-6 rounded-xl border-4 px-3 py-1 font-display text-3xl font-black uppercase',
                        state === 'accepted' ? 'border-lime text-lime' : 'border-rizz text-rizz',
                      )}
                    >
                      {state === 'accepted' ? 'Accepted' : 'Rejected'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="space-y-3 p-4">
                <AnimatePresence mode="wait">
                  {state === 'accepted' ? (
                    <motion.div key="a" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-lime/30 bg-lime/10 p-3 text-center">
                      <p className="text-xs font-semibold uppercase text-lime">Number unlocked</p>
                      <p className="font-mono text-lg font-bold">+1 (555) 314-1592</p>
                    </motion.div>
                  ) : state === 'rejected' ? (
                    <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-rizz/30 bg-rizz/10 p-3 text-center">
                      <p className="text-xs font-semibold uppercase text-rizz">L converted to W</p>
                      <p className="font-display text-lg font-bold">Popularity {pop} {phase2 && <span className="text-carrot">· {tokens} $NERDY</span>}</p>
                    </motion.div>
                  ) : (
                    <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-sm text-white/60">
                      {state === 'sending' ? 'Waiting for Stella…' : 'Ready when you are, champ.'}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  ref={btn}
                  onClick={() => (state === 'idle' ? send() : setState('idle'))}
                  disabled={state === 'sending'}
                  className="btn-primary w-full"
                >
                  {state === 'sending' ? (
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-2 w-2 rounded-full bg-ink-950" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.12 }} />
                      ))}
                    </span>
                  ) : state === 'idle' ? (
                    <>
                      <Send className="h-4 w-4" /> Send request
                    </>
                  ) : (
                    'Shoot again'
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs">
            <span className="text-white/50">Rig it:</span>
            <button onClick={() => state !== 'sending' && send('accepted')} className="chip hover:border-lime/50">Accept</button>
            <button onClick={() => state !== 'sending' && send('rejected')} className="chip hover:border-rizz/50">Reject</button>
            <button onClick={() => setPhase2(!phase2)} className={clsx('chip', phase2 && 'border-carrot/60 text-carrot')}>Phase {phase2 ? 2 : 1}</button>
          </div>
        </motion.div>

        <motion.div {...reveal} className="card order-3 p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rizz/15 text-rizz">
              <Trophy className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-bold">If they reject</h3>
          </div>
          <p className="mt-3 text-white/60">Congrats, it’s logged on your dashboard. Rejections are clout here — the more you shoot, the more popular you get.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {['Phase 1: +1 public popularity', `Phase 2: +${REJECT_REWARD} $NERDY per rejection`, 'Withdraw to wallet or spend in-app'].map((t) => (
              <li key={t} className="flex items-center gap-2 text-white/80">
                <Check className="h-4 w-4 text-rizz" /> {t}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ HOW IT WORKS

function HowItWorks() {
  const steps = [
    { icon: UserPlus, title: 'Create your nerd profile', body: 'Sign up, add a photo (or generate your inner nerd), write a bio, pick your interests. Your phone number stays locked.', color: 'from-grape to-byte' },
    { icon: Send, title: 'Send partner requests', body: `Browse the town and shoot your shot. ${FREE_DAILY_REQUESTS} free requests every day — more with $NERDY after graduation.`, color: 'from-carrot to-rizz' },
    { icon: Crown, title: 'Win. Either way.', body: 'Accepted → you get the number. Rejected → you get popularity now, and $NERDY tokens after graduation.', color: 'from-lime to-byte' },
  ]
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <motion.div {...reveal} className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-4 text-4xl font-extrabold sm:text-6xl">Three steps. Zero losses.</h2>
      </motion.div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.1 }}
            whileHover={{ y: -6, rotate: i === 1 ? 0 : i === 0 ? -1 : 1 }}
            className="card group relative overflow-hidden p-7"
          >
            <span className="absolute -right-4 -top-8 font-display text-[9rem] font-black leading-none text-white/[0.04] transition group-hover:text-white/[0.08]">{i + 1}</span>
            <span className={clsx('grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-ink-950 shadow-lg', s.color)}>
              <s.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-6 text-2xl font-bold">{s.title}</h3>
            <p className="mt-3 text-white/60">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ ROADMAP

function Roadmap() {
  const phase = useStore((s) => s.phase)
  const pct = useStore((s) => s.bondingProgress)
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const line = useTransform(scrollYProgress, [0.15, 0.6], ['0%', '100%'])

  const phases = [
    {
      n: 1,
      title: 'Pre-graduation',
      sub: 'While $NERDY bonds on pump.fun',
      points: [`${FREE_DAILY_REQUESTS} free partner requests per day`, 'Accept → instant phone number reveal', 'Rejections build public popularity', 'Leaderboard of legendary Ls'],
      icon: Shield,
    },
    {
      n: 2,
      title: 'Post-graduation',
      sub: 'After $NERDY graduates',
      points: [`Buy extra daily requests (${EXTRA_REQUEST_COST} $NERDY each)`, `Every rejection = ${REJECT_REWARD} $NERDY`, 'Withdraw to your Solana wallet', 'Spend tokens in-app'],
      icon: Rocket,
    },
  ]
  return (
    <section id="roadmap" ref={ref} className="relative mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
      <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
        <Eyebrow>Roadmap</Eyebrow>
        <h2 className="mt-4 text-4xl font-extrabold sm:text-6xl">Two phases. One token.</h2>
        <p className="mt-5 text-white/60">Profiles, requests, accept/reject and number reveals work the same in both phases. Graduation just turns your Ls into money.</p>
      </motion.div>

      <motion.div {...reveal} className="card mx-auto mt-12 max-w-3xl p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-white/60">pump.fun bonding curve</span>
          <span className="font-mono font-bold text-carrot">{pct.toFixed(1)}%</span>
        </div>
        <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-full rounded-full bg-gradient-to-r from-grape via-carrot to-lime"
          >
            <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)] bg-[length:200%_100%]" />
          </motion.div>
        </div>
        <p className="mt-3 text-center text-xs text-white/40">{phase === 1 ? 'Graduation unlocks Phase 2 automatically.' : '🎓 $NERDY graduated. Phase 2 is live.'}</p>
      </motion.div>

      <div className="relative mt-16 grid gap-6 md:grid-cols-2">
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-white/10 md:block">
          <motion.div style={{ height: line }} className="w-px bg-gradient-to-b from-grape to-lime" />
        </div>
        {phases.map((p, i) => {
          const live = phase === p.n
          return (
            <motion.div key={p.n} {...reveal} transition={{ ...reveal.transition, delay: i * 0.15 }} className={clsx('card relative p-7', live && 'ring-2 ring-carrot/60')}>
              {live && <span className="absolute -top-3 left-7 rounded-full border-2 border-ink-950 bg-carrot px-3 py-0.5 font-mono text-[11px] font-bold uppercase text-ink-950 shadow-pop">Live now</span>}
              <div className="flex items-center gap-4">
                <span className={clsx('grid h-14 w-14 place-items-center rounded-2xl', i ? 'bg-lime/15 text-lime' : 'bg-grape/15 text-grape-300')}>
                  <p.icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-white/40">Phase {p.n}</p>
                  <h3 className="text-2xl font-bold">{p.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/50">{p.sub}</p>
              <ul className="mt-5 space-y-3">
                {p.points.map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Zap className={clsx('mt-0.5 h-4 w-4 shrink-0', i ? 'text-lime' : 'text-grape-300')} />
                    <span className="text-white/80">{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-5">
        {[
          { k: 'Free daily requests', v: FREE_DAILY_REQUESTS, s: '' },
          { k: 'Per rejection (P2)', v: REJECT_REWARD, s: ' $N' },
          { k: 'Extra request (P2)', v: EXTRA_REQUEST_COST, s: ' $N' },
        ].map((x) => (
          <motion.div {...reveal} key={x.k} className="card p-4 text-center sm:p-6">
            <p className="font-display text-3xl font-extrabold text-carrot sm:text-5xl">
              <AnimatedNumber value={x.v} suffix={x.s} />
            </p>
            <p className="mt-1 text-[11px] text-white/50 sm:text-sm">{x.k}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ HALL OF FAME

function HallOfFame() {
  const profiles = useStore((s) => s.profiles)
  const top = useMemo(() => Object.values(profiles).sort((a, b) => b.rejectionsReceived - a.rejectionsReceived).slice(0, 5), [profiles])
  const max = top[0]?.rejectionsReceived || 1
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <motion.div {...reveal}>
          <Eyebrow>Hall of Fame</Eyebrow>
          <h2 className="mt-4 text-4xl font-extrabold sm:text-6xl">The most rejected legends.</h2>
          <p className="mt-5 max-w-md text-white/60">Elsewhere, rejection is a secret. In Nerdy Town it’s a scoreboard. These heroes shot their shot more than anyone — and it shows.</p>
          <Link to="/explore?f=popular" className="btn-dark mt-8">
            See the popular kids <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
        <motion.ol {...reveal} className="card divide-y divide-white/5 overflow-hidden">
          {top.map((p, i) => (
            <li key={p.id}>
              <Link to={`/u/${p.id}`} className="group flex items-center gap-4 p-4 transition hover:bg-white/[0.03] sm:p-5">
                <span className={clsx('w-6 text-center font-display text-2xl font-black', i === 0 ? 'text-carrot' : 'text-white/30')}>{i + 1}</span>
                <ProfilePhoto profile={p} className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-carrot">{p.name} {i === 0 && '👑'}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${(p.rejectionsReceived / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: i * 0.08 }} className="h-full rounded-full bg-gradient-to-r from-rizz to-carrot" />
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-rizz">{p.rejectionsReceived} L</span>
              </Link>
            </li>
          ))}
        </motion.ol>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ FAQ

function FAQ() {
  const qs = [
    ['Is my phone number public?', 'Never. Your number is locked until you personally accept someone’s request. Only that one person sees it.'],
    ['What happens when I get rejected?', 'It’s logged on your dashboard and your public popularity goes up by one. After $NERDY graduates, each rejection also pays you in tokens.'],
    ['How many requests can I send?', `${FREE_DAILY_REQUESTS} free requests per day, reset at midnight UTC. In Phase 2 you can buy more with $NERDY.`],
    ['What is graduation?', 'On pump.fun, a token “graduates” when its bonding curve completes and it moves to open liquidity. That’s our trigger for Phase 2.'],
    ['Can I farm rejections?', 'You can only request each person once, and requests are capped daily. Shooting your shot is the only strategy.'],
  ]
  const [open, setOpen] = useState(0)
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <motion.div {...reveal} className="text-center">
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-4 text-4xl font-extrabold sm:text-5xl">Questions, nerd?</h2>
      </motion.div>
      <div className="mt-10 space-y-3">
        {qs.map(([q, a], i) => (
          <motion.div {...reveal} key={q} className="card overflow-hidden">
            <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold" aria-expanded={open === i}>
              {q}
              <ChevronDown className={clsx('h-5 w-5 shrink-0 text-white/50 transition-transform', open === i && 'rotate-180 text-carrot')} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <p className="px-5 pb-5 text-white/60">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ CTA + FOOTER

function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <motion.div {...reveal} className="relative overflow-hidden rounded-[2.5rem] border-2 border-ink-950 bg-carrot p-8 text-ink-950 shadow-pop-lg sm:p-14">
        <div className="grid-paper absolute inset-0 opacity-40 [filter:invert(1)]" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-4xl font-extrabold leading-[0.95] sm:text-6xl">Your glasses are on. Your shot is loaded.</h2>
            <p className="mt-4 max-w-md text-lg font-medium text-ink-950/70">Join Nerdy Town free. Three requests a day, zero ways to lose.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn bg-ink-950 text-white shadow-[4px_4px_0_0_#fff] hover:bg-ink-800 active:shadow-none">
                <Sparkles className="h-5 w-5 text-carrot" /> Create my profile
              </Link>
              <Link to="/explore" className="btn border-2 border-ink-950 bg-transparent hover:bg-ink-950/10">Explore first</Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-56 sm:w-72">
            <div className="absolute inset-0 rounded-full bg-ink-950/10" />
            <Mascot className="relative h-full w-full animate-float" />
          </div>
        </div>
      </motion.div>
    </section>
  )
}

export function Footer() {
  const phase = useStore((s) => s.phase)
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-10 pt-10 text-sm text-white/40 sm:px-6">
      <div className="flex flex-col gap-6 border-t border-white/10 pt-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="font-display text-lg font-bold text-white">
            Nerdy<span className="text-carrot">Town</span>
          </p>
          <p className="mt-2">$NERDY is a meme coin with no intrinsic value or expectation of financial return. Not financial advice. Be kind — every nerd here is somebody’s favorite nerd.</p>
        </div>
        <div className="rounded-2xl border border-dashed border-white/15 p-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-white/50">Demo controls</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => api.setPhase(phase === 1 ? 2 : 1)} className="chip hover:border-carrot/50 hover:text-white">
              <Rocket className="h-3.5 w-3.5" /> Switch to Phase {phase === 1 ? 2 : 1}
            </button>
            <button
              onClick={() => {
                if (confirm('Reset all local demo data?')) api.resetAll()
              }}
              className="chip hover:border-rizz/50 hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Reset data
            </button>
          </div>
        </div>
      </div>
      <p className="mt-8 flex items-center gap-2">
        <Lock className="h-3.5 w-3.5" /> Phone numbers are only revealed on accept. © {new Date().getFullYear()} Nerdy Town.
      </p>
    </footer>
  )
}

export default function Home() {
  return (
    <Page>
      <Hero />
      <Marquee />
      <WinWinDemo />
      <HowItWorks />
      <Roadmap />
      <HallOfFame />
      <FAQ />
      <FinalCTA />
      <Footer />
    </Page>
  )
}
