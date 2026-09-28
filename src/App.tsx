import { AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Backdrop, BottomTabs, ScrollManager, TopNav } from './components/Layout'
import Loader from './components/Loader'
import { selectMe, useStore } from './lib/store'
import Admin from './pages/Admin'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Explore from './pages/Explore'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import ProfilePage from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import SetupRequired from './pages/SetupRequired'

function RequireAuth({ children, needsProfile = true, admin = false }: { children: ReactNode; needsProfile?: boolean; admin?: boolean }) {
  const ready = useStore((s) => s.ready)
  const session = useStore((s) => s.session)
  const me = useStore(selectMe)
  const isAdmin = useStore((s) => s.isAdmin)
  const loc = useLocation()
  if (!ready) return <Loader />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (needsProfile && !me) return <Navigate to="/onboarding" replace />
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const location = useLocation()
  const configured = useStore((s) => s.configured)
  const recovering = useStore((s) => s.recovering)
  if (!configured) return <SetupRequired />
  return (
    <div className="noise relative min-h-dvh">
      <Backdrop />
      <ScrollManager />
      <TopNav />
      <AnimatePresence mode="wait">
        {recovering && location.pathname !== '/reset-password' ? (
          <Navigate to="/reset-password" replace />
        ) : (
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/u/:id" element={<ProfilePage />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<RequireAuth needsProfile={false}><Onboarding /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </AnimatePresence>
      <BottomTabs />
    </div>
  )
}
