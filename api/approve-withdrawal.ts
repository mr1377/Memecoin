/**
 * POST /api/approve-withdrawal  { id }   (Authorization: Bearer <admin's Supabase access token>)
 *
 * Sends a requested $NERDY withdrawal on-chain from the treasury wallet.
 * Runs on Vercel as a serverless function. Required environment variables:
 *   VITE_SUPABASE_URL           – same as the frontend
 *   SUPABASE_SERVICE_ROLE_KEY   – Supabase → Project settings → API (secret! server only)
 *   TREASURY_SECRET_KEY         – payout wallet secret key (base58 or JSON byte array)
 *   SOLANA_RPC_URL              – optional, defaults to public mainnet RPC (use a paid RPC in production)
 */
import { createClient } from '@supabase/supabase-js'
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token'
import bs58 from 'bs58'

interface Req {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Res {
  status(code: number): Res
  json(body: unknown): void
}

function parseSecret(raw: string): Keypair {
  const s = raw.trim()
  const bytes = s.startsWith('[') ? Uint8Array.from(JSON.parse(s) as number[]) : bs58.decode(s)
  return Keypair.fromSecretKey(bytes)
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  const treasuryKey = process.env.TREASURY_SECRET_KEY
  const missing = [!url && 'VITE_SUPABASE_URL', !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY', !treasuryKey && 'TREASURY_SECRET_KEY'].filter(Boolean)
  if (missing.length) return res.status(503).json({ error: `Payouts not configured. Missing on Vercel: ${missing.join(', ')}` })

  const db = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })

  // --- who is calling?
  const auth = String(req.headers.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const { data: userData } = await db.auth.getUser(token)
  const userId = userData.user?.id
  if (!userId) return res.status(401).json({ error: 'Not logged in.' })
  const { data: isAdmin } = await db.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (!isAdmin) return res.status(403).json({ error: 'Admins only.' })

  const id = (req.body as { id?: string } | undefined)?.id
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing withdrawal id.' })

  const { data: settings } = await db.from('settings').select('*').eq('id', 1).single()
  if (!settings || settings.phase !== 2) return res.status(409).json({ error: 'Payouts only run in Phase 2.' })
  if (!settings.token_mint) return res.status(409).json({ error: 'Set the $NERDY token mint in the admin panel first.' })

  // --- claim the withdrawal atomically so it can never be paid twice
  const { data: row } = await db
    .from('ledger')
    .update({ status: 'processing' })
    .eq('id', id)
    .eq('kind', 'withdraw')
    .eq('status', 'requested')
    .select('*')
    .maybeSingle()
  if (!row) return res.status(409).json({ error: 'Withdrawal not found or already handled.' })

  const fail = async (message: string, status = 500) => {
    // Nothing was broadcast: mark failed, which refunds the user's balance.
    await db.from('ledger').update({ status: 'failed', note: `${row.note} (failed: ${message.slice(0, 120)})` }).eq('id', id)
    return res.status(status).json({ error: message })
  }

  let tx: Transaction
  let connection: Connection
  let signature: string
  try {
    connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed')
    const treasury = parseSecret(treasuryKey!)
    const mint = new PublicKey(settings.token_mint)
    const recipient = new PublicKey(row.wallet)

    const mintAccount = await connection.getAccountInfo(mint)
    if (!mintAccount) return fail('Token mint not found on-chain.', 409)
    const programId = mintAccount.owner // SPL Token or Token-2022
    const mintInfo = await getMint(connection, mint, 'confirmed', programId)

    const units = BigInt(String(row.amount).replace('-', '')) * 10n ** BigInt(mintInfo.decimals)
    const fromAta = getAssociatedTokenAddressSync(mint, treasury.publicKey, false, programId)
    const toAta = getAssociatedTokenAddressSync(mint, recipient, true, programId)

    tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(treasury.publicKey, toAta, recipient, mint, programId),
      createTransferCheckedInstruction(fromAta, mint, toAta, treasury.publicKey, units, mintInfo.decimals, [], programId),
    )
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = blockhash
    tx.lastValidBlockHeight = lastValidBlockHeight
    tx.feePayer = treasury.publicKey
    tx.sign(treasury)
    signature = bs58.encode(tx.signature!)
    // Simulate first so obvious problems (empty treasury, bad address) refund cleanly.
    const sim = await connection.simulateTransaction(tx)
    if (sim.value.err) return fail(`Simulation failed: ${JSON.stringify(sim.value.err)} ${(sim.value.logs ?? []).slice(-2).join(' ')}`, 409)
  } catch (e) {
    return fail((e as Error).message)
  }

  // --- broadcast; from here on the transfer may land, so never auto-refund
  await db.from('ledger').update({ tx_sig: signature }).eq('id', id)
  try {
    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 })
    const conf = await connection.confirmTransaction({ signature, blockhash: tx.recentBlockhash!, lastValidBlockHeight: tx.lastValidBlockHeight! }, 'confirmed')
    if (conf.value.err) return fail(`Transaction failed on-chain: ${JSON.stringify(conf.value.err)}`)
  } catch (e) {
    return res.status(202).json({
      signature,
      error: `Sent but not confirmed yet (${(e as Error).message}). Check https://solscan.io/tx/${signature} before retrying — it stays "processing".`,
    })
  }
  await db.from('ledger').update({ status: 'sent' }).eq('id', id)
  return res.status(200).json({ signature })
}
