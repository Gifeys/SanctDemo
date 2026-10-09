import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A setting that opens when you ask it to.
 *
 * ## Why these fold
 *
 * Language and Reminders were both printed open on the Me tab: two
 * explanatory paragraphs, a pair of language buttons and seven reminder
 * switches, all unfolded above a heading that said "Settings" and a
 * tidy list of rows underneath. The settings a pilgrim came for were
 * below two panels nobody had asked to see, and the page read as a
 * dumping ground rather than a list.
 *
 * Folded, every row on the tab is the same shape - a label you tap -
 * and what you tapped is the only thing open.
 *
 * ## Why the row carries the heading
 *
 * The panels inside already print their own "LANGUAGE" and "REMINDERS"
 * headings, so a wrapper that repeated them would say everything twice.
 * `bare` drops the row's own chrome for a child that brings its own
 * card, leaving this responsible only for the folding.
 */
export default function SettingDisclosure({
  icon,
  label,
  children,
  bare = false,
  defaultOpen = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  /** True when the child renders its own card and heading. */
  bare?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full bg-[var(--color-brand-card-sunk)] p-4 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-3 hover:border-[var(--color-brand-primary)] text-left transition-colors text-[16px] font-semibold text-[var(--color-brand-text)]"
      >
        <span className="text-[var(--color-brand-secondary)] shrink-0">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown
          aria-hidden
          className={`w-4 h-4 shrink-0 text-[var(--color-brand-secondary)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Unmounted rather than hidden. The reminder panel reads the
          device's notification permission when it mounts, and keeping a
          closed panel alive would have it do that on a tab the pilgrim
          never opened. */}
      {open && (
        <div id={panelId} className={bare ? "mt-2" : "mt-2 px-1"}>
          {children}
        </div>
      )}
    </div>
  );
}
