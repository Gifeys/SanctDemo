import { X, Church, MapPin, Check } from "lucide-react";
import { Route } from "../types";

interface ChangeParishModalProps {
  isOpen: boolean;
  onClose: () => void;
  parishes: Route[];
  currentParishId: string | null;
  onChoose: (parishId: string) => void;
}

// The "change it later" surface promised by the one-time HomeParishChooser.
// Reachable from the sidebar drawer (see App.tsx's "Change Home Parish"
// entry). Picking a parish here updates the stored home parish immediately
// and closes the sheet; it does not require re-running onboarding.
export default function ChangeParishModal({ isOpen, onClose, parishes, currentParishId, onChoose }: ChangeParishModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center p-5 bg-black/60 transition-opacity duration-300 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--color-brand-border)] bg-white text-[var(--color-brand-text)] shadow-2xl transition-all duration-300 ease-out font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-brand-border)]">
          <div className="flex items-center gap-1.5">
            <Church className="w-4 h-4 text-[var(--color-brand-primary)]" />
            <h2 className="text-base font-bold tracking-tight">Home Parish</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close change parish"
            className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full text-[var(--color-brand-secondary)] hover:bg-[var(--color-brand-card)] transition-colors duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          <p className="text-[15px] text-[var(--color-brand-secondary)] leading-relaxed pb-1">
            We'll show this parish whenever you're not near a parish in person.
          </p>
          {parishes.map((route) => {
            const isCurrent = route.id === currentParishId;
            return (
              <button
                key={route.id}
                onClick={() => {
                  onChoose(route.id);
                  onClose();
                }}
                className={`w-full rounded-2xl border p-3.5 flex items-center gap-3 text-left transition-all ${
                  isCurrent
                    ? "bg-[var(--color-brand-card)] border-[var(--color-brand-primary)]"
                    : "bg-white border-[var(--color-brand-border)] hover:border-[var(--color-brand-primary)]"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-[var(--color-brand-card)] text-[var(--color-brand-primary)] flex items-center justify-center shrink-0">
                  <Church className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[var(--color-brand-text)] truncate">
                    {route.name.replace(" Guide", "").replace(" Tour", "")}
                  </h3>
                  <p className="text-sm text-[var(--color-brand-secondary)] mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {route.location}
                  </p>
                </div>
                {isCurrent && <Check className="w-4 h-4 text-[var(--color-brand-primary)] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
