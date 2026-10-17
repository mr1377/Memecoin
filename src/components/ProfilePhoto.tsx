import clsx from 'clsx'
import NerdAvatar from './NerdAvatar'
import type { Profile } from '../lib/types'

/** Widths of the stored versions (see lib/photos.ts). */
const THUMB_W = 360
const FULL_W = 1080

/**
 * A profile photo, or the generated avatar when there's none.
 * `small` (avatars, list rows) loads only the ~20 KB thumbnail; otherwise the browser picks the
 * thumbnail or the full image for the space it's shown in.
 */
export default function ProfilePhoto({
  profile,
  index = 0,
  className,
  small,
  sizes = '(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw',
  eager,
}: {
  profile: Pick<Profile, 'photos' | 'avatar' | 'name'> & { thumbs?: string[] }
  index?: number
  className?: string
  small?: boolean
  sizes?: string
  eager?: boolean
}) {
  const full = profile.photos[index]
  const thumb = profile.thumbs?.[index]
  if (full) {
    const hasThumb = !!thumb && thumb !== full
    return (
      <img
        src={small && hasThumb ? thumb : full}
        srcSet={!small && hasThumb ? `${thumb} ${THUMB_W}w, ${full} ${FULL_W}w` : undefined}
        sizes={!small && hasThumb ? sizes : undefined}
        alt={profile.name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={clsx('object-cover', className)}
        draggable={false}
      />
    )
  }
  return (
    <div className={clsx('overflow-hidden', className)}>
      <NerdAvatar seed={index ? { ...profile.avatar, mood: (['happy', 'shock', 'smug'] as const)[index % 3] } : profile.avatar} className="h-full w-full" title={profile.name} />
    </div>
  )
}
