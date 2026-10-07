import { useSyncExternalStore } from 'react'
import type { Session, SolanaWallet } from '@supabase/supabase-js'
import { isConfigured, PHOTO_BUCKET, photoUrl, supabase } from './supabase'
import type { AvatarSeed, LedgerEntry, PartnerRequest, Profile, Report, RevenueStatus, Settings, Social } from './types'
import { connectWallet, needsSecondTap, oneStepSignIn, shortAddress, type ConnectedWallet, type WalletOption } from './wallets'

/**
 * Client-side cache of the Supabase backend. All rules (limits, privacy, balances)
 * are enforced in the database (see supabase/schema.sql); this only mirrors state for the UI.
 */

export interface State {
  configured: boolean
  ready: boolean
  session: string | null
  profiles: Record<string, Profile>
  requests: PartnerRequest[]
  settings: Settings
  phase: 1 | 2
  usage: { used: number; bonus: number }
  balance: number
  ledger: LedgerEntry[]
  /** The Solana address this account signs in with (also where payouts go). */
  wallet: string | null
  /** $NERDY I currently have locked for verification. */
  locked: number
  myContacts: Social[]
  contacts: Record<string, Social[]> // socials revealed to me (accepted requests I sent)
  blocked: string[]
  isAdmin: boolean
  stats: { residents: number; verified: number; rejections: number }
  revenue: RevenueStatus | null
  offline: boolean // backend unreachable
}

const DEFAULT_SETTINGS: Settings = {
  phase: 1,
  freeDailyRequests: 3,
  realUserGoal: 1000,
  phase2At: null,
  verifyLockAmount: 100,
  extraRequestCost: 1,
  minWithdraw: 500,
  tokenMint: null,
  tokenDecimals: 6,
}

let state: State = {
  configured: isConfigured,
  ready: !isConfigured,
  session: null,
  profiles: {},
  requests: [],
  settings: DEFAULT_SETTINGS,
  phase: 1,
  usage: { used: 0, bonus: 0 },
  balance: 0,
  ledger: [],
  wallet: null,
  locked: 0,
  myContacts: [],
  contacts: {},
  blocked: [],
  isAdmin: false,
  stats: { residents: 0, verified: 0, rejections: 0 },
  revenue: null,
  offline: false,
}

const listeners = new Set<() => void>()
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((l) => l())
}

/** Selectors must return stable references (raw state slices); derive the rest with useMemo. */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}
export const getState = () => state

// ---------- mapping ----------

type Row = Record<string, unknown>

function mapProfile(r: Row): Profile {
  const paths = (r.photos as string[]) ?? []
  return {
    id: r.id as string,
    name: r.name as string,
    age: r.age as number,
    gender: r.gender as Profile['gender'],
    lookingFor: r.looking_for as Profile['lookingFor'],
    city: r.city as string,
    nerdClass: r.nerd_class as Profile['nerdClass'],
    tagline: r.tagline as string,
    bio: r.bio as string,
    interests: (r.interests as string[]) ?? [],
    photoPaths: paths,
    photos: paths.map(photoUrl),
    avatar: r.avatar as AvatarSeed,
    joinedAt: Date.parse(r.created_at as string),
    rejectionsGiven: r.rejections_given as number,
    rejectionsReceived: r.rejections_received as number,
    accepts: r.accepts as number,
    verified: r.verified as boolean,
  }
}

const mapRequest = (r: Row): PartnerRequest => ({
  id: r.id as string,
  from: r.from_id as string,
  to: r.to_id as string,
  status: r.status as PartnerRequest['status'],
  seen: r.seen as boolean,
  createdAt: Date.parse(r.created_at as string),
  resolvedAt: r.resolved_at ? Date.parse(r.resolved_at as string) : undefined,
})

const mapLedger = (r: Row): LedgerEntry => ({
  id: r.id as string,
  at: Date.parse(r.created_at as string),
  kind: r.kind as LedgerEntry['kind'],
  amount: Number(r.amount),
  note: r.note as string,
  status: r.status as LedgerEntry['status'],
  txSig: r.tx_sig as string | null,
  wallet: r.wallet as string | null,
  userId: r.user_id as string,
})

const mapSettings = (r: Row): Settings => ({
  phase: r.phase as 1 | 2,
  freeDailyRequests: r.free_daily_requests as number,
  realUserGoal: (r.real_user_goal as number) ?? 1000,
  phase2At: r.phase2_at ? Date.parse(r.phase2_at as string) : null,
  verifyLockAmount: (r.verify_lock_amount as number) ?? 100,
  extraRequestCost: r.extra_request_cost as number,
  minWithdraw: r.min_withdraw as number,
  tokenMint: (r.token_mint as string) || null,
  tokenDecimals: r.token_decimals as number,
})

/** Postgres errors from our functions carry friendly messages; surface them as-is. */
function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message.replace(/^.*?ERROR:\s*/, ''))
  return res.data
}

const todayUTC = () => new Date().toISOString().slice(0, 10)

// ---------- loading ----------

/** This month's revenue-share pool (+ my rejections when logged in). */
async function loadRevenue() {
  const { data } = await supabase.rpc('revenue_status')
  if (!data) return
  const d = data as Row
  const last = d.last as Row | null
  set({
    revenue: {
      month: d.month as string,
      pool: Number(d.pool),
      rejections: Number(d.rejections),
      recipients: Number(d.recipients),
      mine: Number(d.mine),
      last: last
        ? { month: last.month as string, pool: Number(last.pool), rejections: Number(last.rejections), recipients: Number(last.recipients), paid: Number(last.paid), carried: Number(last.carried) }
        : null,
    },
  })
}

let settledMonth = ''
async function loadPublic() {
  // Pays out finished months once a new month starts (idempotent: the database pays each month once).
  const month = new Date().toISOString().slice(0, 7)
  if (settledMonth !== month) {
    const { error } = await supabase.rpc('settle_revenue')
    if (!error) settledMonth = month
  }
  const [settings, profiles, stats] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.rpc('public_stats'),
  ])
  if (settings.error && !settings.data) {
    set({ offline: true })
    return
  }
  const s = settings.data ? mapSettings(settings.data) : DEFAULT_SETTINGS
  const map: Record<string, Profile> = {}
  for (const r of profiles.data ?? []) map[r.id] = mapProfile(r)
  set((st) => ({
    settings: s,
    phase: s.phase,
    profiles: { ...map, ...(st.session && st.profiles[st.session] && !map[st.session] ? { [st.session]: st.profiles[st.session] } : {}) },
    stats: (stats.data as State['stats']) ?? st.stats,
    offline: false,
  }))
  if (s.phase === 2) await loadRevenue()
}

async function loadMine() {
  const me = state.session
  if (!me) return
  const [profile, requests, usage, balance, ledger, wallet, locks, contacts, blocks, admin] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', me).maybeSingle(),
    supabase.from('requests').select('*').or(`from_id.eq.${me},to_id.eq.${me}`).order('created_at', { ascending: false }),
    supabase.from('daily_usage').select('*').eq('user_id', me).eq('day', todayUTC()).maybeSingle(),
    supabase.rpc('my_balance'),
    supabase.from('ledger').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(50),
    supabase.rpc('my_wallet'),
    supabase.from('locks').select('amount').eq('user_id', me).eq('status', 'locked'),
    supabase.from('contacts').select('*'), // RLS: mine + those revealed to me
    supabase.from('blocks').select('blocked'),
    supabase.from('admins').select('user_id').eq('user_id', me).maybeSingle(),
  ])
  if (state.session !== me) return // logged out meanwhile

  const reqs = (requests.data ?? []).map(mapRequest)
  const contactMap: Record<string, Social[]> = {}
  let mine: Social[] = []
  for (const c of contacts.data ?? []) {
    if (c.user_id === me) mine = c.socials as Social[]
    else contactMap[c.user_id] = c.socials as Social[]
  }

  // Fetch any counterpart profiles we don't have yet (e.g. beyond the explore page limit).
  const missing = [...new Set(reqs.flatMap((r) => [r.from, r.to]))].filter((id) => !state.profiles[id] && id !== me)
  const extra = missing.length ? (await supabase.from('profiles').select('*').in('id', missing)).data ?? [] : []

  set((s) => {
    const profiles = { ...s.profiles }
    for (const r of extra) profiles[r.id] = mapProfile(r)
    if (profile.data) profiles[me] = mapProfile(profile.data)
    else delete profiles[me]
    return {
      profiles,
      requests: reqs,
      usage: { used: usage.data?.used ?? 0, bonus: usage.data?.bonus ?? 0 },
      balance: Number(balance.data ?? 0),
      ledger: (ledger.data ?? []).map(mapLedger),
      wallet: (wallet.data as string | null) ?? null,
      locked: (locks.data ?? []).reduce((a, l) => a + Number(l.amount), 0),
      myContacts: mine,
      contacts: contactMap,
      blocked: (blocks.data ?? []).map((b) => b.blocked as string),
      isAdmin: !!admin.data,
    }
  })
  if (state.phase === 2) await loadRevenue()
}

/** Refresh only the profiles touched by a request (cheap counter updates). */
async function refreshProfiles(ids: string[]) {
  if (!ids.length) return
  const { data } = await supabase.from('profiles').select('*').in('id', ids)
  set((s) => {
    const profiles = { ...s.profiles }
    for (const r of data ?? []) profiles[r.id] = mapProfile(r)
    return { profiles }
  })
}

let refreshTimer: number | undefined
function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(async () => {
    await loadMine()
    const me = state.session
    if (me) await refreshProfiles([...new Set(state.requests.flatMap((r) => [r.from, r.to]))].slice(0, 200))
  }, 250)
}

// Live updates
let channel: ReturnType<typeof supabase.channel> | null = null

function startLive(me: string) {
  stopLive()
  channel = supabase
    .channel(`requests:${me}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `from_id=eq.${me}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `to_id=eq.${me}` }, scheduleRefresh)
    .subscribe()
}
function stopLive() {
  if (channel) supabase.removeChannel(channel)
  channel = null
}

async function applySession(session: Session | null) {
  const id = session?.user.id ?? null
  const changed = id !== state.session
  set({ session: id })
  if (!changed) return
  if (id) {
    await loadMine()
    startLive(id)
  } else {
    stopLive()
    set({ requests: [], usage: { used: 0, bonus: 0 }, balance: 0, ledger: [], wallet: null, locked: 0, myContacts: [], contacts: {}, blocked: [], isAdmin: false })
  }
}

if (isConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    // Defer: calling Supabase inside this callback can deadlock the auth lock.
    setTimeout(() => applySession(session), 0)
  })
  ;(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      await Promise.all([loadPublic(), applySession(data.session)])
    } catch {
      set({ offline: true })
    } finally {
      set({ ready: true })
    }
  })()
  // Keep public data (settings, new residents, counters) fresh; retry sooner while offline.
  let ticks = 0
  setInterval(() => {
    ticks++
    if (document.visibilityState !== 'visible' || (!state.offline && ticks % 4 !== 0)) return
    loadPublic().catch(() => set({ offline: true }))
  }, 15_000)
}

// ---------- helpers for pages ----------

export const selectMe = (s: State) => (s.session ? s.profiles[s.session] ?? null : null)

export function dailyInfo(s: State) {
  const limit = s.settings.freeDailyRequests + s.usage.bonus
  return { used: s.usage.used, limit, left: Math.max(0, limit - s.usage.used), bonus: s.usage.bonus }
}

export function relationWith(s: State, other: string) {
  const me = s.session
  if (!me) return null
  return s.requests.find((r) => (r.from === me && r.to === other) || (r.from === other && r.to === me)) ?? null
}

/** Socials are only ever readable (enforced by the database) after they accepted your request. */
export function revealedSocials(s: State, other: string): Social[] | null {
  const r = relationWith(s, other)
  if (!r || r.status !== 'accepted' || r.from !== s.session) return null
  return s.contacts[other] ?? null
}

// ---------- API ----------

export interface ProfileInput {
  name: string
  age: number
  gender: Profile['gender']
  lookingFor: Profile['lookingFor']
  city: string
  nerdClass: Profile['nerdClass']
  tagline: string
  bio: string
  interests: string[]
  avatar: AvatarSeed
}

/** A photo in the editor: either already uploaded (path) or a new blob to upload. */
export type PhotoDraft = { path: string; url: string } | { blob: Blob; url: string }

const WALLET_STATEMENT = 'Sign in to Nerdy Town. I confirm I am 18 or older. This does not send a transaction or cost any fees.'

async function finishWalletSignIn(adapter: SolanaWallet) {
  let res: Awaited<ReturnType<typeof supabase.auth.signInWithWeb3>>
  try {
    res = await supabase.auth.signInWithWeb3({ chain: 'solana', wallet: adapter, statement: WALLET_STATEMENT })
  } catch (e) {
    throw new Error(/reject|cancel|denied|declin/i.test((e as Error).message) ? 'Signature request was cancelled.' : (e as Error).message)
  }
  const { data, error } = res
  if (error) {
    if (/provider.*(disabled|not enabled)|web3.*disabled|unsupported/i.test(error.message)) throw new Error('Wallet login isn’t switched on yet. (Admin: enable Web3 Wallet → Solana in Supabase.)')
    if (/reject|cancel|denied/i.test(error.message)) throw new Error('Signature request was cancelled.')
    if (/uri|url|domain/i.test(error.message)) throw new Error('This site address isn’t allowed for wallet login yet. (Admin: add it in Supabase → Authentication → URL Configuration.)')
    throw new Error(error.message)
  }
  await applySession(data.session)
  return { hasProfile: !!(data.session && state.profiles[data.session.user.id]) }
}

/** Calls /api/lock (verification) as the logged-in user. */
async function lockApi(body: Record<string, string>): Promise<{ tx?: string; pending?: boolean; signature?: string; verified?: boolean }> {
  const { data } = await supabase.auth.getSession()
  const r = await fetch('/api/lock', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(body),
  })
  const out = await r.json().catch(() => ({}))
  if (!r.ok && r.status !== 202) throw new Error(out.error || `Verification failed (${r.status})`)
  return out
}
const toBase64 = (b: Uint8Array) => btoa(Array.from(b, (c) => String.fromCharCode(c)).join(''))
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const api = {
  /**
   * Sign in (or sign up) with a Solana wallet via Supabase's native Sign-In-With-Solana.
   * Works for wallet apps and for Google / X / email logins (Reown creates a Solana wallet for
   * those). The wallet signs a plain-text message — no transaction, no fees.
   */
  async walletSignIn(option: WalletOption): Promise<{ hasProfile: boolean } | { pending: ConnectedWallet }> {
    // Best path: connect + sign in one wallet approval.
    const oneStep = oneStepSignIn(option)
    if (oneStep) {
      const adapter = {
        signIn: async (input: Record<string, unknown>) => {
          const out = await oneStep(input)
          return { signedMessage: out.signedMessage, signature: out.signature }
        },
      } as unknown as SolanaWallet
      return finishWalletSignIn(adapter)
    }
    const wallet = await connectWallet(option)
    // Phones / WalletConnect: the signature trip must start from a new tap ("Sign in" button).
    // Social / email logins sign inside the page, so they go straight on.
    if (needsSecondTap(option) && !wallet.embedded) return { pending: wallet }
    return api.walletSignInWith(wallet)
  },

  /** Second step for wallets connected separately: ask the wallet to sign the login message. */
  async walletSignInWith(wallet: ConnectedWallet) {
    const adapter = {
      publicKey: { toBase58: () => wallet.address },
      signMessage: (message: Uint8Array) => wallet.signMessage(message),
    } as unknown as SolanaWallet
    return finishWalletSignIn(adapter)
  },

  async logout() {
    await supabase.auth.signOut()
    await applySession(null)
  },

  async saveProfile(input: ProfileInput, photos: PhotoDraft[], socials: Social[]) {
    const me = state.session
    if (!me) throw new Error('Log in first.')
    const existing = state.profiles[me]

    // Upload new photos first, then write the row, then clean up removed files.
    const paths: string[] = []
    for (const p of photos) {
      if ('path' in p) {
        paths.push(p.path)
        continue
      }
      const path = `${me}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, p.blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw new Error('Photo upload failed: ' + error.message)
      paths.push(path)
    }

    const row = {
      id: me,
      name: input.name,
      age: input.age,
      gender: input.gender,
      looking_for: input.lookingFor,
      city: input.city,
      nerd_class: input.nerdClass,
      tagline: input.tagline,
      bio: input.bio,
      interests: input.interests,
      photos: paths,
      avatar: input.avatar,
    }
    const res = existing ? await supabase.from('profiles').update(row).eq('id', me).select().single() : await supabase.from('profiles').insert(row).select().single()
    unwrap(res)
    unwrap(await supabase.from('contacts').upsert({ user_id: me, socials, updated_at: new Date().toISOString() }).select())

    const removed = (existing?.photoPaths ?? []).filter((p) => !paths.includes(p))
    if (removed.length) await supabase.storage.from(PHOTO_BUCKET).remove(removed)

    await loadMine()
    await loadPublic()
  },

  async sendRequest(to: string) {
    const r = unwrap(await supabase.rpc('send_request', { p_to: to }))
    set((s) => ({ requests: [mapRequest(r as Row), ...s.requests], usage: { ...s.usage, used: s.usage.used + 1 } }))
    scheduleRefresh()
  },

  async respond(reqId: string, accept: boolean) {
    unwrap(await supabase.rpc('respond_request', { p_request: reqId, p_accept: accept }))
    set((s) => ({ requests: s.requests.map((r) => (r.id === reqId ? { ...r, status: accept ? 'accepted' : 'rejected', resolvedAt: Date.now() } : r)) }))
    scheduleRefresh()
  },

  async markSeen(ids: string[]) {
    if (!ids.length) return
    set((s) => ({ requests: s.requests.map((r) => (ids.includes(r.id) ? { ...r, seen: true } : r)) }))
    await supabase.rpc('mark_seen', { p_ids: ids })
  },

  async buyRequests(count: number) {
    unwrap(await supabase.rpc('buy_requests', { p_count: count }))
    await loadMine()
  },

  /**
   * Verification: lock $NERDY with the platform. The server builds the transfer (and pays the
   * network fee), the sign-in wallet signs it, the server broadcasts it and checks it on-chain.
   */
  async verify(option: WalletOption) {
    const mine = state.wallet
    if (!state.session || !mine) throw new Error('This account has no Solana wallet.')
    const wallet = await connectWallet(option, mine)
    if (wallet.address !== mine) throw new Error(`Use the wallet you signed in with (${shortAddress(mine)}). That one is ${shortAddress(wallet.address)}.`)
    const { tx } = await lockApi({ action: 'build' })
    if (!tx) throw new Error('Could not prepare the transaction.')
    let signed: Uint8Array
    try {
      signed = await wallet.signTransaction(fromBase64(tx))
    } catch (e) {
      throw new Error(/reject|cancel|denied|declin/i.test((e as Error).message) ? 'You cancelled in your wallet. Nothing was locked.' : (e as Error).message)
    }
    let res = await lockApi({ action: 'submit', signedTx: toBase64(signed) })
    for (let i = 0; res.pending && res.signature && i < 4; i++) res = await lockApi({ action: 'confirm', signature: res.signature })
    if (res.pending) throw new Error('Sent! The network is slow to confirm. Refresh in a minute to see your badge.')
    await loadMine()
    await loadPublic()
  },

  /** Gives the locked $NERDY back (an admin sends it) and removes the verified badge. */
  async unlock() {
    unwrap(await supabase.rpc('unlock_verification'))
    await loadMine()
    await loadPublic()
  },

  async withdraw(amount: number) {
    unwrap(await supabase.rpc('request_withdrawal', { p_amount: Math.floor(amount) }))
    await loadMine()
  },

  async block(userId: string) {
    unwrap(await supabase.rpc('block_user', { p_user: userId }))
    set((s) => {
      const profiles = { ...s.profiles }
      delete profiles[userId]
      return { profiles, blocked: [...s.blocked, userId] }
    })
    scheduleRefresh()
  },

  async report(userId: string, reason: string, details: string) {
    if (!state.session) throw new Error('Log in first.')
    unwrap(await supabase.from('reports').insert({ reporter: state.session, reported: userId, reason, details: details.slice(0, 500) }))
  },

  async deleteAccount() {
    const me = state.session
    if (!me) return
    const paths = state.profiles[me]?.photoPaths ?? []
    if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths)
    unwrap(await supabase.rpc('delete_my_account'))
    await supabase.auth.signOut()
    await applySession(null)
    await loadPublic()
  },

  // ----- admin -----
  admin: {
    async saveSettings(s: Settings) {
      unwrap(
        await supabase
          .from('settings')
          .update({
            free_daily_requests: s.freeDailyRequests,
            real_user_goal: s.realUserGoal,
            verify_lock_amount: s.verifyLockAmount,
            extra_request_cost: s.extraRequestCost,
            min_withdraw: s.minWithdraw,
            token_mint: s.tokenMint?.trim() || null,
            token_decimals: s.tokenDecimals,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1)
          .select(),
      )
      await loadPublic()
    },
    async addRevenue(amount: number, note: string) {
      unwrap(await supabase.rpc('admin_add_revenue', { p_amount: amount, p_note: note }))
      await loadRevenue()
    },
    async withdrawals() {
      const res = await supabase.from('ledger').select('*').in('kind', ['withdraw', 'unlock']).order('created_at', { ascending: false }).limit(100)
      return (unwrap(res) ?? []).map(mapLedger)
    },
    async approveWithdrawal(id: string) {
      const { data } = await supabase.auth.getSession()
      const r = await fetch('/api/approve-withdrawal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ id }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.error || `Payout failed (${r.status})`)
      return body as { signature: string }
    },
    async rejectWithdrawal(id: string) {
      unwrap(await supabase.rpc('admin_reject_withdrawal', { p_id: id }))
    },
    async reports(): Promise<Report[]> {
      const res = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200)
      return (unwrap(res) ?? []).map((r: Row) => ({
        id: r.id as string,
        reporter: r.reporter as string,
        reported: r.reported as string,
        reason: r.reason as string,
        details: r.details as string,
        resolved: r.resolved as boolean,
        createdAt: Date.parse(r.created_at as string),
      }))
    },
    async resolveReport(id: string) {
      unwrap(await supabase.from('reports').update({ resolved: true }).eq('id', id).select())
    },
    async setVerified(userId: string, verified: boolean) {
      unwrap(await supabase.rpc('admin_set_verified', { p_user: userId, p_verified: verified }))
      await refreshProfiles([userId])
    },
    async removeProfile(userId: string) {
      unwrap(await supabase.rpc('admin_remove_user', { p_user: userId }))
      set((s) => {
        const profiles = { ...s.profiles }
        delete profiles[userId]
        return { profiles }
      })
    },
  },
}
