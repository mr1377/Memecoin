import { createClient } from '@supabase/supabase-js'

// Injected at build time by vite.config.ts (supports our VITE_* names and the Vercel integration's names).
declare const __SUPABASE_URL__: string
declare const __SUPABASE_KEY__: string
const url = __SUPABASE_URL__ || undefined
const key = __SUPABASE_KEY__ || undefined

export const isConfigured = Boolean(url && key)

// A placeholder client keeps imports safe when env vars are missing; the app shows a setup screen instead.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const PHOTO_BUCKET = 'photos'
export const photoUrl = (path: string) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
