import type { ConnectedWallet } from './wallets'

/**
 * WalletConnect (Reown AppKit) for Solana: the user stays in their normal browser, picks a wallet,
 * the wallet app opens to approve, then they're sent back. On desktop it shows a QR code.
 * Loaded lazily — the library is large and only needed when someone taps the button.
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
        features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false },
        themeMode: 'dark',
        themeVariables: { '--w3m-accent': '#ff7a1a', '--w3m-border-radius-master': '4px', '--w3m-z-index': 1000 },
      })
    })()
  }
  return kit
}

/** Opens the WalletConnect modal and resolves once a Solana wallet is connected. */
export async function connectViaWalletConnect(): Promise<ConnectedWallet> {
  if (!walletConnectEnabled) throw new Error('WalletConnect isn’t set up yet.')
  const modal = await getKit()

  // Start fresh so the user can pick any wallet, not a stale session from last time.
  if (modal.getAddress('solana')) await modal.disconnect('solana').catch(() => {})

  const address = await new Promise<string>((resolve, reject) => {
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
        reject(new Error('Wallet connection was cancelled.'))
      }
    })
    const cleanup = () => {
      offAccount()
      offState()
    }
    modal.open({ view: 'Connect' }).catch((e: Error) => {
      cleanup()
      reject(e)
    })
  })
  await modal.close().catch(() => {})

  const walletName = modal.getWalletInfo?.()?.name ?? 'WalletConnect'
  return {
    name: walletName,
    address,
    signMessage: (message) => signOverWalletConnect(modal, address, message),
  }
}

type WcProvider = {
  signMessage?: (m: Uint8Array) => Promise<unknown>
  request?: (args: { method: string; params: unknown }, chain?: string) => Promise<unknown>
  session?: { namespaces?: Record<string, { accounts?: string[] }> }
}

/** WalletConnect's Solana message-signing RPC. The wallet app opens to approve (deep link on phones). */
export async function signOverWalletConnect(modal: AppKit, address: string, message: Uint8Array): Promise<Uint8Array> {
  const bs58 = (await import('bs58')).default
  const p = modal.getProvider<WcProvider>('solana')
  if (!p) throw new Error('WalletConnect session ended. Pick your wallet again.')
  let out: unknown
  if (typeof p.signMessage === 'function') {
    out = await p.signMessage(message)
  } else if (typeof p.request === 'function') {
    // Use the exact Solana chain id the wallet approved (some wallets still use the legacy mainnet id).
    const account = p.session?.namespaces?.solana?.accounts?.find((a) => a.endsWith(address)) ?? p.session?.namespaces?.solana?.accounts?.[0]
    const chain = account ? account.split(':').slice(0, 2).join(':') : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    out = await p.request({ method: 'solana_signMessage', params: { message: bs58.encode(message), pubkey: address } }, chain)
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
