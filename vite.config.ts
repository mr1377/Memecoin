import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Accept whichever names the Supabase key ends up under: our own VITE_* names, or the ones the
// Vercel ⇄ Supabase integration adds automatically. Only the public URL and public (anon /
// publishable) key are exposed to the browser — never the service-role / secret key.
const pick = (...names: string[]) => names.map((n) => process.env[n]).find((v) => v && v.trim()) ?? ''
const supabaseUrl = pick('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
const supabaseKey = pick(
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
)

export default defineConfig({
  plugins: [react()],
  define: {
    __SUPABASE_URL__: JSON.stringify(supabaseUrl),
    __SUPABASE_KEY__: JSON.stringify(supabaseKey),
  },
})
