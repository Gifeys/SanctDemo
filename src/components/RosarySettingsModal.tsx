import React, { useEffect, useState } from "react";
import { X, Languages, Sparkles, Music } from "lucide-react";
import {
  RosaryLanguage,
  RosaryMysterySet,
  RosaryMusic,
  RosarySettings,
  ROSARY_SETTINGS_KEY,
  loadRosarySettings,
  saveRosarySettings,
  parseRosarySettingsEventValue,
} from "../lib/rosarySettings";

interface RosarySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MYSTERY_OPTIONS: { key: RosaryMysterySet; label: string }[] = [
  { key: "today", label: "Today's Mystery" },
  { key: "joyful", label: "Joyful" },
  { key: "sorrowful", label: "Sorrowful" },
  { key: "glorious", label: "Glorious" },
  { key: "luminous", label: "Luminous" },
];

// Kept in sync with public/rosary/index.html via the shared
// `sanctiwalk.rosary.settings` localStorage key (see src/lib/rosarySettings.ts).
// Both this modal and the rosary iframe read on mount, write on change, and
// listen for the `storage` event so a change made in one place is reflected
// live in the other, without any postMessage bridge.
export default function RosarySettingsModal({ isOpen, onClose }: RosarySettingsModalProps) {
  const [settings, setSettings] = useState<RosarySettings>(() => loadRosarySettings());

  // Pick up whatever is in storage each time the modal opens (e.g. changed
  // from the rosary tab while this modal was closed).
  useEffect(() => {
    if (isOpen) setSettings(loadRosarySettings());
  }, [isOpen]);

  // Live sync: reflect changes made elsewhere (the rosary iframe, or this
  // same app open in another tab) while the modal is open. The `storage`
  // event never fires in the context that made the change, so the setters
  // below also apply the change directly at the point of interaction.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== ROSARY_SETTINGS_KEY) return;
      setSettings(parseRosarySettingsEventValue(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Functional updates: two settings changes made in quick succession (e.g.
  // the same click handler, or React 18 batching two synthetic events into
  // one render) must not have the second overwrite the first by spreading
  // a stale `settings` closure.
  function updateSettings(updater: (prev: RosarySettings) => RosarySettings) {
    setSettings((prev) => {
      const next = updater(prev);
      saveRosarySettings(next);
      return next;
    });
  }

  function setLanguage(language: RosaryLanguage) {
    updateSettings((prev) => ({ ...prev, language }));
  }

  function setMysterySet(mysterySet: RosaryMysterySet) {
    updateSettings((prev) => ({ ...prev, mysterySet }));
  }

  function setMusic(music: RosaryMusic) {
    updateSettings((prev) => ({ ...prev, music }));
  }

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-5 bg-black/60 transition-opacity duration-300 ease-out"
      onClick={onClose}
    >
      {/* Height-safe: the card is capped at the overlay and split into a
          header that stays and a body that scrolls. Without the cap a card
          taller than the screen was centred, so it overflowed equally at
          both ends and carried its own close button off the top - and
          nothing scrolled, so there was no way to reach it or to shut the
          modal except by guessing that the backdrop closes it. It happened
          on any short viewport: a rotated phone, a small one, or a tall
          card with the keyboard up. */}
      <div
        className="w-full max-w-sm max-h-full flex flex-col rounded-2xl border border-[var(--color-brand-on-accent)]/30 bg-[var(--color-brand-primary)] text-white shadow-2xl transition-all duration-300 ease-out font-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
          <h2 className="text-base font-bold tracking-tight font-primary">Rosary Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close rosary settings"
            className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Language */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <Languages className="w-3.5 h-3.5" />
              <span>Language</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLanguage("en")}
                className={`min-h-11 rounded-xl border text-base font-bold transition-colors duration-300 ${
                  settings.language === "en"
                    ? "bg-[var(--color-brand-primary-dark)] border-[var(--color-brand-on-accent)]/80 text-white shadow-[0_0_20px_rgba(24,134,160,0.4)]"
                    : "bg-transparent border-white/25 text-white/90 hover:bg-white/5"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("fil")}
                className={`min-h-11 rounded-xl border text-base font-bold transition-colors duration-300 ${
                  settings.language === "fil"
                    ? "bg-[var(--color-brand-primary-dark)] border-[var(--color-brand-on-accent)]/80 text-white shadow-[0_0_20px_rgba(24,134,160,0.4)]"
                    : "bg-transparent border-white/25 text-white/90 hover:bg-white/5"
                }`}
              >
                Filipino
              </button>
            </div>
          </div>

          {/* Mystery */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mystery</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MYSTERY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMysterySet(opt.key)}
                  className={`min-h-11 px-2 py-2 rounded-xl border text-base font-bold transition-colors duration-300 ${
                    opt.key === "today" ? "col-span-2" : ""
                  } ${
                    settings.mysterySet === opt.key
                      ? "bg-[var(--color-brand-primary-dark)] border-[var(--color-brand-on-accent)]/80 text-white shadow-[0_0_20px_rgba(24,134,160,0.4)]"
                      : "bg-transparent border-white/25 text-white/90 hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background music */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold uppercase tracking-wider text-white/90">
              <Music className="w-3.5 h-3.5" />
              <span>Background Music</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMusic("on")}
                className={`min-h-11 rounded-xl border text-base font-bold transition-colors duration-300 ${
                  settings.music === "on"
                    ? "bg-[var(--color-brand-primary-dark)] border-[var(--color-brand-on-accent)]/80 text-white shadow-[0_0_20px_rgba(24,134,160,0.4)]"
                    : "bg-transparent border-white/25 text-white/90 hover:bg-white/5"
                }`}
              >
                On
              </button>
              <button
                onClick={() => setMusic("off")}
                className={`min-h-11 rounded-xl border text-base font-bold transition-colors duration-300 ${
                  settings.music === "off"
                    ? "bg-[var(--color-brand-primary-dark)] border-[var(--color-brand-on-accent)]/80 text-white shadow-[0_0_20px_rgba(24,134,160,0.4)]"
                    : "bg-transparent border-white/25 text-white/90 hover:bg-white/5"
                }`}
              >
                Off
              </button>
            </div>
          </div>

          <p className="text-sm text-white/70 leading-snug">
            These apply the next time the rosary is opened or started, and stay in sync with the Rosary tab.
          </p>
        </div>
      </div>
    </div>
  );
}
