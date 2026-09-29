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
  photos: string[] // public URLs — empty means generated avatar
  photoPaths: string[] // storage paths backing `photos`
  avatar: AvatarSeed
  joinedAt: number
  rejectionsGiven: number
  rejectionsReceived: number
  accepts: number
  verified?: boolean
  isBot?: boolean
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

export interface Wallet {
  address: string
  provider: WalletProvider
}

export type WalletProvider = 'Phantom' | 'Solflare' | 'Backpack' | 'Other'

export interface LedgerEntry {
  id: string
  at: number
  kind: 'reject-reward' | 'buy-requests' | 'withdraw' | 'adjustment'
  amount: number
  note: string
  status: 'done' | 'requested' | 'processing' | 'sent' | 'failed' | 'rejected'
  txSig?: string | null
  wallet?: string | null
  userId?: string
}

export interface Settings {
  phase: 1 | 2
  bondingProgress: number
  freeDailyRequests: number
  rejectReward: number
  extraRequestCost: number
  minWithdraw: number
  tokenMint: string | null
  tokenDecimals: number
}

export interface Report {
  id: string
  reporter: string
  reported: string
  reason: string
  details: string
  resolved: boolean
  createdAt: number
}
