import { useCallback, useRef, useState } from "react";
import SanctiSheet, { SanctiButton, type SanctiMessage } from "./SanctiSheet";
import { useSpotlight } from "./Spotlight";
import {
  understand, aliasesFor, needsConfirmation, readAnswer, type SanctiAction,
} from "../lib/sancti";
import {
  massAnswer, historyAnswer, itemAnswer, distanceAnswer, contactAnswer,
  reminderAnswer, helpAnswer, unknownAnswer, offerFor, withOffer, declinedAnswer,
  openingLine, type Reply,
} from "../lib/sanctiAnswers";
import { resolveSacrament, resolveMinistry } from "../lib/itemContent";
import { isOpenForApplications } from "../lib/availability";
import { haversineMeters, type Coordinates } from "../lib/geo";
import { ROUTES, MASS_SCHEDULES } from "../data";
import { parishHistoryLede } from "./ChurchHistory";
import type { ParishContent } from "../lib/parishContent";
import type { Language } from "../lib/language";

/**
 * Sancti, wired to the app.
 *
 * ## Why the plumbing is separate from the chat
 *
 * SanctiSheet draws bubbles and knows nothing else. This decides what a
 * sentence means, fetches the parish's real data, writes the answer and
 * then does the thing — switching tabs, pointing at a button, setting a
 * reminder. Keeping those apart means the chat can be restyled without
 * touching the behaviour, and the behaviour can be reasoned about
 * without reading any JSX.
 *
 * ## Why answers are late and actions are later
 *
 * Sancti replies, and only then navigates. Acting first would slide the
 * screen away before the pilgrim had read why — which is the difference
 * between a guide and a jump-cut.
 */

export interface SanctiTools {
  /** Switch tabs. */
  go: (tab: string) => void;
  /** Make this parish the one on screen. */
  selectParish: (parishId: string) => void;
  /** Open the map focused on a parish. */
  walkTo: (parishId: string) => void;
  /** Turn a Mass reminder on for a parish the pilgrim does not belong to. */
  followParish: (parishId: string) => void;
  /** The parish currently on screen. */
  activeParishId: string;
  activeParishName: string;
  /** Admin-managed content for the active parish, if any. */
  content: ParishContent | null;
  /** Where the pilgrim is, when they have allowed it. */
  position: Coordinates | null;
  /**
   * The reading language. Sancti ANSWERS in this, but understands both
   * whatever it is set to - a pilgrim reading in English still types
   * "anong oras ang misa", and refusing that would be the app telling
   * someone their own language is the wrong one.
   */
  language: Language;
}

const PARISH_NAMES = ROUTES.map(r => aliasesFor(r.id, r.name));

function parishLabel(parishId: string): string {
  const route = ROUTES.find(r => r.id === parishId);
  return route?.name.replace(" Guide", "").replace(" Tour", "") ?? "this parish";
}

export default function SanctiHost({ tools }: { tools: SanctiTools }) {
  const spotlight = useSpotlight();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SanctiMessage[]>([]);
  const [thinking, setThinking] = useState(false);

  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  const say = useCallback((from: SanctiMessage["from"], reply: Reply | string) => {
    const body = typeof reply === "string" ? { text: reply } : reply;
    setMessages(m => [
      ...m,
      { id: `${Date.now()}-${m.length}`, from, text: body.text, followUp: body.followUp },
    ]);
  }, []);

  /**
   * Points at something in the app, after closing the sheet.
   *
   * The same spotlight the tutorial uses, so "the Map is here" looks
   * like the tour the pilgrim already saw rather than a second,
   * unfamiliar highlight. It times out by itself: a highlight that
   * waits for a tap is a modal, and nobody asked for one.
   */
  const point = useCallback((target: string, body: string) => {
    setOpen(false);
    window.setTimeout(() => {
      spotlight.show({ target, card: { body }, autoHideMs: 4200, dismissOnTapOutside: true });
    }, 360);
  }, [spotlight]);

  /**
   * The thing Sancti has offered to open and is waiting on a yes for.
   *
   * A ref rather than state: it is read and written inside `ask`, which
   * must not be rebuilt between the question and the answer - a new
   * `ask` identity mid-conversation would lose the offer it is holding.
   */
  const pendingRef = useRef<{ action: SanctiAction; parishId?: string } | null>(null);

  const act = useCallback((action: SanctiAction, parishId?: string) => {
    const t = toolsRef.current;
    const target = parishId ?? t.activeParishId;

    switch (action) {
      case "OPEN_MAP":
        t.go("navigator");
        point("tab-map", "This is the Map — every parish in the diocese, with walking directions.");
        break;
      case "SHOW_CHURCH_LOCATION":
        t.walkTo(target);
        setOpen(false);
        break;
      case "OPEN_CHURCH":
        t.selectParish(target);
        t.go("home");
        setOpen(false);
        break;
      case "OPEN_AR":
        t.go("ar");
        point("tab-scan", "Point your camera at a statue or marker and the scanner will name it.");
        break;
      case "OPEN_MASS_SCHEDULE":
        if (parishId) t.selectParish(parishId);
        t.go("home");
        point("mass-schedule", "The Mass times for this parish, kept by the parish office.");
        break;
      case "OPEN_CHURCH_HISTORY":
        if (parishId) t.selectParish(parishId);
        t.go("history");
        setOpen(false);
        break;
      case "OPEN_SACRAMENTS":
      case "OPEN_BAPTISM":
      case "OPEN_WEDDING":
        t.go("sacraments");
        setOpen(false);
        break;
      case "OPEN_MINISTRIES":
        t.go("ministries");
        setOpen(false);
        break;
      case "OPEN_SETTINGS":
        t.go("me");
        point("tab-me", "Reminders, your profile and your applications live here.");
        break;
      case "CREATE_REMINDER":
        // Following the parish is what actually schedules the alarms;
        // the pilgrim's own parish is always followed already.
        if (parishId && parishId !== t.activeParishId) t.followParish(parishId);
        break;
      default:
        break;
    }
  }, [point]);

  /**
   * One question, answered.
   *
   * The pause is deliberate and short. Everything here is local, so a
   * reply could land in the same frame as the question — which reads as
   * the app ignoring you and printing a canned line. A beat makes it
   * read as having been considered.
   */
  const ask = useCallback((text: string) => {
    say("you", text);
    setThinking(true);

    window.setTimeout(() => {
      const t = toolsRef.current;

      // A bare yes or no, when Sancti has an offer open.
      //
      // Checked before understanding the sentence, because "open it" and
      // "sige" carry no intent of their own - they only mean anything as
      // an answer to what was just asked.
      const pending = pendingRef.current;
      if (pending) {
        const answer = readAnswer(text);
        if (answer === "yes") {
          pendingRef.current = null;
          setThinking(false);
          act(pending.action, pending.parishId);
          return;
        }
        if (answer === "no") {
          pendingRef.current = null;
          setThinking(false);
          say("sancti", declinedAnswer());
          return;
        }
        // Anything else is a new question, and the offer lapses rather
        // than waiting around to be answered by an unrelated sentence.
        pendingRef.current = null;
      }

      const heard = understand(text, PARISH_NAMES);
      const parishId = heard.parishId ?? t.activeParishId;
      const name = parishLabel(parishId);

      // The parish's own times where the office has entered them, the
      // compiled ones otherwise — the same precedence the Mass card
      // uses, so Sancti and the card can never disagree.
      const schedule =
        (parishId === t.activeParishId ? t.content?.massSchedule : undefined)
        ?? MASS_SCHEDULES[parishId]?.schedule
        ?? [];

      let reply: Reply;
      switch (heard.action) {
        case "OPEN_MASS_SCHEDULE":
          reply = massAnswer(name, schedule);
          break;
        case "CREATE_REMINDER":
          reply = reminderAnswer(name, schedule, heard.time);
          break;
        case "OPEN_CHURCH_HISTORY": {
          // The parish's own words where an admin has written them, the
          // compiled opening otherwise - the same order the history
          // card uses, so the two can never disagree about whether this
          // parish has a history at all.
          const managed = parishId === t.activeParishId ? t.content?.historyBody?.trim() : undefined;
          reply = historyAnswer(name, managed || parishHistoryLede(parishId));
          break;
        }
        case "OPEN_BAPTISM": {
          const item = resolveSacrament(t.content, "sac-baptism", t.language);
          reply = itemAnswer(item, isOpenForApplications(t.content, "sac-baptism"));
          break;
        }
        case "OPEN_WEDDING": {
          const item = resolveSacrament(t.content, "sac-matrimony", t.language);
          reply = itemAnswer(item, isOpenForApplications(t.content, "sac-matrimony"));
          break;
        }
        case "OPEN_SACRAMENTS":
          reply = { text: `${name} has a page for each sacrament, with what the office needs for it.` };
          break;
        case "OPEN_MINISTRIES": {
          const first = resolveMinistry(t.content, "min-altar-servers", t.language);
          reply = first
            ? { text: `${name} has lay ministries you can join.` }
            : unknownAnswer();
          break;
        }
        case "ANSWER_DISTANCE": {
          const route = ROUTES.find(r => r.id === parishId);
          const metres =
            t.position && route
              ? haversineMeters(t.position, route.coordinates)
              : null;
          reply = distanceAnswer(name, metres, t.position !== null);
          break;
        }
        case "ANSWER_CONTACT":
          reply = contactAnswer(name, resolveSacrament(t.content, "sac-baptism", t.language)?.contact);
          break;
        // These say WHERE the thing is rather than announcing that
        // Sancti is about to go there. The offer underneath does the
        // asking, and a reply that already said "I'll show you" would
        // be promising something the pilgrim has not agreed to yet.
        case "OPEN_MAP":
          reply = { text: "The map is on the Map tab — every parish in the diocese, with walking directions." };
          break;
        case "SHOW_CHURCH_LOCATION":
          reply = { text: `${name} is on the map, and I can walk you there from where you are.` };
          break;
        case "OPEN_CHURCH":
          reply = { text: `${name} has its own page — Mass times, history and what the office offers.` };
          break;
        case "OPEN_AR":
          reply = { text: "The scanner is on the Scan tab. Point it at a statue, an image or a marker and it will tell you what it is." };
          break;
        case "OPEN_SETTINGS":
          reply = { text: "Your reminders, your profile and your applications are under Me." };
          break;
        case "HELP":
          reply = helpAnswer(name);
          break;
        default:
          reply = unknownAnswer();
      }

      setThinking(false);

      // Ask before leaving the screen.
      //
      // Sancti used to answer and then navigate, every time: "where is
      // the map" opened the map, and the pilgrim lost the conversation
      // to an answer they had not asked to be taken to. A question now
      // gets its answer in full, with the screen offered underneath as
      // one tap. An instruction - "open the map" - is consent already
      // given and still goes straight there.
      const offer = needsConfirmation(heard) ? offerFor(heard.action) : null;
      if (offer) {
        pendingRef.current = { action: heard.action, parishId: heard.parishId };
        say("sancti", withOffer(reply, offer));
        return;
      }

      // Told to, rather than asked: acknowledge and go. Repeating the
      // full answer under an instruction to open it reads as not having
      // been heard, and the screen carrying that answer is already on
      // its way.
      const opening = heard.imperative ? openingLine(heard.action) : null;
      say("sancti", opening ? { text: opening } : reply);

      // Said first, then done. See the note at the top.
      if (heard.action !== "UNKNOWN" && heard.action !== "HELP") {
        window.setTimeout(() => act(heard.action, heard.parishId), 620);
      }
    }, 420);
  }, [say, act]);

  return (
    <>
      <SanctiButton onClick={() => setOpen(true)} />
      <SanctiSheet
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        thinking={thinking}
        parishName={tools.activeParishName}
        onSend={ask}
        onFollowUp={m => ask(m.followUp ?? "")}
      />
    </>
  );
}
