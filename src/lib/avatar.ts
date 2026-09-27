import type { AvatarSeed } from './types'

const HAIR = ['#ff6a1a', '#d9480f', '#6b3e26', '#2b1d14', '#f2c14e', '#e8e1d9', '#8b5cf6', '#22d3ee', '#ff4d8d', '#111']
const SKIN = ['#ffd9b8', '#f6c79d', '#e7a978', '#c68657', '#9a6440', '#6e4428']
const BGS: [string, string][] = [
  ['#8b5cf6', '#22d3ee'],
  ['#ff7a1a', '#ff4d8d'],
  ['#1e1b4b', '#7c3aed'],
  ['#0ea5e9', '#b6f23a'],
  ['#ff4d8d', '#8b5cf6'],
  ['#14532d', '#b6f23a'],
  ['#f59e0b', '#ef4444'],
  ['#312e81', '#ff7a1a'],
]
const FRAMES = ['#7f1d1d', '#1e3a8a', '#111827', '#9d174d', '#065f46', '#b45309', '#1f2937']

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function seedAvatar(key: string): AvatarSeed {
  const r = rng(hashString(key))
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  return {
    hair: pick(HAIR),
    skin: pick(SKIN),
    bg: pick(BGS),
    glasses: pick(['square', 'round', 'thick'] as const),
    frame: pick(FRAMES),
    hairStyle: pick(['swoop', 'spiky', 'bowl', 'curly', 'long'] as const),
    teeth: pick(['buck', 'one', 'grin'] as const),
    freckles: r() > 0.45,
    mood: pick(['smug', 'shock', 'happy'] as const),
  }
}

export const AVATAR_OPTIONS = { HAIR, SKIN, BGS, FRAMES }
