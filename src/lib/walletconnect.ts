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

interface SolanaProvider {
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
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

  const provider = modal.getProvider<SolanaProvider>('solana')
  if (!provider) throw new Error('Wallet connected, but no Solana account was shared.')
  const walletName = (modal.getWalletInfo?.()?.name as string | undefined) ?? 'WalletConnect'
  return {
    name: walletName,
    address,
    signMessage: (message) => provider.signMessage(message),
  }
}
