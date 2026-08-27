import { createBrowserClient } from '@supabase/ssr'
import { createSafeFetch, readSupabaseEnv } from './env'

const { url: SUPABASE_URL, key: SUPABASE_KEY, isConfigured } = readSupabaseEnv()

export const isSupabaseConfigured = isConfigured

/**
 * Creates a Supabase browser client.
 * Falls back to a dummy URL when not configured so the app
 * doesn't crash on import — auth calls will fail gracefully.
 */
export const createClient = () => {
  return createBrowserClient(
    isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
    isSupabaseConfigured ? SUPABASE_KEY : 'placeholder-key',
    { global: { fetch: createSafeFetch() } }
  )
}
