import { useState } from "react";
import { Loader2 } from "lucide-react";
import { MINISTRIES, SACRAMENTS } from "../data";
import { useParishContent } from "../lib/useParishContent";
import { saveParishContent } from "../lib/parishContent";
import { closedIds, isOpenForApplications, withAvailability } from "../lib/availability";
import type { AdminSession } from "./AdminApp";
import AdminNav from "./AdminNav";

/**
 * Turning applications on and off, ministry by ministry.
 *
 * ## Why this is not a "settings" page
 *
 * A parish secretary closing the choir because it is full is doing the
 * single most ordinary thing in this admin. It is one switch per line,
 * worded the way they would say it - "Accepting applications" - and it
 * saves the moment it is pressed. No Save button: there is nothing to
 * compose here, one switch is one decision, and a page of switches with
 * a Save at the bottom is a page people leave without pressing it.
 *
 * ## Why it writes a list and not a flag per ministry
 *
 * See lib/availability.ts. Short version: absent has to mean open, and
 * the security rules need to answer "is this closed" in one expression
 * over one field.
 */
export default function AdminAvailability({ session }: { session: AdminSession }) {
  const churchId = session.profile.churchId;
  const managed = useParishContent(churchId);

  // Which row is mid-save, so only that switch shows a spinner. A single
  // page-wide "saving" flag made every row flicker when one was pressed.
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setOpen(itemId: string, open: boolean) {
    setSaving(itemId);
    setError(null);
    try {
      await saveParishContent(
        churchId,
        { closedApplications: withAvailability(closedIds(managed), itemId, open) },
        session.user.email ?? "",
      );
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  }

  const ministriesOpen = MINISTRIES.filter(m => isOpenForApplications(managed, m.id)).length;
  const sacramentsOpen = SACRAMENTS.filter(s => isOpenForApplications(managed, s.id)).length;

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[760px] mx-auto px-4 py-6">
        <AdminNav />

        <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          What people can apply for
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          Switch something off and it stays visible in the app, with its
          description and requirements, but nobody can apply until you switch
          it back on.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        <Group
          title="Ministries"
          summary={`${ministriesOpen} of ${MINISTRIES.length} accepting applications`}
        >
          {MINISTRIES.map(m => (
            <Row
              key={m.id}
              name={m.name}
              open={isOpenForApplications(managed, m.id)}
              busy={saving === m.id}
              openLabel="Accepting applications"
              closedLabel="Not accepting applications"
              onChange={next => void setOpen(m.id, next)}
            />
          ))}
        </Group>

        <Group
          title="Sacraments"
          summary={`${sacramentsOpen} of ${SACRAMENTS.length} open for applications`}
        >
          {SACRAMENTS.map(s => (
            <Row
              key={s.id}
              name={s.name}
              open={isOpenForApplications(managed, s.id)}
              busy={saving === s.id}
              openLabel="Applications open"
              closedLabel="Not available"
              onChange={next => void setOpen(s.id, next)}
            />
          ))}
        </Group>

        <p className="mt-6 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
          Applications already submitted are not affected. They stay in your
          list and you can still approve or complete them.
        </p>
      </div>
    </div>
  );
}

function Group({
  title, summary, children,
}: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[17px] font-bold font-serif italic text-[var(--color-brand-text)]">{title}</h2>
      <p className="mb-2 text-[14px] text-[var(--color-brand-secondary)]">{summary}</p>
      <ul className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] divide-y divide-[var(--color-brand-border)]">
        {children}
      </ul>
    </section>
  );
}

/**
 * One switch.
 *
 * A real checkbox underneath the styling, not a div with an onClick. It
 * is what gives the row a keyboard, a focus ring and a state a screen
 * reader can read, none of which would be worth rebuilding by hand.
 */
function Row({
  name, open, busy, openLabel, closedLabel, onChange,
}: {
  name: string;
  open: boolean;
  busy: boolean;
  openLabel: string;
  closedLabel: string;
  onChange: (open: boolean) => void;
}) {
  return (
    <li>
      <label className="flex items-center gap-3 p-4 cursor-pointer">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-snug text-[var(--color-brand-text)]">
            {name}
          </span>
          <span className={`mt-0.5 inline-flex items-center gap-1.5 text-[14px] font-semibold ${
            open ? "text-[var(--color-brand-success)]" : "text-[var(--color-brand-secondary)]"
          }`}>
            <span
              aria-hidden
              className="w-2 h-2 rounded-full"
              style={{ background: "currentColor" }}
            />
            {open ? openLabel : closedLabel}
          </span>
        </span>

        {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-brand-primary)]" />}

        <input
          type="checkbox"
          className="availability-switch"
          // The wrapping label holds the ministry's name AND its current
          // state, so the computed name came out as the word "on". Said
          // explicitly instead, or a screen reader reaches a page of
          // fifteen switches that are all called the same thing.
          aria-label={`Accepting applications for ${name}`}
          checked={open}
          disabled={busy}
          onChange={e => onChange(e.target.checked)}
        />
      </label>
    </li>
  );
}
