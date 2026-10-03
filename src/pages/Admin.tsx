import clsx from 'clsx'
import { BadgeCheck, Check, ExternalLink, Flag, Loader2, RefreshCw, Rocket, Save, Search, Trash2, Wallet, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Layout'
import ProfilePhoto from '../components/ProfilePhoto'
import { useToast } from '../components/Toast'
import { api, useStore } from '../lib/store'
import type { LedgerEntry, Report, Settings } from '../lib/types'

function Section({ title, icon: Icon, children, action }: { title: string; icon: typeof Rocket; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Icon className="h-5 w-5 text-carrot" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function NumField({ label, value, onChange, hint, step = 1 }: { label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input font-mono" type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
    </label>
  )
}

export default function Admin() {
  const toast = useToast()
  const settings = useStore((s) => s.settings)
  const profiles = useStore((s) => s.profiles)
  const [form, setForm] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [withdrawals, setWithdrawals] = useState<LedgerEntry[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => setForm(settings), [settings])

  const reload = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([api.admin.withdrawals(), api.admin.reports()])
      setWithdrawals(w)
      setReports(r)
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }, [toast])
  useEffect(() => {
    reload()
  }, [reload])

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key)
    try {
      await fn()
      if (ok) toast('success', ok)
      await reload()
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (form.phase === 2 && settings.phase === 1 && !confirm('Switch to Phase 2? Rejections from real users will start earning $NERDY.')) return
    setSaving(true)
    try {
      await api.admin.saveSettings(form)
      toast('success', 'Settings saved')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const residents = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return Object.values(profiles)
      .filter((p) => !p.isBot && (!needle || p.name.toLowerCase().includes(needle) || p.city.toLowerCase().includes(needle)))
      .sort((a, b) => b.joinedAt - a.joinedAt)
      .slice(0, 30)
  }, [profiles, q])

  const pending = withdrawals.filter((w) => w.status === 'requested' || w.status === 'processing')
  const done = withdrawals.filter((w) => !(w.status === 'requested' || w.status === 'processing'))
  const openReports = reports.filter((r) => !r.resolved)
  const name = (id?: string) => (id && profiles[id]?.name) || 'Unknown user'

  return (
    <Page className="mx-auto max-w-5xl space-y-6 px-4 pt-6 sm:px-6 md:pt-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-carrot">Admin</p>
        <h1 className="mt-2 text-4xl font-extrabold">Town hall</h1>
      </div>

      <Section title="Phase & token" icon={Rocket}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Phase</span>
            <div className="grid grid-cols-2 gap-2">
              {([1, 2] as const).map((p) => (
                <button key={p} onClick={() => setForm({ ...form, phase: p })} className={clsx('rounded-2xl border px-4 py-3 text-sm font-semibold', form.phase === p ? 'border-carrot bg-carrot/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/60')}>
                  Phase {p} {p === 1 ? '· pre-graduation' : '· graduated'}
                </button>
              ))}
            </div>
          </div>
          <NumField label="Bonding curve progress (%)" value={form.bondingProgress} step={0.1} onChange={(v) => setForm({ ...form, bondingProgress: Math.max(0, Math.min(100, v)) })} hint="Copy it from your token page on jup.ag. Shown on the homepage progress bar." />
          <NumField label="Free requests per day" value={form.freeDailyRequests} onChange={(v) => setForm({ ...form, freeDailyRequests: v })} />
          <NumField label="$NERDY per rejection (Phase 2)" value={form.rejectReward} onChange={(v) => setForm({ ...form, rejectReward: v })} />
          <NumField label="Extra request price ($NERDY)" value={form.extraRequestCost} onChange={(v) => setForm({ ...form, extraRequestCost: v })} />
          <NumField label="Minimum withdrawal ($NERDY)" value={form.minWithdraw} onChange={(v) => setForm({ ...form, minWithdraw: v })} />
          <label className="block sm:col-span-2">
            <span className="label">$NERDY token mint address</span>
            <input className="input font-mono text-sm" value={form.tokenMint ?? ''} onChange={(e) => setForm({ ...form, tokenMint: e.target.value })} placeholder="Paste the mint address after launch" />
            <span className="mt-1 block text-xs text-white/40">Shows a “Buy on Jupiter” button on the homepage and is needed for on-chain withdrawals. The payout wallet key lives in Vercel (TREASURY_SECRET_KEY), never here.</span>
          </label>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary mt-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
      </Section>

      <Section
        title={`Withdrawals (${pending.length} pending)`}
        icon={Wallet}
        action={
          <button onClick={reload} className="chip py-2 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      >
        {!pending.length && <p className="text-sm text-white/50">No pending withdrawals.</p>}
        <ul className="space-y-2">
          {pending.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-0 flex-1">
                <Link to={`/u/${w.userId}`} className="font-semibold hover:text-carrot">{name(w.userId)}</Link>
                <p className="font-mono text-xs text-white/50">
                  {Math.abs(w.amount).toLocaleString()} $NERDY → {w.wallet?.slice(0, 6)}…{w.wallet?.slice(-6)} · {new Date(w.at).toLocaleString()}
                </p>
                {profiles[w.userId ?? ''] && (
                  <p className="text-xs text-white/40">Popularity {profiles[w.userId!].rejectionsReceived} · joined {new Date(profiles[w.userId!].joinedAt).toLocaleDateString()}</p>
                )}
              </div>
              {w.status === 'processing' ? (
                <span className="chip text-byte">Processing…</span>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => run(w.id, () => api.admin.rejectWithdrawal(w.id), 'Withdrawal rejected and refunded')} disabled={!!busy} className="chip py-2 hover:border-rizz/50 hover:text-rizz">
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => confirm(`Send ${Math.abs(w.amount)} $NERDY on-chain to ${w.wallet}?`) && run(w.id, () => api.admin.approveWithdrawal(w.id), 'Payout sent on-chain')}
                    disabled={!!busy || !settings.tokenMint}
                    title={settings.tokenMint ? '' : 'Set the token mint first'}
                    className="btn-primary !py-2 text-sm"
                  >
                    {busy === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve & send
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {done.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-white/50">History ({done.length})</summary>
            <ul className="mt-2 space-y-1">
              {done.map((w) => (
                <li key={w.id} className="flex justify-between gap-2 text-white/60">
                  <span className="truncate">{name(w.userId)} · {Math.abs(w.amount).toLocaleString()}</span>
                  <span className="shrink-0">
                    {w.txSig ? (
                      <a href={`https://solscan.io/tx/${w.txSig}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-lime underline">
                        {w.status} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      w.status
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section title={`Reports (${openReports.length} open)`} icon={Flag}>
        {!openReports.length && <p className="text-sm text-white/50">No open reports. The town is behaving.</p>}
        <ul className="space-y-2">
          {openReports.map((r) => {
            const p = profiles[r.reported]
            return (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start gap-3">
                  {p && <ProfilePhoto profile={p} className="h-12 w-12 shrink-0 rounded-xl" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      <Link to={`/u/${r.reported}`} className="hover:text-carrot">{name(r.reported)}</Link> <span className="chip ml-1 text-carrot">{r.reason}</span>
                    </p>
                    {r.details && <p className="mt-1 text-sm text-white/70">“{r.details}”</p>}
                    <p className="mt-1 text-xs text-white/40">by {name(r.reporter)} · {new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => run(r.id, () => api.admin.resolveReport(r.id), 'Report resolved')} disabled={!!busy} className="chip py-2 hover:text-white">
                    <Check className="h-3.5 w-3.5" /> Mark resolved
                  </button>
                  {p && (
                    <button
                      onClick={() => confirm(`Permanently remove ${p.name}'s account?`) && run(r.id, async () => { await api.admin.removeProfile(r.reported); await api.admin.resolveReport(r.id) }, 'User removed')}
                      disabled={!!busy}
                      className="chip py-2 hover:border-rizz/50 hover:text-rizz"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove user
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Residents" icon={BadgeCheck}>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input className="input pl-11" placeholder="Search by name or city" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="divide-y divide-white/5">
          {residents.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <ProfilePhoto profile={p} className="h-10 w-10 shrink-0 rounded-xl" />
              <Link to={`/u/${p.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-carrot">
                {p.name} <span className="font-normal text-white/40">· {p.city}</span>
              </Link>
              <button
                onClick={() => run(`v-${p.id}`, () => api.admin.setVerified(p.id, !p.verified), p.verified ? 'Verification removed' : 'Verified')}
                disabled={!!busy}
                className={clsx('chip py-2', p.verified ? 'border-byte/40 text-byte' : 'hover:text-white')}
              >
                <BadgeCheck className="h-3.5 w-3.5" /> {p.verified ? 'Verified' : 'Verify'}
              </button>
            </li>
          ))}
          {!residents.length && <li className="py-4 text-sm text-white/50">No residents yet.</li>}
        </ul>
      </Section>
    </Page>
  )
}
