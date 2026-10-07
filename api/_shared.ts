/** Helpers shared by the serverless functions (files starting with "_" aren't routes on Vercel). */
import { createClient, type User } from '@supabase/supabase-js'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

export interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
export interface Res {
  status(code: number): Res
  json(body: unknown): void
}

export function parseSecret(raw: string): Keypair {
  const s = raw.trim()
  const bytes = s.startsWith('[') ? Uint8Array.from(JSON.parse(s) as number[]) : bs58.decode(s)
  return Keypair.fromSecretKey(bytes)
}

export const rpcUrl = () => process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const bearer = (req: Req) => {
  const h = String(req.headers.authorization ?? '')
  return h.startsWith('Bearer ') ? h.slice(7) : ''
}

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * The Solana address the user signed in with. Supabase's Sign in with Solana
 * stores it on the identity ("web3:solana:<address>" + custom_claims.address).
 * Same rule as public._wallet() in the database.
 */
export function walletOf(user: User | null | undefined): string | null {
  for (const i of user?.identities ?? []) {
    const data = (i.identity_data ?? {}) as { sub?: string; custom_claims?: { address?: string } }
    const sub = [i.id, data.sub].find((s) => typeof s === 'string' && s.toLowerCase().startsWith('web3:solana:'))
    const address = data.custom_claims?.address ?? sub?.split(':')[2]
    if (sub && address && BASE58.test(address)) return address
  }
  return null
}
