import React, { useState, useEffect, useMemo } from "react";
import { PresenceProvider, usePresence } from "./context/PresenceContext";
import PhoneContainer from "./components/PhoneContainer";
import ChangeParishModal from "./components/ChangeParishModal";
import PwaBanner from "./components/PwaBanner";

// New Components
import Dashboard from "./components/Dashboard";
import MeTab from "./components/MeTab";
import DailyRosary from "./components/DailyRosary";
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
import DioceseMapLive from "./components/DioceseMapLive";

// Firebase imports
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, updateDoc, getDoc, getDocs, writeBatch, query, where } from "firebase/firestore";

import { Route, UserProgress } from "./types";
import { ROUTES, BADGES } from "./data";
import { loadHomeParishId, saveHomeParishId } from "./lib/homeParish";

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

// No home parish stored yet (first run, or storage was cleared) falls back
// to this rather than asking — the client does not want a welcome screen
// standing between install and the dashboard. The choice is still changeable
// afterward from the sidebar's "Change Home Parish" entry.
function firstLiveParishId(): string | null {
  return ROUTES.find(r => r.status !== "coming_soon")?.id ?? ROUTES[0]?.id ?? null;
}

export default function App() {
  // The pilgrim's home parish, chosen once and remembered. This is the
  // fallback the dashboard shows whenever GPS says they are not at a parish.
  const [homeParishId, setHomeParishId] = useState<string | null>(() =>
    loadHomeParishId(ROUTES.map(r => r.id)) ?? firstLiveParishId()
  );
  const [isChangeParishOpen, setIsChangeParishOpen] = useState(false);

  // Navigation & Frame settings. Seeded from the home parish so the app opens
  // on that parish's dashboard rather than asking which church to pick — the
  // app can work that out, so it should not ask.
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(
    () => loadHomeParishId(ROUTES.map(r => r.id)) ?? firstLiveParishId()
  );
  const [activeTab, setActiveTab] = useState<
    "home" | "navigator" | "rosary" | "mass" | "ministries" | "history" | "sacraments" | "ar" | "quiz" | "me" | "admin" | "pwa-devkit"
  >("home");
  
  const [isOffline, setIsOffline] = useState(false);
  const [isMobileOnly, setIsMobileOnly] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  // church context to the one presence detected.
  const handleOpenTourFromPresence = (parishId: string) => {
    setSelectedChurchId(parishId);
    setActiveTab("navigator");
  };

  const handleOpenARFromPresence = (parishId: string) => {
    setSelectedChurchId(parishId);
    setActiveTab("ar");
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
    setSelectedChurchId(parishId);
    setActiveTab("home");
    setIsChangeParishOpen(false);
  };

  return (
    <PresenceProvider>
      <PresenceParishSync onArrive={setSelectedChurchId} />
      <ChangeParishModal
        isOpen={isChangeParishOpen}
        onClose={() => setIsChangeParishOpen(false)}
        parishes={liveParishes}
        currentParishId={homeParishId}
        onChoose={handleChooseHomeParish}
      />
    <div className="min-h-screen bg-[#F5F5F0] text-[#33332D] flex flex-col justify-between font-sans">
      {/* Top Desktop Workspace Header Bar */}
      <header className="bg-[#EBEBE0] border-b border-[#D6D6C2] py-4 px-6 select-none shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-[#5A5A40] text-white flex items-center justify-center font-serif font-bold italic text-lg shadow-xs border border-[#C2A649]">
              S
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#4A4A35] font-serif italic leading-tight">
                SanctiWalk Core Workspace
              </h2>
              <p className="text-sm text-[#8A8A70] font-bold tracking-wider uppercase font-sans">
                Progressive Web App Prepared for STI College Capstone Defense
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-block text-[15px] text-[#8A8A70] font-mono">
              STATUS: <strong className="text-[#5A5A40] uppercase">Ready (Maypajo Parishes v2.0)</strong>
            </span>
            <button
              onClick={() => {
                setSelectedChurchId(null);
                setActiveTab("home");
              }}
              className="bg-[#5A5A40] text-white hover:bg-[#4A4A35] text-[15px] font-bold uppercase tracking-wider py-1.5 px-4 rounded-full flex items-center gap-1.5 shadow-sm transition-all border border-[#C2A649]"
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
          <div className="flex-1 flex flex-col relative bg-[#F5F5F0] overflow-hidden">
            
            {/* If NO church is selected, show the Church Selector view (Figure 2) */}
            {selectedChurchId === null ? (
              <div className="flex-1 flex flex-col bg-[#F5F5F0] p-5 overflow-y-auto justify-between">
                <div className="space-y-6 pt-4">
                  {/* Stylized App Icon/Header */}
                  <div className="text-center space-y-2">
                    <div className="h-14 w-14 rounded-2xl bg-[#5A5A40] border border-[#C2A649] text-white flex items-center justify-center font-sans text-3xl font-black shadow-md mx-auto">
                      S
                    </div>
                    <div>
                      <h1 className="text-3xl font-black font-sans tracking-tight text-white uppercase">
                        SanctiWalk
                      </h1>
                      <p className="text-sm text-[#EBEBE0] font-bold tracking-widest uppercase mt-0.5">
                        Pilgrimage Navigator
                      </p>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="text-center space-y-1 px-4">
                    <h2 className="text-[15px] font-bold text-white uppercase tracking-wider font-sans">
                      Choose Your Church Experience
                    </h2>
                    <p className="text-[15px] text-[#EBEBE0] leading-relaxed font-sans">
                      Select a historical parish of the Diocese of Kalookan to begin your interactive spiritual walking tour.
                    </p>
                  </div>

                  {/* Diocese map — a geographically calibrated illustration
                      showing both parishes (and the pilgrim's own position,
                      when known) before a church is chosen. Tapping a live
                      pin opens that parish's tour, same as the presence
                      sheet does. */}
                  <div className="bg-white rounded-2xl border border-[#D6D6C2] shadow-xs p-3 h-72">
                    <DioceseMapLive onSelectParish={handleOpenTourFromPresence} />
                  </div>

                  {/* Church Selector Cards (Figure 2 / Page 34) */}
                  <div className="space-y-3">
                    {ROUTES.map((route) => (
                      <div
                        key={route.id}
                        className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden shadow-xs hover:border-[#5A5A40] transition-all flex flex-col"
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
                            <span className="text-sm bg-[#C2A649] text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                              {route.category}
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="p-3.5 space-y-2 text-left font-sans">
                          <div>
                            <h4 className="text-[15px] font-bold text-[#4A4A35] font-sans">
                              {route.name}
                            </h4>
                            <p className="text-sm text-[#8A8A70] mt-0.5 flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-[#5A5A40]" /> {route.location}
                            </p>
                          </div>
                          <p className="text-[15px] text-[#33332D] leading-normal line-clamp-2">
                            {route.description}
                          </p>

                          <button
                            onClick={() => {
                              setSelectedChurchId(route.id);
                              setActiveTab("home");
                            }}
                            className="w-full mt-1 py-2 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-sm font-bold uppercase tracking-wider rounded-xl border border-[#4A4A35] transition-colors"
                          >
                            Start Sanctuary Walk
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-white/15">
                  <span className="text-sm text-[#EBEBE0] font-mono block">
                    STI COLLEGE KALOOKAN • CAPSTONE 2026
                  </span>
                </div>
              </div>
            ) : (
              /* ACTIVE CHURCH WEB SHELL LAYOUT */
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Header bar with Hamburger Slideout menu (Figure 35) */}
                <div className="bg-[#5A5A40] text-white h-14 px-4 flex items-center justify-between shrink-0 border-b border-[#D6D6C2]">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Menu className="w-5 h-5 text-white" />
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-[#5FC7DE] uppercase tracking-widest leading-none font-sans">
                        {activeChurchRoute.name.replace("Guide", "").replace("Tour", "")}
                      </h4>
                      <h1 className="text-[15px] font-extrabold font-sans tracking-tight leading-normal mt-0.5">
                        SANCTIWALK GUIDE
                      </h1>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab("me")}
                    className="p-1.5 bg-[#EBEBE0]/15 hover:bg-[#EBEBE0]/30 rounded-full border border-[#D6D6C2]/30 transition-all flex items-center gap-1"
                  >
                    <User className="w-3.5 h-3.5 text-white" />
                    <span className="text-sm font-bold text-white uppercase tracking-wider pr-1">
                      {isLoggedIn ? userEmail.split("@")[0] : "Sign In"}
                    </span>
                  </button>
                </div>

                {/* SLIDEOUT SIDEBAR MENU DRAWER PANEL */}
                {isSidebarOpen && (
                  <div className="absolute inset-0 bg-black/60 z-50 flex">
                    <div className="w-64 bg-[#EBEBE0] border-r border-[#D6D6C2] flex flex-col justify-between h-full shadow-2xl animate-in slide-in-from-left duration-200">

                      {/* Sidebar Header */}
                      <div className="bg-[#5A5A40] text-white p-4 flex items-center justify-between border-b border-[#D6D6C2]">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 rounded-lg bg-white/10 text-white flex items-center justify-center font-sans font-bold text-lg">
                            S
                          </span>
                          <div>
                            <h3 className="text-[15px] font-extrabold font-sans tracking-tight uppercase">
                              SanctiWalk
                            </h3>
                            <span className="text-sm font-mono text-[#EBEBE0] uppercase">Maypajo Parish App</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsSidebarOpen(false)}
                          className="p-1 hover:bg-white/10 rounded-full text-white"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Menu List of available Tabs. Home, Map, Scan, Pray and
                          Me each already have a dedicated bottom-nav tab, so
                          they are deliberately not repeated here — this drawer
                          now only holds what the bottom nav doesn't cover. */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-1 font-sans">
                        {/* One entry for "pick a different parish" — this used
                            to be two entries (an exit-to-selector button and a
                            separate change-home-parish modal) doing the same
                            job under different names. */}
                        <button
                          onClick={() => { setIsChangeParishOpen(true); setIsSidebarOpen(false); }}
                          className="w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all text-[#4A4A35] hover:bg-[#EBEBE0] font-bold"
                        >
                          <Church className="w-4 h-4" />
                          <span>Change Parish</span>
                        </button>

                        <div className="border-t border-[#D6D6C2]/45 my-2"></div>

                        <button
                          onClick={() => { setActiveTab("mass"); setIsSidebarOpen(false); }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            activeTab === "mass" ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          <span>Mass</span>
                        </button>

                        <button
                          onClick={() => { setActiveTab("history"); setIsSidebarOpen(false); }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            activeTab === "history" ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <Bookmark className="w-4 h-4" />
                          <span>History</span>
                        </button>

                        <button
                          onClick={() => { setActiveTab("ministries"); setIsSidebarOpen(false); }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            activeTab === "ministries" ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <MinistryIcon className="w-4 h-4" />
                          <span>Ministries</span>
                        </button>

                        <button
                          onClick={() => { setActiveTab("sacraments"); setIsSidebarOpen(false); }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            activeTab === "sacraments" ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <Heart className="w-4 h-4" />
                          <span>Sacraments</span>
                        </button>

                        <button
                          onClick={() => { setActiveTab("quiz"); setIsSidebarOpen(false); }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            activeTab === "quiz" ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <QuizIcon className="w-4 h-4" />
                          <span>Quiz</span>
                        </button>

                        <button
                          onClick={() => { setIsRosarySettingsOpen(true); setIsSidebarOpen(false); }}
                          className="w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base text-[#4A4A35] hover:bg-[#EBEBE0] transition-all"
                        >
                          <SettingsIcon className="w-4 h-4" />
                          <span>Rosary Settings</span>
                        </button>

                        {/* Admin portal panel entry */}
                        {(isAdmin || isLoggedIn) && (
                          <button
                            onClick={() => { setActiveTab("admin"); setIsSidebarOpen(false); }}
                            className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all bg-[#C2A649]/20 text-[#4A4A35] font-bold border border-[#C2A649]/45`}
                          >
                            <ShieldCheck className="w-4 h-4 text-[#5A5A40]" />
                            <span>Admin Panel</span>
                          </button>
                        )}

                        {/* DEMO TOOLS — deliberately separated (divider + its
                            own heading) from the pilgrim's real features
                            above, and reachable without a gesture: the client
                            demonstrates location awareness from a classroom
                            and needs the simulator to be one tap away, every
                            time. */}
                        <div className="border-t border-[#D6D6C2]/45 my-2"></div>
                        <div className="px-2.5 pt-1 pb-1.5">
                          <span className="text-sm font-bold text-[#8A8A70] uppercase tracking-widest">
                            Demo Tools
                          </span>
                        </div>

                        <button
                          onClick={() => { setIsSimulatorOpen(true); setIsSidebarOpen(false); }}
                          className="w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base text-[#4A4A35] hover:bg-[#EBEBE0] transition-all"
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Location Simulator</span>
                        </button>

                        <button
                          onClick={() => setIsMobileOnly(true)}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            isMobileOnly ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          <span>Smartphone Frame</span>
                        </button>

                        <button
                          onClick={() => setIsMobileOnly(false)}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            !isMobileOnly ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <Monitor className="w-4 h-4" />
                          <span>Full Responsive</span>
                        </button>

                        <button
                          onClick={() => setIsOffline(!isOffline)}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            !isOffline ? "text-emerald-800" : "text-amber-800"
                          } hover:bg-[#EBEBE0]`}
                        >
                          {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                          <span>{isOffline ? "Offline State" : "Online (Sim)"}</span>
                        </button>

                        <button
                          onClick={() => { setActiveTab("pwa-devkit"); setIsSidebarOpen(false); }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 text-base transition-all ${
                            activeTab === "pwa-devkit" ? "bg-[#5A5A40] text-white font-bold" : "text-[#4A4A35] hover:bg-[#EBEBE0]"
                          }`}
                        >
                          <FlaskConical className="w-4 h-4" />
                          <span>PWA Workspace</span>
                        </button>
                      </div>

                      {/* Sidebar Footer */}
                      <div className="p-4 bg-[#EBEBE0] border-t border-[#D6D6C2] text-center text-sm text-[#8A8A70] font-mono">
                        <span>STI College Kalookan v2.0</span>
                      </div>
                    </div>
                    {/* Backdrop closer clicker */}
                    <div className="flex-1" onClick={() => setIsSidebarOpen(false)}></div>
                  </div>
                )}

                {/* PRIMARY VIEW CONTENT WORKSPACE */}
                <div className="flex-1 flex flex-col overflow-y-auto pb-4">
                  
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
                      onSelectParish={handleOpenTourFromPresence}
                    />
                  )}

                  {/* TAB 2: Map / Trail Station Navigator */}
                  {activeTab === "navigator" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 flex flex-col overflow-y-auto">
                        {/* The real diocese map replaces the old simulated
                            walk. That simulation advanced a timer between
                            stations and displayed stored coordinates as if
                            they were the pilgrim's own, which was not a walk
                            at all. Station-by-station progress returns when
                            it is driven by real QR scans at each station. */}
                        <div className="p-4 pb-16">
                          <DioceseMapLive onSelectParish={handleOpenTourFromPresence} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Daily Rosary guide */}
                  {activeTab === "rosary" && (
                    <DailyRosary />
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
                    <ArTour
                      stationNames={activeChurchRoute.stations.map((s) => s.name)}
                    />
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
                <nav className="absolute bottom-0 inset-x-0 h-16 bg-[#EBEBE0] border-t border-[#D6D6C2] flex items-center justify-around px-1 z-40 shadow-md">
                  <button
                    onClick={() => setActiveTab("home")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "home" ? "text-[#5A5A40] font-bold" : "text-[#8A8A70] hover:text-[#5A5A40]"
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">Home</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("navigator")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "navigator" ? "text-[#5A5A40] font-bold" : "text-[#8A8A70] hover:text-[#5A5A40]"
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
                          ? "bg-[#5A5A40] border-[#EBEBE0] text-white"
                          : "bg-[#5A5A40] border-[#EBEBE0] text-white opacity-90"
                      }`}
                    >
                      <ArIcon className="w-5 h-5" />
                    </span>
                    <span className={`text-base font-bold leading-none ${activeTab === "ar" ? "text-[#5A5A40]" : "text-[#8A8A70]"}`}>
                      Scan
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab("rosary")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "rosary" ? "text-[#5A5A40] font-bold" : "text-[#8A8A70] hover:text-[#5A5A40]"
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="text-base font-bold leading-none">Pray</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("me")}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-12 rounded-xl transition-all ${
                      activeTab === "me" ? "text-[#5A5A40] font-bold" : "text-[#8A8A70] hover:text-[#5A5A40]"
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
      <footer className="bg-[#EBEBE0] border-t border-[#D6D6C2] py-3.5 px-6 text-center text-sm text-[#8A8A70] font-mono select-none shrink-0 leading-normal">
        <p>Prepared for STI College Kalookan Capstone 2 Defense (March 2026). SanctiWalk is optimized for offline-first rendering across Windows, iOS, and Android platforms.</p>
      </footer>
    </div>
    </PresenceProvider>
  );
}
