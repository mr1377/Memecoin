import clsx from 'clsx'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ArrowLeft, BadgeCheck, Calendar, Check, Flame, HeartHandshake, MapPin, PencilLine, Send, Share2, Sparkles, Swords, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Page } from '../components/Layout'
import Modal from '../components/Modal'
import OutcomeModal from '../components/Outcome'
import PhoneReveal, { LockedPhone } from '../components/PhoneReveal'
import ProfilePhoto from '../components/ProfilePhoto'
import { useToast } from '../components/Toast'
import { api, dailyInfo, relationWith, revealedPhone, selectMe, useStore } from '../lib/store'
import type { Profile } from '../lib/types'
import NotFound from './NotFound'

function Gallery({ profile }: { profile: Profile }) {
  const count = Math.max(profile.photos.length, profile.photos.length ? 1 : 3)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const go = (n: number) => {
    const next = (n + count) % count
    setDir(next > i ? 1 : -1)
    setI(next)
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) go(i + 1)
    else if (info.offset.x > 60) go(i - 1)
  }
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10 bg-ink-800 shadow-glow">
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.div
          key={i}
          custom={dir}
          initial={{ x: `${dir * 100}%`, opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: `${-dir * 100}%`, opacity: 0.4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          drag={count > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={onDragEnd}
          className="absolute inset-0 touch-pan-y"
        >
          <ProfilePhoto profile={profile} index={i} className="pointer-events-none h-full w-full" />
        </motion.div>
      </AnimatePresence>
      {count > 1 && (
        <>
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {Array.from({ length: count }, (_, k) => (
              <button key={k} onClick={() => go(k)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25" aria-label={`Photo ${k + 1}`}>
                <motion.span className="block h-full bg-white" initial={false} animate={{ width: k <= i ? '100%' : '0%' }} />
              </button>
            ))}
          </div>
          <button className="absolute inset-y-0 left-0 w-1/4" onClick={() => go(i - 1)} aria-label="Previous photo" />
          <button className="absolute inset-y-0 right-0 w-1/4" onClick={() => go(i + 1)} aria-label="Next photo" />
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, value, label, tone }: { icon: typeof Flame; value: number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center sm:p-4">
      <Icon className={clsx('mx-auto h-4 w-4', tone)} />
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
      <p className="text-[11px] leading-tight text-white/50">{label}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const s = useStore((x) => x)
  const me = useStore(selectMe)
  const profile = s.profiles[id]
  const rel = relationWith(s, id)
  const phone = revealedPhone(s, id)
  const [confirm, setConfirm] = useState(false)
  const [outcome, setOutcome] = useState<null | 'accepted' | 'rejected'>(null)
  const prevStatus = useRef(rel?.status)

  // Celebrate when a request we sent gets answered while we're watching.
  useEffect(() => {
    if (rel && rel.from === s.session && prevStatus.current === 'pending' && rel.status !== 'pending') {
      setOutcome(rel.status)
      api.markSeen([rel.id])
    }
    prevStatus.current = rel?.status
  }, [rel, s.session])

  if (!profile) return <NotFound />

  const isMe = s.session === id
  const daily = me ? dailyInfo(s, me.id) : null
  const back = () => ((loc.key !== 'default' ? nav(-1) : nav('/explore')))

  const send = () => {
    try {
      api.sendRequest(id)
      setConfirm(false)
      toast('info', 'Request sent! 🚀', `${profile.name.split(' ')[0]} is thinking about it…`)
    } catch (e) {
      setConfirm(false)
      toast('error', (e as Error).message)
    }
  }
  const respond = (st: 'accepted' | 'rejected') => {
    if (!rel) return
    api.respond(rel.id, st)
    toast(st === 'accepted' ? 'success' : 'info', st === 'accepted' ? 'Accepted! They now have your number.' : 'Rejected. You just made them more popular 😇')
  }
  const share = async () => {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: `${profile.name} on Nerdy Town`, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('success', 'Profile link copied')
      }
    } catch {
      /* dismissed */
    }
  }

  // ---- primary action
  let action: JSX.Element
  if (isMe) {
    action = (
      <Link to="/onboarding" className="btn-ghost w-full py-4">
        <PencilLine className="h-5 w-5" /> Edit my profile
      </Link>
    )
  } else if (!s.session) {
    action = (
      <Link to={`/signup?next=/u/${id}`} className="btn-primary w-full py-4 text-base">
        <Send className="h-5 w-5" /> Join to send request
      </Link>
    )
  } else if (!me) {
    action = (
      <Link to="/onboarding" className="btn-primary w-full py-4 text-base">
        Finish your profile to send requests
      </Link>
    )
  } else if (rel && rel.to === me.id && rel.status === 'pending') {
    action = (
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => respond('rejected')} className="btn w-full border-2 border-rizz/50 bg-rizz/10 py-4 text-rizz hover:bg-rizz/20">
          <X className="h-5 w-5" /> Reject
        </button>
        <button onClick={() => respond('accepted')} className="btn w-full border-2 border-ink-950 bg-lime py-4 text-ink-950 shadow-pop active:shadow-none">
          <Check className="h-5 w-5" /> Accept
        </button>
      </div>
    )
  } else if (rel?.status === 'pending') {
    action = (
      <div className="btn w-full cursor-default border border-byte/30 bg-byte/10 py-4 text-byte">
        Request pending
        <span className="flex gap-1">
          {[0, 1, 2].map((k) => (
            <motion.span key={k} className="h-1.5 w-1.5 rounded-full bg-byte" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: k * 0.2 }} />
          ))}
        </span>
      </div>
    )
  } else if (rel?.status === 'accepted') {
    action = <div className="btn w-full cursor-default border border-lime/30 bg-lime/10 py-4 text-lime"><HeartHandshake className="h-5 w-5" /> You’re matched</div>
  } else if (rel?.status === 'rejected') {
    action = (
      <div className="btn w-full cursor-default border border-rizz/30 bg-rizz/10 py-4 text-rizz">
        <Flame className="h-5 w-5" /> {rel.from === me.id ? 'They passed · +1 popularity' : 'You passed on them'}
      </div>
    )
  } else {
    action = (
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setConfirm(true)} className="btn-primary w-full py-4 text-base">
        <Send className="h-5 w-5" /> Send partner request
        {daily && <span className="ml-1 rounded-full bg-ink-950/15 px-2 py-0.5 font-mono text-xs">{daily.left}/{daily.limit}</span>}
      </motion.button>
    )
  }

  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-4 !pb-48 sm:px-6 md:pt-8 md:!pb-16">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={back} className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-2 pl-2 pr-4 text-sm font-semibold hover:bg-white/10">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 transition group-hover:-translate-x-0.5">
            <ArrowLeft className="h-4 w-4" />
          </span>
          Back to search
        </button>
        <button onClick={share} className="rounded-full border border-white/10 bg-white/5 p-2.5 hover:bg-white/10" aria-label="Share profile">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10">
        <div className="md:sticky md:top-24 md:self-start">
          <Gallery profile={profile} />
        </div>

        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-carrot/40 bg-carrot/10 text-carrot">
                <Sparkles className="h-3.5 w-3.5" /> {profile.nerdClass}
              </span>
              {profile.verified && (
                <span className="chip border-byte/40 bg-byte/10 text-byte">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified nerd
                </span>
              )}
            </div>
            <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">
              {profile.name}
              <span className="ml-3 font-normal text-white/40">{profile.age}</span>
            </h1>
            <p className="mt-3 text-lg italic text-white/70">“{profile.tagline}”</p>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
              <span>{profile.gender}{profile.pronouns && ` · ${profile.pronouns}`}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {profile.city}{!isMe && ` · ${profile.distanceKm < 1 ? '<1' : Math.round(profile.distanceKm)} km`}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Joined {joined}</span>
            </div>
          </motion.div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={Flame} value={profile.rejectionsReceived} label="Popularity" tone="text-rizz" />
            <Stat icon={HeartHandshake} value={profile.accepts} label="Matches" tone="text-lime" />
            <Stat icon={Swords} value={profile.rejectionsGiven} label="Hearts broken" tone="text-grape-300" />
          </div>

          <div className="mt-6 hidden md:block">{action}</div>

          <section className="card mt-6 p-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-white/50">About</h2>
            <p className="mt-3 leading-relaxed text-white/85">{profile.bio}</p>
            <h3 className="mt-6 font-mono text-xs uppercase tracking-widest text-white/50">Interests</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.interests.map((t, k) => (
                <motion.span key={t} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + k * 0.05 }} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
                  {t}
                </motion.span>
              ))}
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-white/40">Looking for</dt>
                <dd className="mt-1 font-semibold">{profile.lookingFor}</dd>
              </div>
              <div>
                <dt className="text-white/40">Nerd class</dt>
                <dd className="mt-1 font-semibold">{profile.nerdClass}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-white/50">Contact</h2>
            {isMe ? (
              <PhoneReveal phone={profile.phone} />
            ) : phone ? (
              <PhoneReveal phone={phone} />
            ) : (
              <LockedPhone />
            )}
          </section>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-[68px] z-40 border-t border-white/10 bg-ink-900/85 p-3 backdrop-blur-xl md:hidden">{action}</div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Send request">
        <div className="text-center">
          <ProfilePhoto profile={profile} className="mx-auto h-24 w-24 rounded-3xl" />
          <h2 className="mt-4 text-2xl font-bold">Shoot your shot with {profile.name.split(' ')[0]}?</h2>
          <p className="mt-2 text-white/60">If they accept, you get their number. If they reject, you get popularity{s.phase === 2 ? ' and $NERDY' : ''}. You literally can’t lose.</p>
          {daily && (
            <p className="mt-4 font-mono text-sm text-white/50">
              Uses 1 of your <b className="text-carrot">{daily.left}</b> remaining request{daily.left === 1 ? '' : 's'} today
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => setConfirm(false)} className="btn-ghost">Not yet</button>
            <button onClick={send} className="btn-primary" disabled={!daily?.left}>
              <Send className="h-4 w-4" /> Send it
            </button>
          </div>
          {daily && !daily.left && (
            <p className="mt-4 text-sm text-rizz">
              Out of requests. {s.phase === 2 ? <Link to="/dashboard" className="underline">Buy more with $NERDY</Link> : 'They reset at midnight UTC.'}
            </p>
          )}
        </div>
      </Modal>

      {me && outcome && <OutcomeModal open={!!outcome} onClose={() => setOutcome(null)} status={outcome} other={profile} me={me} phase={s.phase} />}
    </Page>
  )
}
