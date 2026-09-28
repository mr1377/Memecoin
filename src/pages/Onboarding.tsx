import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Dices, ImagePlus, Loader2, Lock, LogOut, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confetti } from '../components/Confetti'
import { Page } from '../components/Layout'
import NerdAvatar from '../components/NerdAvatar'
import ProfilePhoto from '../components/ProfilePhoto'
import { useToast } from '../components/Toast'
import { AVATAR_OPTIONS, seedAvatar } from '../lib/avatar'
import { api, selectMe, uid, useStore } from '../lib/store'
import type { AvatarSeed, Gender, NerdClass, Profile, Social } from '../lib/types'
import { PLATFORMS, platformInfo, validateSocial } from '../lib/socials'
import { SocialIcon } from '../components/SocialsReveal'

const GENDERS: Gender[] = ['Man', 'Woman', 'Non-binary', 'Other']
const LOOKING: Profile['lookingFor'][] = ['Woman', 'Man', 'Non-binary', 'Everyone']
const CLASSES: { id: NerdClass; emoji: string }[] = [
  { id: 'Code Wizard', emoji: '🧙' },
  { id: 'Math Olympian', emoji: '📐' },
  { id: 'Lore Keeper', emoji: '📜' },
  { id: 'Speedrunner', emoji: '🎮' },
  { id: 'Lab Rat', emoji: '🧪' },
  { id: 'Chess Goblin', emoji: '♟️' },
  { id: 'Anime Scholar', emoji: '🍥' },
  { id: 'Crypto Degen', emoji: '📈' },
]
const SUGGESTED = ['Programming', 'D&D', 'Anime', 'Chess', 'Sci-fi', 'Math', 'Board games', 'Retro games', 'Space', 'Linux', 'Cosplay', 'Physics', 'Manga', 'Lego', 'Crypto', 'Books', 'Coffee', 'Robotics']
const STEPS = ['Basics', 'Photos', 'Vibe', 'Private']

async function resizeImage(file: File, max = 720): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.78)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function Seg<T extends string>({ options, value, onChange, name }: { options: readonly T[]; value: T; onChange: (v: T) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o}
          key={o}
          onClick={() => onChange(o)}
          className={clsx('relative rounded-2xl px-4 py-2.5 text-sm font-semibold transition', value === o ? 'text-ink-950' : 'border border-white/10 bg-white/5 text-white/70 hover:text-white')}
        >
          {value === o && <motion.span layoutId={`seg-${name}`} className="absolute inset-0 rounded-2xl bg-carrot" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  )
}

function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {error ? <p className="mt-1.5 text-xs text-rizz">{error}</p> : hint && <p className="mt-1.5 text-xs text-white/40">{hint}</p>}
    </div>
  )
}

export default function Onboarding() {
  const existing = useStore(selectMe)
  const nav = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const editing = !!existing
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    age: existing?.age ? String(existing.age) : '',
    gender: existing?.gender ?? ('Man' as Gender),
    lookingFor: existing?.lookingFor ?? ('Everyone' as Profile['lookingFor']),
    photos: existing?.photos ?? ([] as string[]),
    avatar: existing?.avatar ?? seedAvatar(uid()),
    nerdClass: existing?.nerdClass ?? ('Code Wizard' as NerdClass),
    tagline: existing?.tagline ?? '',
    bio: existing?.bio ?? '',
    interests: existing?.interests ?? ([] as string[]),
    socials: existing?.socials ?? ([] as Social[]),
    city: existing?.city ?? '',
  }))
  const [tagDraft, setTagDraft] = useState('')
  const up = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const setAvatar = (patch: Partial<AvatarSeed>) => up('avatar', { ...form.avatar, ...patch })

  const validate = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (form.name.trim().length < 2) e.name = 'What should the town call you?'
      const age = Number(form.age)
      if (!Number.isInteger(age) || age < 18) e.age = 'Nerdy Town is 18+ only.'
      else if (age > 99) e.age = 'Respectfully, no.'
    }
    if (s === 2) {
      if (form.tagline.trim().length < 3) e.tagline = 'Give us a one-liner.'
      if (form.bio.trim().length < 20) e.bio = 'At least 20 characters. Nerd out a little.'
      if (form.interests.length < 1) e.interests = 'Pick at least one interest.'
    }
    if (s === 3) {
      if (!form.socials.length) e.socials = 'Add at least one way to reach you.'
      for (const so of form.socials) {
        const err = validateSocial(so)
        if (err) e[`social-${so.platform}`] = err
      }
      if (form.city.trim().length < 2) e.city = 'Which town do you haunt?'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const go = (n: number) => {
    if (n > step && !validate(step)) return
    setDir(n > step ? 1 : -1)
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const finish = async () => {
    if (!validate(3)) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 600))
    try {
      api.saveProfile({
        name: form.name.trim(),
        age: Number(form.age),
        gender: form.gender,
        lookingFor: form.lookingFor,
        photos: form.photos,
        avatar: form.avatar,
        nerdClass: form.nerdClass,
        tagline: form.tagline.trim(),
        bio: form.bio.trim(),
        interests: form.interests,
        socials: form.socials.map((so) => ({ ...so, handle: so.handle.trim() })),
        city: form.city.trim(),
      })
      confetti({ emoji: ['🤓', '🎉', '👓'] })
      toast('win', editing ? 'Profile updated.' : 'You’re officially a resident!', editing ? undefined : 'Check your dashboard — you already have admirers.')
      nav(editing ? '/dashboard' : params.get('next') || '/dashboard', { replace: true })
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const room = 4 - form.photos.length
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room)
    try {
      const urls = await Promise.all(picked.map((f) => resizeImage(f)))
      up('photos', [...form.photos, ...urls])
    } catch {
      toast('error', 'Could not read that image.')
    }
  }

  const addTag = (t: string) => {
    t = t.trim()
    if (!t || form.interests.includes(t) || form.interests.length >= 6) return
    up('interests', [...form.interests, t])
    setTagDraft('')
  }

  const preview = {
    ...form,
    name: form.name || 'Your Name',
    photos: form.photos,
  }

  const steps: ReactNode[] = [
    // Basics
    <div key="0" className="space-y-6">
      <Field label="Display name" error={errors.name}>
        <input className="input" value={form.name} onChange={(e) => up('name', e.target.value)} placeholder="Ada Lovelace" maxLength={40} autoComplete="name" />
      </Field>
      <Field label="Age" error={errors.age}>
        <input className="input max-w-[140px]" inputMode="numeric" value={form.age} onChange={(e) => up('age', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="24" />
      </Field>
      <Field label="Gender">
        <Seg name="gender" options={GENDERS} value={form.gender} onChange={(v) => up('gender', v)} />
      </Field>
      <Field label="Interested in">
        <Seg name="looking" options={LOOKING} value={form.lookingFor} onChange={(v) => up('lookingFor', v)} />
      </Field>
    </div>,

    // Photos
    <div key="1" className="space-y-6">
      <Field label="Your photos" hint="Up to 4. First photo is your cover. No photos? Your generated nerd becomes your face.">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {form.photos.map((p, i) => (
            <motion.div layout key={p.slice(-24) + i} className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10">
              <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-carrot px-2 py-0.5 text-[10px] font-bold text-ink-950">Cover</span>}
              <button type="button" onClick={() => up('photos', form.photos.filter((_, k) => k !== i))} className="absolute right-1.5 top-1.5 rounded-full bg-ink-950/80 p-1.5 text-white/80 hover:text-rizz" aria-label="Remove photo">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
          {form.photos.length < 4 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onFiles(e.dataTransfer.files)
              }}
              className="grid aspect-[3/4] place-items-center rounded-2xl border-2 border-dashed border-white/15 text-white/40 transition hover:border-carrot hover:text-carrot"
            >
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <ImagePlus className="h-6 w-6" /> Add
              </span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </Field>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="label !mb-0">Generate your inner nerd</p>
          <motion.button type="button" whileTap={{ rotate: 180, scale: 0.9 }} onClick={() => up('avatar', seedAvatar(uid()))} className="chip border-grape/40 bg-grape/10 text-grape-300">
            <Dices className="h-4 w-4" /> Shuffle
          </motion.button>
        </div>
        <div className="mt-4 flex gap-4">
          <motion.div key={JSON.stringify(form.avatar)} initial={{ scale: 0.9, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl sm:h-32 sm:w-32">
            <NerdAvatar seed={form.avatar} className="h-full w-full" />
          </motion.div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] text-white/40">Hair</p>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_OPTIONS.HAIR.map((c) => (
                  <button type="button" key={c} onClick={() => setAvatar({ hair: c })} style={{ background: c }} className={clsx('h-6 w-6 rounded-full border-2 transition', form.avatar.hair === c ? 'scale-110 border-white' : 'border-transparent')} aria-label={`Hair ${c}`} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] text-white/40">Skin</p>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_OPTIONS.SKIN.map((c) => (
                  <button type="button" key={c} onClick={() => setAvatar({ skin: c })} style={{ background: c }} className={clsx('h-6 w-6 rounded-full border-2 transition', form.avatar.skin === c ? 'scale-110 border-white' : 'border-transparent')} aria-label={`Skin ${c}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          {(
            [
              ['hairStyle', ['swoop', 'spiky', 'bowl', 'curly', 'long']],
              ['glasses', ['square', 'round', 'thick']],
              ['teeth', ['buck', 'one', 'grin']],
            ] as const
          ).map(([k, opts]) => (
            <button
              type="button"
              key={k}
              onClick={() => {
                const list = opts as readonly string[]
                const cur = list.indexOf(form.avatar[k] as string)
                setAvatar({ [k]: list[(cur + 1) % list.length] } as Partial<AvatarSeed>)
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 font-semibold capitalize hover:border-carrot/50"
            >
              {k === 'hairStyle' ? 'Hair' : k}: <span className="text-carrot">{form.avatar[k] as string}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Vibe
    <div key="2" className="space-y-6">
      <Field label="Nerd class">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CLASSES.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => up('nerdClass', c.id)}
              className={clsx('rounded-2xl border p-3 text-left transition', form.nerdClass === c.id ? 'border-carrot bg-carrot/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25')}
            >
              <span className="text-2xl">{c.emoji}</span>
              <p className="mt-1 text-xs font-semibold">{c.id}</p>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Tagline" error={errors.tagline} hint={`${form.tagline.length}/60`}>
        <input className="input" value={form.tagline} onChange={(e) => up('tagline', e.target.value.slice(0, 60))} placeholder="Will debug your heart in O(1)." />
      </Field>
      <Field label="About you" error={errors.bio} hint={`${form.bio.length}/300`}>
        <textarea className="input min-h-[120px] resize-none" value={form.bio} onChange={(e) => up('bio', e.target.value.slice(0, 300))} placeholder="What makes you gloriously nerdy?" />
      </Field>
      <Field label={`Interests (${form.interests.length}/6)`} error={errors.interests}>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {form.interests.map((t) => (
              <motion.button
                type="button"
                layout
                key={t}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={() => up('interests', form.interests.filter((x) => x !== t))}
                className="flex items-center gap-1 rounded-full bg-carrot px-3 py-1.5 text-sm font-semibold text-ink-950"
              >
                {t} <X className="h-3.5 w-3.5" />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <div className="relative mt-3">
          <input
            className="input pr-12"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value.slice(0, 24))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(tagDraft)
              }
            }}
            placeholder="Add your own…"
            disabled={form.interests.length >= 6}
          />
          <button type="button" onClick={() => addTag(tagDraft)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label="Add interest">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTED.filter((t) => !form.interests.includes(t)).map((t) => (
            <button type="button" key={t} onClick={() => addTag(t)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:border-carrot/50 hover:text-white">
              + {t}
            </button>
          ))}
        </div>
      </Field>
    </div>,

    // Private
    <div key="3" className="space-y-6">
      <div className="flex gap-3 rounded-2xl border border-byte/30 bg-byte/10 p-4 text-sm">
        <Lock className="h-5 w-5 shrink-0 text-byte" />
        <p className="text-white/80">
          Your socials are <b>never shown publicly</b>. They’re revealed only to a person whose request <b>you accept</b>.
        </p>
      </div>
      <Field label={`Your socials (${form.socials.length}/5)`} error={errors.socials} hint="Tap the platforms you use, then add your handle.">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ id }) => {
            const on = form.socials.some((so) => so.platform === id)
            return (
              <button
                type="button"
                key={id}
                aria-pressed={on}
                onClick={() => {
                  if (on) up('socials', form.socials.filter((so) => so.platform !== id))
                  else if (form.socials.length < 5) up('socials', [...form.socials, { platform: id, handle: '' }])
                }}
                className={clsx('flex items-center gap-2 rounded-2xl border py-1.5 pl-1.5 pr-3 text-sm font-semibold transition', on ? 'border-carrot bg-carrot/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white')}
              >
                <SocialIcon platform={id} className="h-7 w-7 rounded-lg" />
                {id}
                {on && <Check className="h-3.5 w-3.5 text-carrot" />}
              </button>
            )
          })}
        </div>
        <AnimatePresence initial={false}>
          {form.socials.map((so, i) => (
            <motion.div key={so.platform} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-center gap-3 pt-3">
                <SocialIcon platform={so.platform} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <input
                    className="input font-mono"
                    value={so.handle}
                    aria-label={`${so.platform} handle`}
                    type={so.platform === 'Email' ? 'email' : so.platform === 'WhatsApp' ? 'tel' : 'text'}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={60}
                    placeholder={platformInfo(so.platform).placeholder}
                    onChange={(e) => {
                      const next = [...form.socials]
                      next[i] = { ...so, handle: e.target.value }
                      up('socials', next)
                      setErrors((er) => ({ ...er, [`social-${so.platform}`]: '' }))
                    }}
                  />
                  {errors[`social-${so.platform}`] && <p className="mt-1 text-xs text-rizz">{errors[`social-${so.platform}`]}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </Field>
      <Field label="City" error={errors.city}>
        <input className="input" value={form.city} onChange={(e) => up('city', e.target.value)} placeholder="Brooklyn, NY" autoComplete="address-level2" maxLength={40} />
      </Field>
    </div>,
  ]

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 md:pt-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-carrot">{editing ? 'Edit profile' : 'Create your profile'}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{['Who are you, nerd?', 'Show us the glasses.', 'What’s your vibe?', 'The private stuff.'][step]}</h1>
        </div>
        <button
          onClick={() => {
            api.logout()
            nav('/')
          }}
          className="chip shrink-0 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>

      {/* progress */}
      <div className="mt-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => i < step && go(i)} disabled={i > step} className="text-left">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full bg-carrot" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
            </div>
            <p className={clsx('mt-2 flex items-center gap-1 text-xs font-semibold', i <= step ? 'text-white' : 'text-white/30')}>
              {i < step && <Check className="h-3 w-3 text-carrot" />} {s}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden p-5 sm:p-8">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 40 }} transition={{ duration: 0.25 }}>
              {steps[step]}
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex items-center justify-between gap-3">
            <button onClick={() => go(step - 1)} className={clsx('btn-ghost', !step && 'invisible')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < 3 ? (
              <button onClick={() => go(step + 1)} className="btn-primary">
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={finish} disabled={busy} className="btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editing ? 'Save changes' : 'Move in'}
              </button>
            )}
          </div>
        </div>

        {/* live preview */}
        <aside className="hidden lg:block">
          <p className="label">Live preview</p>
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-white/10 bg-ink-800 shadow-glow">
            <div className="relative aspect-[3/4]">
              <ProfilePhoto profile={preview} className="h-full w-full" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent p-4 pt-20">
                <p className="font-display text-2xl font-bold">
                  {preview.name.split(' ')[0]} <span className="font-normal text-white/50">{form.age}</span>
                </p>
                <p className="text-sm text-white/70">{form.interests.slice(0, 3).join(' · ') || 'Your interests'}</p>
                <p className="mt-1 text-xs text-carrot">{form.nerdClass}</p>
              </div>
            </div>
            <p className="p-4 text-sm italic text-white/60">“{form.tagline || 'Your tagline goes here.'}”</p>
          </div>
        </aside>
      </div>
    </Page>
  )
}
