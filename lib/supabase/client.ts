import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  SUPABASE_KEY.length > 100 // real anon keys are ~200 chars

/**
 * Creates a Supabase browser client.
 * Falls back to a dummy URL when not configured so the app
 * doesn't crash on import — auth calls will fail gracefully.
 */
export const createClient = () => {
  return createBrowserClient(
    isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
    isSupabaseConfigured ? SUPABASE_KEY : 'placeholder-key'
  )
}
