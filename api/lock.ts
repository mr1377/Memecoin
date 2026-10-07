/**
 * POST /api/lock   (Authorization: Bearer <user's Supabase access token>)
 *
 * Verification = locking $NERDY (settings.verify_lock_amount, default 100) with the platform:
 *   { action: 'build' }                → a transfer from the user's sign-in wallet to the platform
 *                                         wallet, with the platform paying the network fee
 *                                         (so the user needs no SOL). Returns { tx } (base64,
 *                                         fee-payer signature already on it).
 *   { action: 'submit', signedTx }     → broadcasts the wallet-signed transaction, then confirms.
 *   { action: 'confirm', signature }   → (re)checks a sent transaction.
 * Confirming reads the transaction back from the chain and only counts it if the user's wallet
 * sent at least the lock amount of the $NERDY mint to the platform wallet. Then record_lock()
 * marks the resident verified.
 *
 * Environment (Vercel): SUPABASE_SERVICE_ROLE_KEY, TREASURY_SECRET_KEY, SOLANA_RPC_URL (+ the Supabase URL).
 */
import { Connection, PublicKey, Transaction, type Keypair } from '@solana/web3.js'
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bearer, parseSecret, rpcUrl, serviceClient, walletOf, type Req, type Res } from './_shared.js'

interface Deps {
  db: SupabaseClient
  connection: Connection
  treasury: Keypair
  sleep?: (ms: number) => Promise<void>
}
type Out = { status: number; body: Record<string, unknown> }
const fail = (status: number, error: string): Out => ({ status, body: { error } })

interface TokenBalance {
  owner?: string
  mint: string
  uiTokenAmount: { amount: string }
}
/** Net change of `owner`'s balance of `mint` in a confirmed transaction (raw units). */
function delta(pre: TokenBalance[] = [], post: TokenBalance[] = [], owner: string, mint: string) {
  const sum = (list: TokenBalance[]) => list.filter((b) => b.owner === owner && b.mint === mint).reduce((a, b) => a + BigInt(b.uiTokenAmount.amount), 0n)
  return sum(post) - sum(pre)
}

export async function lockCore(input: { action?: string; signedTx?: string; signature?: string }, user: { id: string; wallet: string }, deps: Deps): Promise<Out> {
  const { db, connection, treasury } = deps
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  const { data: settings } = await db.from('settings').select('*').eq('id', 1).single()
  if (!settings?.token_mint) return fail(409, 'Verification opens when $NERDY launches.')
  const { data: profile } = await db.from('profiles').select('id, verified').eq('id', user.id).maybeSingle()
  if (!profile) return fail(409, 'Create your profile first.')

  const mint = new PublicKey(settings.token_mint)
  const owner = new PublicKey(user.wallet)
  const mintAccount = await connection.getAccountInfo(mint)
  if (!mintAccount) return fail(409, 'The $NERDY mint was not found on-chain.')
  const programId = mintAccount.owner // SPL Token or Token-2022
  const { decimals } = await getMint(connection, mint, 'confirmed', programId)
  const lockAmount = BigInt(settings.verify_lock_amount)
  const units = lockAmount * 10n ** BigInt(decimals)

  if (input.action === 'build') {
    if (profile.verified) return fail(409, 'You’re already verified.')
    const fromAta = getAssociatedTokenAddressSync(mint, owner, true, programId)
    const toAta = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, programId)
    const have = await connection.getTokenAccountBalance(fromAta).then((r) => BigInt(r.value.amount), () => 0n)
    if (have < units) {
      const whole = Number(have / 10n ** BigInt(decimals))
      return fail(409, `Your wallet ${user.wallet.slice(0, 4)}…${user.wallet.slice(-4)} has ${whole.toLocaleString('en-US')} $NERDY. You need ${lockAmount} to verify.`)
    }
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(treasury.publicKey, toAta, treasury.publicKey, mint, programId),
      createTransferCheckedInstruction(fromAta, mint, toAta, owner, units, decimals, [], programId),
    )
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = blockhash
    tx.lastValidBlockHeight = lastValidBlockHeight
    tx.feePayer = treasury.publicKey
    tx.partialSign(treasury)
    const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    return { status: 200, body: { tx: Buffer.from(bytes).toString('base64'), amount: Number(lockAmount) } }
  }

  let signature = input.signature
  if (input.action === 'submit') {
    if (typeof input.signedTx !== 'string') return fail(400, 'Missing signed transaction.')
    let tx: Transaction
    try {
      tx = Transaction.from(Buffer.from(input.signedTx, 'base64'))
    } catch {
      return fail(400, 'That transaction could not be read.')
    }
    if (!tx.feePayer?.equals(treasury.publicKey)) return fail(400, 'This is not a Nerdy Town lock transaction.')
    if (!tx.signatures.some((s) => s.publicKey.equals(owner) && s.signature)) return fail(400, 'Your wallet didn’t sign the transaction.')
    try {
      signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 })
    } catch (e) {
      const msg = (e as Error).message
      return fail(400, /blockhash/i.test(msg) ? 'That took too long. Please try again.' : `The network rejected it: ${msg.slice(0, 160)}`)
    }
  } else if (input.action !== 'confirm') {
    return fail(400, 'Unknown action.')
  }
  if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(signature)) return fail(400, 'Missing transaction signature.')

  // --- read it back from the chain (up to ~30 s), then check who sent what to whom
  let found = null as Awaited<ReturnType<Connection['getTransaction']>>
  for (let i = 0; i < 20 && !found; i++) {
    found = await connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }).catch(() => null)
    if (!found) await sleep(1500)
  }
  if (!found?.meta) return { status: 202, body: { pending: true, signature } }
  if (found.meta.err) return fail(400, 'The transaction failed on-chain, so nothing was locked.')

  const pre = (found.meta.preTokenBalances ?? []) as TokenBalance[]
  const post = (found.meta.postTokenBalances ?? []) as TokenBalance[]
  const received = delta(pre, post, treasury.publicKey.toBase58(), mint.toBase58())
  const sent = -delta(pre, post, user.wallet, mint.toBase58())
  if (received < units || sent < units) return fail(400, `This transaction doesn’t move ${lockAmount} $NERDY from your wallet to Nerdy Town.`)

  const wholeLocked = Number(received / 10n ** BigInt(decimals))
  const { error } = await db.rpc('record_lock', { p_user: user.id, p_tx_sig: signature, p_amount: wholeLocked, p_wallet: user.wallet })
  if (error) return fail(409, error.message.replace(/^.*?ERROR:\s*/, ''))
  return { status: 200, body: { verified: true, signature, amount: wholeLocked } }
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const db = serviceClient()
  const key = process.env.TREASURY_SECRET_KEY
  if (!db || !key) return res.status(503).json({ error: 'Verification isn’t set up yet. (Missing SUPABASE_SERVICE_ROLE_KEY or TREASURY_SECRET_KEY on Vercel.)' })

  const { data } = await db.auth.getUser(bearer(req))
  if (!data.user) return res.status(401).json({ error: 'Log in first.' })
  const wallet = walletOf(data.user)
  if (!wallet) return res.status(409).json({ error: 'Your account has no Solana wallet. Sign in with a wallet or social login.' })

  try {
    const out = await lockCore((req.body ?? {}) as Record<string, string>, { id: data.user.id, wallet }, {
      db,
      connection: new Connection(rpcUrl(), 'confirmed'),
      treasury: parseSecret(key),
    })
    return res.status(out.status).json(out.body)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
