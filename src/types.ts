export interface Station {
  id: string;
  name: string;
  description: string;
  history: string;
  reflection: string;
  coordinates: { lat: number; lng: number };
  audioDuration: string;
  imageUrl: string;
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
