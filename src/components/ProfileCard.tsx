import clsx from 'clsx'
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion'
import { BadgeCheck, Flame, MapPin } from 'lucide-react'
import type { PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import type { PartnerRequest, Profile } from '../lib/types'
import ProfilePhoto from './ProfilePhoto'

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-byte text-ink-950' },
  accepted: { label: 'Matched', cls: 'bg-lime text-ink-950' },
  rejected: { label: 'Took the L', cls: 'bg-rizz text-ink-950' },
  incoming: { label: 'Wants you!', cls: 'bg-carrot text-ink-950' },
}

export default function ProfileCard({ profile, relation, me, index = 0 }: { profile: Profile; relation?: PartnerRequest | null; me?: string | null; index?: number }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 250, damping: 20 })
  const ry = useSpring(useMotionValue(0), { stiffness: 250, damping: 20 })
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  const shine = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,.22), transparent 55%)`

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    ry.set((x - 0.5) * 14)
    rx.set(-(y - 0.5) * 14)
    gx.set(x * 100)
    gy.set(y * 100)
  }
  const onLeave = () => {
    rx.set(0)
    ry.set(0)
  }

  const statusKey = relation ? (relation.from === me ? relation.status : relation.status === 'pending' ? 'incoming' : relation.status) : null
  const st = statusKey ? STATUS[statusKey] : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.45, delay: Math.min(index, 12) * 0.035, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 900 }}
    >
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }} onPointerMove={onMove} onPointerLeave={onLeave} whileTap={{ scale: 0.97 }}>
        <Link
          to={`/u/${profile.id}`}
          className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-ink-800 shadow-lg transition-shadow hover:shadow-glow"
          aria-label={`${profile.name}, ${profile.age}. ${profile.tagline}`}
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            <ProfilePhoto profile={profile} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
            <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: shine }} />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />

            <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2">
              <span className="flex items-center gap-1 rounded-full bg-ink-950/70 px-2 py-1 font-mono text-[10px] font-bold text-rizz-300 backdrop-blur" title="Popularity (rejections received)">
                <Flame className="h-3 w-3" /> {profile.rejectionsReceived}
              </span>
              {st && <span className={clsx('rounded-full px-2 py-1 text-[10px] font-bold uppercase shadow', st.cls)}>{st.label}</span>}
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4" style={{ transform: 'translateZ(30px)' }}>
              <p className="flex items-center gap-1 font-display text-lg font-bold leading-tight sm:text-xl">
                <span className="truncate">{profile.name.split(' ')[0]}</span>
                <span className="font-normal text-white/60">{profile.age}</span>
                {profile.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-byte" aria-label="Verified" />}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-white/70 sm:text-sm">{profile.interests.slice(0, 3).join(' · ')}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/45">
                <MapPin className="h-3 w-3" /> {profile.distanceKm < 1 ? '<1' : Math.round(profile.distanceKm)} km · {profile.nerdClass}
              </p>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  )
}

export function ProfileCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/5">
      <div className="skeleton aspect-[3/4]" />
    </div>
  )
}
