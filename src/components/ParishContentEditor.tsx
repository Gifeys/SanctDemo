import { useEffect, useRef, useState } from "react";
import { Upload, Check, AlertTriangle, Loader2 } from "lucide-react";
import { ROUTES, MASS_SCHEDULES } from "../data";
import { checkParishColour, readableTextOn, parseHex } from "../lib/contrast";
import { saveParishContent, uploadParishPhoto, type ParishContent } from "../lib/parishContent";
import { useParishContent } from "../lib/useParishContent";
import { parseTimes } from "../lib/schedule";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ParishContentEditorProps {
  /** The signed-in admin, recorded against each change. */
  editorEmail: string;
}

/**
 * The parish office's own editor: patron photograph, description, Mass times
 * and brand colour, without a developer.
 *
 * Mass times are the reason this is worth building. Twenty-nine of the
 * thirty-one parishes have none, and every one collected so far had to be
 * typed into data.ts by hand — so the field team could gather them but not
 * enter them. Here they can.
 */
export default function ParishContentEditor({ editorEmail }: ParishContentEditorProps) {
  const [parishId, setParishId] = useState(ROUTES[0]?.id ?? "");
  const managed = useParishContent(parishId);

  const [description, setDescription] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; message: string }>({
    kind: "idle",
    message: "",
  });
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Reload the form whenever the parish changes or someone else saves.
  useEffect(() => {
    const fallback = MASS_SCHEDULES[parishId]?.schedule ?? [];
    const asMap: Record<string, string> = {};
    for (const day of DAYS) {
      asMap[day] =
        managed?.massSchedule?.find(e => e.day === day)?.time ??
        fallback.find(e => e.day === day)?.time ??
        "";
    }
    setSchedule(asMap);
    setDescription(managed?.description ?? "");
    setThemeColor(managed?.themeColor ?? "");
  }, [parishId, managed]);

  const colourVerdict = themeColor.trim() ? checkParishColour(themeColor.trim()) : null;

  const save = async (patch: Partial<ParishContent>) => {
    setStatus({ kind: "busy", message: "Saving…" });
    try {
      await saveParishContent(parishId, patch, editorEmail);
      setStatus({ kind: "ok", message: "Saved. Every device updates within a second." });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[ParishContentEditor]", message);
      setStatus({
        kind: "error",
        message: /permission|insufficient/i.test(message)
          ? "Saving was refused. Your account is not in the admins collection, or the Firestore rules are not deployed."
          : "Could not save. Check your connection and try again.",
      });
    }
  };

  const onPickPhoto = async (file: File) => {
    setStatus({ kind: "busy", message: "Uploading photo…" });
    const result = await uploadParishPhoto(parishId, file);
    if (result.url) {
      await save({ photoUrl: result.url });
    } else {
      setStatus({ kind: "error", message: result.error ?? "The photo could not be uploaded." });
    }
  };

  const saveSchedule = () => {
    // Empty days are dropped rather than stored blank — "no Mass listed" and
    // "Mass at nothing o'clock" are different things downstream.
    const entries = DAYS.filter(day => schedule[day]?.trim()).map(day => ({
      day,
      time: schedule[day].trim(),
    }));
    void save({ massSchedule: entries });
  };

  const invalidDays = DAYS.filter(day => {
    const value = schedule[day]?.trim();
    if (!value) return false;
    return parseTimes(value).some(t => !/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(t.trim()));
  });

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)] mb-1.5">
          Parish
        </label>
        <select
          value={parishId}
          onChange={e => setParishId(e.target.value)}
          className="w-full p-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[16px] text-[var(--color-brand-text)]"
        >
          {ROUTES.map(route => (
            <option key={route.id} value={route.id}>
              {route.name.replace(" Guide", "").replace(" Tour", "")}
            </option>
          ))}
        </select>
      </div>

      {/* Patron photograph */}
      <section className="rounded-[22px] border border-[var(--color-brand-border)] p-4 space-y-3">
        <h4 className="text-[16px] font-semibold text-[var(--color-brand-text)]">Patron photograph</h4>
        {managed?.photoUrl ? (
          <img
            src={managed.photoUrl}
            alt="Current patron photograph"
            className="w-full h-40 object-cover rounded-xl border border-[var(--color-brand-border)]"
          />
        ) : (
          <p className="text-[15px] text-[var(--color-brand-secondary)]">
            No photograph yet. The home screen shows the parish name alone until one is added.
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void onPickPhoto(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full py-3 rounded-full text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {managed?.photoUrl ? "Replace photograph" : "Upload photograph"}
        </button>
        <p className="text-[15px] text-[var(--color-brand-secondary)]">
          A photograph of this parish's own patron image. Under 5 MB — most phones offer to resize
          when sharing. Please do not use a picture of a different church.
        </p>
      </section>

      {/* Description */}
      <section className="rounded-[22px] border border-[var(--color-brand-border)] p-4 space-y-3">
        <h4 className="text-[16px] font-semibold text-[var(--color-brand-text)]">Parish description</h4>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Mary Help of Christians Parish in Maypajo is a vibrant Catholic community…"
          className="w-full p-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[16px] text-[var(--color-brand-text)]"
        />
        <button
          type="button"
          onClick={() => void save({ description: description.trim() })}
          className="w-full py-3 rounded-full text-[16px] font-semibold border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
        >
          Save description
        </button>
      </section>

      {/* Mass schedule */}
      <section className="rounded-[22px] border border-[var(--color-brand-border)] p-4 space-y-3">
        <h4 className="text-[16px] font-semibold text-[var(--color-brand-text)]">Mass schedule</h4>
        <p className="text-[15px] text-[var(--color-brand-secondary)]">
          One line per day. Separate multiple Masses with commas, e.g. <strong>6:00 AM, 6:00 PM</strong>.
          Leave a day blank if there is no Mass.
        </p>
        {DAYS.map(day => (
          <div key={day} className="flex items-center gap-3">
            <span className="w-[92px] shrink-0 text-[15px] text-[var(--color-brand-secondary)]">{day}</span>
            <input
              value={schedule[day] ?? ""}
              onChange={e => setSchedule(s => ({ ...s, [day]: e.target.value }))}
              placeholder="—"
              className={`flex-1 min-w-0 p-2.5 rounded-xl border bg-[var(--color-brand-card)] text-[16px] text-[var(--color-brand-text)] ${
                invalidDays.includes(day)
                  ? "border-[var(--color-brand-error)]"
                  : "border-[var(--color-brand-border)]"
              }`}
            />
          </div>
        ))}
        {invalidDays.length > 0 && (
          <p className="text-[15px] text-[var(--color-brand-error)]">
            {invalidDays.join(", ")}: times must look like <strong>6:00 AM</strong>. A time the app
            cannot read is skipped, which would silently hide a Mass.
          </p>
        )}
        <button
          type="button"
          disabled={invalidDays.length > 0}
          onClick={saveSchedule}
          className="w-full py-3 rounded-full text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] disabled:opacity-40"
        >
          Save Mass schedule
        </button>
      </section>

      {/* Theme colour */}
      <section className="rounded-[22px] border border-[var(--color-brand-border)] p-4 space-y-3">
        <h4 className="text-[16px] font-semibold text-[var(--color-brand-text)]">Parish colour</h4>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={parseHex(themeColor) ? themeColor : "#1C2C56"}
            onChange={e => setThemeColor(e.target.value.toUpperCase())}
            className="w-14 h-12 rounded-xl border border-[var(--color-brand-border)] bg-transparent"
            aria-label="Pick a parish colour"
          />
          <input
            value={themeColor}
            onChange={e => setThemeColor(e.target.value.toUpperCase())}
            placeholder="#1C2C56"
            className="flex-1 min-w-0 p-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[16px] font-mono text-[var(--color-brand-text)]"
          />
        </div>

        {/* The whole point of validating: an admin sees the consequence before
            a congregation does. */}
        {colourVerdict && (
          <div
            className={`rounded-xl p-3 text-[15px] leading-relaxed ${
              colourVerdict.ok
                ? "bg-[var(--color-brand-card-sunk)] text-[var(--color-brand-text)]"
                : "bg-[var(--color-brand-error)] text-[var(--color-brand-on-accent)]"
            }`}
          >
            {colourVerdict.ok ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Check className="w-4 h-4" /> Readable
                </span>
                <span
                  className="mt-2 inline-block px-3 py-1.5 rounded-md text-[15px] font-semibold"
                  style={{
                    background: themeColor,
                    color: readableTextOn(parseHex(themeColor)!).hex,
                  }}
                >
                  Button preview
                </span>
              </>
            ) : (
              <span className="flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {colourVerdict.problem}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={!colourVerdict?.ok}
          onClick={() => void save({ themeColor: themeColor.trim() })}
          className="w-full py-3 rounded-full text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] disabled:opacity-40"
        >
          Save colour
        </button>
        <button
          type="button"
          onClick={() => {
            setThemeColor("");
            void save({ themeColor: "" });
          }}
          className="w-full py-2.5 text-[16px] font-semibold text-[var(--color-brand-secondary)]"
        >
          Reset to the app's own colour
        </button>
      </section>

      {status.kind !== "idle" && (
        <p
          className={`flex items-center gap-2 text-[16px] ${
            status.kind === "error"
              ? "text-[var(--color-brand-error)]"
              : "text-[var(--color-brand-text)]"
          }`}
        >
          {status.kind === "busy" && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
          {status.message}
        </p>
      )}

      {managed?.updatedBy && (
        <p className="text-[15px] text-[var(--color-brand-secondary)]">
          Last changed by {managed.updatedBy}
          {managed.updatedAt ? ` on ${new Date(managed.updatedAt).toLocaleString()}` : ""}.
        </p>
      )}
    </div>
  );
}
