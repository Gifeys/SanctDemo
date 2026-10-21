/**
 * Watches the home parish's Mass schedule and tells the phone when it
 * moves.
 *
 * The rules live in massScheduleWatch.ts and are tested there; this is
 * only the plumbing — subscribe, compare against what was last seen,
 * and hand the words to the notification layer.
 *
 * Only the HOME parish. Somebody browsing another parish is reading,
 * not planning to attend, and a notification about a church they
 * looked at once is spam.
 */
import { useEffect, useRef } from 'react'

import { notifyNow, permissionState } from './deviceNotifications'
import { watchParishContent } from './parishContent'
import {
  classifyMassChange,
  massDiff,
  massFingerprint,
  massFingerprintKey,
  massNotice,
  nextStoredFingerprint,
} from './massScheduleWatch'

function readSeen(parishId: string): string | null {
  try {
    return localStorage.getItem(massFingerprintKey(parishId))
  } catch {
    // Private mode. Without a baseline every change reads as
    // first-seen, which says nothing — the quiet failure, not the
    // noisy one.
    return null
  }
}

function writeSeen(parishId: string, value: string): void {
  try {
    localStorage.setItem(massFingerprintKey(parishId), value)
  } catch {
    /* nothing to do; it will simply compare again next time */
  }
}

export function useMassScheduleNotice(
  parishId: string | null | undefined,
  parishName: string,
): void {
  // The name can change render to render while the parish does not, and
  // it is only needed at the moment something is said.
  const name = useRef(parishName)
  name.current = parishName

  useEffect(() => {
    if (!parishId) return

    let live = true

    const stop = watchParishContent(parishId, content => {
      if (!live) return

      const current = massFingerprint(content?.massSchedule)
      const previous = readSeen(parishId)
      const change = classifyMassChange(previous, current)

      // Written before the notification is sent, not after. If the
      // send throws, the user has still seen this state and should not
      // be told about it again on the next snapshot.
      writeSeen(parishId, nextStoredFingerprint(current))

      // What moved, so the notice can name the Mass rather than
      // saying only that something changed.
      const notice = massNotice(change, name.current, massDiff(previous, current))
      if (!notice) return

      void (async () => {
        // Asked for, never demanded. Somebody who has not granted
        // notifications gets nothing rather than a permission prompt
        // in the middle of reading about a parish.
        if ((await permissionState()) !== 'granted') return
        await notifyNow(notice.title, notice.body)
      })()
    })

    return () => {
      live = false
      stop()
    }
  }, [parishId])
}
