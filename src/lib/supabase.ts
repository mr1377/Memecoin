import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// A placeholder client keeps imports safe when env vars are missing; the app shows a setup screen instead.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const PHOTO_BUCKET = 'photos'
export const photoUrl = (path: string) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
