/**
 * Android's hardware Back button, behaving the way Android expects.
 *
 * ## What it did before
 *
 * Nothing handled it, so Capacitor's default ran: the WebView had no
 * page history to go back through - the whole app is one page with tab
 * state - so Back quit the application outright. Somebody three screens
 * into the Sacraments list, or reading a station, pressed Back once and
 * lost the app.
 *
 * ## What Back should do, in order
 *
 * 1. Close whatever is covering the screen - a modal, the search sheet,
 *    the tutorial. The thing on top goes first, which is what Back
 *    means everywhere else on the phone.
 * 2. Otherwise step back to Home, because every other tab is somewhere
 *    the pilgrim navigated TO.
 * 3. Only on Home, with nothing open, does Back leave - and even then it
 *    MINIMISES rather than exits, so the app is still where they left it
 *    when they come back to it. Android's own Home button behaves this
 *    way and people expect the same from Back at the root.
 *
 * ## Why a list of closers rather than a router
 *
 * The app's screens are state, not routes, so there is no history stack
 * to pop. The caller passes what is currently open, innermost first, and
 * this walks the list. That keeps the knowledge of what "back" means in
 * App.tsx, where the state lives, rather than inventing a second source
 * of truth about which screen is on top.
 */
import { useEffect, useRef } from 'react'

/**
 * One thing Back can dismiss.
 *
 * `when` is evaluated at the moment Back is pressed, not when the hook
 * runs, so a stale closure cannot close a modal that is no longer open.
 */
export interface BackStep {
  when: boolean
  close: () => void
}

export function useAndroidBack(
  steps: BackStep[],
  /** True when the pilgrim is already at the root of the app. */
  atRoot: boolean,
  /** Step back one level. Not called at the root. */
  goHome: () => void,
): void {
  // The caller builds a fresh steps array on every render, so these go
  // in a ref and the listener is registered ONCE. Putting them in the
  // dependency list instead would tear the native listener down and
  // rebuild it on every keystroke anywhere in the app, and a Back press
  // landing in that gap would do nothing at all.
  const latest = useRef({ steps, atRoot, goHome })
  latest.current = { steps, atRoot, goHome }

  useEffect(() => {
    let detach: (() => void) | null = null
    let cancelled = false

    void (async () => {
      // Imported here rather than at the top of the file so a browser,
      // where there is no Back button and no Capacitor bridge, never
      // pays for the plugin at all.
      let CapApp: typeof import('@capacitor/app').App
      let Capacitor: typeof import('@capacitor/core').Capacitor
      try {
        ;({ App: CapApp } = await import('@capacitor/app'))
        ;({ Capacitor } = await import('@capacitor/core'))
      } catch {
        return
      }

      try {
        if (!Capacitor.isNativePlatform()) return
      } catch {
        return
      }

      const handle = await CapApp.addListener('backButton', () => {
        const now = latest.current

        // Innermost first. Whatever is covering the screen goes before
        // anything else moves.
        for (const step of now.steps) {
          if (step.when) {
            step.close()
            return
          }
        }

        if (!now.atRoot) {
          now.goHome()
          return
        }

        // At the root with nothing open. Minimise rather than exit, so
        // coming back finds the app where it was left.
        void CapApp.minimizeApp()
      })

      if (cancelled) {
        void handle.remove()
        return
      }
      detach = () => void handle.remove()
    })()

    return () => {
      cancelled = true
      if (detach) detach()
    }
    // Registered once. The handler reads the current state through the
    // ref above, so it is never stale and never re-registered.
  }, [])
}
