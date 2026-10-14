/**
 * The signed-in user's id, as a value a component can re-render on.
 *
 * `auth.currentUser` is a snapshot: read it during render and the
 * component never hears about signing in, so the scanner would keep
 * showing "sign in to scan" to somebody who just had. This subscribes,
 * which is the difference between a value and a reading.
 */
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

export function useAuthUid(): string | null {
  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null)

  useEffect(() => onAuthStateChanged(auth, user => setUid(user?.uid ?? null)), [])

  return uid
}
