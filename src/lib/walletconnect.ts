import type { ConnectedWallet } from './wallets'

/**
 * Reown AppKit for Solana, used for two things:
 *  - Google / X / Discord / Apple / email login: Reown creates a Solana wallet for the user, which
 *    signs inside the page (no wallet app needed).
 *  - WalletConnect: the user stays in their normal browser, picks a wallet app, approves, comes back.
 *    On desktop it shows a QR code.
 * Loaded lazily — the library is large and only needed when someone taps one of those buttons.
 */

declare const __WC_PROJECT_ID__: string
export const walletConnectProjectId = __WC_PROJECT_ID__
export const walletConnectEnabled = Boolean(__WC_PROJECT_ID__)

type AppKit = import('@reown/appkit').AppKit
let kit: Promise<AppKit> | null = null

function getKit(): Promise<AppKit> {
  if (!kit) {
    kit = (async () => {
      const [{ createAppKit }, { SolanaAdapter }, { solana }] = await Promise.all([
        import('@reown/appkit'),
        import('@reown/appkit-adapter-solana'),
        import('@reown/appkit/networks'),
      ])
      return createAppKit({
        adapters: [new SolanaAdapter()],
        networks: [solana],
        projectId: __WC_PROJECT_ID__,
        metadata: {
          name: 'Nerdy Town',
          description: 'Where nerds are always winners.',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.svg`],
        },
        features: {
          analytics: false,
          email: true,
          socials: ['google', 'x', 'discord', 'apple', 'github'],
          emailShowWallets: true,
          swaps: false,
          onramp: false,
          send: false,
          history: false,
        },
        themeMode: 'dark',
        themeVariables: { '--w3m-accent': '#ff7a1a', '--w3m-border-radius-master': '4px', '--w3m-z-index': 1000 },
      })
    })()
  }
  return kit
}

/** AppKit restores the previous session asynchronously; wait a moment for it. */
async function restoredAddress(modal: AppKit) {
  for (let i = 0; i < 15 && !modal.getAddress('solana'); i++) await new Promise((r) => setTimeout(r, 100))
  return modal.getAddress('solana')
}

/**
 * Opens the AppKit modal (social / email login, or the wallet list) and resolves once a Solana
 * account is connected. With `expected`, an existing session on that address is reused.
 */
export async function connectViaAppKit({ social, expected }: { social: boolean; expected?: string }): Promise<ConnectedWallet> {
  if (!walletConnectEnabled) throw new Error('WalletConnect isn’t set up yet.')
  const modal = await getKit()

  const current = await restoredAddress(modal)
  if (!(expected && current === expected)) {
    // Start fresh so the user can pick any login, not a stale session from last time.
    if (current) await modal.disconnect('solana').catch(() => {})
    await new Promise<string>((resolve, reject) => {
      let opened = false
      const offAccount = modal.subscribeAccount((acc) => {
        if (acc.isConnected && acc.address) {
          cleanup()
          resolve(acc.address)
        }
      }, 'solana')
      const offState = modal.subscribeState((st) => {
        if (st.open) opened = true
        else if (opened && !modal.getAddress('solana')) {
          cleanup()
          reject(new Error('Login was cancelled.'))
        }
      })
      const cleanup = () => {
        offAccount()
        offState()
      }
      modal.open({ view: social ? 'Connect' : 'AllWallets' }).catch((e: Error) => {
        cleanup()
        reject(e)
      })
    })
    await modal.close().catch(() => {})
  }

  const address = modal.getAddress('solana')
  if (!address) throw new Error('No Solana account connected.')
  const account = modal.getAccount('solana') as { embeddedWalletInfo?: { authProvider?: string } } | undefined
  const embedded = !!account?.embeddedWalletInfo
  const walletName = embedded ? `${account?.embeddedWalletInfo?.authProvider ?? 'Social'} login` : modal.getWalletInfo?.()?.name ?? 'WalletConnect'
  return {
    name: walletName,
    address,
    embedded,
    signMessage: (message) => signOverWalletConnect(modal, address, message),
    signTransaction: (tx) => signTransactionOverAppKit(modal, address, tx),
  }
}

type WcProvider = {
  signMessage?: (m: Uint8Array) => Promise<unknown>
  signTransaction?: (tx: unknown) => Promise<{ serialize(o?: object): Uint8Array }>
  request?: (args: { method: string; params: unknown }, chain?: string) => Promise<unknown>
  session?: { namespaces?: Record<string, { accounts?: string[] }> }
}

/** The exact Solana chain id the WalletConnect wallet approved (some still use the legacy mainnet id). */
function wcChain(p: WcProvider, address: string) {
  const accounts = p.session?.namespaces?.solana?.accounts
  const account = accounts?.find((a) => a.endsWith(address)) ?? accounts?.[0]
  return account ? account.split(':').slice(0, 2).join(':') : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
}

/** Message signing: the wallet app (or the in-page social wallet) asks the user to approve. */
export async function signOverWalletConnect(modal: AppKit, address: string, message: Uint8Array): Promise<Uint8Array> {
  const bs58 = (await import('bs58')).default
  const p = modal.getProvider<WcProvider>('solana')
  if (!p) throw new Error('Wallet session ended. Pick your login again.')
  let out: unknown
  if (typeof p.signMessage === 'function') {
    out = await p.signMessage(message)
  } else if (typeof p.request === 'function') {
    out = await p.request({ method: 'solana_signMessage', params: { message: bs58.encode(message), pubkey: address } }, wcChain(p, address))
  } else {
    throw new Error('This wallet can’t sign messages over WalletConnect.')
  }
  // Wallets answer with raw bytes, { signature: base58 } or { signature: bytes }.
  if (out instanceof Uint8Array) return out
  const sig = (out as { signature?: unknown })?.signature
  if (typeof sig === 'string') return bs58.decode(sig)
  if (sig instanceof Uint8Array) return sig
  if (Array.isArray(sig)) return Uint8Array.from(sig as number[])
  throw new Error('The wallet returned an unexpected signature.')
}

/** Transaction signing (no sending — our server broadcasts it). Returns the signed bytes. */
export async function signTransactionOverAppKit(modal: AppKit, address: string, tx: Uint8Array): Promise<Uint8Array> {
  const [{ Transaction, PublicKey }, bs58, { Buffer }] = await Promise.all([import('@solana/web3.js'), import('bs58').then((m) => m.default), import('buffer')])
  const p = modal.getProvider<WcProvider>('solana')
  if (!p) throw new Error('Wallet session ended. Pick your login again.')
  const transaction = Transaction.from(tx)
  if (typeof p.signTransaction === 'function') {
    // Social login wallet / wallet-standard wrappers take a Transaction object.
    const signed = await p.signTransaction(transaction)
    return new Uint8Array(signed.serialize({ requireAllSignatures: false, verifySignatures: false }))
  }
  if (typeof p.request !== 'function') throw new Error('This wallet can’t sign transactions over WalletConnect.')
  // Raw WalletConnect: base64 transaction in, signed transaction or signature out.
  const base64 = Buffer.from(tx).toString('base64')
  const out = (await p.request({ method: 'solana_signTransaction', params: { transaction: base64, pubkey: address } }, wcChain(p, address))) as {
    transaction?: string
    signature?: string
  }
  if (out?.transaction) {
    // base64 per the current spec; some wallets still answer base58.
    try {
      return new Uint8Array(Transaction.from(Buffer.from(out.transaction, 'base64')).serialize({ requireAllSignatures: false, verifySignatures: false }))
    } catch {
      return new Uint8Array(Transaction.from(bs58.decode(out.transaction)).serialize({ requireAllSignatures: false, verifySignatures: false }))
    }
  }
  if (out?.signature) {
    transaction.addSignature(new PublicKey(address), Buffer.from(bs58.decode(out.signature)))
    return new Uint8Array(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }))
  }
  throw new Error('The wallet didn’t return a signed transaction.')
}
