import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { watchNotifications, markRead, unreadCount } from "../lib/notifications";
import type { NotificationDoc } from "../types";

/**
 * The pilgrim's notifications.
 *
 * ## Why unread is a weight and a dot, not a dot alone
 *
 * The unread state has to survive a printed page, a bright porch and a
 * reader who cannot separate the hues, so the row carries a bolder title
 * as well as the marker.
 *
 * ## Why reading one is an explicit tap
 *
 * Marking everything read on open is the usual shortcut and it loses
 * things: a person opening the tab to check something else should not come
 * back later to find the parish's decision already dismissed. The tap is
 * the acknowledgement.
 */
export default function NotificationsCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [items, setItems] = useState<NotificationDoc[]>([]);

  useEffect(() => {
    if (!isLoggedIn) { setItems([]); return; }
    return watchNotifications(setItems);
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  const unread = unreadCount(items);

  return (
    <div className="bg-[var(--color-brand-card-sunk)] rounded-[22px] border border-[var(--color-brand-border)] p-5 space-y-3">
      <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans flex items-center gap-1.5">
        <Bell className="w-4 h-4" /> Notifications
        {unread > 0 && (
          <span className="ml-1 rounded-full bg-[var(--color-brand-primary)] px-2 py-0.5 text-[12px] text-[var(--color-brand-on-accent)]">
            {unread} new
          </span>
        )}
      </h4>

      {items.length === 0 ? (
        <p className="flex items-start gap-2 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          <BellOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          Nothing yet. When you apply for something, and when your parish responds,
          it appears here.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map(n => (
            <li
              key={n.id}
              className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-[15px] leading-snug text-[var(--color-brand-text)] ${n.readAt ? "font-semibold" : "font-bold"}`}>
                  {!n.readAt && (
                    <span
                      aria-label="Unread"
                      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle bg-[var(--color-brand-primary)]"
                    />
                  )}
                  {n.title}
                </p>
                {!n.readAt && n.id && (
                  <button
                    type="button"
                    onClick={() => void markRead(n.id!)}
                    aria-label={`Mark "${n.title}" as read`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[var(--color-brand-border)] px-2.5 py-1 text-[13px] font-bold text-[var(--color-brand-secondary)]"
                  >
                    <Check className="w-3.5 h-3.5" /> Read
                  </button>
                )}
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-brand-text)]">{n.body}</p>
              {n.createdAt && (
                <p className="mt-1 text-[13px] text-[var(--color-brand-secondary)]">
                  {new Date(n.createdAt).toLocaleString(undefined, {
                    month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
