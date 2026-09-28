import clsx from 'clsx'
import { motion } from 'framer-motion'
import { Check, Copy, ExternalLink, Ghost, Gamepad2, Instagram, Lock, Mail, MessageCircle, Music2, Send, Twitter, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { displayHandle, platformInfo, socialUrl } from '../lib/socials'
import type { Social, SocialPlatform } from '../lib/types'

const ICONS: Record<SocialPlatform, LucideIcon> = {
  Instagram,
  X: Twitter,
  Telegram: Send,
  Snapchat: Ghost,
  Discord: Gamepad2,
  TikTok: Music2,
  WhatsApp: MessageCircle,
  Email: Mail,
}

export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const Icon = ICONS[platform]
  return (
    <span className={clsx('grid shrink-0 place-items-center rounded-xl bg-gradient-to-br', platformInfo(platform).color, platform === 'Snapchat' ? 'text-ink-950' : 'text-white', className ?? 'h-10 w-10')}>
      <Icon className="h-[55%] w-[55%]" />
    </span>
  )
}

/** Scrambles characters like a movie hacker before landing on the real text. */
export function Scramble({ text, className, duration = 1000 }: { text: string; className?: string; duration?: number }) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const start = performance.now()
    let raf = 0
    const run = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const settled = Math.floor(p * text.length)
      setOut(
        text
          .split('')
          .map((c, i) => (i < settled || !/[a-z0-9]/i.test(c) ? c : chars[Math.floor(Math.random() * chars.length)]))
          .join(''),
      )
      if (p < 1) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [text, duration])
  return <span className={className}>{out}</span>
}

export function LockedSocials({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4', className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-white/50">
        <Lock className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="select-none font-mono text-lg font-bold tracking-wider text-white/70 blur-[5px]" aria-hidden>
          @secret.handle
        </p>
        <p className="text-xs text-white/40">Socials unlock when they accept your request.</p>
      </div>
    </div>
  )
}

function SocialRow({ social, delay }: { social: Social; delay: number }) {
  const [copied, setCopied] = useState(false)
  const text = displayHandle(social)
  const url = socialUrl(social)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <motion.li initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }} className="flex items-center gap-3">
      <SocialIcon platform={social.platform} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{social.platform}</p>
        <Scramble text={text} className="block truncate font-mono font-bold" />
      </div>
      <button onClick={copy} className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label={`Copy ${social.platform}`}>
        {copied ? <Check className="h-5 w-5 text-lime" /> : <Copy className="h-5 w-5" />}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-lime p-2.5 text-ink-950 hover:brightness-110" aria-label={`Open ${social.platform}`}>
          <ExternalLink className="h-5 w-5" />
        </a>
      )}
    </motion.li>
  )
}

export default function SocialsReveal({ socials, className, label = 'Socials unlocked' }: { socials: Social[]; className?: string; label?: string }) {
  return (
    <div className={clsx('rounded-2xl border border-lime/30 bg-lime/10 p-4', className)}>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-lime">{label}</p>
      <ul className="space-y-3">
        {socials.map((s, i) => (
          <SocialRow key={s.platform + s.handle} social={s} delay={i * 0.08} />
        ))}
      </ul>
    </div>
  )
}
