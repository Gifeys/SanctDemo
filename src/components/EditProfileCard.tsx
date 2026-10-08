import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { auth } from "../lib/firebase";
import { getProfile, updateProfile } from "../lib/userProfile";
import { fileToAvatarDataUrl, initialsFor, AvatarError } from "../lib/avatar";
import type { UserProfile } from "../types";

/**
 * Your own profile: the picture and the name the app calls you.
 *
 * ## Why only these two
 *
 * They are the two things that are yours to decide. The full name on your
 * applications is what the parish office records, your parish cannot be
 * changed once chosen, and your email is your sign-in - each of those is
 * either someone else's to change or a different conversation. Putting
 * them in the same card as "what should we call you" would invite edits
 * the rules will refuse.
 *
 * ## Why the picture is applied immediately and the name is not
 *
 * Choosing a photograph is already a deliberate act with a file picker in
 * front of it; making someone then press Save is a second confirmation of
 * something they just confirmed. Typing is different - a half-typed name
 * is not an intention - so the nickname waits for Save.
 */
export default function EditProfileCard({
  isLoggedIn,
  onNicknameChange,
  onPhotoChange,
}: {
  isLoggedIn: boolean;
  /** Lets Home's greeting update without waiting for a reload. */
  onNicknameChange?: (nickname: string) => void;
  /** Keeps the profile header's avatar in step with this card's. */
  onPhotoChange?: (photoUrl: string) => void;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"photo" | "name" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) { setProfile(null); return; }
    let live = true;
    void getProfile(auth.currentUser.uid).then(p => { if (live) setProfile(p); });
    return () => { live = false; };
  }, [isLoggedIn]);

  if (!isLoggedIn || !profile) return null;

  const shownName = profile.nickname?.trim() || profile.fullName || "Pilgrim";

  async function choosePhoto(file: File) {
    setBusy("photo");
    setError(null);
    try {
      const photoUrl = await fileToAvatarDataUrl(file);
      await updateProfile(profile!.uid, { photoUrl });
      setProfile(p => (p ? { ...p, photoUrl } : p));
      onPhotoChange?.(photoUrl);
    } catch (err) {
      setError(err instanceof AvatarError ? err.message : "That photo could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto() {
    setBusy("photo");
    try {
      await updateProfile(profile!.uid, { photoUrl: "" });
      setProfile(p => (p ? { ...p, photoUrl: "" } : p));
      onPhotoChange?.("");
    } finally {
      setBusy(null);
    }
  }

  async function saveNickname() {
    const next = draft.trim().slice(0, 24);
    setBusy("name");
    setError(null);
    try {
      await updateProfile(profile!.uid, { nickname: next });
      setProfile(p => (p ? { ...p, nickname: next } : p));
      onNicknameChange?.(next);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch {
      setError("That could not be saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-[var(--color-brand-card-sunk)] rounded-[22px] border border-[var(--color-brand-border)] p-5">
      <h4 className="mb-3 text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans">
        My Profile
      </h4>

      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-3.5 py-2.5 text-[14px] text-[var(--color-brand-error)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt=""
              className="w-[72px] h-[72px] rounded-full object-cover border border-[var(--color-brand-border)]"
            />
          ) : (
            <span
              aria-hidden
              className="w-[72px] h-[72px] rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] flex items-center justify-center text-[24px] font-bold"
            >
              {initialsFor(shownName)}
            </span>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "photo"}
            aria-label={profile.photoUrl ? "Change your photo" : "Add a photo"}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] border-2 border-[var(--color-brand-card-sunk)] flex items-center justify-center"
          >
            {busy === "photo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              // Cleared so choosing the same file twice still fires.
              e.target.value = "";
              if (file) void choosePhoto(file);
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <>
              <label htmlFor="nick" className="block text-[13px] font-bold text-[var(--color-brand-secondary)] mb-1">
                Nickname
              </label>
              <input
                id="nick"
                value={draft}
                maxLength={24}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") void saveNickname();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2 text-[16px]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveNickname()}
                  disabled={busy === "name"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-3.5 py-2 text-[14px] font-bold disabled:opacity-50"
                >
                  {busy === "name" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3.5 py-2 text-[14px] font-bold text-[var(--color-brand-secondary)]"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                {/* Removing the photo is an edit, so it lives in the
                    editing state. On the resting card it sat beside the
                    name as though it were as ordinary as reading it. */}
                {profile.photoUrl && (
                  <button
                    type="button"
                    onClick={() => void removePhoto()}
                    className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-error)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove photo
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[20px] font-bold text-[var(--color-brand-text)] truncate">{shownName}</p>
              <p className="text-[14px] text-[var(--color-brand-secondary)] truncate">{profile.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setDraft(profile.nickname ?? ""); setEditing(true); }}
                  className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-primary)]"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit nickname
                </button>

              </div>
            </>
          )}
        </div>
      </div>

      {saved && (
        <p role="status" className="mt-3 text-[14px] text-[var(--color-brand-success)]">
          Saved. Your home screen will greet you by this name.
        </p>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-brand-secondary)]">
        Your nickname is what the app calls you. The parish still records applications
        under your full name, {profile.fullName || "—"}.
      </p>
    </div>
  );
}
