import type { Social, SocialPlatform } from './types'

export const PLATFORMS: { id: SocialPlatform; color: string; placeholder: string }[] = [
  { id: 'Instagram', color: 'from-[#f58529] via-[#dd2a7b] to-[#8134af]', placeholder: '@yourhandle' },
  { id: 'X', color: 'from-[#333] to-[#000]', placeholder: '@yourhandle' },
  { id: 'Telegram', color: 'from-[#2aabee] to-[#229ed9]', placeholder: '@yourhandle' },
  { id: 'Snapchat', color: 'from-[#fffc00] to-[#f5d800]', placeholder: 'yourusername' },
  { id: 'Discord', color: 'from-[#5865f2] to-[#4752c4]', placeholder: 'username' },
  { id: 'TikTok', color: 'from-[#25f4ee] via-[#000] to-[#fe2c55]', placeholder: '@yourhandle' },
  { id: 'WhatsApp', color: 'from-[#25d366] to-[#128c7e]', placeholder: '+1 555 123 4567' },
  { id: 'Email', color: 'from-[#ff7a1a] to-[#ff4d8d]', placeholder: 'you@example.com' },
]

export const platformInfo = (id: SocialPlatform) => PLATFORMS.find((p) => p.id === id)!

const strip = (h: string) => h.trim().replace(/^@/, '')

/** Deep link for a social handle, or null when the platform has no public profile URL (Discord). */
export function socialUrl({ platform, handle }: Social): string | null {
  const h = encodeURIComponent(strip(handle))
  switch (platform) {
    case 'Instagram':
      return `https://instagram.com/${h}`
    case 'X':
      return `https://x.com/${h}`
    case 'Telegram':
      return `https://t.me/${h}`
    case 'Snapchat':
      return `https://snapchat.com/add/${h}`
    case 'TikTok':
      return `https://tiktok.com/@${h}`
    case 'WhatsApp':
      return `https://wa.me/${handle.replace(/\D/g, '')}`
    case 'Email':
      return `mailto:${handle.trim()}`
    default:
      return null
  }
}

export function validateSocial({ platform, handle }: Social): string | null {
  const h = handle.trim()
  if (!h) return 'Enter your handle.'
  if (platform === 'Email' && !/^\S+@\S+\.\S+$/.test(h)) return 'That email looks glitched.'
  if (platform === 'WhatsApp' && h.replace(/\D/g, '').length < 7) return 'Enter a number with country code.'
  if (platform !== 'Email' && platform !== 'WhatsApp' && !/^@?[\w.\-#]{2,40}$/.test(h)) return 'Letters, numbers, dots and underscores only.'
  return null
}

export const displayHandle = ({ platform, handle }: Social) =>
  platform === 'Email' || platform === 'WhatsApp' || platform === 'Discord' ? handle.trim() : '@' + strip(handle)
