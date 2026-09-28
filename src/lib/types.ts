export type Gender = 'Man' | 'Woman' | 'Non-binary' | 'Other'

export type NerdClass =
  | 'Code Wizard'
  | 'Math Olympian'
  | 'Lore Keeper'
  | 'Speedrunner'
  | 'Lab Rat'
  | 'Chess Goblin'
  | 'Anime Scholar'
  | 'Crypto Degen'

export interface AvatarSeed {
  hair: string
  skin: string
  bg: [string, string]
  glasses: 'square' | 'round' | 'thick'
  frame: string
  hairStyle: 'swoop' | 'spiky' | 'bowl' | 'curly' | 'long'
  teeth: 'buck' | 'one' | 'grin'
  freckles: boolean
  mood: 'smug' | 'shock' | 'happy'
}

export interface Profile {
  id: string
  name: string
  age: number
  gender: Gender
  lookingFor: Gender | 'Everyone'
  city: string
  nerdClass: NerdClass
  tagline: string
  bio: string
  interests: string[]
  photos: string[] // data URLs (uploads) — empty means generated avatar
  avatar: AvatarSeed
  socials: Social[] // private until accepted
  joinedAt: number
  rejectionsGiven: number
  rejectionsReceived: number
  accepts: number
  verified?: boolean
}

export type SocialPlatform = 'Instagram' | 'X' | 'Telegram' | 'Snapchat' | 'Discord' | 'TikTok' | 'WhatsApp' | 'Email'

export interface Social {
  platform: SocialPlatform
  handle: string
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected'

export interface PartnerRequest {
  id: string
  from: string
  to: string
  status: RequestStatus
  createdAt: number
  resolvedAt?: number
  seen?: boolean
}

export interface Account {
  id: string // same as profile id
  email: string
  passHash: string
  createdAt: number
  hasProfile: boolean
}

export interface Wallet {
  address: string
  provider: 'Phantom' | 'Solflare' | 'Backpack'
}

export interface LedgerEntry {
  id: string
  at: number
  kind: 'reject-reward' | 'buy-requests' | 'withdraw' | 'airdrop'
  amount: number
  note: string
}
