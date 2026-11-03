import { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { auth } from "../lib/firebase";
import { watchMyMemberships } from "../lib/membershipStore";
import { myMinistries, type MembershipDoc } from "../lib/memberships";

/**
 * What the pilgrim actually serves in.
 *
 * ## Why this is not a filter over My Applications
 *
 * An application is a request; a membership is a fact about now. They
 * come apart: somebody applies twice over three years, is approved
 * once, later leaves the ministry. Deriving this list from application
 * statuses would put a badge on a request and keep it there after the
 * parish had withdrawn it.
 *
 * ## Why approved memberships only
 *
 * A badge is a claim. A pending application belongs in My
 * Applications, where it has a status next to it and is plainly still
 * being decided - showing it here would read as "you are in", which is
 * the one thing the parish asked this screen not to say.
 */
export default function MyMinistries() {
  const uid = auth.currentUser?.uid ?? null;
  const [rows, setRows] = useState<MembershipDoc[]>([]);

  useEffect(() => {
    if (!uid) { setRows([]); return; }
    // Silent on failure. An empty card is the same shape as "you are
    // not in a ministry yet", and an error box on the account screen
    // over a card like this one is noise.
    return watchMyMemberships(uid, setRows, () => setRows([]));
  }, [uid]);

  if (!uid) return null;
  const mine = myMinistries(rows, uid);

  // Deliberately flat: no background, no border, no padding of its
  // own. This sits inside the My Profile card, and a bordered box
  // nested in a bordered box reads as a mistake. The heading matches
  // that card's own eyebrow so the two look like one panel.
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <HeartHandshake className="w-3.5 h-3.5 text-[var(--color-brand-secondary)] shrink-0" />
        <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans">
          My Ministries
        </h4>
      </div>

      {mine.length === 0 ? (
        /* Says what to do, not just that there is nothing. An empty
           card explaining its own emptiness is a dead end. */
        <p className="text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
          You are not listed in a ministry yet. Apply from the Ministries tab —
          or if you already serve in one, tell the parish there and they will
          confirm it with your coordinator.
        </p>
      ) : (
        <ul className="space-y-2">
          {mine.map(m => (
            <li
              key={m.itemId}
              className="flex items-center justify-between gap-2 bg-[var(--color-brand-card)] px-3 py-2.5 rounded-xl border border-[var(--color-brand-border)]"
            >
              {/* Wraps rather than truncating.
                  "Social Communications Ministry" came out as
                  "Social Communication…", which tells somebody they
                  are a member of something they cannot read. There is
                  no hover on a phone and nothing to tap, so an
                  ellipsis here hides the answer with no way back to
                  it. A ministry name is three words; it can have two
                  lines. */}
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--color-brand-text)] break-words">
                {m.ministryName}
              </span>
              <span className="shrink-0 px-2.5 py-1 bg-[var(--color-brand-gold)] text-white text-[11px] font-bold uppercase tracking-wider rounded-full">
                Member
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
