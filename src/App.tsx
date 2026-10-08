import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PresenceProvider, usePresence } from "./context/PresenceContext";
import PhoneContainer from "./components/PhoneContainer";
import Onboarding from "./components/Onboarding";
import SearchScreen from "./components/SearchScreen";
import PrayScreen from "./components/PrayScreen";
import PwaBanner from "./components/PwaBanner";

// New Components
import Dashboard from "./components/Dashboard";
import { type HomeSection } from "./components/HomeQuickLinks";
import MeTab from "./components/MeTab";
import ChurchHistory from "./components/ChurchHistory";
import MassSchedule from "./components/MassSchedule";
import MinistriesTab from "./components/MinistriesTab";
import ParishSectionHeader from "./components/ParishSectionHeader";
import SacramentsTab from "./components/SacramentsTab";
import ArTour from "./components/ArTour";
import PilgrimQuiz from "./components/PilgrimQuiz";
import LoginModal from "./components/LoginModal";
import { useDeviceSurface } from "./lib/displayMode";
import AdminPortal from "./components/AdminPortal";
import RosarySettingsModal from "./components/RosarySettingsModal";
import PresenceSheet from "./components/PresenceSheet";
import SimulatorPanel from "./components/SimulatorPanel";
import CustomDioceseMap from "./components/CustomDioceseMap";

// Firebase imports
import { auth, db } from "./lib/firebase";
import { logActivity } from "./lib/activityLog";
import { getProfile } from "./lib/userProfile";
import { watchNotifications, unreadCount } from "./lib/notifications";
import { useReminders } from "./lib/useReminders";
import { useParishContents } from "./lib/useParishContents";
import type { ParishReminders } from "./lib/reminderSchedule";
import {
  loadFollowed, saveFollowed, withFollowed, remindableParishes,
} from "./lib/followedParishes";
import { notifyNow } from "./lib/deviceNotifications";
import { announcementsForParish, publishedOnly } from "./lib/announcements";
import ReminderSettingsCard from "./components/ReminderSettingsCard";
import TutorialRunner from "./components/TutorialRunner";
import SanctiHost from "./components/SanctiHost";
import { hasSeenTutorial, type TutorialTab } from "./lib/tutorial";
import { useLanguage } from "./lib/useLanguage";
import { t } from "./lib/ui";
import MyApplicationsPage from "./components/MyApplicationsPage";
import NotificationsPage from "./components/NotificationsPage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, getDoc, getDocs, writeBatch, query, where } from "firebase/firestore";

import { Route, UserProgress } from "./types";
import { ROUTES, BADGES, MASS_SCHEDULES } from "./data";
import { loadHomeParishId, saveHomeParishId } from "./lib/homeParish";
import { tabForParishSelection } from "./lib/parishSelection";
import { parishPhoto, parishPhotoAlt } from "./lib/parishPhotos";
import parishData from "./data/diocese-parishes.json";
import { assertKnownParishIds, routeIdForParish } from "./lib/parishIds";
import { useParishContent } from "./lib/useParishContent";
import { checkParishColour, readableTextOn, parseHex } from "./lib/contrast";

import {
  Compass, Map, Cpu, Sparkles, BookOpen, Clock, Heart,
  Menu, X, Home, Lock, HelpCircle, User, ShieldCheck, HelpCircle as QuizIcon,
  ScanLine as ArIcon, Users as MinistryIcon, MapPin, ChevronRight, Bookmark,
  Settings as SettingsIcon,
  Church, Smartphone, Monitor, Wifi, WifiOff, FlaskConical
} from "lucide-react";

// Watches presence from inside the provider and reports an arrival upward.
// App itself renders PresenceProvider, so it cannot call usePresence(); this
// tiny child can. Only `present` switches the dashboard — `approaching` is
// still just passing by, and switching then would yank the screen around
// while someone walks down the street.
/**
 * Applies the active parish's admin-chosen colour to the app's tokens.
 *
 * The text colour placed ON that background is derived, never chosen: an
 * admin picks one value and the pairing is computed, so no combination of
 * choices can produce unreadable text. The colour is re-validated here as
 * well as in the editor, because a document written before the validator
 * existed — or edited straight in the Firebase console — would otherwise
 * bypass it entirely.
 */
function ParishTheme({ parishId }: { parishId: string | null }) {
  const managed = useParishContent(parishId);
  const colour = managed?.themeColor;

  useEffect(() => {
    const root = document.documentElement;
    const clear = () => {
      root.style.removeProperty("--color-brand-primary");
      root.style.removeProperty("--color-brand-accent");
      root.style.removeProperty("--color-brand-on-accent");
    };

    if (!colour) {
      clear();
      return;
    }
    const verdict = checkParishColour(colour);
    const rgb = parseHex(colour);
    if (!verdict.ok || !rgb) {
      console.warn(`[SanctiWalk] Ignoring parish colour ${colour}: ${verdict.problem}`);
      clear();
      return;
    }

    root.style.setProperty("--color-brand-primary", colour);
    root.style.setProperty("--color-brand-accent", colour);
    root.style.setProperty("--color-brand-on-accent", readableTextOn(rgb).hex);
    return clear;
  }, [colour]);

  return null;
}

/**
 * Sancti needs the pilgrim's position to answer "how far is it", and
 * App renders PresenceProvider so it cannot read the context itself.
 * This sits inside the provider and hands it down.
 */
function SanctiMount({
  activeParishId, activeParishName, content, language,
  onGo, onShowHomeSection, onSelectParish, onWalkTo, onFollowParish,
}: {
  activeParishId: string;
  activeParishName: string;
  content: import("./lib/parishContent").ParishContent | null;
  language: "en" | "fil";
  onGo: (tab: string) => void;
  onShowHomeSection: (section: HomeSection) => void;
  onSelectParish: (parishId: string) => void;
  onWalkTo: (parishId: string) => void;
  onFollowParish: (parishId: string) => void;
}) {
  const { position } = usePresence();
  return (
    <SanctiHost
      tools={{
        go: onGo,
        showHomeSection: onShowHomeSection,
        selectParish: onSelectParish,
        walkTo: onWalkTo,
        followParish: onFollowParish,
        activeParishId,
        activeParishName,
        content,
        position,
        language,
      }}
    />
  );
}

function PresenceParishSync({ onArrive }: { onArrive: (parishId: string) => void }) {
  const { presence } = usePresence();

  useEffect(() => {
    if (presence.mode === "present" && presence.parishId) {
      onArrive(presence.parishId);
    }
  }, [presence.mode, presence.parishId, onArrive]);

  return null;
}

// The fallback parish used wherever a home parish is needed but none has
// been chosen — the map's own default, and the tour behind a home parish
// that has no tour of its own.
//
// This is also the answer on first run: the app picks a parish rather than
// asking, because the client does not want a welcome screen standing between
// install and the dashboard.
function firstLiveParishId(): string | null {
  return ROUTES.find(r => r.status !== "coming_soon")?.id ?? ROUTES[0]?.id ?? null;
}

// A home parish may be any of the 31 in the diocese, not just the two with a
// tour behind them — the parish picker lists them all, and a pilgrim's
// own parish is very likely one of the 29 still being documented. The active
// *tour* must still be one of the live routes, so the two are mapped rather
// than conflated.
const DIOCESE_PARISH_IDS = (parishData as { parishes: { id: string }[] }).parishes.map(p => p.id);
const VALID_HOME_IDS = [...ROUTES.map(r => r.id), ...DIOCESE_PARISH_IDS];

/** The tour to open for a chosen home parish, falling back to a live one. */
function routeForHomeParish(homeId: string | null): string | null {
  if (!homeId) return firstLiveParishId();
  if (ROUTES.some(r => r.id === homeId)) return homeId;
  return routeIdForParish(homeId) ?? firstLiveParishId();
}

// Checked once at startup. The bug this guards is a silence, not a crash: a
// stale id makes a documented parish render as though nothing had been
// collected about it, and every screen dutifully says "not collected yet".
//
// Reported rather than thrown — a white screen during a defense demo would
// be a worse failure than the one being guarded against.
try {
  assertKnownParishIds();
} catch (error) {
  console.error("[SanctiWalk]", error instanceof Error ? error.message : error);
}

export default function App() {
  // The pilgrim's home parish, chosen once and remembered. This is the
  // fallback the dashboard shows whenever GPS says they are not at a parish.
  const [homeParishId, setHomeParishId] = useState<string | null>(() =>
    loadHomeParishId(VALID_HOME_IDS) ?? firstLiveParishId()
  );
  /**
   * A request from outside the dashboard for one part of the bulletin.
   *
   * Sancti sets this when the pilgrim accepts "want me to open the Mass
   * schedule?". The id makes a repeat request its own event; see
   * Dashboard's sectionRequest.
   */
  const [homeSectionRequest, setHomeSectionRequest] =
    useState<{ section: HomeSection; id: number } | null>(null);
  const showHomeSection = useCallback((section: HomeSection) => {
    setHomeSectionRequest(prev => ({ section, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const [isChangeParishOpen, setIsChangeParishOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  // There is deliberately no first-run parish picker. On a fresh install
  // homeParishId is seeded with firstLiveParishId(), so the app already knows
  // a sensible parish to open on and asking would be a question it can answer
  // itself. The picker below still exists, reached from "Change Home Parish"
  // in Me, for the pilgrim who wants a different one.

  // Navigation & Frame settings. Seeded from the home parish so the app opens
  // on that parish's dashboard rather than asking which church to pick — the
  // app can work that out, so it should not ask.
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(() =>
    routeForHomeParish(loadHomeParishId(VALID_HOME_IDS))
  );
  type Tab =
    | "home" | "navigator" | "rosary" | "mass" | "ministries" | "history"
    | "sacraments" | "ar" | "quiz" | "me" | "admin" | "pwa-devkit"
    | "myApplications" | "notifications";

  /**
   * The tab, remembered across a restart.
   *
   * Not a convenience. Android's low-memory killer terminates this app
   * while it is in the background - every recorded exit on the test
   * phone was reason=3 LOW_MEMORY, not a crash - and a WebView app
   * carrying a map is a large, attractive target. When that happens the
   * app restarts from scratch, and landing back on Home after having
   * been on the Map is exactly what "the map crashed" looks like from
   * the outside.
   *
   * It cannot stop the kill. It can make coming back feel like coming
   * back rather than starting over.
   *
   * "ar" and "admin" are deliberately NOT restored: reopening straight
   * into the camera, or into the parish office, is not what someone
   * returning to the app expects.
   */
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem("sanctiwalk.tab");
      const restorable: Tab[] = ["home", "navigator", "rosary", "mass", "me"];
      if (saved && (restorable as string[]).includes(saved)) return saved as Tab;
    } catch {
      // Private mode, or storage blocked. Home is the right fallback.
    }
    return "home";
  });

  useEffect(() => {
    try {
      localStorage.setItem("sanctiwalk.tab", activeTab);
    } catch {
      // Nothing to do; the tab simply will not be remembered.
    }
  }, [activeTab]);

  // Where "Back" goes from the history page. It is opened from two places -
  // the Learn more on Home's Church History card, and the parish's own page
  // reached from the map - and a single hardcoded destination would strand
  // whoever came from the other one.
  // History is reached from the dashboard now that the separate parish
  // page is gone, so there is only one place to go back to.
  const [historyReturnTab] = useState<"home">("home");

  // Whether Scan's viewfinder is open, so the parish band can get out of
  // the way of a live camera.
  const [scanCameraLive, setScanCameraLive] = useState(false);

  
  const [isOffline, setIsOffline] = useState(false);
  const [isMobileOnly, setIsMobileOnly] = useState(true);

  // A real phone gets the whole screen. The centring and the 24px of
  // breathing room below only make sense around the desktop mockup; applied
  // to the installed app they inset it from the edges it should be using,
  // and left the fixed-position screens (sign-in, search) looking like a
  // different app at a different size.
  const deviceSurface = useDeviceSurface();
  const [isRosarySettingsOpen, setIsRosarySettingsOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Identity state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  // The greeting name.
  //
  // The pilgrim's own nickname when they have set one, which is the whole
  // point of having one. The email's first word is the fallback, and it
  // was the only thing here before - which is how someone came to be
  // greeted as "sanctiwalk" on their own home screen.
  const [nickname, setNickname] = useState<string | undefined>(undefined);
  /** The pilgrim's own parish, from their profile. Home returns here. */
  const [myParishId, setMyParishId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const greetingName =
    (isLoggedIn ? nickname?.trim() : "") ||
    (isLoggedIn && userEmail ? userEmail.split("@")[0].split(/[._-]/)[0] : undefined);

  const [isAdmin, setIsAdmin] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  /**
   * Unread count, and a phone notification for anything new.
   *
   * The seen-set is what stops the second half firing for history. On
   * the first snapshot every existing notification is "new" to this
   * listener, and without recording them first, opening the app would
   * put every decision the parish ever made into the notification tray
   * at once.
   */
  const seenNotificationsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadNotifications(0);
      seenNotificationsRef.current = null;
      return;
    }
    return watchNotifications(items => {
      setUnreadNotifications(unreadCount(items));

      const ids = new Set(items.map(n => n.id).filter(Boolean) as string[]);
      if (seenNotificationsRef.current === null) {
        // First snapshot: adopt it silently.
        seenNotificationsRef.current = ids;
        return;
      }

      if (!remindersRef.current.settings.applicationUpdates) {
        seenNotificationsRef.current = ids;
        return;
      }

      for (const item of items) {
        if (!item.id || seenNotificationsRef.current.has(item.id)) continue;
        if (item.readAt) continue;
        // Raised on the phone, not only in the app. This is the one
        // category that cannot be scheduled in advance - the parish
        // decides when it decides - so it arrives when the app is next
        // open. See lib/deviceNotifications.ts for why not push.
        void notifyNow(item.title, item.body);
      }
      seenNotificationsRef.current = ids;
    });
  }, [isLoggedIn, uid]);
  // Read once per sign-in, then kept current by Me's editor rather than
  // re-read on every render.
  useEffect(() => {
    if (!isLoggedIn || !uid) { setNickname(undefined); return; }
    let live = true;
    void getProfile(uid).then(p => {
      if (!live) return;
      setNickname(p?.nickname ?? undefined);
      // The parish chosen at signup. Home belongs to it: it is the one
      // the pilgrim actually attends, and the one their applications go
      // to. Anything else on screen is a visit.
      if (p?.churchId) {
        setMyParishId(p.churchId);
        setSelectedChurchId(current => current ?? p.churchId);
      }
    });
    return () => { live = false; };
  }, [isLoggedIn, uid]);

  // The applications collection in Firestore: ministry applications and
  // sacrament bookings share it, distinguished by `type`.
  //
  // The first six fields are what every application has had from the start
  // and what the existing lists render. The rest arrive on ministry
  // applications (see lib/ministryApplication.ts) and are optional here
  // because the sacrament bookings and the older seeded rows do not carry
  // them - reading ministry or parish off `details` was the alternative,
  // and parsing a sentence is not a data model.
  const [applications, setApplications] = useState<Array<{
    id: string;
    type: string;
    applicant: string;
    details: string;
    date: string;
    status: string;
    email?: string;
    mobile?: string;
    ministryId?: string;
    ministryName?: string;
    parishId?: string;
    parishName?: string;
    message?: string;
    consent?: boolean;
    submittedAt?: string;
  }>>([]);

  // Dynamic Announcements list
  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    type: string;
  }>>([]);

  // Dynamic Devotee Stations Comments Database
  const [commentsByStation, setCommentsByStation] = useState<Record<string, Array<{
    user: string;
    text: string;
    date: string;
  }>>>({
    "mhcp-altar": [
      { user: "Mary Grace", text: "Truly serene altar. It is the best place to pray in Maypajo.", date: "May 14" },
      { user: "Bro. Justine", text: "The wood carvings are outstanding! A true catechism piece.", date: "May 15" }
    ],
    "mhcp-patron": [
      { user: "Nanay Corazon", text: "Maria Auxiliadora, pray for our family during sick days.", date: "May 12" }
    ]
  });

  const [activeCommentInput, setActiveCommentInput] = useState("");

  // User Progress passport status state
  const [userProgress, setUserProgress] = useState<UserProgress>({
    completedStations: [],
    completedRoutes: [],
    badges: [],
    steps: 640,
    distanceKm: 0.42,
    points: 120
  });

  // 1. Listen to Auth State changes in Firebase
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);
        setUserEmail(user.email || "");
        setUid(user.uid);

        // Admin status is derived from membership in the "admins" collection
        // (one document per uid, granted only from the Firebase console),
        // never from anything the client controls like the email address.
        try {
          const adminSnap = await getDoc(doc(db, "admins", user.uid));
          setIsAdmin(adminSnap.exists());
        } catch (err) {
          console.error("Error checking admin status from Firestore:", err);
          setIsAdmin(false);
        }

        // Fetch / sync user profile document in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribeUserDoc = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUserProgress({
                completedStations: data.completedStations || [],
                completedRoutes: data.completedRoutes || [],
                badges: data.badges || [],
                steps: data.steps || 640,
                distanceKm: data.distanceKm || 0.42,
                points: data.points || 120
              });
            }
          },
          (error) => {
            console.error("Error listening to user profile document (check Firestore rules / sign-in state):", error);
          }
        );

        return () => {
          unsubscribeUserDoc();
        };
      } else {
        setIsLoggedIn(false);
        setUserEmail("");
        setIsAdmin(false);
        setUid(null);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // 2. Listen to Applications collection in Firestore (with dynamic seeding if database empty).
  // Under the Firestore rules, a signed-out user cannot read this collection
  // at all, and a signed-in non-admin can only read documents whose "uid"
  // matches their own uid. Subscribe accordingly so we never attempt a read
  // the rules will reject.
  useEffect(() => {
    if (!isLoggedIn || !uid) {
      setApplications([]);
      return;
    }

    const applicationsQuery = isAdmin
      ? collection(db, "applications")
      : query(collection(db, "applications"), where("uid", "==", uid));

    const unsub = onSnapshot(
      applicationsQuery,
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });

        if (items.length === 0 && isAdmin) {
          // Seed initial applications to Firestore if empty (admin only —
          // a non-admin write here would be rejected by the rules anyway,
          // and every application must carry an owning uid).
          const initialApps = [
            {
              type: "Sacrament Booking",
              applicant: "Christian dela Vega",
              details: "Holy Baptism - May 24, 2026 (Sponsor: Maria Santos)",
              date: "05/12/2026",
              status: "Awaiting Parish Interview",
              uid,
              createdAt: new Date().toISOString()
            },
            {
              type: "Ministry Application",
              applicant: "Justine Valenzuela",
              details: "SOCOM (Social Communications) - Cameraman Volunteer",
              date: "05/14/2026",
              status: "Interview Scheduled",
              uid,
              createdAt: new Date().toISOString()
            }
          ];
          initialApps.forEach(async (app) => {
            await addDoc(collection(db, "applications"), app);
          });
        } else {
          // Sort items by a createdAt timestamp or doc id to keep consistent order
          items.sort((a, b) => b.id.localeCompare(a.id));
          setApplications(items);
        }
      },
      (error) => {
        console.error("Error listening to applications collection (check Firestore rules / sign-in state):", error);
      }
    );

    return () => unsub();
  }, [isLoggedIn, isAdmin, uid]);

  // 3. Listen to Announcements collection in Firestore (with dynamic seeding if database empty)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "announcements"),
      (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });

        if (items.length === 0 && isAdmin) {
          // Seed initial announcements to Firestore if empty. Announcement
          // writes are admin-only under the rules, so only attempt this
          // once we know the current user is an admin.
          const initialAnns = [
            { title: "Feast of St. Joseph Mass", date: "May 1, 2026", time: "3:00 PM", type: "Mass", createdAt: new Date().toISOString() },
            { title: "Consecration to Maria Auxiliadora", date: "May 13, 2026", time: "3:00 PM", type: "Feast", createdAt: new Date().toISOString() },
            { title: "7th Sunday of Easter Liturgy", date: "May 17, 2026", time: "3:00 PM", type: "Mass", createdAt: new Date().toISOString() }
          ];
          initialAnns.forEach(async (ann) => {
            await addDoc(collection(db, "announcements"), ann);
          });
        } else {
          items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          setAnnouncements(items);
        }
      },
      (error) => {
        console.error("Error listening to announcements collection:", error);
      }
    );

    return () => unsub();
  }, [isAdmin]);

  const activeChurchRoute = ROUTES.find(r => r.id === selectedChurchId) || ROUTES[0];

  /**
   * The phone's reminder alarms.
   *
   * Built from the parishes the pilgrim FOLLOWS, not the one they
   * happen to be looking at. Those are different questions, and
   * conflating them meant that glancing at another parish's Mass times
   * silently replaced every reminder for their own — and glancing back
   * replaced them again.
   */
  /**
   * The first-run walkthrough.
   *
   * Opened from a lazy initialiser rather than an effect, so it is
   * decided once on mount. An effect would re-evaluate on re-render and
   * could reopen the tour under somebody who had just skipped it.
   */
  const [tutorialOpen, setTutorialOpen] = useState(() => !hasSeenTutorial());

  /** One reading language for every screen. See lib/language.ts. */
  const { language, setLanguage } = useLanguage();

  const [followedParishes, setFollowedParishes] = useState<string[]>(loadFollowed);
  const remindableIds = useMemo(
    () => remindableParishes(followedParishes, homeParishId),
    [followedParishes, homeParishId],
  );
  /**
   * The parish on screen is watched too, not only the followed ones.
   *
   * Sancti answers about whatever parish you are looking at, and
   * subscribing only to the followed set meant it fell back to the
   * compiled Mass times the moment you asked about a parish you were
   * merely visiting - quoting times the office may have changed.
   */
  const watchedParishIds = useMemo(
    () => (remindableIds.includes(activeChurchRoute.id)
      ? remindableIds
      : [...remindableIds, activeChurchRoute.id]),
    [remindableIds, activeChurchRoute.id],
  );
  const followedContent = useParishContents(watchedParishIds);

  /**
   * The parish on screen, as the office has it.
   *
   * Sancti answers from this rather than from the compiled data, so a
   * Mass time the office changed this morning is the one it quotes.
   * Null for a parish nobody has edited, which every answer treats as
   * "fall back to what shipped" rather than as "no information".
   */
  const activeParishContent = followedContent[activeChurchRoute.id] ?? null;

  const reminderParishes = useMemo<ParishReminders[]>(
    () => remindableIds.map(id => {
      const route = ROUTES.find(r => r.id === id);
      return {
        parishId: id,
        parishName: route?.name.replace(" Guide", "").replace(" Tour", "") ?? id,
        // The parish's own times where an admin has entered them, the
        // compiled ones otherwise — the same precedence the Mass card
        // uses, so a reminder and the card can never disagree.
        massSchedule: followedContent[id]?.massSchedule ?? MASS_SCHEDULES[id]?.schedule ?? [],
        announcements: publishedOnly(announcementsForParish(announcements, id)),
      };
    }),
    [remindableIds, followedContent, announcements],
  );

  const reminders = useReminders(reminderParishes);

  const toggleFollowParish = useCallback((parishId: string, follow: boolean) => {
    setFollowedParishes(current => {
      const next = withFollowed(current, parishId, follow, homeParishId);
      saveFollowed(next);
      return next;
    });
  }, [homeParishId]);

  // Read by the notification watcher above, which is declared earlier and
  // must not re-subscribe every time a setting changes.
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;

  // Shown only when the dashboard is on a parish that is not the
  // pilgrim's own - which happens two ways, both deliberate: walking near
  // another parish, or searching for one. Offering "back" while already
  // home would be a button that does nothing.
  //
  // "Own" means the profile's parish when signed in and the locally chosen
  // home parish otherwise. Keying it on the profile alone made the way back
  // vanish for everyone signed out: myParishId is null until a profile
  // loads, so a visitor who searched their way to another parish was left
  // on it with no route home. homeParishId is never null - it is seeded
  // with firstLiveParishId() on a fresh install - so the button is always
  // there when it is needed.
  //
  // Both are resolved to a ROUTE id before comparing. They are not stored in
  // the same id space - a home parish may be any of the 31 diocese ids,
  // while the dashboard always shows one of the two routes - so comparing
  // them raw made "parish-mary-help-of-christians-parish" look different
  // from "route-mhcp", and the way back was offered to a pilgrim already
  // standing in their own parish.
  const ownParishId = routeForHomeParish(myParishId ?? homeParishId);

  const viewingAnotherParish =
    ownParishId !== null && activeChurchRoute.id !== ownParishId;

  const backToMyParish = () => {
    if (ownParishId) setSelectedChurchId(ownParishId);
    setActiveTab("home");
  };

  // Presence sheet actions: the pilgrim may be physically near a parish they
  // haven't selected in-app yet (e.g. they came straight from the church
  // selector), so opening the tour or AR screen also switches the active
  // church context to the one presence detected. "Open Tour" (map icon,
  // next to the sheet's own "AR Tour" button) means "show me the diocese
  // map" — the pilgrim is already standing at the parish, so jumping to the
  // map tab is the correct destination here, distinct from selecting a
  // parish elsewhere (see handleSelectParish below).
  const [walkToParishId, setWalkToParishId] = useState<string | null>(null);

  const handleOpenTourFromPresence = (parishId: string) => {
    setSelectedChurchId(parishId);
    setActiveTab(tabForParishSelection("presence-open-tour"));
  };

  // "Get directions" on the Home hero: switch to the map and hand it the parish
  // to route to, rather than routing from Home and hoping the map picks it up.
  // Cleared once the map has consumed it so returning to the tab later does
  // not silently redraw a route the pilgrim did not ask for again.
  const handleWalkThere = (parishId: string) => {
    setWalkToParishId(parishId);
    setActiveTab("navigator");
  };

  const handleOpenARFromPresence = (parishId: string) => {
    setSelectedChurchId(parishId);
    setActiveTab("ar");
  };

  // Selecting a parish from a map pin, a search result, or a parish card —
  // anywhere the pilgrim is picking *which parish* to look at — opens that
  // parish's own profile (the "home" tab: Dashboard, with its Mass
  // schedule/History/Ministries/Sacraments links), not the map tab. Using
  // "navigator" here was the bug behind "View parish does nothing": when
  // the map pin lives on the map tab itself (App.tsx's "navigator" tab),
  // setActiveTab("navigator") is a no-op because that tab is already active.
  // Matches the "Start Sanctuary Walk" card button in the church-selector
  // screen below, which already does exactly this for the same action.
  const handleSelectParish = (parishId: string) => {
    setSelectedChurchId(parishId);
    setActiveTab(tabForParishSelection("pin"));
  };

  // Global methods to update progress
  const addPoints = async (pointsToAdd: number) => {
    setUserProgress(prev => {
      const newProgress = {
        ...prev,
        points: prev.points + pointsToAdd
      };
      if (auth.currentUser) {
        setDoc(doc(db, "users", auth.currentUser.uid), newProgress, { merge: true });
      }
      return newProgress;
    });
  };

  const earnBadge = async (badgeId: string) => {
    setUserProgress(prev => {
      if (prev.badges.includes(badgeId)) return prev;
      const newProgress = {
        ...prev,
        badges: [...prev.badges, badgeId]
      };
      if (auth.currentUser) {
        setDoc(doc(db, "users", auth.currentUser.uid), newProgress, { merge: true });
      }
      return newProgress;
    });
  };

  const handleAddApplication = async (newApp: Omit<typeof applications[0], "id">) => {
    if (!auth.currentUser) {
      // The Firestore rules require every application to carry the uid of
      // its signed-in creator, so an anonymous write would be rejected
      // anyway. Fail loudly here instead of letting it fail silently.
      console.error("Cannot submit application: no signed-in user.");
      alert("Please sign in first before submitting this form.");
      return;
    }
    try {
      await addDoc(collection(db, "applications"), {
        ...newApp,
        uid: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding application to Firestore:", err);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    try {
      await deleteDoc(doc(db, "applications", id));
    } catch (err) {
      console.error("Error deleting application from Firestore:", err);
    }
  };

  const handleUpdateApplicationStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "applications", id), {
        status: newStatus
      });
    } catch (err) {
      console.error("Error updating application status in Firestore:", err);
    }
  };

  const handleAddAnnouncement = async (newAnn: Omit<typeof announcements[0], "id">) => {
    try {
      await addDoc(collection(db, "announcements"), {
        ...newAnn,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding announcement to Firestore:", err);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
    } catch (err) {
      console.error("Error deleting announcement from Firestore:", err);
    }
  };

  const handleLoginSuccess = (email: string, adminFlag: boolean) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    setIsAdmin(adminFlag);
    
    // Earn badge for login
    earnBadge("badge-5"); // Community Active badge represents engagement
    addPoints(200);

    // A sign-in is an event, not an application. It used to be written
    // into the applications collection, which put login records in the
    // queue the parish office works through.
    void logActivity("sign_in", `Signed in as ${adminFlag ? "admin" : "pilgrim"}`);

    if (adminFlag) {
      setActiveTab("admin");
    } else {
      setActiveTab("home");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out from Firebase:", err);
    }
    setIsLoggedIn(false);
    setUserEmail("");
    setIsAdmin(false);
    setActiveTab("home");
  };

  // Station check in
  const handleStationVisited = (stationId: string, stepsToAdd: number, distanceToAdd: number) => {
    setUserProgress((prev) => {
      if (prev.completedStations.includes(stationId)) return prev;

      const newCompletedStations = [...prev.completedStations, stationId];
      const newSteps = prev.steps + stepsToAdd;
      const newDistance = prev.distanceKm + distanceToAdd;
      const newPoints = prev.points + 250; // +250 points per stamp

      const newBadges = [...prev.badges];

      // Badge 1: First Stamp inside Maypajo
      if (stationId.startsWith("mhcp-") && !newBadges.includes("badge-1")) {
        newBadges.push("badge-1");
      }

      // Badge 2: Completed all of Cathedral trail
      const srcStationIds = ROUTES.find(r => r.id === "route-src")?.stations.map(s => s.id) || [];
      const completedSrc = srcStationIds.every(id => newCompletedStations.includes(id));
      if (completedSrc && !newBadges.includes("badge-2")) {
        newBadges.push("badge-2");
      }

      void logActivity("station_visit", `Checked in at station ${stationId}`);

      const updatedProgress = {
        ...prev,
        completedStations: newCompletedStations,
        steps: newSteps,
        distanceKm: newDistance,
        points: newPoints,
        badges: newBadges
      };

      if (auth.currentUser) {
        setDoc(doc(db, "users", auth.currentUser.uid), updatedProgress, { merge: true });
      }

      return updatedProgress;
    });
  };

  // Comments submit
  const handlePostComment = (stationId: string) => {
    if (!activeCommentInput.trim()) return;
    
    const userDisplay = isLoggedIn ? userEmail.split("@")[0] : "Pilgrim Walk";
    const newComment = {
      user: userDisplay,
      text: activeCommentInput,
      date: "Today"
    };

    setCommentsByStation(prev => ({
      ...prev,
      [stationId]: [newComment, ...(prev[stationId] || [])]
    }));

    setActiveCommentInput("");
    addPoints(100); // 100 points for adding a comment
    earnBadge("badge-5"); // Unlock Community Active badge

    void logActivity("station_comment", `Commented at station ${stationId}`);
  };

  const liveParishes = ROUTES.filter(r => r.status !== "coming_soon");

  const handleChooseHomeParish = (parishId: string) => {
    saveHomeParishId(parishId);
    setHomeParishId(parishId);
    // The home parish may be one of the 29 without a tour. The active route
    // still has to be a live one, so it is mapped rather than set directly —
    // setting a diocese id here would leave activeChurchRoute falling back to
    // ROUTES[0] with no indication why.
    setSelectedChurchId(routeForHomeParish(parishId));
    setActiveTab("home");
    setIsChangeParishOpen(false);
  };

  return (
    <PresenceProvider>
      <PresenceParishSync onArrive={setSelectedChurchId} />
      <ParishTheme parishId={selectedChurchId} />
      {/* The parish picker, reached only from "Change Home Parish". It is
          not shown on first run: the app opens straight on the dashboard.
          It renders inside PresenceProvider because it orders the list by
          distance and so needs the position. */}
      {isChangeParishOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--color-brand-card)] flex flex-col">
          {/* The inset keeps Cancel clear of the status bar. A `fixed
              inset-0` overlay starts at the very top of the screen, so on a
              phone that draws its status bar over the app this row was
              underneath it and the only way out of the screen could not be
              seen or tapped. */}
          <div
            className="flex justify-end p-3 shrink-0"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
          >
            <button
              type="button"
              onClick={() => setIsChangeParishOpen(false)}
              className="text-[16px] font-semibold text-[var(--color-brand-primary)] px-2"
            >
              Cancel
            </button>
          </div>
          <Onboarding onChoose={handleChooseHomeParish} />
        </div>
      )}

      {/* Sign-in as its own screen rather than embedded at the top of Me,
          where it stacked a second "Pilgrim Profile" header under the first. */}
      {isSignInOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--color-brand-card)] flex flex-col">
          {/* Inset for the status bar, as above. */}
          <div
            className="flex justify-end p-3 shrink-0"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
          >
            <button
              type="button"
              onClick={() => setIsSignInOpen(false)}
              className="text-[16px] font-semibold text-[var(--color-brand-primary)] px-2"
            >
              Close
            </button>
          </div>
          <LoginModal
            isLoggedIn={isLoggedIn}
            userEmail={userEmail}
            isAdmin={isAdmin}
            onLoginSuccess={(email, adminFlag) => {
              handleLoginSuccess(email, adminFlag);
              setIsSignInOpen(false);
            }}
            onLogout={handleLogout}
          />
        </div>
      )}

      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--color-brand-card)] flex flex-col">
          <SearchScreen
            onClose={() => setIsSearchOpen(false)}
            onSelectParish={parishId => {
              setIsSearchOpen(false);
              const route = routeIdForParish(parishId);
              // Only the two live parishes have a page to open. Selecting any
              // other is still useful — it centres the map on it — so this
              // routes there instead of doing nothing.
              if (route) {
                handleSelectParish(route);
              } else {
                setWalkToParishId(parishId);
                setActiveTab("navigator");
              }
            }}
          />
        </div>
      )}
    <div
      className={
        deviceSurface
          ? "h-[100dvh] bg-[var(--color-brand-card)] text-[var(--color-brand-text)] flex flex-col font-sans overflow-hidden"
          : "min-h-screen bg-[var(--color-brand-card)] text-[var(--color-brand-text)] flex flex-col justify-between font-sans"
      }
    >
      {/* There is deliberately no desktop workspace header. It carried a
          "SanctiWalk Core Workspace / Prepared for STI College Capstone
          Defense" title and a "Return to Church Selection" button, which is
          why the app read as a project website on a laptop rather than as the
          app. The button also returned to a selection step the app no longer
          has. */}
      {/* Main Container Workspace */}
      <main
        className={
          deviceSurface
            ? "flex-1 flex flex-col select-none relative min-h-0"
            : "flex-1 flex items-center justify-center py-6 select-none relative"
        }
      >
        <PhoneContainer
          isOffline={isOffline}
          setIsOffline={setIsOffline}
          isMobileOnly={isMobileOnly}
          setIsMobileOnly={setIsMobileOnly}
        >
          {/* Main App Frame inside simulator */}
          <div className="flex-1 flex flex-col relative bg-[var(--color-brand-card)] overflow-hidden">
            
            {/* If NO church is selected, show the Church Selector view (Figure 2) */}
            {selectedChurchId === null ? (
              <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] p-5 overflow-y-auto justify-between">
                <div className="space-y-6 pt-4">
                  {/* Stylized App Icon/Header */}
                  <div className="text-center space-y-2">
                    <div className="h-14 w-14 rounded-2xl bg-[var(--color-brand-primary)] border border-[var(--color-brand-gold)] text-white flex items-center justify-center font-sans text-3xl font-black shadow-md mx-auto">
                      S
                    </div>
                    <div>
                      <h1 className="text-3xl font-black font-sans tracking-tight text-white uppercase">
                        SanctiWalk
                      </h1>
                      <p className="text-sm text-[var(--color-brand-secondary)] font-bold tracking-widest uppercase mt-0.5">
                        Pilgrimage Navigator
                      </p>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="text-center space-y-1 px-4">
                    <h2 className="text-[15px] font-bold text-white uppercase tracking-wider font-sans">
                      Choose Your Church Experience
                    </h2>
                    <p className="text-[15px] text-[var(--color-brand-secondary)] leading-relaxed font-sans">
                      Select a historical parish of the Diocese of Kalookan to begin your interactive spiritual walking tour.
                    </p>
                  </div>

                  {/* Diocese map — a geographically calibrated illustration
                      showing both parishes (and the pilgrim's own position,
                      when known) before a church is chosen. Tapping a live
                      pin opens that parish's profile, same as the "Start
                      Sanctuary Walk" card button below does for the same
                      selection action. */}
                  <div className="bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] shadow-xs p-3 h-72">
                    <CustomDioceseMap onSelectParish={handleSelectParish} />
                  </div>

                  {/* Church Selector Cards (Figure 2 / Page 34) */}
                  <div className="space-y-3">
                    {ROUTES.map((route) => (
                      <div
                        key={route.id}
                        className="bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] overflow-hidden shadow-xs hover:border-[var(--color-brand-primary)] transition-all flex flex-col"
                      >
                        {/* Facade image placeholder */}
                        <div className="relative h-28">
                          <img
                            src={parishPhoto(route.id)}
                            alt={parishPhotoAlt(route.id, route.name)}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/70 flex items-end p-2.5">
                            <span className="text-sm bg-[var(--color-brand-gold)] text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                              {route.category}
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="p-3.5 space-y-2 text-left font-sans">
                          <div>
                            <h4 className="text-[15px] font-bold text-[var(--color-brand-text)] font-sans">
                              {route.name}
                            </h4>
                            <p className="text-sm text-[var(--color-brand-secondary)] mt-0.5 flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-[var(--color-brand-secondary)]" /> {route.location}
                            </p>
                          </div>
                          <p className="text-[15px] text-[var(--color-brand-text)] leading-normal line-clamp-2">
                            {route.description}
                          </p>

                          <button
                            onClick={() => {
                              setSelectedChurchId(route.id);
                              setActiveTab("home");
                            }}
                            className="w-full mt-1 py-2 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-sm font-bold uppercase tracking-wider rounded-xl border border-[var(--color-brand-primary-dark)] transition-colors"
                          >
                            Start Sanctuary Walk
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-white/15">
                  <span className="text-sm text-[var(--color-brand-secondary)] font-mono block">
                    STI COLLEGE KALOOKAN • CAPSTONE 2026
                  </span>
                </div>
              </div>
            ) : (
              /* ACTIVE CHURCH WEB SHELL LAYOUT */
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* The navy header bar is gone. It repeated the parish name
                    already shown on Home, and its two controls moved into Me:
                    Sign In, plus the menu's Change Parish / Rosary Settings /
                    Admin Panel / Location Simulator. Five tabs are now the
                    whole navigation — nothing hidden behind a hamburger. */}

                {/* The slideout sidebar is gone with the header bar that
                    opened it. Its four entries live in Me now: Change Parish,
                    Rosary Settings, and — for those who have them — Admin
                    Panel and the Location Simulator. */}


                {/* PRIMARY VIEW CONTENT WORKSPACE */}
                <div className="app-scroll flex-1 min-h-0 flex flex-col overflow-y-auto">
                  
                  {/* TAB 1: Parish Dashboard / Home Tab — TODAY first, then
                      the parish grid, then diocese-wide content. Extracted
                      into its own component (see src/components/Dashboard.tsx)
                      once this block needed a TODAY section on top of the
                      existing two; App.tsx was already large. */}
                  {activeTab === "home" && (
                    <Dashboard
                      parish={activeChurchRoute}
                      firstName={greetingName}
                      announcements={announcements}
                      onNavigate={setActiveTab}
                      onBackToMyParish={viewingAnotherParish ? backToMyParish : undefined}
                      onSelectParish={handleSelectParish}
                      onWalkThere={handleWalkThere}
                      onOpenSearch={() => setIsSearchOpen(true)}
                      sectionRequest={homeSectionRequest ?? undefined}
                    />
                  )}

                  {/* TAB 2: Map / Trail Station Navigator — restyled to match
                      the client's earlier prototype (Churches.jsx): a
                      centred diocese heading, the map at its full ~374px
                      height (not squeezed by a fixed-height card), and one
                      tappable card per live parish below it. */}
                  {activeTab === "navigator" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 flex flex-col overflow-y-auto">
                        {/* The real diocese map replaces the old simulated
                            walk. That simulation advanced a timer between
                            stations and displayed stored coordinates as if
                            they were the pilgrim's own, which was not a walk
                            at all. Station-by-station progress returns when
                            it is driven by real QR scans at each station. */}
                        {/* Full-bleed map with the parish rail floating over
                            it, per the redesign. The map is the screen rather
                            than a card on it: the header and the rail sit on
                            top as overlays, so nothing steals height from the
                            thing people came to this tab to look at. */}
                        <div className="map-screen">
                          {/* The heading block is gone at the client's
                              request — the Map tab is self-evidently the map,
                              and the two title lines plus the legend cost
                              about a fifth of the screen. */}
                          <div className="map-screen__canvas">
                            <CustomDioceseMap
                              onSelectParish={handleSelectParish}
                              walkToParishId={walkToParishId}
                              onWalkToConsumed={() => setWalkToParishId(null)}
                            />
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* The parish's own page — the redesign's screen 05. */}

                  {/* TAB 3: Daily Rosary guide */}
                  {activeTab === "rosary" && (
                    <PrayScreen
                      onOpenSettings={() => setIsRosarySettingsOpen(true)}
                      parish={activeChurchRoute}
                    />
                  )}

                  {/* TAB 4: Mass schedule table — follows the active parish,
                      not hardcoded to any one church (see MassSchedule.tsx). */}
                  {activeTab === "mass" && (
                    <MassSchedule parish={activeChurchRoute} />
                  )}

                  {/* TAB 5: Church History archive — same fix: renders the
                      active parish's own history rather than an internal tab. */}
                  {activeTab === "history" && (
                    <ChurchHistory
                      parish={activeChurchRoute}
                      onBack={() => setActiveTab(historyReturnTab)}
                    />
                  )}

                  {/* TAB 6: Volunteer Guilds list */}
                  {activeTab === "ministries" && (
                    <MinistriesTab
                      parish={activeChurchRoute}
                      onAddApplication={handleAddApplication}
                      uid={uid}
                      userEmail={userEmail}
                      onOpenSignIn={() => setIsSignInOpen(true)}
                    />
                  )}

                  {/* TAB 7: Sacraments office */}
                  {activeTab === "sacraments" && (
                    <SacramentsTab
                      parish={activeChurchRoute}
                      onAddApplication={handleAddApplication}
                      uid={uid}
                      userEmail={userEmail}
                      onOpenSignIn={() => setIsSignInOpen(true)}
                    />
                  )}

                  {/* TAB 8: AR Tour */}
                  {activeTab === "ar" && (
                    <div
                      className={
                        scanCameraLive
                          ? "flex-1 flex flex-col min-h-0"
                          : "flex-1 flex flex-col min-h-0 bg-[var(--color-brand-card)]"
                      }
                    >
                      {/* Wrapped out here rather than inside ArTour: that
                          component returns early for each of its camera
                          states, so a banner added to one of them would
                          vanish in the others.

                          Gone entirely once the viewfinder is up - the
                          screen is the camera then, and the scroller goes
                          with it so the picture is not inside something
                          that can be scrolled. */}
                      {/* Both children are KEYED, and that is load-bearing.
                          React matches siblings by position when they have
                          no key, so the moment the camera went live and the
                          band unmounted, ArTour shifted from the second
                          child to the first - React tore it down and built
                          a fresh one, which stopped the camera it had just
                          started. The banner then cleared, the band came
                          back, and it began again. The scanner could never
                          stay open for more than a frame. */}
                      {!scanCameraLive && (
                        <ParishSectionHeader
                          key="ar-band"
                          routeId={activeChurchRoute.id}
                          eyebrow="Explore in Augmented Reality"
                          title="AR Walk"
                          blurb="Point your camera at the marker to begin, then at each station as you walk."
                          icon={<Sparkles className="w-3.5 h-3.5" />}
                          collapsing
                        />
                      )}
                      <ArTour
                        key="ar-tour"
                        stations={activeChurchRoute.stations}
                        parishId={activeChurchRoute.id}
                        parishName={activeChurchRoute.name.replace(" Guide", "").replace(" Tour", "")}
                        onClose={() => setActiveTab("home")}
                        onCameraLiveChange={setScanCameraLive}
                      />
                    </div>
                  )}

                  {/* TAB 9: Pilgrim Catechism Quiz */}
                  {activeTab === "quiz" && (
                    <PilgrimQuiz 
                      onEarnBadge={earnBadge} 
                      onAddPoints={addPoints} 
                      onAddApplication={handleAddApplication}
                    />
                  )}

                  {/* TAB 10: "Me" — sign-in state, applications, prayer/visit
                      progress, and links to Change Parish and Rosary
                      Settings, all assembled from state the app already
                      tracks. Replaces the old standalone "Devotee
                      Authentication" screen, which is now folded in here. */}
                  {activeTab === "myApplications" && (
                    <MyApplicationsPage
                      applications={applications}
                      onBack={() => setActiveTab("me")}
                    />
                  )}

                  {activeTab === "notifications" && (
                    <NotificationsPage onBack={() => setActiveTab("me")} />
                  )}

                  {activeTab === "me" && (
                    <MeTab
                      onOpenApplications={() => setActiveTab("myApplications")}
                      onOpenNotifications={() => setActiveTab("notifications")}
                      unreadNotifications={unreadNotifications}
                      onNicknameChange={setNickname}
                      isLoggedIn={isLoggedIn}
                      userEmail={userEmail}
                      isAdmin={isAdmin}
                      userProgress={userProgress}
                      applications={applications}
                      onLoginSuccess={handleLoginSuccess}
                      onLogout={handleLogout}
                      onOpenChangeParish={() => setIsChangeParishOpen(true)}
                      onOpenRosarySettings={() => setIsRosarySettingsOpen(true)}
                      parishName={activeChurchRoute?.name.replace(" Guide", "").replace(" Tour", "")}
                      onOpenAdmin={() => setActiveTab("admin")}
                      onOpenSimulator={() => setIsSimulatorOpen(true)}
                      onOpenSignIn={() => setIsSignInOpen(true)}
                      onReplayTutorial={() => { setActiveTab("home"); setTutorialOpen(true); }}
                      language={language}
                      onLanguageChange={setLanguage}
                      reminders={
                        <ReminderSettingsCard
                          settings={reminders.settings}
                          update={reminders.update}
                          permission={reminders.permission}
                          enable={reminders.enable}
                          scheduled={reminders.scheduled}
                          supported={reminders.supported}
                          otherParishes={ROUTES
                            .filter(r => r.id !== homeParishId)
                            .map(r => ({
                              id: r.id,
                              name: r.name.replace(" Guide", "").replace(" Tour", ""),
                              following: followedParishes.includes(r.id),
                            }))}
                          onToggleParish={toggleFollowParish}
                        />
                      }
                    />
                  )}

                  {/* TAB 11: Admin Control Panel */}
                  {activeTab === "admin" && (
                    <AdminPortal
                      userEmail={userEmail}
                      applications={applications}
                      onDeleteApplication={handleDeleteApplication}
                      onUpdateApplicationStatus={handleUpdateApplicationStatus}
                      announcements={announcements}
                      onAddAnnouncement={handleAddAnnouncement}
                      onDeleteAnnouncement={handleDeleteAnnouncement}
                    />
                  )}

                  {/* TAB 12: PWA Workspace — a Demo Tools entry, not a
                      pilgrim-facing feature; see the sidebar's "Demo Tools"
                      section. */}
                  {activeTab === "pwa-devkit" && <PwaBanner />}

                  {/* Sancti sits above the tab bar, reachable from every
                      screen - which is the point, since most of what it
                      does is take you to another one. Hidden while the
                      camera has the screen: a floating button over a
                      viewfinder covers the thing being scanned. */}
                  {activeTab !== "ar" && (
                    <SanctiMount
                      activeParishId={activeChurchRoute.id}
                      activeParishName={activeChurchRoute.name.replace(" Guide", "").replace(" Tour", "")}
                      content={activeParishContent}
                      language={language}
                      onGo={tab => setActiveTab(tab as typeof activeTab)}
                      onShowHomeSection={showHomeSection}
                      onSelectParish={setSelectedChurchId}
                      onWalkTo={handleWalkThere}
                      onFollowParish={id => toggleFollowParish(id, true)}
                    />
                  )}
                </div>

                {/* BOTTOM STICKY PHONE SIM NAVIGATION BAR — five tabs, Scan
                    centred and visually raised as the app's signature
                    feature, every tab keeping a visible text label. */}
                {/* A flex child, not an overlay.
                
                    As `absolute bottom-0` it floated ON TOP of the content:
                    every screen then had to reserve 64px for it by hand, the
                    outer wrapper reserved only 16px, and screens with their
                    own inner scroller (Me, Pray) reserved none at all — so
                    their last rows sat under the bar and could never be
                    scrolled clear. Taking part in the layout means the
                    content area sizes itself around the bar automatically,
                    on every screen, including ones not written yet.
                
                    The safe-area inset keeps the labels clear of the iPhone
                    home indicator. */}
                <nav
                  className="shrink-0 h-16 bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)] flex items-center justify-around px-1 z-40 shadow-md"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  <button
                    onClick={() => setActiveTab("home")}
                    data-spotlight="tab-home"
                    className={`tab-item ${activeTab === "home" ? "tab-item--on" : ""}`}
                    aria-current={activeTab === "home" ? "page" : undefined}
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">{t("tab.home", language)}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("navigator")}
                    data-spotlight="tab-map"
                    className={`tab-item ${activeTab === "navigator" ? "tab-item--on" : ""}`}
                    aria-current={activeTab === "navigator" ? "page" : undefined}
                  >
                    <Map className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">{t("tab.map", language)}</span>
                  </button>

                  {/* Scan: the app's signature feature, given a raised,
                      filled treatment so it reads as the visual anchor of
                      the bar — but still carries a text label like every
                      other tab, not an icon-only control. */}
                  <button
                    onClick={() => setActiveTab("ar")}
                    data-spotlight="tab-scan"
                    className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 -translate-y-3"
                  >
                    <span
                      className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-all ${
                        activeTab === "ar"
                          ? "bg-[var(--color-brand-primary)] border-[var(--color-brand-card)] text-white"
                          : "bg-[var(--color-brand-primary)] border-[var(--color-brand-card)] text-white opacity-90"
                      }`}
                    >
                      <ArIcon className="w-5 h-5" />
                    </span>
                    <span className={`text-base font-bold leading-none ${activeTab === "ar" ? "text-[var(--color-brand-secondary)]" : "text-[var(--color-brand-secondary)]"}`}>
                      {t("tab.scan", language)}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("rosary")}
                    data-spotlight="tab-pray"
                    className={`tab-item ${activeTab === "rosary" ? "tab-item--on" : ""}`}
                    aria-current={activeTab === "rosary" ? "page" : undefined}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">{t("tab.pray", language)}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("me")}
                    data-spotlight="tab-me"
                    className={`tab-item ${activeTab === "me" ? "tab-item--on" : ""}`}
                    aria-current={activeTab === "me" ? "page" : undefined}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">{t("tab.me", language)}</span>
                  </button>
                </nav>

              </div>
            )}

            {/* The walkthrough. Rendered last so its overlay sits above
                the tab bar it points at. */}
            <TutorialRunner
              open={tutorialOpen}
              onClose={() => setTutorialOpen(false)}
              onSwitchTab={(tab: TutorialTab) => setActiveTab(tab)}
            />

            <RosarySettingsModal
              isOpen={isRosarySettingsOpen}
              onClose={() => setIsRosarySettingsOpen(false)}
            />

            <SimulatorPanel
              isOpen={isSimulatorOpen}
              onClose={() => setIsSimulatorOpen(false)}
            />

            {/* The "You are approaching …" banner is gone at the client's
                request, and its own design was the reason.

                It was a floating overlay pinned near the top of whatever
                screen you happened to be on, so it covered content it knew
                nothing about: the turn instruction while navigating, and the
                pilgrim's own name and avatar on Me. Being global was the
                point of it and also its whole problem.

                PresenceSheet stays: it carries the same information plus the
                actions worth taking on arrival, it collapses, and it does not
                sit on top of another screen's heading. */}
            <PresenceSheet onOpenTour={handleOpenTourFromPresence} onOpenAR={handleOpenARFromPresence} />

          </div>
        </PhoneContainer>
      </main>

      {/* Footer credits bar */}
    </div>
    </PresenceProvider>
  );
}
