import React from "react";
import { Sparkles, ScanLine, MapPin, BookOpenText, Hourglass } from "lucide-react";

export default function ArPlaceholder() {
  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[var(--color-brand-border)]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <ScanLine className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[var(--color-brand-on-accent)] font-bold text-[15px] tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Coming Soon
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            AR Tour
          </h2>
          <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            An augmented-reality guide to the parish, built directly into SanctiWalk.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status card */}
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] p-5 shadow-xs space-y-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] flex items-center justify-center mx-auto text-[var(--color-brand-accent)]">
            <Hourglass className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[var(--color-brand-text)] font-serif italic">
            The AR Tour is still being built
          </h3>
          <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans">
            This is a placeholder for our real-world augmented reality feature, which is
            still in development. It will let pilgrims explore the church through their
            camera, right from this app.
          </p>
        </div>

        {/* What it will do */}
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] p-4.5 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-[var(--color-brand-text)] uppercase tracking-wider font-sans border-b border-[var(--color-brand-border)]/45 pb-1.5">
            What the AR Tour will do
          </h4>

          <div className="flex gap-3 items-start">
            <div className="h-9 w-9 rounded-xl bg-[var(--color-brand-card)] flex items-center justify-center shrink-0 text-[var(--color-brand-accent)]">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans pt-1">
              Point your phone's camera at a marked feature inside the church — an altar,
              a statue, a historical marker.
            </p>
          </div>

          <div className="flex gap-3 items-start">
            <div className="h-9 w-9 rounded-xl bg-[var(--color-brand-card)] flex items-center justify-center shrink-0 text-[var(--color-brand-accent)]">
              <BookOpenText className="w-4.5 h-4.5" />
            </div>
            <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans pt-1">
              Its history, meaning, and significance to the parish will appear on screen,
              turning a self-guided walk into a living tour.
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--color-brand-secondary)] text-center leading-relaxed font-sans px-2">
          We're building this feature for real church spaces. Check back in a future
          update once it's ready.
        </p>
      </div>
    </div>
  );
}
