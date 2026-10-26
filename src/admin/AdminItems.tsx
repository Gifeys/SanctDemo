import { useState } from "react";
import { Loader2 } from "lucide-react";

import { SACRAMENTS, ministriesForParish } from "../data";
import { useParishContent } from "../lib/useParishContent";
import { saveParishContent } from "../lib/parishContent";
import { closedIds, isOpenForApplications, withAvailability } from "../lib/availability";
import {
  MAX_WINDOWS_PER_ITEM,
  describeWindows,
  normaliseWindows,
  withWindow,
  withoutWindow,
  type OpenWindow,
} from "../lib/openWindows";
import {
  hasParishContent, mergeItemContent, resolveMinistry, resolveSacrament,
  type ItemContent,
} from "../lib/itemContent";
import AdminNav from "./AdminNav";
import { Item } from "./AdminContent";
import type { AdminSession } from "./AdminApp";

/**
 * One ministry or sacrament, start to finish, on one page.
 *
 * ## Why this replaced two pages
 *
 * "What people read" edited the descriptions; "Open & Closed" switched
 * applications on and off. Both listed every ministry and every
 * sacrament, in the same order, from the same record - so a secretary
 * closing the choir and then correcting its requirements had to find
 * two different screens to do one afternoon's work, and the dashboard
 * carried two tiles for what the parish thinks of as one thing.
 *
 * They are now a page per kind: Ministries, and Sacraments. Each row
 * carries its own switch and opens its own editor.
 *
 * ## Why Mass is not here
 *
 * A Mass is not applied for. Suspending the 6:00 AM is a change to a
 * schedule, which is what the Mass Schedule page is, and the bell that
 * tells people about it is already wired to the schedule's own record.
 * Putting it on a page about applications would be filing it by the
 * screen it resembles rather than by what it is.
 */
export default function AdminItems({
  session,
  kind,
}: {
  session: AdminSession;
  kind: "ministry" | "sacrament";
}) {
  const churchId = session.profile.churchId;
  const managed = useParishContent(churchId);

  // This parish's ministries, not every parish's. Sacraments are the
  // same seven everywhere, which is why they are not filtered.
  const items =
    kind === "ministry"
      ? ministriesForParish(churchId).map(m => ({ id: m.id, name: m.name }))
      : SACRAMENTS.map(s => ({ id: s.id, name: s.name }));

  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function saveContent(itemId: string, patch: ItemContent) {
    setBusy(itemId);
    setError(null);
    try {
      await saveParishContent(
        churchId,
        { itemContent: mergeItemContent(managed, itemId, patch) },
        session.user.email ?? "",
      );
      setSaved(itemId);
      window.setTimeout(() => setSaved(null), 2600);
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function setOpen(itemId: string, open: boolean) {
    setSwitching(itemId);
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
      setSwitching(null);
    }
  }

  async function saveWindows(itemId: string, windows: OpenWindow[]) {
    setSwitching(itemId);
    setError(null);
    try {
      await saveParishContent(
        churchId,
        { openWindows: { ...(managed?.openWindows ?? {}), [itemId]: windows } },
        session.user.email ?? "",
      );
    } catch {
      setError("Those dates could not be saved. Check your connection and try again.");
    } finally {
      setSwitching(null);
    }
  }

  const openCount = items.filter(i => isOpenForApplications(managed, i.id)).length;
  const title = kind === "ministry" ? "Ministries" : "Sacraments";

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[760px] mx-auto px-4 py-6">
        <AdminNav />

        <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          {title}
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          Open a row to change what people read about it. Use the switch to
          decide whether they can apply. Switched off, it stays visible in the
          app with everything you have written, and the Apply button goes.
        </p>

        <p className="mt-3 text-[14px] font-semibold text-[var(--color-brand-secondary)]">
          {openCount} of {items.length} accepting applications
        </p>

        {error && (
          <p role="alert" className="mt-3 text-[14px] font-semibold text-[var(--color-brand-danger)]">
            {error}
          </p>
        )}

        <ul className="mt-4 divide-y divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] overflow-hidden">
          {items.map(item => {
            const open = isOpenForApplications(managed, item.id);
            return (
              <Item
                key={`${item.id}-${openId === item.id}`}
                id={item.id}
                name={item.name}
                churchId={churchId}
                kind={kind}
                edited={hasParishContent(managed, item.id)}
                open={openId === item.id}
                busy={busy === item.id}
                saved={saved === item.id}
                current={
                  kind === "ministry"
                    ? resolveMinistry(managed, item.id, "en")
                    : resolveSacrament(managed, item.id, "en")
                }
                existing={managed?.itemContent?.[item.id] ?? {}}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                onSave={patch => void saveContent(item.id, patch)}
                availability={
                  <AvailabilitySwitch
                    name={item.name}
                    open={open}
                    busy={switching === item.id}
                    onChange={next => void setOpen(item.id, next)}
                  />
                }
                calendar={
                  <OpenDates
                    name={item.name}
                    windows={normaliseWindows(managed?.openWindows?.[item.id])}
                    busy={switching === item.id}
                    onChange={next => void saveWindows(item.id, next)}
                  />
                }
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * One switch, saved the moment it is pressed.
 *
 * A real checkbox under the styling, as on the page this replaced: it
 * is what gives the row a keyboard, a focus ring and a state a screen
 * reader can read, none of which is worth rebuilding by hand.
 *
 * No Save button either. One switch is one decision, and a page of
 * switches with a single Save at the bottom invites someone to flip
 * four things and lose three of them.
 */
function AvailabilitySwitch({
  name,
  open,
  busy,
  onChange,
}: {
  name: string;
  open: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-2">
      {busy && (
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-brand-primary)]" aria-hidden />
      )}
      <input
        type="checkbox"
        className="availability-switch"
        // Said explicitly: the row around it already carries the name
        // and the state, so the computed label came out as "on" for
        // every switch on the page.
        aria-label={`Accepting applications for ${name}`}
        checked={open}
        disabled={busy}
        onChange={e => onChange(e.target.checked)}
      />
    </span>
  );
}

/**
 * The dates a ministry or sacrament is open for applications.
 *
 * ## Why ranges and not a month grid
 *
 * A parish office says "baptisms through November", not "the 1st, the
 * 2nd, the 3rd…". A grid would make them tap thirty times to express
 * one sentence, and would make a mistake thirty times as likely.
 *
 * ## Why no dates means open
 *
 * Every parish is in that state today, and every one of them is
 * currently open. A page that read "no dates" as "closed" would shut
 * every sacrament in the diocese the moment it shipped - see
 * lib/openWindows.ts, which is where that rule actually lives.
 *
 * Saved on add and on remove, with no Save button, for the same reason
 * the switch above has none: one range is one decision.
 */
function OpenDates({
  name,
  windows,
  busy,
  onChange,
}: {
  name: string;
  windows: OpenWindow[];
  busy: boolean;
  onChange: (next: OpenWindow[]) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const full = windows.length >= MAX_WINDOWS_PER_ITEM;
  const canAdd = !!from && !!to && !busy && !full;

  return (
    <div className="mt-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-4">
      <p className="text-[15px] font-bold text-[var(--color-brand-text)]">
        Open on these dates
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
        {describeWindows(windows, new Date().toISOString().slice(0, 10))}
        {" "}Outside these dates it closes itself, so nobody has to remember to.
      </p>

      {windows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {windows.map(w => (
            <li
              key={`${w.from}-${w.to}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] px-3 py-2"
            >
              <span className="text-[14px] text-[var(--color-brand-text)]">
                {w.from === w.to ? w.from : `${w.from} to ${w.to}`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange(withoutWindow(windows, w))}
                aria-label={`Remove ${w.from} to ${w.to} from ${name}`}
                className="text-[14px] font-semibold text-[var(--color-brand-error)] disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--color-brand-secondary)]">
          From
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-[15px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--color-brand-secondary)]">
          To
          <input
            type="date"
            value={to}
            // The end cannot precede the start. openWindows tolerates a
            // reversed range rather than failing, but the office should
            // not be able to enter one in the first place.
            min={from || undefined}
            onChange={e => setTo(e.target.value)}
            className="rounded-xl border border-[var(--color-brand-border)] px-3 py-2 text-[15px]"
          />
        </label>
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            onChange(withWindow(windows, { from, to }));
            setFrom("");
            setTo("");
          }}
          className="rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-[15px] font-bold text-[var(--color-brand-on-accent)] disabled:opacity-50"
        >
          Add dates
        </button>
      </div>

      {full && (
        <p className="mt-2 text-[13px] text-[var(--color-brand-secondary)]">
          That is as many date ranges as one item can hold. Remove one to add another.
        </p>
      )}
    </div>
  );
}
