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
