import type { Language } from "./language";

/**
 * The app's own words, in both languages.
 *
 * ## Why a table and not a library
 *
 * i18next and its relatives bring plurals, interpolation, namespaces
 * and lazy-loaded bundles. SanctiWalk has two languages, one of them
 * default, and a few hundred short labels that all ship with the app —
 * none of that machinery would ever be used, and all of it would be in
 * the bundle a pilgrim downloads over parish wifi.
 *
 * A frozen object and a lookup is the whole requirement. TypeScript
 * makes the key set exhaustive, so a label added in English without its
 * Tagalog fails the build rather than appearing untranslated on
 * somebody's phone.
 *
 * ## What belongs here and what does not
 *
 * Interface labels: tabs, headings, buttons, the words the app says
 * about itself. NOT the parish's content — descriptions, Mass times,
 * announcements and histories come from data.ts or from Firestore and
 * are handled by contentTranslations.ts, because translating what a
 * parish wrote is a different act from translating a button.
 */

const STRINGS = {
  // ---- the tab bar ----
  "tab.home": { en: "Home", fil: "Bahay" },
  "tab.map": { en: "Map", fil: "Mapa" },
  "tab.scan": { en: "Scan", fil: "I-scan" },
  "tab.pray": { en: "Pray", fil: "Dasal" },
  "tab.me": { en: "Me", fil: "Ako" },

  // ---- Home ----
  "home.welcome": { en: "Welcome", fil: "Maligayang pagdating" },
  "home.bulletin": { en: "Parish Bulletin", fil: "Patalastas ng Parokya" },
  "home.verseOfTheDay": { en: "Verse of the Day", fil: "Talata ng Araw" },
  "home.massSchedule": { en: "Mass Schedule", fil: "Oras ng Misa" },
  "home.churchHistory": { en: "Church History", fil: "Kasaysayan ng Simbahan" },
  "home.commemorates": { en: "Commemorates", fil: "Ginugunita" },
  "home.learnMore": { en: "Learn more", fil: "Alamin pa" },
  "home.backToMyParish": { en: "Back to my parish", fil: "Balik sa aking parokya" },
  "home.nothingThisWeek": {
    en: "Nothing from the parish office this week. Announcements, feast days and schedule changes appear here first.",
    fil: "Walang bago mula sa tanggapan ng parokya ngayong linggo. Dito unang lalabas ang mga patalastas, kapistahan at pagbabago sa oras ng Misa.",
  },

  // ---- the quick buttons ----
  "quick.ministries": { en: "Ministries", fil: "Mga Ministeryo" },
  "quick.sacraments": { en: "Sacraments", fil: "Mga Sakramento" },
  "quick.mass": { en: "Mass Schedule", fil: "Oras ng Misa" },
  "quick.history": { en: "History", fil: "Kasaysayan" },
  "quick.heading": { en: "What are you looking for?", fil: "Ano ang hinahanap mo?" },

  // ---- Me ----
  "me.title": { en: "Pilgrim Profile", fil: "Profile ng Peregrino" },
  "me.account": { en: "Account", fil: "Account" },
  "me.signIn": { en: "Sign in", fil: "Mag-sign in" },
  "me.signOut": { en: "Sign out", fil: "Mag-sign out" },
  "me.myApplications": { en: "My Applications", fil: "Aking mga Aplikasyon" },
  "me.notifications": { en: "Notifications", fil: "Mga Abiso" },
  "me.nothingNew": { en: "Nothing new", fil: "Walang bago" },
  "me.unread": { en: "unread", fil: "hindi pa nababasa" },
  "me.settings": { en: "Settings", fil: "Mga Setting" },
  "me.language": { en: "Language", fil: "Wika" },
  "me.languageHelp": {
    en: "Everything in SanctiWalk is shown in this language, including the station and ministry descriptions.",
    fil: "Lahat ng nasa SanctiWalk ay ipapakita sa wikang ito, pati na ang mga paglalarawan ng istasyon at ministeryo.",
  },
  "me.changeParish": { en: "Change Parish", fil: "Palitan ang Parokya" },
  "me.rosarySettings": { en: "Rosary Settings", fil: "Setting ng Rosaryo" },
  "me.replayTutorial": { en: "Show me around again", fil: "Ipakita muli ang gabay" },
  "me.helpAndGuide": { en: "Help & guide", fil: "Tulong at gabay" },

  // ---- reminders ----
  "rem.title": { en: "Reminders", fil: "Mga Paalala" },
  "rem.beforeMass": { en: "Before Mass", fil: "Bago ang Misa" },
  "rem.beforeMassHint": { en: "Your parish's Mass times.", fil: "Ang oras ng Misa sa iyong parokya." },
  "rem.howLongBefore": { en: "How long before?", fil: "Gaano katagal bago mag-Misa?" },
  "rem.feastDays": { en: "Feast days", fil: "Mga Kapistahan" },
  "rem.feastHint": { en: "The evening before, and on the day.", fil: "Gabi bago ang araw, at sa mismong araw." },
  "rem.events": { en: "Parish events", fil: "Mga Gawain ng Parokya" },
  "rem.announcements": { en: "Parish announcements", fil: "Mga Patalastas ng Parokya" },
  "rem.applications": { en: "My applications", fil: "Aking mga aplikasyon" },
  "rem.applicationsHint": { en: "When the parish decides on one.", fil: "Kapag may pasya na ang parokya." },
  "rem.otherParishes": { en: "Other parishes", fil: "Ibang mga Parokya" },
  "rem.otherParishesHint": {
    en: "Be reminded before Mass at another parish as well as your own.",
    fil: "Maaari ka ring paalalahanan bago ang Misa sa ibang parokya bukod sa iyong sarili.",
  },
  "rem.turnOn": { en: "Turn on reminders", fil: "Buksan ang mga paalala" },
  "rem.test": { en: "Send a test reminder", fil: "Magpadala ng pansubok na paalala" },
  "rem.testSent": { en: "Sent — check your notifications", fil: "Naipadala — tingnan ang iyong mga abiso" },

  // ---- Sancti ----
  "sancti.ask": { en: "Ask Sancti", fil: "Tanungin si Sancti" },
  "sancti.subtitle": { en: "Your guide around", fil: "Iyong gabay sa" },
  "sancti.placeholder": { en: "Ask Sancti…", fil: "Magtanong kay Sancti…" },
  "sancti.greeting": {
    en: "Good day! Ask me anything about the parish — where things are, when Mass is, or how to apply for a sacrament.",
    fil: "Magandang araw! Itanong mo sa akin ang anuman tungkol sa parokya — kung nasaan ang mga bagay, kailan ang Misa, o paano mag-apply para sa isang sakramento.",
  },
  "sancti.tryThese": { en: "Try one of these:", fil: "Subukan ang isa sa mga ito:" },

  // ---- shared words ----
  "common.back": { en: "Back", fil: "Bumalik" },
  "common.next": { en: "Next", fil: "Susunod" },
  "common.skip": { en: "Skip", fil: "Laktawan" },
  "common.finish": { en: "Finish", fil: "Tapusin" },
  "common.close": { en: "Close", fil: "Isara" },
  "common.search": { en: "Search", fil: "Maghanap" },
} as const satisfies Record<string, { en: string; fil: string }>;

export type UiKey = keyof typeof STRINGS;

/**
 * One interface label.
 *
 * Returns the key itself for anything unknown, which cannot happen
 * through the type but can through a cast. A visible "me.title" on
 * screen is reported in minutes; a silent empty string is not.
 */
export function t(key: UiKey, language: Language): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[language] || entry.en;
}

/** A `t` already bound to a language, for components that use many. */
export function translator(language: Language): (key: UiKey) => string {
  return key => t(key, language);
}

export const UI_KEYS = Object.keys(STRINGS) as UiKey[];
