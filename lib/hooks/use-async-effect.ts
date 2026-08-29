'use client'

import { useEffect } from 'react'

/**
 * Runs an async loader once the effect for `run` commits, and again whenever
 * `run` changes identity.
 *
 * Loaders update state after their request resolves. Scheduling them on a
 * microtask keeps those updates out of the synchronous effect body, which is
 * what `react-hooks/set-state-in-effect` guards against, and the `active` flag
 * stops a loader from firing at all if the component unmounts first.
 *
 * Pass a `useCallback`-memoised loader so the effect does not re-run on every
 * render.
 */
export function useAsyncEffect(run: () => Promise<unknown>) {
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) return run()
    })
    return () => {
      active = false
    }
  }, [run])
}
