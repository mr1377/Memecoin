import { useEffect, useRef, useState } from 'react'
import NerdAvatar from './NerdAvatar'
import type { AvatarSeed } from '../lib/types'

export const MASCOT: AvatarSeed = {
  hair: '#ff6a1a',
  skin: '#ffd9b8',
  bg: ['#8b5cf6', '#22d3ee'],
  glasses: 'square',
  frame: '#8a1c2b',
  hairStyle: 'swoop',
  teeth: 'one',
  freckles: true,
  mood: 'smug',
}

/** Mr. Nerdy: eyes follow the cursor (or device tilt), blinks at random, gasps when poked. */
export default function Mascot({ className, bg = false }: { className?: string; bg?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [blink, setBlink] = useState(false)
  const [mood, setMood] = useState<AvatarSeed['mood']>('smug')

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2.2)
      const d = Math.max(1, Math.hypot(dx, dy))
      const k = Math.min(1, d / 300)
      setLook({ x: (dx / d) * k, y: (dy / d) * k })
    }
    window.addEventListener('pointermove', onMove)
    let t: number
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 140)
        loop()
      }, 2200 + Math.random() * 3200)
    }
    loop()
    return () => {
      window.removeEventListener('pointermove', onMove)
      clearTimeout(t)
    }
  }, [])

  const poke = () => {
    setMood('shock')
    window.setTimeout(() => setMood('happy'), 700)
    window.setTimeout(() => setMood('smug'), 1800)
  }

  return (
    <div ref={ref} className={className} onPointerDown={poke} role="presentation">
      <NerdAvatar seed={MASCOT} look={look} blink={blink} mood={mood} bg={bg} title="Mr. Nerdy, mayor of Nerdy Town" className="h-full w-full" />
    </div>
  )
}
