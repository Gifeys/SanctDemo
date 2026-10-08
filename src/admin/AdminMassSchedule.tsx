import { useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useParishContent } from "../lib/useParishContent";
import { saveParishContent } from "../lib/parishContent";
import {
  isTimeAvailable, parseTimes, withTimeAvailability, type MassScheduleEntry,
} from "../lib/schedule";
import { MASS_SCHEDULES } from "../data";
import { notifyParish, MAX_PARISH_NOTIFICATIONS } from "../lib/notifications";
import AdminNav from "./AdminNav";
import type { AdminSession } from "./AdminApp";

const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * The parish's Mass times.
 *
 * ## This was already in Firebase
 *
 * `parishContent.massSchedule` has always been the source the app reads —
 * nothing was ever hard-coded into the phone. What was missing was a way
 * to edit it from the parish office: the only editor lived inside the old
 * in-app admin, behind a tab most parishes never found.
 *
 * ## Why suspending is not deleting
 *
 * Removing the 8:00 AM Mass takes it off the schedule as though it had
 * never existed, and someone who comes every week at 8 finds no mention
 * of it and assumes they misremembered. Suspended, the app still lists it
 * and says "Not available" — which is the information they actually need.
 */
export default function AdminMassSchedule({ session }: { session: AdminSession }) {
  const churchId = session.profile.churchId;
  const managed = useParishContent(churchId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Telling the parish is a separate, deliberate act - not something
  // every edit does. A secretary fixing a typo in a time must not send
  // four hundred phones a notification.
  const [telling, setTelling] = useState(false);
  const [message, setMessage] = useState("");
  const [told, setTold] = useState<string | null>(null);

  // The compiled schedule is the starting point for a parish that has
  // never edited one. Without it the office opens an empty page and has
  // to retype times the app is already showing.
  const compiled = MASS_SCHEDULES[churchId]?.schedule ?? [];
  const schedule: MassScheduleEntry[] = managed?.massSchedule ?? compiled;

  async function save(next: MassScheduleEntry[]) {
    setBusy(true);
    setError(null);
    try {
      await saveParishContent(churchId, { massSchedule: next }, session.user.email ?? "");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function tellParish() {
    setTelling(true);
    setTold(null);
    setError(null);
    try {
      const result = await notifyParish(churchId, "Mass schedule updated", message.trim());
      setTold(result.tooManyFor
        ? `Nobody was notified: this parish has ${result.tooManyFor} members, more than the ${MAX_PARISH_NOTIFICATIONS} this can message at once. Post an announcement instead.`
        : `Sent to ${result.sent} ${result.sent === 1 ? "person" : "people"}.`);
      if (!result.tooManyFor) setMessage("");
    } catch {
      setError("That could not be sent. Check your connection and try again.");
    } finally {
      setTelling(false);
    }
  }

  function replaceDay(day: string, entry: MassScheduleEntry | null) {
    const without = schedule.filter(e => e.day !== day);
    const next = entry ? [...without, entry] : without;
    // Kept in week order whatever order they were added in, so the saved
    // document reads the way the app displays it.
    next.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    void save(next);
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[760px] mx-auto px-4 py-6">
        <AdminNav />

        <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          Mass Schedule
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          {session.church?.name ?? churchId} — this is what the app shows on Home.
          Changes appear on every phone straight away.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mt-4 text-[15px] font-semibold text-[var(--color-brand-success)]">
            Saved.
          </p>
        )}

        <ul className="mt-5 space-y-3">
          {DAYS.map(day => (
            <DayRow
              key={day}
              day={day}
              entry={schedule.find(e => e.day === day) ?? null}
              busy={busy}
              onChange={entry => replaceDay(day, entry)}
            />
          ))}
        </ul>

        <p className="mt-6 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
          Write times as <strong>6:00 AM</strong> or <strong>4:30 PM</strong>. A day with
          no times is simply not shown in the app. A Mass switched off stays on the
          list marked <strong>Not available</strong>, so nobody turns up for one that
          has been called off.
        </p>

        <section className="mt-6 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
            Tell the parish
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
            Your changes are already live on everyone&apos;s phone. Send a notification
            as well only when it is something people need to know before Sunday.
          </p>

          {told && (
            <p role="status" className="mt-3 text-[15px] font-semibold text-[var(--color-brand-success)]">
              {told}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2.5 items-start">
            <input
              value={message}
              maxLength={160}
              aria-label="What to tell the parish"
              placeholder="The Sunday 8:00 AM Mass is suspended this month."
              onChange={e => setMessage(e.target.value)}
              className="flex-1 min-w-[240px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 py-2.5 text-[16px]"
            />
            <button
              type="button"
              disabled={telling || !message.trim()}
              onClick={() => void tellParish()}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-5 py-3 text-[15px] font-bold disabled:opacity-50"
            >
              {telling && <Loader2 className="w-4 h-4 animate-spin" />}
              Send to parish users
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function DayRow({
  day, entry, busy, onChange,
}: {
  day: string;
  entry: MassScheduleEntry | null;
  busy: boolean;
  onChange: (entry: MassScheduleEntry | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(entry?.note ?? "");
  const [editingNote, setEditingNote] = useState(false);

  const times = entry ? parseTimes(entry.time) : [];

  function addTime() {
    const value = draft.trim();
    if (!value) return;
    const next = [...times, value];
    onChange({ ...(entry ?? { day, time: "" }), day, time: next.join(", ") });
    setDraft("");
    setAdding(false);
  }

  function removeTime(time: string) {
    const next = times.filter(t => t !== time);
    if (next.length === 0) { onChange(null); return; }
    const base = entry ?? { day, time: "" };
    onChange({
      ...base,
      day,
      time: next.join(", "),
      // A suspension for a time that no longer exists would sit in the
      // document for ever.
      unavailableTimes: (base.unavailableTimes ?? []).filter(t => t !== time),
    });
  }

  function toggleTime(time: string, available: boolean) {
    if (!entry) return;
    onChange(withTimeAvailability(entry, time, available));
  }

  return (
    <li className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold font-serif italic text-[var(--color-brand-text)]">{day}</h2>
        {times.length === 0 && (
          <span className="text-[14px] text-[var(--color-brand-secondary)]">No Mass</span>
        )}
      </div>

      {times.length > 0 && (
        <ul className="mt-2.5 space-y-2">
          {times.map(time => {
            const on = entry ? isTimeAvailable(entry, time) : true;
            return (
              <li key={time} className="flex items-center gap-3">
                <span className={`text-[16px] font-bold tabular-nums ${
                  on ? "text-[var(--color-brand-text)]"
                     : "text-[var(--color-brand-secondary)] line-through"
                }`}>
                  {time}
                </span>

                <span className={`text-[13px] font-bold ${
                  on ? "text-[var(--color-brand-success)]" : "text-[var(--color-brand-secondary)]"
                }`}>
                  {on ? "Available" : "Not available"}
                </span>

                <span className="ml-auto flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="availability-switch"
                    aria-label={`${day} ${time} Mass is going ahead`}
                    checked={on}
                    disabled={busy}
                    onChange={e => toggleTime(time, e.target.checked)}
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(time)}
                    disabled={busy}
                    aria-label={`Remove the ${day} ${time} Mass`}
                    className="text-[var(--color-brand-error)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {entry?.note && !editingNote && (
        <p className="mt-2.5 rounded-xl bg-[var(--color-brand-card-sunk)] px-3 py-2 text-[14px] text-[var(--color-brand-text)]">
          {entry.note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {adding ? (
          <span className="flex items-center gap-2">
            <input
              value={draft}
              autoFocus
              placeholder="8:00 AM"
              aria-label={`Time of a new Mass on ${day}`}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addTime();
                if (e.key === "Escape") { setAdding(false); setDraft(""); }
              }}
              className="w-[120px] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 py-2 text-[16px]"
            />
            <button type="button" onClick={addTime} disabled={busy}
                    className="rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-4 py-2 text-[14px] font-bold">
              Add
            </button>
            <button type="button" onClick={() => { setAdding(false); setDraft(""); }}
                    aria-label="Cancel adding a Mass"
                    className="text-[var(--color-brand-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setAdding(true)} disabled={busy}
                  className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-primary)]">
            <Plus className="w-4 h-4" /> Add a Mass
          </button>
        )}

        {editingNote ? (
          <span className="flex items-center gap-2 flex-1 min-w-[220px]">
            <input
              value={note}
              autoFocus
              maxLength={120}
              placeholder="No 6pm Mass during the renovation"
              aria-label={`Note for ${day}`}
              onChange={e => setNote(e.target.value)}
              className="flex-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 py-2 text-[16px]"
            />
            <button
              type="button"
              disabled={busy || times.length === 0}
              onClick={() => {
                if (!entry) return;
                const { note: _old, ...rest } = entry;
                onChange(note.trim() ? { ...rest, note: note.trim() } : rest);
                setEditingNote(false);
              }}
              className="rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-4 py-2 text-[14px] font-bold"
            >
              Save
            </button>
          </span>
        ) : times.length > 0 && (
          <button type="button" onClick={() => setEditingNote(true)}
                  className="text-[14px] font-bold text-[var(--color-brand-secondary)]">
            {entry?.note ? "Edit note" : "Add a note"}
          </button>
        )}

        {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-brand-primary)]" />}
      </div>
    </li>
  );
}
