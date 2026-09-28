import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Wand2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import Mascot from '../components/Mascot'
import { useToast } from '../components/Toast'
import { api, selectAccount, useStore } from '../lib/store'

function strength(p: string) {
  let s = 0
  if (p.length >= 6) s++
  if (p.length >= 10) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s++
  return s
}
const STRENGTH = ['Too short', 'Weak sauce', 'Decent', 'Strong', 'Galaxy brain']
const STRENGTH_TONE = ['bg-white/10', 'bg-rizz', 'bg-carrot', 'bg-byte', 'bg-lime']

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const account = useStore(selectAccount)
  const [params] = useSearchParams()
  const next = params.get('next')
  const nav = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<false | 'form' | 'demo'>(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)

  if (account && !busy) return <Navigate to={account.hasProfile ? next || '/dashboard' : '/onboarding'} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy('form')
    try {
      if (mode === 'signup') {
        await api.signup(email, password)
        toast('success', 'Welcome to Nerdy Town!', 'Now let’s build your profile.')
        nav('/onboarding' + (next ? `?next=${encodeURIComponent(next)}` : ''), { replace: true })
      } else {
        const acc = await api.login(email, password)
        toast('success', 'Welcome back, legend.')
        nav(acc.hasProfile ? next || '/dashboard' : '/onboarding', { replace: true })
      }
    } catch (err) {
      setError((err as Error).message)
      setShake((x) => x + 1)
    } finally {
      setBusy(false)
    }
  }

  const demo = async () => {
    setBusy('demo')
    try {
      await api.demo()
      toast('win', 'Logged in as Newton Byte', 'A demo nerd with a few incoming requests waiting.')
      nav(next || '/dashboard', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const st = strength(password)
  const q = next ? `?next=${encodeURIComponent(next)}` : ''

  return (
    <Page className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2">
      <div className="relative order-2 hidden lg:order-1 lg:block">
        <div className="relative mx-auto aspect-square max-w-md">
          <div className="absolute inset-6 rotate-3 rounded-[3rem] bg-gradient-to-br from-carrot to-rizz" />
          <div className="absolute inset-6 -rotate-3 rounded-[3rem] border border-white/10 bg-ink-800" />
          <Mascot className="absolute inset-10" />
        </div>
        <blockquote className="mx-auto mt-6 max-w-md text-center">
          <p className="font-display text-2xl font-bold">“I got rejected 212 times. Now I’m the most popular guy in town.”</p>
          <footer className="mt-2 text-sm text-white/50">— Mr. Nerdy, Mayor</footer>
        </blockquote>
      </div>

      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="order-1 mx-auto w-full max-w-md lg:order-2">
        <div className="card p-6 sm:p-8">
          <div className="relative grid grid-cols-2 rounded-2xl bg-ink-950/60 p-1">
            {(['signup', 'login'] as const).map((m) => (
              <Link key={m} to={`/${m}${q}`} replace className={clsx('relative rounded-xl py-2.5 text-center text-sm font-semibold transition', mode === m ? 'text-ink-950' : 'text-white/60 hover:text-white')}>
                {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-xl bg-carrot" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <span className="relative">{m === 'signup' ? 'Sign up' : 'Log in'}</span>
              </Link>
            ))}
          </div>

          <h1 className="mt-8 text-3xl font-extrabold">{mode === 'signup' ? 'Get your town key.' : 'Welcome back, nerd.'}</h1>
          <p className="mt-2 text-white/60">{mode === 'signup' ? 'An account is required before you can create a profile.' : 'Your requests (and your Ls) missed you.'}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-11" placeholder="you@nerdy.town" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11 pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/50 hover:text-white" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signup' && password && (
                <div className="mt-2">
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((k) => (
                      <span key={k} className={clsx('h-1 rounded-full transition-colors', k <= st ? STRENGTH_TONE[st] : 'bg-white/10')} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-white/50">{STRENGTH[st]}</p>
                </div>
              )}
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-rizz/30 bg-rizz/10 px-3 py-2 text-sm text-rizz" role="alert">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={!!busy} className="btn-primary w-full py-4 text-base">
              {busy === 'form' ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === 'signup' ? 'Create account' : 'Log in'} <ArrowRight className="h-5 w-5" /></>}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-white/30">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>
          <button onClick={demo} disabled={!!busy} className="btn-ghost w-full">
            {busy === 'demo' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-4 w-4 text-grape-300" />} Try the demo nerd
          </button>
          <p className="mt-6 text-center text-xs text-white/40">By joining you agree to be kind. Your socials are only shared when you accept a request.</p>
        </div>
      </motion.div>
    </Page>
  )
}
