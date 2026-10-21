/**
 * Tells the pilgrim when something they asked to be told about opens.
 *
 * The bells in lib/openingSubscriptions record the wish. This is what
 * honours it: one watcher on the home parish's content, comparing the
 * closed list against the one it last saw, and a notification for every
 * watched item that has just come off it.
 *
 * ## Why it only watches one parish
 *
 * The same reason useMassScheduleNotice does. Content streams per
 * parish, so watching all thirty-one would mean thirty-one live
 * Firestore listeners on a phone, and somebody who tapped a bell on a
 * church they passed through once does not want it waking their screen
 * months later. A watch on another parish is kept and simply reported
 * the next time that parish is open on screen.
 *
 * ## Why the watch is dropped once it fires
 *
 * The pilgrim asked to be told when it opens. They have been told. A
 * watch that stayed would fire again on the next close-and-reopen,
 * which is a different question nobody asked.
 */
import { useEffect, useRef } from 'react'

import { closedIds } from './availability'
import { notifyNow, permissionState } from './deviceNotifications'
import { watchParishContent } from './parishContent'
import { isWatched, setWatched } from './openingSubscriptions'

function seenKey(parishId: string): string {
  return `sanctiwalk.closed.seen.${parishId}`
}

function readSeen(parishId: string): string[] | null {
  try {
    const raw = localStorage.getItem(seenKey(parishId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : null
  } catch {
    return null
  }
}

function writeSeen(parishId: string, ids: string[]): void {
  try {
    localStorage.setItem(seenKey(parishId), JSON.stringify(ids))
  } catch {
    /* private mode; it will compare again next time */
  }
}

/**
 * The ids that were closed and no longer are.
 *
 * `previous` being null is a first run: there is no "was closed" to
 * compare against, so nothing has opened yet and nothing is said. The
 * alternative is announcing every open ministry in the parish the first
 * time the app starts.
 */
export function newlyOpened(previous: string[] | null, current: string[]): string[] {
  if (previous === null) return []
  const nowClosed = new Set(current)
  return previous.filter(id => !nowClosed.has(id))
}

/** The words. Kept out of the effect so they can be tested. */
export function openedNotice(
  names: string[],
  parishName: string,
): { title: string; body: string } | null {
  if (names.length === 0) return null
  if (names.length === 1) {
    return {
      title: `${names[0]} is open`,
      body: `${parishName} is accepting applications for ${names[0]} again.`,
    }
  }
  return {
    title: 'Now open at your parish',
    body: `${parishName} has reopened ${names.join(', ')}.`,
  }
}

export function useOpeningNotices(
  parishId: string | null | undefined,
  parishName: string,
  /** Turns an id into something a person would recognise. */
  nameFor: (itemId: string) => string,
): void {
  // Both change render to render while the parish does not, and both
  // are only needed at the moment something is said.
  const latest = useRef({ parishName, nameFor })
  latest.current = { parishName, nameFor }

  useEffect(() => {
    if (!parishId) return
    let live = true

    const stop = watchParishContent(parishId, content => {
      if (!live) return

      const current = [...closedIds(content)].sort()
      const previous = readSeen(parishId)

      // Written before anything is sent. If the notification throws,
      // this state has still been seen and must not be reported twice.
      writeSeen(parishId, current)

      const opened = newlyOpened(previous, current).filter(id =>
        // A ministry nobody asked about opening is not news.
        isWatched({ kind: 'ministry', parishId, itemId: id }) ||
        isWatched({ kind: 'sacrament', parishId, itemId: id }),
      )
      if (opened.length === 0) return

      for (const id of opened) {
        setWatched({ kind: 'ministry', parishId, itemId: id }, false)
        setWatched({ kind: 'sacrament', parishId, itemId: id }, false)
      }

      const notice = openedNotice(
        opened.map(id => latest.current.nameFor(id)),
        latest.current.parishName,
      )
      if (!notice) return

      void (async () => {
        // Asked for by the bell, never demanded here.
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
