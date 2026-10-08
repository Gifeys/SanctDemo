import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  CalendarDays, Eye, FileEdit, ImagePlus, Loader2, MapPin, Megaphone,
  Archive, Trash2, Undo2, X,
} from "lucide-react";
import { db } from "../lib/firebase";
import {
  ANNOUNCEMENT_TYPES, BOARD_LABEL, EVENT_TYPE, FEAST_TYPE, STATUS_LABEL,
  createAnnouncement, deleteAnnouncement, updateAnnouncement,
  formatWhen, onBoard, startOfDay, statusOf,
  type AnnouncementDoc, type AnnouncementStatus, type Board,
} from "../lib/announcements";
import { fileToBannerDataUrl, AnnouncementImageError } from "../lib/announcementImage";
import { notifyParish, MAX_PARISH_NOTIFICATIONS } from "../lib/notifications";
import AdminNav from "./AdminNav";
import type { AdminSession } from "./AdminApp";

/**
 * Announcements, Feast Days and Events — one page, three boards.
 *
 * ## Why not three pages
 *
 * They are the same document with a different chip on it: a title, a
 * date, a picture, and a published/draft/archived life. Three
 * collections would have been three sets of security rules, three admin
 * screens and three places for the next bug to hide. The nav still shows
 * them as three places, because that is how a parish thinks about them.
 *
 * ## Why archive and not delete
 *
 * Delete is here, but behind a confirmation and only for drafts and
 * archived items. A published announcement that has been on five hundred
 * home screens is a record of what the parish said; "Archive" takes it
 * down without pretending it never happened.
 */
export default function AdminAnnouncements({ session }: { session: AdminSession }) {
  const { board: boardParam } = useParams<{ board?: string }>();
  const board: Board =
    boardParam === "feasts" ? "feasts" : boardParam === "events" ? "events" : "announcements";

  const churchId = session.profile.churchId;
  const [items, setItems] = useState<AnnouncementDoc[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AnnouncementDoc | null>(null);

  useEffect(() => {
    const q = query(collection(db, "announcements"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setItems(snap.docs.map(d => ({ ...(d.data() as AnnouncementDoc), id: d.id }))),
      err => setListError(err.message),
    );
  }, [churchId]);

  // Leaving the board must not leave an edit form open over a document
  // the new board does not show.
  useEffect(() => { setEditing(null); }, [board]);

  const { current, archived } = useMemo(() => {
    const mine = (items ?? [])
      .filter(a => onBoard(a, board))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return {
      current: mine.filter(a => statusOf(a) !== "archived"),
      archived: mine.filter(a => statusOf(a) === "archived"),
    };
  }, [items, board]);

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[820px] mx-auto px-4 py-6">
        <AdminNav />

        <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
          {BOARD_LABEL[board]}
        </h1>
        <p className="text-[15px] text-[var(--color-brand-secondary)]">
          {session.church?.name ?? churchId}
          {board === "announcements"
            ? " — everything you have posted. Published items appear in the Parish Bulletin on Home."
            : board === "feasts"
              ? " — feast days, shown to pilgrims with the date and where they are held."
              : " — parish events, shown to pilgrims with the date, time and place."}
        </p>

        <ComposeForm
          key={editing?.id ?? `new-${board}`}
          board={board}
          churchId={churchId}
          authorEmail={session.user.email ?? ""}
          editing={editing}
          onDone={() => setEditing(null)}
        />

        {listError && (
          <p role="alert" className="mt-5 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {listError}
          </p>
        )}

        {items === null ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto w-6 h-6 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : (
          <>
            <BoardList
              title={`Current ${BOARD_LABEL[board].toLowerCase()}`}
              count={current.length}
              empty={
                <>
                  <Megaphone className="mx-auto w-7 h-7 text-[var(--color-brand-secondary)]" />
                  <p className="mt-2 text-[15px] text-[var(--color-brand-secondary)]">
                    Nothing posted yet. Whatever you publish above appears on every
                    pilgrim&apos;s home screen straight away.
                  </p>
                </>
              }
            >
              {current.map(a => (
                <Row key={a.id} item={a} authorEmail={session.user.email ?? ""}
                     onEdit={() => setEditing(a)} />
              ))}
            </BoardList>

            {/* Only when there is something in it. An empty "Archived"
                heading on a parish that has never archived anything is a
                question nobody asked. */}
            {archived.length > 0 && (
              <BoardList title="Archived" count={archived.length} tone="muted" empty={null}>
                {archived.map(a => (
                  <Row key={a.id} item={a} authorEmail={session.user.email ?? ""}
                       onEdit={() => setEditing(a)} />
                ))}
              </BoardList>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BoardList({
  title, count, children, empty, tone,
}: {
  title: string;
  count: number;
  children: ReactNode;
  empty: ReactNode;
  tone?: "muted";
}) {
  return (
    <section className={`mt-8${tone === "muted" ? " opacity-90" : ""}`}>
      <h2 className="mb-3 text-[17px] font-bold font-serif italic text-[var(--color-brand-text)]">
        {title}{" "}
        {count > 0 && (
          <span className="not-italic font-sans text-[15px] text-[var(--color-brand-secondary)]">
            ({count})
          </span>
        )}
      </h2>
      {count === 0 ? (
        <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-10 text-center px-6">
          {empty}
        </div>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  );
}

function ComposeForm({
  board, churchId, authorEmail, editing, onDone,
}: {
  board: Board;
  churchId: string;
  authorEmail: string;
  editing: AnnouncementDoc | null;
  onDone: () => void;
}) {
  // A feast posted from the Feast Days board is a feast. Making someone
  // pick "Feast" from a dropdown on a page called Feast Days is asking a
  // question whose answer is the page they are on.
  const defaultType =
    board === "feasts" ? FEAST_TYPE : board === "events" ? EVENT_TYPE : ANNOUNCEMENT_TYPES[0];

  const [title, setTitle] = useState(editing?.title ?? "");
  const [type, setType] = useState<string>(editing?.type ?? defaultType);
  const [date, setDate] = useState(editing?.date ?? "");
  const [time, setTime] = useState(editing?.time ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [busy, setBusy] = useState<"photo" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Off by default, and asked rather than assumed. The surest way to
  // make people ignore notifications is to send one that did not matter.
  const [notify, setNotify] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function choosePhoto(file: File) {
    setBusy("photo");
    setError(null);
    try {
      setImageUrl(await fileToBannerDataUrl(file));
    } catch (err) {
      setError(err instanceof AnnouncementImageError ? err.message : "That photo could not be read.");
    } finally {
      setBusy(null);
    }
  }

  async function save(status: AnnouncementStatus) {
    if (!title.trim()) { setError("Give it a title."); return; }
    if (!date) { setError("Choose the date this is for."); return; }
    setBusy("save");
    setError(null);
    try {
      if (editing) {
        await updateAnnouncement(
          editing.id,
          { title, body, date, time, type, location, imageUrl, status },
          authorEmail,
        );
        onDone();
        return;
      }
      await createAnnouncement(
        { churchId, title, body, date, time, type, location, imageUrl, status },
        authorEmail,
      );
      setTitle(""); setBody(""); setDate(""); setTime(""); setLocation(""); setImageUrl("");
      setType(defaultType);
      let note = status === "draft"
        ? "Saved as a draft. Nobody can see it until you publish it."
        : "Published. It is on the home screen now.";

      // Only on publish. A draft nobody can see must not ring anyone's
      // phone, whatever the checkbox says.
      if (notify && status === "published") {
        const result = await notifyParish(
          churchId,
          titleFor(board),
          `${title.trim()} — see the Parish Bulletin for details.`,
        );
        note += result.tooManyFor
          ? ` Nobody was notified: this parish has ${result.tooManyFor} members, more than the ${MAX_PARISH_NOTIFICATIONS} this can message at once.`
          : ` ${result.sent} ${result.sent === 1 ? "person was" : "people were"} notified.`;
        setNotify(false);
      }

      setDone(note);
      window.setTimeout(() => setDone(null), 6000);
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const noun = board === "feasts" ? "feast day" : board === "events" ? "event" : "announcement";

  return (
    <section className="mt-6 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
          {editing ? `Editing "${editing.title}"` : `Add a ${noun}`}
        </h2>
        {editing && (
          <button type="button" onClick={onDone}
                  className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-secondary)]">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
          {error}
        </p>
      )}

      <Field label="Title" htmlFor="ann-title">
        <input id="ann-title" value={title} maxLength={90}
               onChange={e => setTitle(e.target.value)}
               placeholder={board === "feasts" ? "Feast of Mary Help of Christians" : "Sunday Mass schedule update"}
               className={INPUT} />
      </Field>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Kind" htmlFor="ann-type">
          <select id="ann-type" value={type} onChange={e => setType(e.target.value)} className={INPUT}>
            {ANNOUNCEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Date" htmlFor="ann-date">
          <input id="ann-date" type="date" value={date}
                 onChange={e => setDate(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Time (optional)" htmlFor="ann-time">
          <input id="ann-time" type="time" value={time}
                 onChange={e => setTime(e.target.value)} className={INPUT} />
        </Field>
      </div>

      <Field label="Where (optional)" htmlFor="ann-where">
        <input id="ann-where" value={location} maxLength={120}
               onChange={e => setLocation(e.target.value)}
               placeholder="Parish church, parish hall, the grounds…"
               className={INPUT} />
      </Field>

      <Field label="Details (optional)" htmlFor="ann-body">
        <textarea id="ann-body" value={body} rows={3} maxLength={600}
                  onChange={e => setBody(e.target.value)}
                  placeholder="A sentence or two for the pilgrims."
                  className={INPUT} />
      </Field>

      <Field label="Photo (optional)" htmlFor="">
        {imageUrl ? (
          <div className="relative w-full max-w-[360px]">
            <img src={imageUrl} alt="" className="w-full aspect-video object-cover rounded-xl border border-[var(--color-brand-border)]" />
            <button type="button" onClick={() => setImageUrl("")} aria-label="Remove this photo"
                    className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "photo"}
                  className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-brand-border)] px-4 py-2.5 text-[15px] font-bold text-[var(--color-brand-text)]">
            {busy === "photo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            Choose a photo
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
               onChange={e => {
                 const file = e.target.files?.[0];
                 e.target.value = "";
                 if (file) void choosePhoto(file);
               }} />
      </Field>

      <label className="mb-4 flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
        <input
          type="checkbox"
          checked={notify}
          onChange={e => setNotify(e.target.checked)}
          className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--color-brand-primary)]"
        />
        <span>
          Send this to parish users as a notification
          <span className="block text-[14px] text-[var(--color-brand-secondary)]">
            Only when you publish. Leave it off for small corrections.
          </span>
        </span>
      </label>

      <div className="mt-5 flex items-center gap-2.5 flex-wrap">
        <button type="button" onClick={() => void save("published")} disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-5 py-3 text-[15px] font-bold disabled:opacity-60">
          {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {editing ? "Save and publish" : "Publish now"}
        </button>
        {/* Saving a draft is the quieter of the two, so it is the quieter
            button. A parish writing up the fiesta over three days should
            not have to publish it to keep it. */}
        <button type="button" onClick={() => void save("draft")} disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-brand-border)] px-5 py-3 text-[15px] font-bold text-[var(--color-brand-text)] disabled:opacity-60">
          <FileEdit className="w-4 h-4" /> Save as draft
        </button>
        {done && (
          <span role="status" className="text-[15px] font-semibold text-[var(--color-brand-success)]">
            {done}
          </span>
        )}
      </div>
    </section>
  );
}

function Row({
  item, authorEmail, onEdit,
}: { item: AnnouncementDoc; authorEmail: string; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = statusOf(item);
  const when = item.date ? new Date(item.date) : null;
  const dated = when && !Number.isNaN(when.getTime()) ? when : null;
  const past = dated !== null && dated.getTime() < startOfDay(new Date());

  async function setStatus(next: AnnouncementStatus) {
    setBusy(true);
    setError(null);
    try {
      await updateAnnouncement(item.id, { status: next }, authorEmail);
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteAnnouncement(item.id);
    } catch {
      setError("That could not be removed. Check your connection and try again.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li className={`rounded-2xl border bg-[var(--color-brand-card)] overflow-hidden ${
      status === "archived"
        ? "border-dashed border-[var(--color-brand-border)]"
        : "border-[var(--color-brand-border)]"
    }`}>
      <div className="flex gap-3 p-4">
        {item.imageUrl && (
          <img src={item.imageUrl} alt=""
               className={`w-[108px] h-[72px] shrink-0 rounded-lg object-cover${
                 status === "archived" ? " grayscale opacity-70" : ""
               }`} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold px-2.5 py-1 rounded-md bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]">
              <CalendarDays className="w-3.5 h-3.5" />
              {item.type}
            </span>
            <StatusChip status={status} />
          </div>

          <h3 className="mt-2 text-[16px] font-bold leading-snug text-[var(--color-brand-text)]">
            {item.title}
          </h3>
          <p className="mt-0.5 text-[14px] text-[var(--color-brand-secondary)]">
            {dated ? formatWhen(dated) : "No date"}
            {item.time ? ` · ${item.time}` : ""}
            {/* Said plainly, so an admin wondering why their announcement
                vanished from Home gets the answer here. */}
            {past && status === "published" && " · past, no longer shown on Home"}
          </p>
          {item.location && (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[14px] text-[var(--color-brand-secondary)]">
              <MapPin className="w-3.5 h-3.5" /> {item.location}
            </p>
          )}
          {item.body && (
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-brand-text)]">{item.body}</p>
          )}
          {error && <p role="alert" className="mt-2 text-[14px] text-[var(--color-brand-error)]">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <Action onClick={onEdit} icon={<FileEdit className="w-3.5 h-3.5" />} label="Edit" />

            {status === "draft" && (
              <Action onClick={() => void setStatus("published")} busy={busy}
                      icon={<Eye className="w-3.5 h-3.5" />} label="Publish" primary />
            )}
            {status === "published" && (
              <Action onClick={() => void setStatus("archived")} busy={busy}
                      icon={<Archive className="w-3.5 h-3.5" />} label="Archive" />
            )}
            {status === "archived" && (
              <Action onClick={() => void setStatus("published")} busy={busy}
                      icon={<Undo2 className="w-3.5 h-3.5" />} label="Restore" primary />
            )}

            {/* Delete only once it is off the home screen. Something five
                hundred people have read is a record of what the parish
                said; archive takes it down without erasing it. */}
            {status !== "published" && (
              <Action onClick={() => setConfirming(true)} danger
                      icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" />
            )}
          </div>
        </div>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-label="Delete permanently"
             className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-[380px] rounded-[22px] bg-[var(--color-brand-card)] p-6">
            <h3 className="text-[18px] font-bold font-serif italic">Delete this permanently?</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-text)]">
              <strong>{item.title}</strong> will be gone for good. If you only want it
              off the home screen, archive it instead — it stays here and you can
              restore it later.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirming(false)} disabled={busy}
                      className="flex-1 rounded-full border-[1.5px] border-[var(--color-brand-border)] py-3 text-[15px] font-bold">
                Keep it
              </button>
              <button onClick={() => void remove()} disabled={busy}
                      className="flex-1 rounded-full bg-[var(--color-brand-error)] text-white py-3 text-[15px] font-bold disabled:opacity-60">
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function StatusChip({ status }: { status: AnnouncementStatus }) {
  const tone =
    status === "published" ? { bg: "#E4F0E8", fg: "#2F5A41", br: "#BFD6C8" }
    : status === "draft" ? { bg: "#F6F0E2", fg: "#6E5010", br: "#E0D2AE" }
    : { bg: "var(--color-brand-card-sunk)", fg: "var(--color-brand-secondary)", br: "var(--color-brand-border)" };

  return (
    <span className="text-[13px] font-bold px-2.5 py-1 rounded-full border"
          style={{ background: tone.bg, color: tone.fg, borderColor: tone.br }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Action({
  onClick, icon, label, primary, danger, busy,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  primary?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
            className={`inline-flex items-center gap-1.5 text-[14px] font-bold disabled:opacity-50 ${
              danger ? "text-[var(--color-brand-error)]"
              : primary ? "text-[var(--color-brand-primary)]"
              : "text-[var(--color-brand-secondary)]"
            }`}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

/** What the notification says it is about. */
function titleFor(board: Board): string {
  if (board === "feasts") return "Upcoming feast day";
  if (board === "events") return "Parish event";
  return "Parish announcement";
}

const INPUT =
  "w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-bg)] px-3 py-2.5 text-[16px] text-[var(--color-brand-text)]";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor || undefined} className="block mb-1.5 text-[14px] font-bold text-[var(--color-brand-secondary)]">
        {label}
      </label>
      {children}
    </div>
  );
}
