import clsx from 'clsx'
import NerdAvatar from './NerdAvatar'
import type { Profile } from '../lib/types'

export default function ProfilePhoto({ profile, index = 0, className }: { profile: Pick<Profile, 'photos' | 'avatar' | 'name'>; index?: number; className?: string }) {
  const src = profile.photos[index]
  if (src) return <img src={src} alt={profile.name} className={clsx('object-cover', className)} draggable={false} />
  return (
    <div className={clsx('overflow-hidden', className)}>
      <NerdAvatar seed={index ? { ...profile.avatar, mood: (['happy', 'shock', 'smug'] as const)[index % 3] } : profile.avatar} className="h-full w-full" title={profile.name} />
    </div>
  )
}
