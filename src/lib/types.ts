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


export interface LedgerEntry {
  id: string
  at: number
  kind: 'revenue-share' | 'reject-reward' | 'buy-requests' | 'withdraw' | 'adjustment' | 'lock-return' | 'unlock'
  amount: number
  note: string
  status: 'done' | 'requested' | 'processing' | 'sent' | 'failed' | 'rejected'
  txSig?: string | null
  wallet?: string | null
  userId?: string
}

export interface Settings {
  phase: 1 | 2
  freeDailyRequests: number
  /** Phase 2 starts by itself once this many verified residents exist. */
  realUserGoal: number
  phase2At: number | null
  /** $NERDY to lock for the verified badge (needed to send / answer requests). */
  verifyLockAmount: number
  extraRequestCost: number
  minWithdraw: number
  tokenMint: string | null
  tokenDecimals: number
}

/** The monthly revenue-share pool (see supabase/schema.sql: revenue_status). */
export interface RevenueStatus {
  /** First day of the current month, YYYY-MM-DD (UTC). */
  month: string
  pool: number
  rejections: number
  recipients: number
  /** My Phase 2 rejections this month. */
  mine: number
  last: { month: string; pool: number; rejections: number; recipients: number; paid: number; carried: number } | null
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
