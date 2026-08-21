import { Church, MapPin, ChevronRight } from "lucide-react";
import { Route } from "../types";

interface HomeParishChooserProps {
  parishes: Route[];
  onChoose: (parishId: string) => void;
}

// The one-time onboarding screen: shown only when no home parish is stored
// yet (see App.tsx's homeParishId gate). Once the pilgrim picks one it is
// saved to localStorage (src/lib/homeParish.ts) and this screen never
// appears again unless they explicitly change it later from the sidebar.
//
// This deliberately does NOT explain presence detection or the diocese map
// — it just needs a warm, short answer to one question so the dashboard can
// become the front door. No dismiss/skip control: a home parish is required
// for the "not near any parish" fallback to mean anything.
export default function HomeParishChooser({ parishes, onChoose }: HomeParishChooserProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-brand-bg)] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-primary)] flex items-center justify-center mx-auto shadow-md">
            <Church className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-sans tracking-tight text-white">
              Welcome to SanctiWalk
            </h1>
            <p className="text-base text-[var(--color-brand-card)] leading-relaxed mt-2 font-sans">
              Which parish is yours? We'll show it to you whenever you're not near a parish in person.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {parishes.map((route) => (
            <button
              key={route.id}
              onClick={() => onChoose(route.id)}
              className="w-full bg-white rounded-2xl border border-[var(--color-brand-border)] p-4 shadow-xs hover:border-[var(--color-brand-primary)] transition-all flex items-center gap-3.5 text-left"
            >
              <div className="h-11 w-11 rounded-xl bg-[var(--color-brand-card)] text-[var(--color-brand-primary)] flex items-center justify-center shrink-0">
                <Church className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-[var(--color-brand-text)] font-sans truncate">
                  {route.name.replace(" Guide", "").replace(" Tour", "")}
                </h2>
                <p className="text-sm text-[var(--color-brand-secondary)] mt-0.5 flex items-center gap-1 font-sans">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {route.location}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            </button>
          ))}
        </div>

        <p className="text-sm text-[var(--color-brand-card)] text-center font-sans leading-relaxed">
          You can change this anytime from the app menu.
        </p>
      </div>
    </div>
  );
}
