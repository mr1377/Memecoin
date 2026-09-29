import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, PHOTO_BUCKET, photoUrl, supabase } from './supabase'
import type { AvatarSeed, LedgerEntry, PartnerRequest, Profile, Report, Settings, Social, Wallet, WalletProvider } from './types'

/**
 * Client-side cache of the Supabase backend. All rules (limits, privacy, balances)
 * are enforced in the database (see supabase/schema.sql); this only mirrors state for the UI.
 */

export interface State {
  configured: boolean
  ready: boolean
  session: string | null
  email: string | null
  emailConfirmed: boolean
  recovering: boolean // arrived via password-reset link
  profiles: Record<string, Profile>
  requests: PartnerRequest[]
  settings: Settings
  phase: 1 | 2
  bondingProgress: number
  usage: { used: number; bonus: number }
  balance: number
  ledger: LedgerEntry[]
  wallet: Wallet | null
  myContacts: Social[]
  contacts: Record<string, Social[]> // socials revealed to me (accepted requests I sent)
  blocked: string[]
  isAdmin: boolean
  stats: { residents: number; rejections: number }
  offline: boolean // backend unreachable
}

const DEFAULT_SETTINGS: Settings = {
  phase: 1,
  bondingProgress: 0,
  freeDailyRequests: 3,
  rejectReward: 100,
  extraRequestCost: 250,
  minWithdraw: 500,
  tokenMint: null,
  tokenDecimals: 6,
}

let state: State = {
  configured: isConfigured,
  ready: !isConfigured,
  session: null,
  email: null,
  emailConfirmed: false,
  recovering: false,
  profiles: {},
  requests: [],
  settings: DEFAULT_SETTINGS,
  phase: 1,
  bondingProgress: 0,
  usage: { used: 0, bonus: 0 },
  balance: 0,
  ledger: [],
  wallet: null,
  myContacts: [],
  contacts: {},
  blocked: [],
  isAdmin: false,
  stats: { residents: 0, rejections: 0 },
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
    isBot: r.is_bot as boolean,
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
  bondingProgress: Number(r.bonding_progress),
  freeDailyRequests: r.free_daily_requests as number,
  rejectReward: r.reject_reward as number,
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

async function loadPublic() {
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
    bondingProgress: s.bondingProgress,
    profiles: { ...map, ...(st.session && st.profiles[st.session] && !map[st.session] ? { [st.session]: st.profiles[st.session] } : {}) },
    stats: (stats.data as State['stats']) ?? st.stats,
    offline: false,
  }))
}

async function loadMine() {
  const me = state.session
  if (!me) return
  const [profile, requests, usage, balance, ledger, wallet, contacts, blocks, admin] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', me).maybeSingle(),
    supabase.from('requests').select('*').or(`from_id.eq.${me},to_id.eq.${me}`).order('created_at', { ascending: false }),
    supabase.from('daily_usage').select('*').eq('user_id', me).eq('day', todayUTC()).maybeSingle(),
    supabase.rpc('my_balance'),
    supabase.from('ledger').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(50),
    supabase.from('wallets').select('*').eq('user_id', me).maybeSingle(),
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
      wallet: wallet.data ? { address: wallet.data.address, provider: wallet.data.provider } : null,
      myContacts: mine,
      contacts: contactMap,
      blocked: (blocks.data ?? []).map((b) => b.blocked as string),
      isAdmin: !!admin.data,
    }
  })
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

// Live updates + bot answers
let channel: ReturnType<typeof supabase.channel> | null = null
let botTimer: number | undefined

function startLive(me: string) {
  stopLive()
  channel = supabase
    .channel(`requests:${me}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `from_id=eq.${me}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `to_id=eq.${me}` }, scheduleRefresh)
    .subscribe()
  botTimer = window.setInterval(async () => {
    const waitingOnBot = state.requests.some((r) => r.from === me && r.status === 'pending' && state.profiles[r.to]?.isBot)
    if (!waitingOnBot) return
    const { data } = await supabase.rpc('tick_bots')
    if (data) scheduleRefresh()
  }, 2000)
}
function stopLive() {
  if (channel) supabase.removeChannel(channel)
  channel = null
  clearInterval(botTimer)
}

async function applySession(session: Session | null) {
  const id = session?.user.id ?? null
  const changed = id !== state.session
  set({ session: id, email: session?.user.email ?? null, emailConfirmed: !!session?.user.email_confirmed_at })
  if (!changed) return
  if (id) {
    await loadMine()
    startLive(id)
  } else {
    stopLive()
    set({ requests: [], usage: { used: 0, bonus: 0 }, balance: 0, ledger: [], wallet: null, myContacts: [], contacts: {}, blocked: [], isAdmin: false })
  }
}

if (isConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') set({ recovering: true })
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

declare const __SITE_URL__: string
/** Where email links send people: the public production address, not a private preview URL. */
const siteUrl = () => __SITE_URL__ || window.location.origin

export const api = {
  async signup(email: string, password: string) {
    email = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That email looks glitched.')
    if (password.length < 8) throw new Error('Password needs at least 8 characters.')
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl()}/onboarding` } })
    if (error) throw new Error(error.message)
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) throw new Error('This email already lives in Nerdy Town. Try logging in.')
    return { needsConfirmation: !data.session }
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) {
      if (/confirm/i.test(error.message)) throw Object.assign(new Error('Please confirm your email first — check your inbox.'), { code: 'unconfirmed' })
      throw new Error('Wrong email or password. Even nerds typo.')
    }
    await applySession(data.session)
    return { hasProfile: !!state.profiles[data.user.id] }
  },

  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${siteUrl()}/onboarding` } })
    if (error) throw new Error(error.message)
  },

  async sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${siteUrl()}/reset-password` })
    if (error) throw new Error(error.message)
  },

  async updatePassword(password: string) {
    if (password.length < 8) throw new Error('Password needs at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    set({ recovering: false })
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

  async connectWallet(provider: WalletProvider) {
    const address = await connectSolanaWallet(provider)
    unwrap(await supabase.rpc('link_wallet', { p_address: address, p_provider: provider }))
    await loadMine()
  },

  async disconnectWallet() {
    unwrap(await supabase.rpc('unlink_wallet'))
    set({ wallet: null })
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
            phase: s.phase,
            bonding_progress: s.bondingProgress,
            free_daily_requests: s.freeDailyRequests,
            reject_reward: s.rejectReward,
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
    async withdrawals() {
      const res = await supabase.from('ledger').select('*').eq('kind', 'withdraw').order('created_at', { ascending: false }).limit(100)
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

// ---------- Solana wallets (browser extensions / in-app browsers) ----------

interface InjectedWallet {
  connect: () => Promise<{ publicKey?: { toString(): string } } | void>
  publicKey?: { toString(): string } | null
}

async function connectSolanaWallet(provider: WalletProvider): Promise<string> {
  const w = window as unknown as {
    phantom?: { solana?: InjectedWallet & { isPhantom?: boolean } }
    solana?: InjectedWallet & { isPhantom?: boolean }
    solflare?: InjectedWallet & { isSolflare?: boolean }
    backpack?: InjectedWallet
  }
  const injected: InjectedWallet | undefined =
    provider === 'Phantom' ? w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined) : provider === 'Solflare' ? w.solflare : w.backpack
  if (!injected) {
    const here = encodeURIComponent(window.location.href)
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    const links: Record<WalletProvider, string> = {
      Phantom: mobile ? `https://phantom.app/ul/browse/${here}?ref=${encodeURIComponent(siteUrl())}` : 'https://phantom.app/download',
      Solflare: mobile ? `https://solflare.com/ul/v1/browse/${here}?ref=${encodeURIComponent(siteUrl())}` : 'https://solflare.com/download',
      Backpack: 'https://backpack.app/download',
    }
    window.open(links[provider], '_blank', 'noopener')
    throw new Error(`${provider} not found — opening ${mobile ? 'the app' : 'the download page'}.`)
  }
  try {
    const res = await injected.connect()
    const key = (res && 'publicKey' in res && res.publicKey) || injected.publicKey
    if (!key) throw new Error()
    return key.toString()
  } catch {
    throw new Error('Wallet connection was cancelled.')
  }
}
