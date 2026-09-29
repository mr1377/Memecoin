import { getWallets } from '@wallet-standard/app'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { SolanaSignMessageFeature } from '@solana/wallet-standard-features'
import { useEffect, useState } from 'react'
import { connectViaWalletConnect, walletConnectEnabled } from './walletconnect'

/**
 * Solana wallet discovery via the Wallet Standard: every modern Solana wallet (Phantom, Solflare,
 * Backpack, Trust Wallet, Coinbase Wallet, OKX, Bitget, Exodus, Magic Eden, …) announces itself here,
 * so any installed wallet shows up automatically — no per-wallet code.
 */

export interface WalletOption {
  id: string
  name: string
  icon?: string
  installed: boolean
  /** Small caption under the name. */
  hint?: string
  /** Where to send people who don't have it (in-app browser on mobile, download page on desktop). */
  getUrl?: string
}

export interface ConnectedWallet {
  name: string
  address: string
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
}

type ConnectFeature = { 'standard:connect': { connect: () => Promise<{ accounts: readonly WalletAccount[] }> } }

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
const isAndroid = () => /Android/i.test(navigator.userAgent)

const MWA_NAME = 'Mobile Wallet Adapter'
const WC_ICON =
  'data:image/svg+xml;base64,' +
  btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#3396ff"/><path d="M12.2 15.6c4.3-4.2 11.3-4.2 15.6 0l.5.5a.5.5 0 0 1 0 .8l-1.8 1.7a.3.3 0 0 1-.4 0l-.7-.7a8 8 0 0 0-10.9 0l-.8.8a.3.3 0 0 1-.4 0l-1.8-1.8a.5.5 0 0 1 0-.8zm19.3 3.6 1.6 1.6a.5.5 0 0 1 0 .8l-7.1 7a.6.6 0 0 1-.8 0l-5-5a.1.1 0 0 0-.2 0l-5 5a.6.6 0 0 1-.8 0l-7.1-7a.5.5 0 0 1 0-.8l1.6-1.6a.6.6 0 0 1 .8 0l5 5a.1.1 0 0 0 .2 0l5-5a.6.6 0 0 1 .8 0l5 5a.1.1 0 0 0 .2 0l5-5a.6.6 0 0 1 .8 0z" fill="#fff"/></svg>')

/**
 * Android: register Solana's Mobile Wallet Adapter, so Phantom, Solflare, Backpack & co. open as
 * apps and return to the browser (no in-app browser detour). It appears as a normal wallet option.
 */
export async function registerMobileWalletAdapter() {
  if (!isAndroid()) return
  await new Promise((r) => setTimeout(r, 600)) // let injected wallets (wallet in-app browsers) announce first
  if (getWallets().get().some(isSolanaWallet)) return
  const m = await import('@solana-mobile/wallet-standard-mobile')
  m.registerMwa({
    appIdentity: { name: 'Nerdy Town', uri: window.location.origin, icon: 'favicon.svg' },
    authorizationCache: m.createDefaultAuthorizationCache(),
    chains: ['solana:mainnet'],
    chainSelector: m.createDefaultChainSelector(),
    onWalletNotFound: m.createDefaultWalletNotFoundHandler(),
  })
}
const here = () => encodeURIComponent(window.location.href)
const ref = () => encodeURIComponent(window.location.origin)

/** Popular wallets we suggest when they're not installed. */
const SUGGESTED: { name: string; mobile?: () => string; desktop: string; color: string }[] = [
  { name: 'Phantom', mobile: () => `https://phantom.app/ul/browse/${here()}?ref=${ref()}`, desktop: 'https://phantom.app/download', color: 'from-[#ab9ff2] to-[#534bb1]' },
  { name: 'Solflare', mobile: () => `https://solflare.com/ul/v1/browse/${here()}?ref=${ref()}`, desktop: 'https://solflare.com/download', color: 'from-[#ffc10b] to-[#fb3f2e]' },
  { name: 'Trust', mobile: () => `https://link.trustwallet.com/open_url?coin_id=501&url=${here()}`, desktop: 'https://trustwallet.com/browser-extension', color: 'from-[#0500ff] to-[#48ff91]' },
  { name: 'Backpack', desktop: 'https://backpack.app/download', color: 'from-[#e33e3f] to-[#a42b2c]' },
]
export const suggestedColor = (name: string) => SUGGESTED.find((s) => s.name === name)?.color ?? 'from-grape to-byte'

function isSolanaWallet(w: Wallet) {
  return w.chains.some((c) => c.startsWith('solana:')) && 'standard:connect' in w.features && 'solana:signMessage' in w.features
}

const sameWallet = (a: string, b: string) => a.toLowerCase().replace(/\s*wallet$/, '') === b.toLowerCase().replace(/\s*wallet$/, '')

function listOptions(): WalletOption[] {
  const installed = getWallets().get().filter(isSolanaWallet)
  const opts: WalletOption[] = installed.map((w) =>
    w.name === MWA_NAME
      ? { id: `std:${w.name}`, name: 'Wallet app', hint: 'Phantom, Solflare…', icon: w.icon, installed: true }
      : { id: `std:${w.name}`, name: w.name, icon: w.icon, installed: true },
  )
  const mobile = isMobile()
  if (walletConnectEnabled) opts.push({ id: 'walletconnect', name: 'WalletConnect', hint: mobile ? 'Trust, OKX, 300+' : 'Scan with phone', icon: WC_ICON, installed: true })
  for (const s of SUGGESTED) {
    if (opts.some((o) => sameWallet(o.name, s.name))) continue
    if (mobile) {
      // App-to-app flows (Mobile Wallet Adapter / WalletConnect) cover these; only fall back to
      // opening the site inside a wallet browser where nothing else works (Phantom on iPhone).
      if (walletConnectEnabled && s.name !== 'Phantom') continue
      if (isAndroid() && installed.some((w) => w.name === MWA_NAME)) continue
      if (!s.mobile) continue
      opts.push({ id: `get:${s.name}`, name: s.name, hint: 'Open in app', installed: false, getUrl: s.mobile() })
    } else {
      opts.push({ id: `get:${s.name}`, name: s.name, hint: 'Get', installed: false, getUrl: s.desktop })
    }
  }
  return opts
}

/** Live list of wallets: re-renders when a wallet extension finishes loading. */
export function useWalletOptions() {
  const [options, setOptions] = useState<WalletOption[]>(() => listOptions())
  useEffect(() => {
    const api = getWallets()
    const update = () => setOptions(listOptions())
    const offReg = api.on('register', update)
    const offUnreg = api.on('unregister', update)
    update()
    return () => {
      offReg()
      offUnreg()
    }
  }, [])
  return options
}

/** Connect to an installed wallet (or send the user to get it) and return a uniform signer. */
export async function connectWallet(option: WalletOption): Promise<ConnectedWallet> {
  if (option.id === 'walletconnect') return connectViaWalletConnect()
  if (!option.installed) {
    if (option.getUrl) {
      if (isMobile()) window.location.href = option.getUrl
      else window.open(option.getUrl, '_blank', 'noopener')
    }
    throw Object.assign(new Error(isMobile() ? `Opening ${option.name}…` : `${option.name} isn’t installed — opening the download page.`), { quiet: isMobile() })
  }
  const wallet = getWallets().get().find((w) => `std:${w.name}` === option.id)
  if (!wallet) throw new Error(`${option.name} is no longer available. Refresh the page and try again.`)
  let account: WalletAccount | undefined
  try {
    const { accounts } = await (wallet.features as unknown as ConnectFeature)['standard:connect'].connect()
    account = accounts.find((a) => a.chains.some((c) => c.startsWith('solana:'))) ?? accounts[0]
  } catch {
    throw new Error('Wallet connection was cancelled.')
  }
  if (!account) throw new Error(`No Solana account found in ${option.name}.`)
  const signFeature = (wallet.features as unknown as SolanaSignMessageFeature)['solana:signMessage']
  return {
    name: wallet.name,
    address: account.address,
    signMessage: async (message) => {
      const [out] = await signFeature.signMessage({ account: account!, message })
      return out.signature
    },
  }
}

/** Our database stores one of these labels; any other wallet is stored as "Other". */
export function providerLabel(name: string): 'Phantom' | 'Solflare' | 'Backpack' | 'Other' {
  for (const p of ['Phantom', 'Solflare', 'Backpack'] as const) if (sameWallet(name, p)) return p
  return 'Other'
}
