import { KeyRound, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Page } from '../components/Layout'
import Loader from '../components/Loader'
import { useToast } from '../components/Toast'
import { api, useStore } from '../lib/store'

export default function ResetPassword() {
  const ready = useStore((s) => s.ready)
  const session = useStore((s) => s.session)
  const nav = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Passwords don’t match.')
    setBusy(true)
    try {
      await api.updatePassword(password)
      toast('success', 'Password updated', 'You’re logged in.')
      nav('/dashboard', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <Loader />

  return (
    <Page className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-8">
      <div className="card w-full p-6 sm:p-8">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-carrot/15 text-carrot">
          <KeyRound className="h-7 w-7" />
        </span>
        {session ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <h1 className="text-3xl font-extrabold">Choose a new password</h1>
            <div>
              <label htmlFor="np" className="label">New password</label>
              <input id="np" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label htmlFor="np2" className="label">Repeat it</label>
              <input id="np2" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
            </div>
            {error && <p className="rounded-xl border border-rizz/30 bg-rizz/10 px-3 py-2 text-sm text-rizz" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full py-4">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save password'}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <h1 className="text-3xl font-extrabold">Link expired</h1>
            <p className="mt-2 text-white/60">This reset link is invalid or has expired. Request a new one from the login page.</p>
            <Link to="/login" className="btn-primary mt-6 w-full">Back to log in</Link>
          </div>
        )}
      </div>
    </Page>
  )
}
