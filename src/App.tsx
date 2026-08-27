import React, { useState, useEffect, useMemo } from "react";
import { PresenceProvider, usePresence } from "./context/PresenceContext";
import PhoneContainer from "./components/PhoneContainer";
import Onboarding from "./components/Onboarding";
import SearchScreen from "./components/SearchScreen";
import ChurchDetail from "./components/ChurchDetail";
import PrayScreen from "./components/PrayScreen";
import PwaBanner from "./components/PwaBanner";

// New Components
import Dashboard from "./components/Dashboard";
import MeTab from "./components/MeTab";
import ChurchHistory from "./components/ChurchHistory";
import MassSchedule from "./components/MassSchedule";
import MinistriesTab from "./components/MinistriesTab";
import SacramentsTab from "./components/SacramentsTab";
import ArTour from "./components/ArTour";
import PilgrimQuiz from "./components/PilgrimQuiz";
import LoginModal from "./components/LoginModal";
import AdminPortal from "./components/AdminPortal";
import RosarySettingsModal from "./components/RosarySettingsModal";
import PresenceBanner from "./components/PresenceBanner";
import PresenceSheet from "./components/PresenceSheet";
import SimulatorPanel from "./components/SimulatorPanel";
import CustomDioceseMap from "./components/CustomDioceseMap";
import ParishCard from "./components/ParishCard";

// Firebase imports
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, getDoc, getDocs, writeBatch, query, where } from "firebase/firestore";

import { Route, UserProgress } from "./types";
import { ROUTES, BADGES } from "./data";
import { loadHomeParishId, saveHomeParishId } from "./lib/homeParish";
import { tabForParishSelection } from "./lib/parishSelection";
import parishData from "./data/diocese-parishes.json";
import { assertKnownParishIds, routeIdForParish } from "./lib/parishIds";

import {
  Compass, Map, Cpu, Sparkles, BookOpen, Clock, Heart,
  Menu, X, Home, Lock, HelpCircle, User, ShieldCheck, HelpCircle as QuizIcon,
  ScanLine as ArIcon, Users as MinistryIcon, MapPin, ChevronRight, Bookmark, ArrowLeft,
  Settings as SettingsIcon,
  Church, Smartphone, Monitor, Wifi, WifiOff, FlaskConical
} from "lucide-react";

// Watches presence from inside the provider and reports an arrival upward.
// App itself renders PresenceProvider, so it cannot call usePresence(); this
// tiny child can. Only `present` switches the dashboard — `approaching` is
// still just passing by, and switching then would yank the screen around
// while someone walks down the street.
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
// This used to be the answer to first run as well: the app picked a parish
// silently rather than asking, because the client did not want a welcome
// screen between install and the dashboard. That decision was reversed when
// the redesign's onboarding screen was adopted — see `needsOnboarding`.
function firstLiveParishId(): string | null {
  return ROUTES.find(r => r.status !== "coming_soon")?.id ?? ROUTES[0]?.id ?? null;
}

// A home parish may be any of the 31 in the diocese, not just the two with a
// tour behind them — the redesign's onboarding lists them all, and a pilgrim's
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
  const [isChangeParishOpen, setIsChangeParishOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // First run: nothing stored yet, so the pilgrim is asked which parish is
  // theirs before the app opens. Read from storage rather than from
  // homeParishId, which is seeded with a fallback and so is never null —
  // testing that instead would mean onboarding could never appear.
  const [needsOnboarding, setNeedsOnboarding] = useState(
    () => loadHomeParishId(VALID_HOME_IDS) === null
  );

  // Navigation & Frame settings. Seeded from the home parish so the app opens
  // on that parish's dashboard rather than asking which church to pick — the
  // app can work that out, so it should not ask.
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(() =>
    routeForHomeParish(loadHomeParishId(VALID_HOME_IDS))
  );
  const [activeTab, setActiveTab] = useState<
    "home" | "navigator" | "rosary" | "mass" | "ministries" | "history" | "sacraments" | "ar" | "quiz" | "church" | "me" | "admin" | "pwa-devkit"
  >("home");
  
  const [isOffline, setIsOffline] = useState(false);
  const [isMobileOnly, setIsMobileOnly] = useState(true);
  const [isRosarySettingsOpen, setIsRosarySettingsOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Identity state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  // Simulated Database store: Dynamic Pilgrim Applications & Visitor transaction logs
  const [applications, setApplications] = useState<Array<{
    id: string;
    type: string;
    applicant: string;
    details: string;
    date: string;
    status: string;
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

  // "Walk there" on the Home hero: switch to the map and hand it the parish
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

    // Dynamic application registration
    handleAddApplication({
      type: "User Authenticated",
      applicant: email,
      details: `Logged into SanctiWalk Devotee Profile (${adminFlag ? "ADMIN" : "PILGRIM"})`,
      date: new Date().toLocaleDateString(),
      status: "Session Authorized"
    });

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

      // Auto log station visit to Admin dashboard
      handleAddApplication({
        id: "vst-" + Date.now(),
        type: "Station Visited",
        applicant: isLoggedIn ? userEmail : "Anonymous Pilgrim",
        details: `Scanned & Checked in at Station: ${stationId}`,
        date: new Date().toLocaleDateString(),
        status: "Stamp Awarded"
      });

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

    // Log comment event
    handleAddApplication({
      id: "cmt-" + Date.now(),
      type: "Station Comment Posted",
      applicant: isLoggedIn ? userEmail : "Public User",
      details: `Commented: "${activeCommentInput.substring(0, 45)}..." at ${stationId}`,
      date: new Date().toLocaleDateString(),
      status: "Moderated Approval"
    });
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
    setNeedsOnboarding(false);
  };

  return (
    <PresenceProvider>
      <PresenceParishSync onArrive={setSelectedChurchId} />
      {/* The redesign's onboarding screen. It is reached from "Change Home
          Parish" rather than shown on first run, because the client's earlier
          decision — recorded above firstLiveParishId — was that no welcome
          screen should stand between install and the dashboard. The screen is
          built and complete; making it first-run is a one-line change if that
          decision has changed. */}
      {/* The redesign's onboarding, shown on first run and again whenever the
          pilgrim asks to change parish. It renders inside PresenceProvider
          because it orders the list by distance and so needs the position.
          On first run there is no Cancel: the app has nothing sensible to
          fall back to until a parish is chosen, and choosing is one tap. */}
      {(needsOnboarding || isChangeParishOpen) && (
        <div className="fixed inset-0 z-50 bg-[var(--color-brand-card)] flex flex-col">
          {isChangeParishOpen && (
            <div className="flex justify-end p-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsChangeParishOpen(false)}
                className="text-[16px] font-semibold text-[var(--color-brand-primary)] px-2"
              >
                Cancel
              </button>
            </div>
          )}
          <Onboarding onChoose={handleChooseHomeParish} />
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
    <div className="min-h-screen bg-[var(--color-brand-card)] text-[var(--color-brand-text)] flex flex-col justify-between font-sans">
      {/* Top Desktop Workspace Header Bar */}
      <header className="bg-[var(--color-brand-card)] border-b border-[var(--color-brand-border)] py-4 px-6 select-none shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-[var(--color-brand-primary)] text-white flex items-center justify-center font-serif font-bold italic text-lg shadow-xs border border-[var(--color-brand-gold)]">
              S
            </span>
            <div>
              <h2 className="text-sm font-bold text-[var(--color-brand-text)] font-serif italic leading-tight">
                SanctiWalk Core Workspace
              </h2>
              <p className="text-sm text-[var(--color-brand-secondary)] font-bold tracking-wider uppercase font-sans">
                Progressive Web App Prepared for STI College Capstone Defense
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block text-[15px] text-[var(--color-brand-secondary)] font-mono">
              STATUS: <strong className="text-[var(--color-brand-secondary)] uppercase">Ready (Maypajo Parishes v2.0)</strong>
            </span>
            <button
              onClick={() => {
                setSelectedChurchId(null);
                setActiveTab("home");
              }}
              className="bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-dark)] text-[15px] font-bold uppercase tracking-wider py-1.5 px-4 rounded-full flex items-center gap-1.5 shadow-sm transition-all border border-[var(--color-brand-gold)]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Church Selection
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 flex items-center justify-center py-6 select-none relative">
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
                            src={route.id === "route-mhcp" 
                              ? "https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg"
                              : "https://images.unsplash.com/photo-1590076241314-e2c7c724490d?auto=format&fit=crop&w=600&q=80"
                            }
                            alt={route.name}
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
                <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                  
                  {/* TAB 1: Parish Dashboard / Home Tab — TODAY first, then
                      the parish grid, then diocese-wide content. Extracted
                      into its own component (see src/components/Dashboard.tsx)
                      once this block needed a TODAY section on top of the
                      existing two; App.tsx was already large. */}
                  {activeTab === "home" && (
                    <Dashboard
                      parish={activeChurchRoute}
                      announcements={announcements}
                      onNavigate={(tab) => setActiveTab(tab)}
                      onSelectParish={handleSelectParish}
                      onWalkThere={handleWalkThere}
                      onOpenSearch={() => setIsSearchOpen(true)}
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
                          <header className="map-screen__header">
                            <h1 className="map-screen__title">Diocese of Kalookan</h1>
                            <p className="map-screen__count">
                              {liveParishes.length} {liveParishes.length === 1 ? "parish is" : "parishes are"} live on SanctiWalk
                            </p>
                          </header>

                          <div className="map-screen__canvas">
                            <CustomDioceseMap
                              onSelectParish={handleSelectParish}
                              walkToParishId={walkToParishId}
                              onWalkToConsumed={() => setWalkToParishId(null)}
                            />
                          </div>

                          {/* Horizontal, the way Maps does it. Each card is a
                              real button so the rail stays reachable by
                              keyboard and screen reader, not just by swipe. */}
                          <div className="map-screen__rail" role="list" aria-label="Live parishes">
                            {liveParishes.map((parish) => (
                              <div className="map-screen__rail-item" role="listitem" key={parish.id}>
                                <ParishCard parish={parish} onSelect={handleSelectParish} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* The parish's own page — the redesign's screen 05. */}
                  {activeTab === "church" && (
                    <ChurchDetail
                      parish={activeChurchRoute}
                      onBack={() => setActiveTab("home")}
                      onWalkThere={handleWalkThere}
                      onNavigate={tab => setActiveTab(tab)}
                    />
                  )}

                  {/* TAB 3: Daily Rosary guide */}
                  {activeTab === "rosary" && (
                    <PrayScreen
                      onOpenSettings={() => setIsRosarySettingsOpen(true)}
                      parishId={activeChurchRoute.id}
                      parishName={activeChurchRoute.name.replace(" Guide", "").replace(" Tour", "")}
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
                    <ChurchHistory parish={activeChurchRoute} />
                  )}

                  {/* TAB 6: Volunteer Guilds list */}
                  {activeTab === "ministries" && (
                    <MinistriesTab parish={activeChurchRoute} onAddApplication={handleAddApplication} />
                  )}

                  {/* TAB 7: Sacraments office */}
                  {activeTab === "sacraments" && (
                    <SacramentsTab parish={activeChurchRoute} onAddApplication={handleAddApplication} />
                  )}

                  {/* TAB 8: AR Tour */}
                  {activeTab === "ar" && (
                    <ArTour stations={activeChurchRoute.stations} />
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
                  {activeTab === "me" && (
                    <MeTab
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
                    />
                  )}

                  {/* TAB 11: Admin Control Panel */}
                  {activeTab === "admin" && (
                    <AdminPortal
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
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "home" ? "text-[var(--color-brand-secondary)] font-bold" : "text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-secondary)]"
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">Home</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("navigator")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "navigator" ? "text-[var(--color-brand-secondary)] font-bold" : "text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-secondary)]"
                    }`}
                  >
                    <Map className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">Map</span>
                  </button>

                  {/* Scan: the app's signature feature, given a raised,
                      filled treatment so it reads as the visual anchor of
                      the bar — but still carries a text label like every
                      other tab, not an icon-only control. */}
                  <button
                    onClick={() => setActiveTab("ar")}
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
                      Scan
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("rosary")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "rosary" ? "text-[var(--color-brand-secondary)] font-bold" : "text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-secondary)]"
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">Pray</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("me")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "me" ? "text-[var(--color-brand-secondary)] font-bold" : "text-[var(--color-brand-secondary)] hover:text-[var(--color-brand-secondary)]"
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">Me</span>
                  </button>
                </nav>

              </div>
            )}

            <RosarySettingsModal
              isOpen={isRosarySettingsOpen}
              onClose={() => setIsRosarySettingsOpen(false)}
            />

            <SimulatorPanel
              isOpen={isSimulatorOpen}
              onClose={() => setIsSimulatorOpen(false)}
            />

            {/* Presence is global, not a property of one tab — rendered here
                so it rises over whatever screen the pilgrim is on, and
                bounded by this same relative container so it never escapes
                the phone frame. */}
            <PresenceBanner />
            <PresenceSheet onOpenTour={handleOpenTourFromPresence} onOpenAR={handleOpenARFromPresence} />

          </div>
        </PhoneContainer>
      </main>

      {/* Footer credits bar */}
      <footer className="bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)] py-3.5 px-6 text-center text-sm text-[var(--color-brand-secondary)] font-mono select-none shrink-0 leading-normal">
        <p>Prepared for STI College Kalookan Capstone 2 Defense (March 2026). SanctiWalk is optimized for offline-first rendering across Windows, iOS, and Android platforms.</p>
      </footer>
    </div>
    </PresenceProvider>
  );
}
