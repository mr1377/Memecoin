import { Check, Copy, Lock, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

/** Scrambles digits like a movie hacker before landing on the real number. */
export function Scramble({ text, className, duration = 1100 }: { text: string; className?: string; duration?: number }) {
  const [out, setOut] = useState(text.replace(/\d/g, '0'))
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const run = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const settled = Math.floor(p * text.length)
      setOut(
        text
          .split('')
          .map((c, i) => (i < settled || !/\d/.test(c) ? c : String(Math.floor(Math.random() * 10))))
          .join(''),
      )
      if (p < 1) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [text, duration])
  return <span className={className}>{out}</span>
}

export function LockedPhone({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4', className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-white/50">
        <Lock className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="select-none font-mono text-lg font-bold tracking-wider text-white/70 blur-[5px]" aria-hidden>
          +1 (555) 000-0000
        </p>
        <p className="text-xs text-white/40">Phone number unlocks when they accept your request.</p>
      </div>
    </div>
  )
}

export default function PhoneReveal({ phone, className }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className={clsx('flex items-center gap-3 rounded-2xl border border-lime/30 bg-lime/10 p-4', className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime text-ink-950">
        <Phone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-lime">Number unlocked</p>
        <Scramble text={phone} className="font-mono text-lg font-bold" />
      </div>
      <button onClick={copy} className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Copy number">
        {copied ? <Check className="h-5 w-5 text-lime" /> : <Copy className="h-5 w-5" />}
      </button>
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="rounded-xl bg-lime p-2.5 text-ink-950 hover:brightness-110" aria-label="Call">
        <Phone className="h-5 w-5" />
      </a>
    </div>
  )
}
