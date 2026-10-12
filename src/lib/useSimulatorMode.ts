import { useCallback, useEffect, useState } from 'react'
import {
  SIMULATOR_EVENT,
  SIMULATOR_KEY,
  loadSimulatorMode,
  saveSimulatorMode,
} from './simulatorMode'

/**
 * The simulator setting, shared across every screen that reads it.
 *
 * Same shape as useLanguage, and for the same reason: `storage` only
 * reaches other tabs, so without the custom event the Me screen would
 * update and the scanner would keep the old answer until a reload.
 */
export function useSimulatorMode(): {
  simulatorMode: boolean
  setSimulatorMode: (on: boolean) => void
} {
  const [simulatorMode, setState] = useState<boolean>(loadSimulatorMode)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== SIMULATOR_KEY) return
      setState(loadSimulatorMode())
    }
    const onLocal = () => setState(loadSimulatorMode())

    window.addEventListener('storage', onStorage)
    window.addEventListener(SIMULATOR_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SIMULATOR_EVENT, onLocal)
    }
  }, [])

  const setSimulatorMode = useCallback((on: boolean) => {
    saveSimulatorMode(on)
    setState(on)
  }, [])

  return { simulatorMode, setSimulatorMode }
}
