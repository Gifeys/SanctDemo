import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { SUGGESTIONS } from "../lib/sancti";
import { useLanguage } from "../lib/useLanguage";
import { t } from "../lib/ui";
import type { Reply } from "../lib/sanctiAnswers";

/**
 * Sancti, as a sheet over whatever you were looking at.
 *
 * ## Why a sheet and not a screen
 *
 * Most of what Sancti does is take you somewhere. A full screen would
 * have to close itself to do that, and the pilgrim would lose the
 * conversation at the moment it paid off. Over the app, it can answer,
 * slide away to show you the thing, and still be there when you come
 * back.
 *
 * ## Why it does not look like a chat app
 *
 * The brief is explicit, and it is right: this is for people who have
 * never used one. So there is no typing indicator pretending somebody
 * is at the other end, no avatars on every line, no timestamps. Two
 * kinds of bubble, the parish's own navy and card colours, and the
 * suggestions sitting in the empty state where a new user will look.
 */

export interface SanctiMessage {
  id: string;
  from: "you" | "sancti";
  text: string;
  /** A tappable follow-up Sancti offered with this answer. */
  followUp?: string;
}

export default function SanctiSheet({
  open, onClose, messages, thinking, onSend, onFollowUp, parishName,
}: {
  open: boolean;
  onClose: () => void;
  messages: SanctiMessage[];
  thinking: boolean;
  onSend: (text: string) => void;
  onFollowUp: (message: SanctiMessage) => void;
  parishName: string;
}) {
  const { language } = useLanguage();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // New answers scroll into view; the input keeps focus so a follow-up
  // question does not need the keyboard summoned again.
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length, thinking]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  if (!open) return null;

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setDraft("");
  }

  return (
    <div className="sancti" role="dialog" aria-modal="true" aria-label="Ask Sancti">
      <button type="button" className="sancti__scrim" onClick={onClose} aria-label="Close Sancti" />

      <div className="sancti__sheet">
        <header className="sancti__head">
          <span className="sancti__avatar" aria-hidden>
            <img src="/ui/sanctiwalk-mark-white.png" alt="" />
          </span>
          <span className="sancti__who">
            <span className="sancti__name">Sancti</span>
            <span className="sancti__sub">{t("sancti.subtitle", language)} {parishName}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="sancti__x">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="sancti__log">
          {messages.length === 0 && (
            <div className="sancti__empty">
              <p className="sancti__greeting">
                {t("sancti.greeting", language)}
              </p>
              <p className="sancti__try">{t("sancti.tryThese", language)}</p>
              <div className="sancti__chips">
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" className="sancti__chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`sancti__row sancti__row--${m.from}`}>
              <div className={`sancti__bubble sancti__bubble--${m.from}`}>
                {/* Answers carry real line breaks - a Mass schedule is a
                    list, not a paragraph - so they are split rather than
                    run together. */}
                {m.text.split("\n").map((line, i) => (
                  <span key={i} className="sancti__line">{line}</span>
                ))}
              </div>
              {m.followUp && (
                <button type="button" className="sancti__followup" onClick={() => onFollowUp(m)}>
                  {m.followUp}
                </button>
              )}
            </div>
          ))}

          {thinking && (
            <div className="sancti__row sancti__row--sancti">
              <div className="sancti__bubble sancti__bubble--sancti sancti__thinking" aria-label="Sancti is looking that up">
                <span /><span /><span />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form
          className="sancti__compose"
          onSubmit={e => { e.preventDefault(); send(draft); }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={t("sancti.placeholder", language)}
            aria-label="Ask Sancti a question"
            className="sancti__input"
          />
          <button
            type="submit"
            className="sancti__send"
            disabled={!draft.trim()}
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * The way in: a floating button above the tab bar.
 *
 * Here rather than in the tab bar because Sancti's job is taking you
 * places, which means it has to be reachable from the place you are
 * stuck on — and because a sixth tab would have pushed five labels
 * into truncating.
 */
export function SanctiButton({ onClick }: { onClick: () => void }) {
  const { language } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      data-spotlight="sancti-button"
      className="sancti-fab"
      aria-label={t("sancti.ask", language)}
    >
      <img src="/ui/sanctiwalk-mark-white.png" alt="" aria-hidden />
      <span className="sancti-fab__label">{t("sancti.ask", language)}</span>
    </button>
  );
}
