import { useSyncExternalStore } from 'react'
import { seedAvatar } from './avatar'
import { makeSeedProfiles } from './seed'
import type { Account, LedgerEntry, PartnerRequest, Profile, Social, Wallet } from './types'

/**
 * Nerdy Town mock backend.
 * Everything lives in localStorage so the whole product loop is playable without a server.
 * Swap these functions for API calls when the real backend lands — the UI only talks to `api`.
 */

export const FREE_DAILY_REQUESTS = 3
export const REJECT_REWARD = 100 // $NERDY per rejection (Phase 2)
export const EXTRA_REQUEST_COST = 250 // $NERDY per extra daily request (Phase 2)
export const MIN_WITHDRAW = 500

const KEY = 'nerdy-town:v2' // v2: socials replace phone numbers

export interface State {
  accounts: Record<string, Account>
  profiles: Record<string, Profile>
  requests: PartnerRequest[]
  session: string | null
  phase: 1 | 2
  bondingProgress: number // % toward pump.fun graduation
  usage: Record<string, { day: string; used: number; bonus: number }>
  balances: Record<string, number>
  ledger: Record<string, LedgerEntry[]>
  wallets: Record<string, Wallet | null>
  botTimers: Record<string, number> // requestId -> resolve at (ms)
}

const today = () => new Date().toISOString().slice(0, 10)
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function fresh(): State {
  const now = Date.now()
  const profiles: Record<string, Profile> = {}
  for (const p of makeSeedProfiles(now)) profiles[p.id] = p
  return {
    accounts: {},
    profiles,
    requests: [],
    session: null,
    phase: 1,
    bondingProgress: 68.4,
    usage: {},
    balances: {},
    ledger: {},
    wallets: {},
    botTimers: {},
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...fresh(), ...JSON.parse(raw) }
  } catch {
    /* corrupted or blocked storage — start fresh */
  }
  return fresh()
}

let state: State = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    throw new Error('Storage is full — try removing a photo.')
  }
}

function set(fn: (s: State) => State) {
  const prev = state
  state = fn(state)
  try {
    persist()
  } catch (e) {
    state = prev
    throw e
  }
  listeners.forEach((l) => l())
}

/** Selectors must return stable references (raw state slices), derive the rest with useMemo. */
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

// ---------- helpers ----------

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nerdy-salt::' + text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function usageFor(s: State, id: string) {
  const u = s.usage[id]
  if (!u || u.day !== today()) return { day: today(), used: 0, bonus: 0 }
  return u
}

export function dailyInfo(s: State, id: string) {
  const u = usageFor(s, id)
  const limit = FREE_DAILY_REQUESTS + u.bonus
  return { used: u.used, limit, left: Math.max(0, limit - u.used), bonus: u.bonus }
}

function addLedger(s: State, id: string, e: Omit<LedgerEntry, 'id' | 'at'>): State {
  const list = s.ledger[id] ?? []
  return { ...s, ledger: { ...s.ledger, [id]: [{ ...e, id: uid('tx_'), at: Date.now() }, ...list].slice(0, 100) } }
}

function patchProfile(s: State, id: string, patch: Partial<Profile> | ((p: Profile) => Partial<Profile>)): State {
  const p = s.profiles[id]
  if (!p) return s
  const next = typeof patch === 'function' ? patch(p) : patch
  return { ...s, profiles: { ...s.profiles, [id]: { ...p, ...next } } }
}

function resolve(s: State, reqId: string, status: 'accepted' | 'rejected'): State {
  const req = s.requests.find((r) => r.id === reqId)
  if (!req || req.status !== 'pending') return s
  let n: State = {
    ...s,
    requests: s.requests.map((r) => (r.id === reqId ? { ...r, status, resolvedAt: Date.now(), seen: false } : r)),
  }
  const { [reqId]: _drop, ...timers } = n.botTimers
  n = { ...n, botTimers: timers }
  if (status === 'accepted') {
    n = patchProfile(n, req.from, (p) => ({ accepts: p.accepts + 1 }))
    n = patchProfile(n, req.to, (p) => ({ accepts: p.accepts + 1 }))
  } else {
    n = patchProfile(n, req.from, (p) => ({ rejectionsReceived: p.rejectionsReceived + 1 }))
    n = patchProfile(n, req.to, (p) => ({ rejectionsGiven: p.rejectionsGiven + 1 }))
    if (n.phase === 2) {
      n = { ...n, balances: { ...n.balances, [req.from]: (n.balances[req.from] ?? 0) + REJECT_REWARD } }
      const who = n.profiles[req.to]?.name ?? 'someone'
      n = addLedger(n, req.from, { kind: 'reject-reward', amount: REJECT_REWARD, note: `Rejected by ${who}. Still a W.` })
    }
  }
  return n
}

// Bots answer the requests you send them after a short, suspenseful pause.
function tickBots() {
  const now = Date.now()
  const due = Object.entries(state.botTimers).filter(([, at]) => at <= now)
  if (!due.length) return
  set((s) => {
    let n = s
    for (const [id] of due) {
      const req = n.requests.find((r) => r.id === id)
      if (!req) continue
      // Deterministic-ish but fun: ~40% accept rate
      const roll = (parseInt(id.slice(-4), 36) % 100) / 100
      n = resolve(n, id, roll < 0.4 ? 'accepted' : 'rejected')
    }
    return n
  })
}
setInterval(tickBots, 1000)

function seedIncoming(s: State, me: string): State {
  const bots = Object.values(s.profiles).filter((p) => p.id.startsWith('bot_'))
  const picks = [...bots].sort(() => Math.random() - 0.5).slice(0, 3)
  const reqs: PartnerRequest[] = picks.map((p, i) => ({
    id: uid('rq_'),
    from: p.id,
    to: me,
    status: 'pending',
    createdAt: Date.now() - (i + 1) * 1000 * 60 * 17,
  }))
  return { ...s, requests: [...reqs, ...s.requests] }
}

// ---------- public api ----------

export const api = {
  async signup(email: string, password: string) {
    await wait(500)
    email = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That email looks glitched.')
    if (password.length < 6) throw new Error('Password needs at least 6 characters.')
    if (Object.values(state.accounts).some((a) => a.email === email)) throw new Error('This email already lives in Nerdy Town. Try logging in.')
    const id = uid('u_')
    const passHash = await sha256(password)
    set((s) => ({
      ...s,
      accounts: { ...s.accounts, [id]: { id, email, passHash, createdAt: Date.now(), hasProfile: false } },
      session: id,
    }))
    return id
  },

  async login(email: string, password: string) {
    await wait(500)
    email = email.trim().toLowerCase()
    const acc = Object.values(state.accounts).find((a) => a.email === email)
    const passHash = await sha256(password)
    if (!acc || acc.passHash !== passHash) throw new Error('Wrong email or password. Even nerds typo.')
    set((s) => ({ ...s, session: acc.id }))
    return acc
  },

  async demo() {
    const email = 'demo@nerdy.town'
    const existing = Object.values(state.accounts).find((a) => a.email === email)
    if (existing) return api.login(email, 'nerdy123')
    const id = await api.signup(email, 'nerdy123')
    api.saveProfile({
      name: 'Newton Byte',
      age: 26,
      gender: 'Man',
      lookingFor: 'Everyone',
      city: 'Brooklyn, NY',
      nerdClass: 'Code Wizard',
      tagline: 'Professional overthinker. Amateur romantic.',
      bio: 'I have 47 browser tabs open and one of them is your profile. I build side projects I never finish and I know way too much about keyboards.',
      interests: ['TypeScript', 'Mech keyboards', 'Sci-fi', 'Coffee'],
      photos: [],
      avatar: seedAvatar('newton-demo'),
      socials: [
        { platform: 'Instagram', handle: 'newton.byte' },
        { platform: 'Telegram', handle: 'newtonbyte' },
      ],
    })
    return state.accounts[id]
  },

  logout() {
    set((s) => ({ ...s, session: null }))
  },

  saveProfile(data: Omit<Profile, 'id' | 'joinedAt' | 'rejectionsGiven' | 'rejectionsReceived' | 'accepts'>) {
    const id = state.session
    if (!id) throw new Error('Log in first.')
    set((s) => {
      const existing = s.profiles[id]
      const profile: Profile = existing
        ? { ...existing, ...data }
        : { ...data, id, joinedAt: Date.now(), rejectionsGiven: 0, rejectionsReceived: 0, accepts: 0 }
      let n: State = {
        ...s,
        profiles: { ...s.profiles, [id]: profile },
        accounts: { ...s.accounts, [id]: { ...s.accounts[id], hasProfile: true } },
      }
      if (!existing) n = seedIncoming(n, id)
      return n
    })
  },

  sendRequest(to: string) {
    const me = state.session
    if (!me || !state.profiles[me]) throw new Error('Create your profile first.')
    if (to === me) throw new Error('Self-love is valid, but not like this.')
    const existing = relationWith(state, to)
    if (existing) {
      if (existing.from !== me) throw new Error('They already requested you — check your dashboard!')
      throw new Error(existing.status === 'rejected' ? 'They already said no. Respect the L — it’s on your board.' : 'You already sent a request here.')
    }
    const d = dailyInfo(state, me)
    if (d.left <= 0) {
      throw new Error(state.phase === 1 ? 'Out of requests for today. Come back tomorrow, legend.' : 'Out of requests — buy more with $NERDY.')
    }
    const id = uid('rq_')
    set((s) => {
      const u = usageFor(s, me)
      return {
        ...s,
        requests: [{ id, from: me, to, status: 'pending', createdAt: Date.now() }, ...s.requests],
        usage: { ...s.usage, [me]: { ...u, used: u.used + 1 } },
        botTimers: to.startsWith('bot_') ? { ...s.botTimers, [id]: Date.now() + 3500 + Math.random() * 3500 } : s.botTimers,
      }
    })
    return id
  },

  respond(reqId: string, status: 'accepted' | 'rejected') {
    const req = state.requests.find((r) => r.id === reqId)
    if (!req || req.to !== state.session) throw new Error('Request not found.')
    set((s) => resolve(s, reqId, status))
  },

  markSeen(ids: string[]) {
    if (!ids.length) return
    set((s) => ({ ...s, requests: s.requests.map((r) => (ids.includes(r.id) ? { ...r, seen: true } : r)) }))
  },

  setPhase(phase: 1 | 2) {
    set((s) => {
      let n: State = { ...s, phase, bondingProgress: phase === 2 ? 100 : 68.4 }
      if (phase === 2 && s.session && !(s.ledger[s.session] ?? []).some((e) => e.kind === 'airdrop')) {
        n = { ...n, balances: { ...n.balances, [s.session]: (n.balances[s.session] ?? 0) + 500 } }
        n = addLedger(n, s.session, { kind: 'airdrop', amount: 500, note: 'Graduation welcome drop 🎓' })
      }
      return n
    })
  },

  buyRequests(count: number) {
    const me = state.session
    if (!me) throw new Error('Log in first.')
    if (state.phase !== 2) throw new Error('Extra requests unlock after $NERDY graduates.')
    const cost = count * EXTRA_REQUEST_COST
    if ((state.balances[me] ?? 0) < cost) throw new Error(`Not enough $NERDY. You need ${cost.toLocaleString()}.`)
    set((s) => {
      const u = usageFor(s, me)
      let n: State = {
        ...s,
        balances: { ...s.balances, [me]: (s.balances[me] ?? 0) - cost },
        usage: { ...s.usage, [me]: { ...u, bonus: u.bonus + count } },
      }
      n = addLedger(n, me, { kind: 'buy-requests', amount: -cost, note: `+${count} extra request${count > 1 ? 's' : ''} today` })
      return n
    })
  },

  async connectWallet(provider: Wallet['provider']) {
    const me = state.session
    if (!me) throw new Error('Log in first.')
    let address = ''
    const w = window as unknown as { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString(): string } }> } }
    if (provider === 'Phantom' && w.solana?.isPhantom) {
      try {
        const res = await w.solana.connect()
        address = res.publicKey.toString()
      } catch {
        throw new Error('Wallet connection was cancelled.')
      }
    } else {
      await wait(900)
      const abc = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      address = Array.from({ length: 44 }, () => abc[Math.floor(Math.random() * abc.length)]).join('')
    }
    set((s) => ({ ...s, wallets: { ...s.wallets, [me]: { address, provider } } }))
  },

  disconnectWallet() {
    const me = state.session
    if (!me) return
    set((s) => ({ ...s, wallets: { ...s.wallets, [me]: null } }))
  },

  async withdraw(amount: number) {
    const me = state.session
    if (!me) throw new Error('Log in first.')
    if (state.phase !== 2) throw new Error('Withdrawals open after graduation.')
    const wallet = state.wallets[me]
    if (!wallet) throw new Error('Connect a wallet first.')
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) throw new Error(`Minimum withdrawal is ${MIN_WITHDRAW} $NERDY.`)
    if ((state.balances[me] ?? 0) < amount) throw new Error('Balance too low.')
    await wait(1400)
    set((s) => {
      let n: State = { ...s, balances: { ...s.balances, [me]: (s.balances[me] ?? 0) - amount } }
      n = addLedger(n, me, { kind: 'withdraw', amount: -amount, note: `Sent to ${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` })
      return n
    })
  },

  resetAll() {
    localStorage.removeItem(KEY)
    state = fresh()
    listeners.forEach((l) => l())
  },
}

// ---------- selectors ----------

export const selectMe = (s: State) => (s.session ? s.profiles[s.session] ?? null : null)
export const selectAccount = (s: State) => (s.session ? s.accounts[s.session] ?? null : null)

/** Relationship between the current user and another profile. */
export function relationWith(s: State, other: string) {
  const me = s.session
  if (!me) return null
  const reqs = s.requests.filter((r) => (r.from === me && r.to === other) || (r.from === other && r.to === me))
  return reqs[0] ?? null
}

/** Socials are only ever returned when the request between you two was accepted. */
export function revealedSocials(s: State, other: string): Social[] | null {
  const r = relationWith(s, other)
  if (!r || r.status !== 'accepted') return null
  return s.profiles[other]?.socials ?? null
}
