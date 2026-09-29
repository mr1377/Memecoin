import { getWallets } from '@wallet-standard/app'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import type { SolanaSignMessageFeature } from '@solana/wallet-standard-features'
import { useEffect, useState } from 'react'

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
  const opts: WalletOption[] = installed.map((w) => ({ id: `std:${w.name}`, name: w.name, icon: w.icon, installed: true }))
  for (const s of SUGGESTED) {
    if (opts.some((o) => sameWallet(o.name, s.name))) continue
    const url = isMobile() ? s.mobile?.() ?? s.desktop : s.desktop
    opts.push({ id: `get:${s.name}`, name: s.name, installed: false, getUrl: url })
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
