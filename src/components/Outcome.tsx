import { motion } from 'framer-motion'
import { Coins, Flame } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Gamepad2 } from 'lucide-react'
import type { Profile } from '../lib/types'
import AnimatedNumber from './AnimatedNumber'
import { confetti } from './Confetti'
import Modal from './Modal'
import NerdAvatar from './NerdAvatar'
import SocialsReveal from './SocialsReveal'
import ProfilePhoto from './ProfilePhoto'
import { MASCOT } from './Mascot'

interface Props {
  open: boolean
  onClose: () => void
  status: 'accepted' | 'rejected'
  other: Profile
  me: Profile
  phase: 1 | 2
}

export default function OutcomeModal({ open, onClose, status, other, me, phase }: Props) {
  const reward = useStore((s) => s.settings.rejectReward)
  const socials = useStore((s) => s.contacts[other.id])
  const paid = phase === 2 && !other.isBot
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (status === 'accepted') confetti({ y: innerHeight * 0.35, emoji: ['💬', '💘', '🤓', '✨'] })
      else confetti({ y: innerHeight * 0.35, count: 90, colors: ['#ff4d8d', '#ff7a1a', '#8b5cf6', '#fff'], emoji: ['🏆', '🔥', '🤓'] })
    }, 250)
    return () => clearTimeout(t)
  }, [open, status])

  return (
    <Modal open={open} onClose={onClose} title={status === 'accepted' ? 'Request accepted' : 'Request rejected'}>
      <div className="text-center">
        <div className="relative mx-auto flex h-28 w-48 items-center justify-center">
          <motion.div initial={{ x: 40, rotate: 10 }} animate={{ x: -28, rotate: -8 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} className="absolute h-24 w-24 overflow-hidden rounded-3xl border-4 border-ink-800 shadow-xl">
            <ProfilePhoto profile={me} className="h-full w-full" />
          </motion.div>
          <motion.div initial={{ x: -40, rotate: -10 }} animate={{ x: 28, rotate: 8 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} className="absolute h-24 w-24 overflow-hidden rounded-3xl border-4 border-ink-800 shadow-xl">
            <ProfilePhoto profile={other} className="h-full w-full" />
          </motion.div>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 400, damping: 12 }}
            className={`absolute -bottom-3 z-10 grid h-12 w-12 place-items-center rounded-full border-4 border-ink-800 text-2xl ${status === 'accepted' ? 'bg-lime' : 'bg-rizz'}`}
          >
            {status === 'accepted' ? '💘' : '🏆'}
          </motion.span>
        </div>

        {status === 'accepted' ? (
          <>
            <h2 className="mt-8 text-3xl font-extrabold">
              {other.name.split(' ')[0]} said <span className="text-lime">yes!</span>
            </h2>
            <p className="mt-2 text-white/60">Their socials are yours. Slide in. Be cool. (You won’t be. That’s fine.)</p>
            {other.isBot ? (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-white/70">
                <Gamepad2 className="h-6 w-6 shrink-0 text-grape-300" />
                {other.name.split(' ')[0]} is a Nerdy Town NPC — a built-in resident — so there are no socials to reveal. Real residents share theirs when they accept.
              </div>
            ) : socials ? (
              <SocialsReveal socials={socials} className="mt-6 text-left" />
            ) : (
              <p className="mt-6 text-sm text-white/50">Loading their socials…</p>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-8 text-3xl font-extrabold">
              Rejected. <span className="text-gradient">Still a W.</span>
            </h2>
            <p className="mt-2 text-white/60">{other.name.split(' ')[0]} passed — and your legend grew.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-rizz/30 bg-rizz/10 p-4">
                <Flame className="mx-auto h-5 w-5 text-rizz" />
                <p className="mt-1 font-display text-3xl font-extrabold">
                  <AnimatedNumber value={me.rejectionsReceived} />
                </p>
                <p className="text-xs text-white/50">Popularity (+1)</p>
              </div>
              <div className={`rounded-2xl border p-4 ${paid ? 'border-carrot/30 bg-carrot/10' : 'border-white/10 bg-white/5'}`}>
                <Coins className={`mx-auto h-5 w-5 ${paid ? 'text-carrot' : 'text-white/30'}`} />
                <p className="mt-1 font-display text-3xl font-extrabold">{paid ? `+${reward}` : '🔒'}</p>
                <p className="text-xs text-white/50">{paid ? '$NERDY earned' : phase === 2 ? 'NPCs don’t pay $NERDY' : 'Tokens unlock in Phase 2'}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-left text-sm text-white/60">
              <NerdAvatar seed={MASCOT} bg={false} mood="happy" className="h-12 w-12 shrink-0" />
              “Rejection is just data, champ. And data is beautiful.” — Mr. Nerdy
            </div>
          </>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link to="/dashboard" onClick={onClose} className="btn-ghost">
            Dashboard
          </Link>
          <Link to="/explore" onClick={onClose} className="btn-primary">
            Keep exploring
          </Link>
        </div>
      </div>
    </Modal>
  )
}
