import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, PenLine } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import Mascot from '../components/Mascot'
import { useToast } from '../components/Toast'
import { api, selectMe, useStore } from '../lib/store'
import { shortAddress, SOCIAL_OPTION, type ConnectedWallet, type WalletOption } from '../lib/wallets'
import WalletPicker from '../components/WalletPicker'

/** Small brand marks for the social login button. */
function SocialMarks() {
  return (
    <span className="flex items-center -space-x-1.5" aria-hidden>
      <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2z" fill="#4285f4" />
          <path d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.7H2v2.9A11 11 0 0 0 12 23z" fill="#34a853" />
          <path d="M5.7 13.9a6.6 6.6 0 0 1 0-4.2V6.8H2a11 11 0 0 0 0 10z" fill="#fbbc04" />
          <path d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.2-3.2A11 11 0 0 0 2 6.8l3.7 2.9C6.6 7 9.1 5.4 12 5.4z" fill="#ea4335" />
        </svg>
      </span>
      <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-black text-white">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
        </svg>
      </span>
      <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#5865f2] text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M19.3 5.3A16.6 16.6 0 0 0 15.2 4l-.5 1a15.3 15.3 0 0 0-5.4 0l-.5-1a16.6 16.6 0 0 0-4.1 1.3A17 17 0 0 0 1.8 17a16.7 16.7 0 0 0 5 2.5l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 10.8 0l.4.3-1.7.8 1.1 1.7a16.7 16.7 0 0 0 5-2.5 17 17 0 0 0-2.9-11.7zM8.7 14.6c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1zm6.6 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1z" />
        </svg>
      </span>
    </span>
  )
}

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const session = useStore((s) => s.session)
  const me = useStore(selectMe)
  const [params] = useSearchParams()
  const next = params.get('next')
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [walletBusy, setWalletBusy] = useState<string | null>(null)
  const [connected, setConnected] = useState<ConnectedWallet | null>(null)

  if (session && !busy) return <Navigate to={me ? next || '/dashboard' : '/onboarding'} replace />

  const fail = (err: unknown) => {
    if ((err as { quiet?: boolean }).quiet) return
    setError((err as Error).message)
    setShake((x) => x + 1)
  }

  const loggedIn = (hasProfile: boolean) => {
    toast('success', hasProfile ? 'Welcome back, legend.' : 'You’re in!', hasProfile ? undefined : 'Now let’s build your profile.')
    nav(hasProfile ? next || '/dashboard' : '/onboarding' + (next ? `?next=${encodeURIComponent(next)}` : ''), { replace: true })
  }

  const login = async (option: WalletOption) => {
    setError('')
    setBusy(true)
    setWalletBusy(option.id)
    try {
      const res = await api.walletSignIn(option)
      if ('pending' in res) setConnected(res.pending)
      else loggedIn(res.hasProfile)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
      setWalletBusy(null)
    }
  }

  // Second tap (wallet apps on phones / WalletConnect): sign the login message.
  const signWithConnected = async () => {
    if (!connected) return
    setError('')
    setBusy(true)
    try {
      const { hasProfile } = await api.walletSignInWith(connected)
      loggedIn(hasProfile)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

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
          <p className="font-display text-2xl font-bold">“Every rejection is just data. And data is beautiful.”</p>
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
          <p className="mt-2 text-white/60">{mode === 'signup' ? 'One tap. New here? Your account is created on the spot.' : 'Use the same login as last time. Your Ls missed you.'}</p>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-5 rounded-xl border border-rizz/30 bg-rizz/10 px-3 py-2 text-sm text-rizz" role="alert">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {connected ? (
            <div className="mt-6 rounded-2xl border border-lime/30 bg-lime/10 p-4 text-center">
              <p className="text-sm text-white/80">
                <Check className="mr-1 inline h-4 w-4 text-lime" />
                {connected.name} connected · <span className="font-mono">{shortAddress(connected.address)}</span>
              </p>
              <button type="button" onClick={signWithConnected} disabled={busy} className="btn-primary mt-3 w-full py-3.5">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PenLine className="h-5 w-5" />} Sign in with this wallet
              </button>
              <p className="mt-2 text-[11px] text-white/50">Your wallet opens once more to sign — free, no transaction.</p>
              <button type="button" onClick={() => setConnected(null)} className="mt-2 text-xs text-white/50 underline hover:text-white">
                Use a different login
              </button>
            </div>
          ) : (
            <>
              {SOCIAL_OPTION && (
                <button
                  type="button"
                  onClick={() => login(SOCIAL_OPTION!)}
                  disabled={busy}
                  className="mt-6 flex w-full items-center gap-3 rounded-2xl border-2 border-ink-950 bg-white px-4 py-3.5 text-left font-semibold text-ink-950 shadow-pop transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  <SocialMarks />
                  <span className="flex-1">
                    Continue with Google, X or email
                    <span className="block text-xs font-normal text-ink-950/60">Discord, Apple and GitHub too · no wallet app needed</span>
                  </span>
                  {walletBusy === 'social' && <Loader2 className="h-5 w-5 animate-spin" />}
                </button>
              )}
              <div className="my-6 flex items-center gap-3 text-xs text-white/30">
                <span className="h-px flex-1 bg-white/10" /> {SOCIAL_OPTION ? 'or use a Solana wallet' : 'continue with a Solana wallet'} <span className="h-px flex-1 bg-white/10" />
              </div>
              <WalletPicker onPick={login} busyId={walletBusy} disabled={busy} hideSocial />
            </>
          )}
          <p className="mt-4 text-center text-[11px] text-white/35">Logging in never sends a transaction or costs anything. Social logins get a free Solana wallet that’s yours.</p>
          <p className="mt-6 text-center text-xs text-white/40">By joining you confirm you’re 18+ and agree to be kind. Your socials are only shared when you accept a request.</p>
        </div>
      </motion.div>
    </Page>
  )
}
