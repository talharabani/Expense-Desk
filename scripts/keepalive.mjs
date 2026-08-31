#!/usr/bin/env node
/**
 * Keeps a free-tier Supabase project from pausing.
 *
 * Free projects pause after 7 days without database activity, and unpausing is
 * manual — so the app is down until someone notices. This reads a single row
 * from the `health_check` table, which is enough activity to reset that clock.
 *
 * Run it from a schedule (see .github/workflows/keepalive.yml) or by hand:
 *
 *   npm run keepalive
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, falling
 * back to SUPABASE_URL / SUPABASE_ANON_KEY so the same script works in CI
 * without the Next.js-specific names. The anon key is deliberate: this needs no
 * more privilege than a page load, so there is no reason to hand a scheduled
 * job the service role key.
 *
 * Exits 0 on success and 1 on failure, so a scheduled run turns red — a ping
 * that fails silently is worse than no ping at all.
 *
 * Sets `process.exitCode` rather than calling `process.exit()`. Exiting while a
 * fetch handle is still open aborts the Node process on Windows with
 * "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and an exit code of
 * 127 — which a successful ping would then report as a failure.
 */

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ''
).trim()

/** Overridable so the ping can be pointed elsewhere without editing the script. */
const TABLE = (process.env.KEEPALIVE_TABLE ?? 'health_check').trim()
const TIMEOUT_MS = 15_000
const ATTEMPTS = 3
/** A paused project can take a while to answer, so back off rather than give up. */
const BACKOFF_MS = [0, 5_000, 20_000]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function configError() {
  if (!url) return 'NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is not set'
  if (!key) return 'NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) is not set'
  if (!url.startsWith('https://')) return `URL should start with https:// — got ${url.slice(0, 12)}...`
  return null
}

async function ping(endpoint, attempt) {
  const started = Date.now()
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const elapsed = Date.now() - started
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} after ${elapsed}ms — ${body.slice(0, 200)}`)
  }

  let rows
  try {
    rows = JSON.parse(body)
  } catch {
    throw new Error(`response was not JSON: ${body.slice(0, 120)}`)
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      `table "${TABLE}" returned no rows. Run the health_check migration, and check its SELECT policy.`
    )
  }

  console.log(`keepalive: ok — ${TABLE} answered in ${elapsed}ms (attempt ${attempt})`)
}

async function main() {
  const problem = configError()
  if (problem) {
    console.error(`keepalive: ${problem}`)
    process.exitCode = 1
    return
  }

  // select=id keeps the response to a couple of bytes; limit=1 stops a future
  // table from being read in full by accident.
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${TABLE}?select=id&limit=1`

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      if (BACKOFF_MS[attempt - 1]) await sleep(BACKOFF_MS[attempt - 1])
      await ping(endpoint, attempt)
      process.exitCode = 0
      return
    } catch (error) {
      const reason = error?.cause?.code ?? error?.name ?? ''
      const detail = `${error.message}${reason ? ` (${reason})` : ''}`
      if (attempt === ATTEMPTS) {
        console.error(`keepalive: all ${ATTEMPTS} attempts failed — ${detail}`)
        process.exitCode = 1
        return
      }
      console.warn(`keepalive: attempt ${attempt} failed — ${detail}; retrying`)
    }
  }
}

await main()
