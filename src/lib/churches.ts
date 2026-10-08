import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import type { Church } from "../types";
import parishData from "../data/diocese-parishes.json";

/**
 * The churches an account can belong to.
 *
 * ## Why this reads Firestore and falls back to the bundled list
 *
 * The signup screen has to show a church list before anyone has signed in,
 * and the rules make churches/ publicly readable for exactly that reason.
 * But a brand-new project has an empty collection, and a signup screen with
 * no churches in it is a dead end that looks like a bug. So the diocese list
 * that already ships with the app is the floor: Firestore can add to it and
 * correct it, and until someone does, signup still works.
 *
 * The fallback carries no adminUid. Only a real Firestore document can say
 * who administers a church, because that is the field the whole
 * one-admin-per-church rule rests on, and a value invented client-side would
 * be a value the rules then refuse to honour.
 */

interface DioceseParish {
  id: string;
  name: string;
  vicariate: string;
  status: string;
}

const PARISHES = (parishData as { parishes: DioceseParish[] }).parishes;

/**
 * The two parishes with a route id, which is what a churchId has to be.
 *
 * parishContent is keyed by route id and the rules authorise that write with
 * `isAdminOf(parishId)`, so a church whose id is not the route id would have
 * an admin who cannot edit their own parish page.
 */
export const LIVE_CHURCHES: Church[] = [
  { id: "route-mhcp", name: "Mary Help of Christians Parish", location: "Maypajo, Caloocan City" },
  { id: "route-src", name: "San Roque Cathedral Parish", location: "Caloocan City" },
];

/** The bundled diocese list, as churches, for parishes with no route yet. */
function bundledChurches(): Church[] {
  const live = new Set(LIVE_CHURCHES.map(c => c.id));
  const rest = PARISHES
    .filter(p => !live.has(p.id))
    .map(p => ({ id: p.id, name: p.name, location: p.vicariate }));
  return [...LIVE_CHURCHES, ...rest];
}

/**
 * Every church a new account may choose from, Firestore first.
 *
 * A failed read is not an error here: churches/ is world-readable, so a
 * failure means the network, and the bundled list is a better answer than an
 * empty dropdown.
 */
export async function listChurches(): Promise<Church[]> {
  try {
    const snap = await getDocs(collection(db, "churches"));
    if (snap.empty) return bundledChurches();

    const fromDb = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Church, "id">) }));
    const seen = new Set(fromDb.map(c => c.id));
    // Bundled entries fill the gaps rather than replacing anything: a church
    // that exists in Firestore is the authoritative version of itself.
    return [...fromDb, ...bundledChurches().filter(c => !seen.has(c.id))];
  } catch {
    return bundledChurches();
  }
}

/** One church, or null. Used to show which parish an account belongs to. */
export async function getChurch(churchId: string): Promise<Church | null> {
  if (!churchId) return null;
  try {
    const snap = await getDoc(doc(db, "churches", churchId));
    if (snap.exists()) return { id: snap.id, ...(snap.data() as Omit<Church, "id">) };
  } catch {
    /* fall through to the bundled list */
  }
  return bundledChurches().find(c => c.id === churchId) ?? null;
}

/** The display name for a churchId, falling back to the id itself. */
export function churchName(churchId: string, churches: Church[]): string {
  return churches.find(c => c.id === churchId)?.name ?? churchId;
}
