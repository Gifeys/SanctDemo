import { useCallback, useEffect, useState } from "react";
import {
  LANGUAGE_EVENT, LANGUAGE_KEY, loadLanguage, saveLanguage, type Language,
} from "./language";

/**
 * The reader's language, shared across every screen.
 *
 * ## Why a storage listener and not a context
 *
 * A context would mean a provider wrapping the app and a prop drilled
 * into the rosary's iframe, which is same-origin and keeps its own copy
 * of this setting in localStorage. Both sides already agree through
 * that key; listening to `storage` means changing the language in the
 * rosary updates the app and the other way round, with nothing between
 * them to keep in sync.
 *
 * The `storage` event does not fire in the tab that made the change, so
 * the setter updates local state itself.
 */
export function useLanguage(): {
  language: Language;
  setLanguage: (next: Language) => void;
} {
  const [language, setLanguageState] = useState<Language>(loadLanguage);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // A null key means the whole store was cleared.
      if (e.key !== null && e.key !== LANGUAGE_KEY) return;
      setLanguageState(loadLanguage());
    };
    // `storage` reaches other tabs; the custom event reaches the other
    // hooks in this one. Both are needed: without the first the rosary
    // iframe and the app drift apart, without the second the tab bar
    // and Sancti's button keep the old language until a reload.
    const onLocal = () => setLanguageState(loadLanguage());

    window.addEventListener("storage", onStorage);
    window.addEventListener(LANGUAGE_EVENT, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LANGUAGE_EVENT, onLocal);
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    saveLanguage(next);
    setLanguageState(next);
  }, []);

  return { language, setLanguage };
}
