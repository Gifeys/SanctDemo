export interface Station {
  id: string;
  name: string;
  description: string;
  history: string;
  reflection: string;
  coordinates: { lat: number; lng: number };
  /**
   * A recorded narration for this station, once one exists.
   *
   * This replaces `audioDuration`, which was a string like "1:30" on every
   * station while no audio file had ever been recorded — the app was
   * advertising narration that did not exist. A duration is a property OF a
   * recording, so it is read from the file at playback rather than typed by
   * hand, and with no file there is nothing to claim.
   */
  audioUrl?: string;
  /**
   * A photograph OF THIS STATION. Optional, and absent is the honest state
   * for most: four of the five stations carried Unsplash stock photographs of
   * unrelated churches, which presented another parish's baptismal font as
   * this one's. Same principle as `scheduleVerified` in data.ts — show the
   * placeholder, never the plausible-looking wrong thing.
   */
  imageUrl?: string;
  qrCode: string;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  location: string;
  distanceKm: number;
  durationMins: number;
  difficulty: "Easy" | "Moderate" | "Challenging";
  stations: Station[];
  estimatedSteps: number;
  category: "Marian Church" | "Historic Heritage" | "Spiritual Retreat" | "Wellness Trail";
  accentColor: string;
  coordinates?: { lat: number; lng: number };
  coordinatesVerified?: boolean;
  geofenceRadius?: number;
  status?: "live" | "coming_soon";
}

export interface UserProgress {
  completedStations: string[]; // station ids
  completedRoutes: string[]; // route ids
  badges: string[]; // badge ids
  steps: number;
  distanceKm: number;
  points: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  dateEarned?: string;
}

export interface Reflection {
  id: string;
  stationId: string;
  routeId: string;
  date: string;
  text: string;
  mood: string;
}

// ---------------------------------------------------------------------------
// Accounts, churches and applications
//
// These three travel together: a person belongs to exactly one church, a
// church has exactly one administrator, and an application belongs to the
// church its applicant belongs to. The security rules enforce all three; the
// types here are so the app cannot casually write a shape the rules will
// reject at the last moment, in front of the user.
// ---------------------------------------------------------------------------

/** What a signed-in account is allowed to be. Never chosen by the client. */
export type UserRole = "user" | "church_admin";

/**
 * A parish, as an account belongs to it.
 *
 * `id` is the route id ("route-mhcp"), not a separate key. The parish's
 * admin-managed content already lives at parishContent/{routeId} and the
 * rules authorise that write with the same id, so a second identifier would
 * mean two ways to name one parish and a mapping table to keep in step.
 */
export interface Church {
  id: string;
  name: string;
  location: string;
  contactEmail?: string;
  contactNumber?: string;
  /**
   * The one administrator. Immutable from the client - that immutability IS
   * the one-admin-per-church rule, since nothing in the app can assign or
   * reassign it.
   */
  adminUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * The account document at users/{uid}.
 *
 * `role` and `churchId` decide what the security rules will let this account
 * do, and neither is writable by the account itself after creation.
 * `emailVerified` is a mirror of Firebase Auth for display only - the rules
 * never trust it, because a mirror is only as honest as whoever last wrote
 * it.
 */
export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  /**
   * What the app calls you. Shown on Home's welcome band.
   *
   * Separate from fullName because the two are for different readers: the
   * parish office needs the name on your baptismal record, and the home
   * screen should greet you the way your family does. Before this, Home
   * greeted people with the first word of their email address.
   */
  nickname?: string;
  /** A small square avatar. See lib/avatar.ts for why it is a data URL. */
  photoUrl?: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  role: UserRole;
  churchId: string;
  createdAt: string;
  updatedAt?: string;
  points?: number;
  steps?: number;
  completedStations?: string[];
  badges?: string[];
}

/** Where an application has got to. The rules refuse anything outside this. */
export type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "completed";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "pending", "under_review", "approved", "rejected", "completed",
];

/** One step in an application's audit trail. */
export interface ApplicationEvent {
  status: ApplicationStatus;
  at: string;
  by?: string;
  note?: string;
}

/**
 * A sacrament or ministry application.
 *
 * Owner is `uid`, not `applicantId`: that is the field the documents already
 * in the database carry and the field the existing query filters on, and
 * renaming it would strand every application already submitted.
 */
export interface ApplicationDoc {
  id?: string;
  uid: string;
  applicantName: string;
  applicantEmail: string;
  churchId: string;
  kind: "sacrament" | "ministry";
  /**
   * The ministry's or sacrament's id - "min-altar-servers", "sac-baptism".
   *
   * Optional on the type only because applications submitted before this
   * field existed do not carry one. Every NEW application must have it:
   * the security rules refuse a create without it, because it is what
   * they check against the parish's closed-applications list.
   */
  itemId?: string;
  /** "Baptism", "Confirmation", or the ministry's name. */
  type: string;
  status: ApplicationStatus;
  referenceNumber: string;
  formData?: Record<string, unknown>;
  documentPaths?: string[];
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  history?: ApplicationEvent[];
  createdAt: string;
  updatedAt?: string;
}

/** An in-app message. Email needs Cloud Functions, which needs Blaze. */
export interface NotificationDoc {
  id?: string;
  userId: string;
  churchId: string;
  title: string;
  body: string;
  applicationId?: string;
  createdAt: string;
  readAt?: string | null;
}
