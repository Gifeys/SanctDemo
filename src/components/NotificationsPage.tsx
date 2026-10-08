import { useEffect, useState } from "react";
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, Trash2 } from "lucide-react";
import { watchNotifications, markRead, unreadCount } from "../lib/notifications";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { NotificationDoc } from "../types";

/**
 * Notifications, on their own screen.
 *
 * Same reasoning as My Applications: it was a card on the Me tab that
 * grew without limit, pushing everything else down. A row with a count,
 * opening a page, keeps Me readable and lets this list breathe.
 */
export default function NotificationsPage({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<NotificationDoc[]>([]);

  useEffect(() => watchNotifications(setItems), []);

  const unread = unreadCount(items);

  async function remove(id: string) {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      // Yours to delete by the rules, so a failure here is the network.
      console.debug("[notifications] delete failed:", err);
    }
  }

  async function markAllRead() {
    // Sequential rather than parallel: a parish list is short, and a
    // burst of writes is more likely to trip a rate limit than to feel
    // faster.
    for (const n of items) {
      if (!n.readAt && n.id) await markRead(n.id);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[var(--color-brand-card)]">
      <div className="px-5 pt-5 pb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-brand-primary)]"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">
              Notifications
            </h1>
            <p className="text-[15px] text-[var(--color-brand-secondary)]">
              {items.length === 0
                ? "Nothing yet."
                : unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3 py-2 text-[14px] font-bold text-[var(--color-brand-secondary)]"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-6">
        {items.length === 0 ? (
          <div className="rounded-[22px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-6 text-center">
            <BellOff className="mx-auto w-7 h-7 text-[var(--color-brand-secondary)]" />
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
              When you apply for something, and when your parish responds, it appears here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map(n => (
              <li key={n.id}
                  className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-[16px] leading-snug text-[var(--color-brand-text)] ${n.readAt ? "font-semibold" : "font-bold"}`}>
                    {!n.readAt && (
                      <span aria-label="Unread"
                            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle bg-[var(--color-brand-primary)]" />
                    )}
                    {n.title}
                  </p>
                  <Bell className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-brand-secondary)]" aria-hidden />
                </div>

                <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-brand-text)]">{n.body}</p>

                {n.createdAt && (
                  <p className="mt-1 text-[13px] text-[var(--color-brand-secondary)]">
                    {new Date(n.createdAt).toLocaleString(undefined, {
                      month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap gap-3">
                  {!n.readAt && n.id && (
                    <button onClick={() => void markRead(n.id!)}
                            className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-primary)]">
                      <Check className="w-3.5 h-3.5" /> Mark read
                    </button>
                  )}
                  {n.id && (
                    <button onClick={() => void remove(n.id!)}
                            aria-label={`Delete "${n.title}"`}
                            className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-brand-secondary)]">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
