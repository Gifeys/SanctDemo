import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { MINISTRIES, SACRAMENTS } from "../data";
import { useParishContent } from "../lib/useParishContent";
import { saveParishContent } from "../lib/parishContent";
import {
  hasParishContent, linesToList, listToLines, mergeItemContent,
  resolveMinistry, resolveSacrament, type ItemContent,
} from "../lib/itemContent";
import AdminNav from "./AdminNav";
import type { AdminSession } from "./AdminApp";

/**
 * What pilgrims read about each ministry and sacrament.
 *
 * ## Why editing here changes nothing about applications
 *
 * This is the page somebody reads before they apply. Their application
 * is a separate record, and nothing typed here touches one — a parish
 * correcting a requirement in March does not alter what somebody
 * submitted in February.
 *
 * ## Why every box starts blank
 *
 * Blank means "use what the app already shows", which for most of these
 * is text the parish supplied in the first place. Pre-filling the boxes
 * with it would invite someone to save it back as though they had
 * written it, and then an edit to the shared text would stop reaching
 * this parish. The placeholder shows what is currently displayed; the
 * box stays empty until the parish wants something different.
 */
export default function AdminContent({ session }: { session: AdminSession }) {
  const churchId = session.profile.churchId;
  const managed = useParishContent(churchId);

  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(itemId: string, patch: ItemContent) {
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

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[820px] mx-auto px-4 py-6">
        <AdminNav />

        <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          What people read
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          {session.church?.name ?? churchId} — the information shown before someone
          applies. Leave a box empty to keep what the app already shows.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        <Group title="Sacraments">
          {SACRAMENTS.map(s => (
            <Item
              key={s.id}
              id={s.id}
              name={s.name}
              kind="sacrament"
              edited={hasParishContent(managed, s.id)}
              open={openId === s.id}
              busy={busy === s.id}
              saved={saved === s.id}
              current={resolveSacrament(managed, s.id)}
              existing={managed?.itemContent?.[s.id] ?? {}}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
              onSave={patch => void save(s.id, patch)}
            />
          ))}
        </Group>

        <Group title="Ministries">
          {MINISTRIES.map(m => (
            <Item
              key={m.id}
              id={m.id}
              name={m.name}
              kind="ministry"
              edited={hasParishContent(managed, m.id)}
              open={openId === m.id}
              busy={busy === m.id}
              saved={saved === m.id}
              current={resolveMinistry(managed, m.id)}
              existing={managed?.itemContent?.[m.id] ?? {}}
              onToggle={() => setOpenId(openId === m.id ? null : m.id)}
              onSave={patch => void save(m.id, patch)}
            />
          ))}
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-[17px] font-bold font-serif italic text-[var(--color-brand-text)]">
        {title}
      </h2>
      <ul className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] divide-y divide-[var(--color-brand-border)] overflow-hidden">
        {children}
      </ul>
    </section>
  );
}

function Item({
  id, name, kind, edited, open, busy, saved, current, existing, onToggle, onSave,
}: {
  id: string;
  name: string;
  kind: "ministry" | "sacrament";
  edited: boolean;
  open: boolean;
  busy: boolean;
  saved: boolean;
  current: ReturnType<typeof resolveMinistry>;
  existing: ItemContent;
  onToggle: () => void;
  onSave: (patch: ItemContent) => void;
}) {
  // Keyed off `open` by the parent remounting, so reopening a row always
  // shows what is saved rather than a half-finished edit from earlier.
  const [about, setAbout] = useState(existing.about ?? "");
  const [requirements, setRequirements] = useState(listToLines(existing.requirements));
  const [schedule, setSchedule] = useState(existing.schedule ?? "");
  const [responsibilities, setResponsibilities] = useState(listToLines(existing.responsibilities));
  const [process, setProcess] = useState(listToLines(existing.process));
  const [reminders, setReminders] = useState(listToLines(existing.reminders));
  const [contact, setContact] = useState(existing.contact ?? "");

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-snug text-[var(--color-brand-text)]">
            {name}
          </span>
          <span className="text-[14px] text-[var(--color-brand-secondary)]">
            {edited ? "You have written your own information" : "Using the app's information"}
          </span>
        </span>
        {saved && (
          <span role="status" className="text-[14px] font-bold text-[var(--color-brand-success)]">
            Saved
          </span>
        )}
        <ChevronDown className={`w-5 h-5 shrink-0 text-[var(--color-brand-secondary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4">
          <Box
            label="About"
            value={about}
            onChange={setAbout}
            rows={4}
            placeholder={current?.about}
            help="Leave empty to keep what is shown now."
          />

          <Box
            label="Requirements"
            value={requirements}
            onChange={setRequirements}
            rows={5}
            placeholder={current?.requirements.join("\n")}
            help="One per line. Leave empty to keep the list shown now."
          />

          <Box
            label="Schedule"
            value={schedule}
            onChange={setSchedule}
            rows={2}
            placeholder={current?.schedule || "Saturdays, 9:00 AM"}
            help="In your own words."
          />

          {kind === "ministry" && (
            <Box
              label="What members do"
              value={responsibilities}
              onChange={setResponsibilities}
              rows={4}
              help="One per line. Shown as a list."
            />
          )}

          <Box
            label="How applying works"
            value={process}
            onChange={setProcess}
            rows={5}
            help="One step per line. Shown numbered, in this order."
          />

          <Box
            label="Important reminders"
            value={reminders}
            onChange={setReminders}
            rows={4}
            help="One per line."
          />

          <Box
            label="Who to contact"
            value={contact}
            onChange={setContact}
            rows={2}
            help="A number, an email, or the office hours."
          />

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onSave({
                about,
                requirements: linesToList(requirements),
                schedule,
                responsibilities: linesToList(responsibilities),
                process: linesToList(process),
                reminders: linesToList(reminders),
                contact,
              })
            }
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-5 py-3 text-[15px] font-bold disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      )}
    </li>
  );
}

function Box({
  label, value, onChange, rows, help, placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  help?: string;
  placeholder?: string;
}) {
  const id = `c-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-bold text-[var(--color-brand-secondary)]">
        {label}
      </label>
      {help && <p className="mb-1.5 text-[13px] text-[var(--color-brand-secondary)]">{help}</p>}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 py-2.5 text-[16px] text-[var(--color-brand-text)]"
      />
    </div>
  );
}
