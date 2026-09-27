import { AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Backdrop, BottomTabs, ScrollManager, TopNav } from './components/Layout'
import { selectAccount, useStore } from './lib/store'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Explore from './pages/Explore'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import ProfilePage from './pages/Profile'

function RequireAuth({ children, needsProfile = true }: { children: ReactNode; needsProfile?: boolean }) {
  const account = useStore(selectAccount)
  const loc = useLocation()
  if (!account) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (needsProfile && !account.hasProfile) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  const location = useLocation()
  return (
    <div className="noise relative min-h-dvh">
      <Backdrop />
      <ScrollManager />
      <TopNav />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/u/:id" element={<ProfilePage />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/onboarding" element={<RequireAuth needsProfile={false}><Onboarding /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      <BottomTabs />
    </div>
  )
}
