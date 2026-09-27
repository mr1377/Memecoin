import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Home, LayoutDashboard, LogIn, UserRound } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { selectMe, useStore } from '../lib/store'
import Logo from './Logo'
import PhaseBadge from './PhaseBadge'
import ProfilePhoto from './ProfilePhoto'

function useUnread() {
  const session = useStore((s) => s.session)
  const requests = useStore((s) => s.requests)
  if (!session) return 0
  return requests.filter((r) => (r.to === session && r.status === 'pending') || (r.from === session && r.status !== 'pending' && !r.seen)).length
}

export function TopNav() {
  const me = useStore(selectMe)
  const session = useStore((s) => s.session)
  const unread = useUnread()
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx('relative rounded-full px-4 py-2 text-sm font-semibold transition', isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white')
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/explore" className={link}>Explore</NavLink>
          <NavLink to="/dashboard" className={link}>
            Dashboard
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rizz px-1 text-[10px] text-white">{unread}</span>}
          </NavLink>
          <a href="/#roadmap" className="rounded-full px-4 py-2 text-sm font-semibold text-white/60 hover:text-white">Roadmap</a>
        </nav>
        <div className="flex items-center gap-2">
          <PhaseBadge className="hidden sm:flex" />
          {me ? (
            <Link to="/dashboard" className="h-10 w-10 overflow-hidden rounded-full border-2 border-carrot/80 transition hover:scale-105" aria-label="My dashboard">
              <ProfilePhoto profile={me} className="h-full w-full" />
            </Link>
          ) : session ? (
            <Link to="/onboarding" className="btn-primary !px-4 !py-2 text-sm">Finish profile</Link>
          ) : (
            <>
              <Link to="/login" className="hidden px-3 text-sm font-semibold text-white/70 hover:text-white sm:block">Log in</Link>
              <Link to="/signup" className="btn-primary !px-4 !py-2 text-sm">Join the town</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function BottomTabs() {
  const session = useStore((s) => s.session)
  const unread = useUnread()
  const tabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: unread },
    session ? { to: '/onboarding', label: 'Profile', icon: UserRound } : { to: '/login', label: 'Log in', icon: LogIn },
  ]
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink-900/85 backdrop-blur-xl md:hidden" aria-label="App">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-pill" className="absolute inset-x-4 top-1.5 h-9 rounded-2xl bg-carrot/15" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <t.icon className={clsx('relative h-5 w-5 transition', isActive ? 'text-carrot' : 'text-white/50')} />
                <span className={clsx('relative', isActive ? 'text-white' : 'text-white/50')}>{t.label}</span>
                {!!t.badge && <span className="absolute right-[26%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rizz px-1 text-[9px] text-white">{t.badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('pb-28 md:pb-16', className)}
    >
      {children}
    </motion.main>
  )
}

export function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 350)
      return () => clearTimeout(t)
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])
  return null
}

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="grid-paper absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] animate-blob rounded-full bg-grape/25 blur-[120px]" />
      <div className="absolute -right-40 top-40 h-[28rem] w-[28rem] animate-blob rounded-full bg-carrot/15 blur-[120px] [animation-delay:-6s]" />
      <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] animate-blob rounded-full bg-byte/10 blur-[120px] [animation-delay:-12s]" />
    </div>
  )
}

export { AnimatePresence }
