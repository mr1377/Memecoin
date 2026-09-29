import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import Mascot from '../components/Mascot'
import { useToast } from '../components/Toast'
import { api, selectMe, useStore } from '../lib/store'
import type { WalletProvider } from '../lib/types'

const WALLETS: [WalletProvider, string][] = [
  ['Phantom', 'from-[#ab9ff2] to-[#534bb1]'],
  ['Solflare', 'from-[#ffc10b] to-[#fb3f2e]'],
  ['Backpack', 'from-[#e33e3f] to-[#a42b2c]'],
]

function strength(p: string) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s++
  return s
}
const STRENGTH = ['Too short', 'Weak sauce', 'Decent', 'Strong', 'Galaxy brain']
const STRENGTH_TONE = ['bg-white/10', 'bg-rizz', 'bg-carrot', 'bg-byte', 'bg-lime']

type View = 'form' | 'check-inbox' | 'forgot' | 'reset-sent'

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const session = useStore((s) => s.session)
  const me = useStore(selectMe)
  const [params] = useSearchParams()
  const next = params.get('next')
  const nav = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [view, setView] = useState<View>('form')
  const [shake, setShake] = useState(0)
  const [walletBusy, setWalletBusy] = useState<WalletProvider | null>(null)

  if (session && !busy && view === 'form') return <Navigate to={me ? next || '/dashboard' : '/onboarding'} replace />

  const fail = (err: unknown) => {
    setError((err as Error).message)
    setUnconfirmed((err as { code?: string }).code === 'unconfirmed')
    setShake((x) => x + 1)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setUnconfirmed(false)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await api.signup(email, password)
        if (needsConfirmation) setView('check-inbox')
        else {
          toast('success', 'Welcome to Nerdy Town!', 'Now let’s build your profile.')
          nav('/onboarding' + (next ? `?next=${encodeURIComponent(next)}` : ''), { replace: true })
        }
      } else {
        const { hasProfile } = await api.login(email, password)
        toast('success', 'Welcome back, legend.')
        nav(hasProfile ? next || '/dashboard' : '/onboarding', { replace: true })
      }
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setBusy(true)
    try {
      await api.resendConfirmation(email)
      toast('info', 'Confirmation email sent', 'Check your inbox (and spam folder).')
    } catch (err) {
      toast('error', (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sendReset = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter the email you signed up with.')
      await api.sendPasswordReset(email)
      setView('reset-sent')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const walletLogin = async (provider: WalletProvider) => {
    setError('')
    setUnconfirmed(false)
    setBusy(true)
    setWalletBusy(provider)
    try {
      const { hasProfile } = await api.walletSignIn(provider)
      toast('success', hasProfile ? 'Welcome back, legend.' : 'Wallet connected!', hasProfile ? undefined : 'Now let’s build your profile.')
      nav(hasProfile ? next || '/dashboard' : '/onboarding' + (next ? `?next=${encodeURIComponent(next)}` : ''), { replace: true })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
      setWalletBusy(null)
    }
  }

  const st = strength(password)
  const q = next ? `?next=${encodeURIComponent(next)}` : ''

  const emailField = (
    <div>
      <label htmlFor="email" className="label">Email</label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-11" placeholder="you@nerdy.town" />
      </div>
    </div>
  )
  const errorBox = (
    <AnimatePresence>
      {error && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-rizz/30 bg-rizz/10 px-3 py-2 text-sm text-rizz" role="alert">
          {error}
          {unconfirmed && (
            <button type="button" onClick={resend} className="ml-1 font-semibold underline">
              Resend email
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  let body
  if (view === 'check-inbox' || view === 'reset-sent') {
    body = (
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-lime/15 text-lime">
          <MailCheck className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold">Check your inbox</h1>
        <p className="mt-3 text-white/60">
          {view === 'check-inbox' ? 'We sent a confirmation link to ' : 'We sent a password reset link to '}
          <b className="text-white">{email.trim().toLowerCase()}</b>.{' '}
          {view === 'check-inbox' ? 'Click it to activate your account and build your profile.' : 'Click it to choose a new password.'}
        </p>
        <p className="mt-2 text-sm text-white/40">Nothing there? Check your spam folder.</p>
        <div className="mt-8 grid gap-3">
          {view === 'check-inbox' && (
            <button onClick={resend} disabled={busy} className="btn-ghost w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Resend email
            </button>
          )}
          <Link to={`/login${q}`} onClick={() => setView('form')} className="btn-primary w-full">
            Back to log in
          </Link>
        </div>
      </div>
    )
  } else if (view === 'forgot') {
    body = (
      <form onSubmit={sendReset} className="space-y-4" noValidate>
        <button type="button" onClick={() => setView('form')} className="flex items-center gap-1 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-3xl font-extrabold">Forgot your password?</h1>
        <p className="text-white/60">Happens to the best of us. Enter your email and we’ll send a reset link.</p>
        {emailField}
        {errorBox}
        <button type="submit" disabled={busy} className="btn-primary w-full py-4 text-base">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send reset link'}
        </button>
      </form>
    )
  } else {
    body = (
      <>
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
          {emailField}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">Password</label>
              {mode === 'login' && (
                <button type="button" onClick={() => { setError(''); setView('forgot') }} className="mb-2 text-xs font-semibold text-carrot hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={8}
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
          {errorBox}
          <button type="submit" disabled={busy} className="btn-primary w-full py-4 text-base">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === 'signup' ? 'Create account' : 'Log in'} <ArrowRight className="h-5 w-5" /></>}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-white/30">
          <span className="h-px flex-1 bg-white/10" /> or continue with a Solana wallet <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {WALLETS.map(([w, g]) => (
            <button
              key={w}
              type="button"
              onClick={() => walletLogin(w)}
              disabled={busy}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3 text-xs font-semibold transition hover:border-white/25 hover:bg-white/[0.06] disabled:opacity-50"
            >
              <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${g} text-sm font-bold`}>
                {walletBusy === w ? <Loader2 className="h-4 w-4 animate-spin" /> : w[0]}
              </span>
              {w}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-white/35">You’ll sign a message to prove it’s your wallet — no transaction, no fees.</p>
        <p className="mt-6 text-center text-xs text-white/40">By joining you confirm you’re 18+ and agree to be kind. Your socials are only shared when you accept a request.</p>
      </>
    )
  }

  return (
    <Page className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2">
      <div className="relative order-2 hidden lg:order-1 lg:block">
        <div className="relative mx-auto aspect-square max-w-md">
          <div className="absolute inset-6 rotate-3 rounded-[3rem] bg-gradient-to-br from-carrot to-rizz" />
          <div className="absolute inset-6 -rotate-3 rounded-[3rem] border border-white/10 bg-ink-800" />
          <Mascot className="absolute inset-10" />
        </div>
        <blockquote className="mx-auto mt-6 max-w-md text-center">
          <p className="font-display text-2xl font-bold">“Every rejection is just data. And data is beautiful.”</p>
          <footer className="mt-2 text-sm text-white/50">— Mr. Nerdy, Mayor</footer>
        </blockquote>
      </div>

      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="order-1 mx-auto w-full max-w-md lg:order-2">
        <div className="card p-6 sm:p-8">{body}</div>
      </motion.div>
    </Page>
  )
}
