import { Route, Badge } from "./types";

export interface RosaryMystery {
  id: string;
  category: "Joyful" | "Sorrowful" | "Glorious" | "Luminous";
  title: string;
  days: string;
  prayers: string[];
}

export interface Ministry {
  id: string;
  name: string;
  description: string;
  requirements: string[];
}

export interface Sacrament {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  scheduleDetails: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export const ROSARY_MYSTERIES: RosaryMystery[] = [
  {
    id: "joyful",
    category: "Joyful",
    title: "The Joyful Mysteries",
    days: "Mondays & Saturdays",
    prayers: [
      "1. The Annunciation: Mary accepts her call to be the Mother of God.",
      "2. The Visitation: Mary visits her cousin Elizabeth who is with child.",
      "3. The Nativity: The birth of our Lord Jesus Christ in a humble stable.",
      "4. The Presentation: Jesus is presented in the Temple by Mary and Joseph.",
      "5. The Finding in the Temple: Jesus is found teaching the elders."
    ]
  },
  {
    id: "sorrowful",
    category: "Sorrowful",
    title: "The Sorrowful Mysteries",
    days: "Tuesdays & Fridays",
    prayers: [
      "1. The Agony in the Garden: Jesus prays in Gethsemane.",
      "2. The Scourging at the Pillar: Jesus is brutally whipped by Roman soldiers.",
      "3. The Crowning with Thorns: Jesus is mocked with a crown of thorns.",
      "4. The Carrying of the Cross: Jesus carries His heavy cross to Calvary.",
      "5. The Crucifixion: Jesus dies on the cross for our salvation."
    ]
  },
  {
    id: "glorious",
    category: "Glorious",
    title: "The Glorious Mysteries",
    days: "Wednesdays & Sundays",
    prayers: [
      "1. The Resurrection: Jesus rises from the dead on Easter Sunday.",
      "2. The Ascension: Jesus ascends to Heaven forty days after Easter.",
      "3. The Descent of the Holy Spirit: Pentecost descends upon the Apostles.",
      "4. The Assumption of Mary: Mary is taken body and soul into Heaven.",
      "5. The Coronation of Mary: Mary is crowned Queen of Heaven and Earth."
    ]
  },
  {
    id: "luminous",
    category: "Luminous",
    title: "The Luminous Mysteries",
    days: "Thursdays",
    prayers: [
      "1. The Baptism in the Jordan: Jesus is baptized by John the Baptist.",
      "2. The Wedding at Cana: Jesus performs His first miracle at Mary's request.",
      "3. The Proclamation of the Kingdom: Jesus calls all to repentance and faith.",
      "4. The Transfiguration: Jesus reveals His divine glory on Mount Tabor.",
      "5. The Institution of the Eucharist: Jesus institutes the Holy Mass."
    ]
  }
];

export const MINISTRIES: Ministry[] = [
  {
    id: "min-altar",
    name: "Altar Servers",
    description: "Young men dedicated to serving at the Holy Altar, maintaining the solemnity and order of parish liturgies.",
    requirements: [
      "Open heart to the call of God",
      "Baptized Catholic",
      "Ready for the Discernment Journey",
      "Age 10-25"
    ]
  },
  {
    id: "min-socom",
    name: "SOCOM (Social Communications) Ministry",
    description: "Responsible for parish communications, live streaming of Holy Mass, photography, and spreading God's word digitally.",
    requirements: [
      "Interested in Media & Communications",
      "Basic Knowledge of Social Media or Camera/Stream setups",
      "Willingness to volunteer on Parish events",
      "Age 15+"
    ]
  },
  {
    id: "min-vocation",
    name: "Vocation Recruitment Team",
    description: "Invites members to consider religious vocations: priesthood, consecrated life, or holy diaconate.",
    requirements: [
      "Active participant in Parish life",
      "Baptized Catholic with solid spiritual commitment",
      "Passionate about supporting church vocations",
      "Age 16-30"
    ]
  },
  {
    id: "min-lector",
    name: "Lector and Commentator Ministry",
    description: "Proclaims the Sacred Scriptures with dignity, clarity, and deep understanding during liturgical services.",
    requirements: [
      "Clear speaking voice and public confidence",
      "Regular attendee of Sunday mass",
      "Completion of Parish liturgical reading seminar",
      "Age 18+"
    ]
  },
  {
    id: "min-choir",
    name: "Singing Servants of Christ (Choir)",
    description: "Leads the congregation in liturgical song, elevating the Holy Mass and offering vocal praise to our Lord with beautiful hymns.",
    requirements: [
      "Deep passion for singing or playing musical instruments",
      "Ready to attend weekly rehearsals and musical training",
      "Committed to serving at Sunday masses and special parish feasts",
      "Age 12+"
    ]
  }
];

export const SACRAMENTS: Sacrament[] = [
  {
    id: "sac-baptism",
    name: "Holy Baptism",
    description: "The gateway to life in the Spirit, which washes away original sin and welcomes the soul into the Body of Christ.",
    requirements: [
      "Child's Birth Certificate (PSA copy)",
      "Marriage Contract of Parents",
      "Godparent (Ninong/Ninang) Catholic Certificates",
      "Pre-Baptismal Seminar attendance"
    ],
    scheduleDetails: "Saturdays and Sundays: 10:00 AM (Group Baptism)"
  },
  {
    id: "sac-confirmation",
    name: "Sacrament of Confirmation",
    description: "Imparts the special strength of the Holy Spirit to witness to the Christian faith actively.",
    requirements: [
      "Baptismal Certificate (with 'For Confirmation' annotation)",
      "Parish Catechism seminar certificate",
      "One Sponsor certificate copy"
    ],
    scheduleDetails: "Annual Diocesan Schedule / Parish Feast Day masses"
  },
  {
    id: "sac-matrimony",
    name: "Holy Matrimony",
    description: "A covenant by which a man and a woman establish a lifelong partnership directed toward the good of the spouses.",
    requirements: [
      "PSA Certificate of Singleness (CENOMAR)",
      "PSA Birth Certificates",
      "New copies of Baptismal & Confirmation Certificates",
      "Pre-Cana Seminar completion",
      "Canonical Interview with Father Paul Woo"
    ],
    scheduleDetails: "Tuesday to Saturday: 9:00 AM, 1:30 PM, or 3:30 PM (By advanced booking)"
  },
  {
    id: "sac-eucharist",
    name: "First Holy Communion",
    description: "The first reception of Christ's true Body and Blood, uniting children intimately with Jesus.",
    requirements: [
      "Baptismal Certificate",
      "Active enrollment in Parish Catechesis",
      "First Confession clearance"
    ],
    scheduleDetails: "Usually organized through local Catholic schools & Sunday school batches"
  },
  {
    id: "sac-confession",
    name: "Sacrament of Reconciliation (Confession)",
    description: "The merciful healing sacrament where sins are forgiven and the soul is fully restored to grace.",
    requirements: [
      "Sincere examination of conscience",
      "Intent to confess and repent of sins"
    ],
    scheduleDetails: "Every first Friday of the month (before Mass) or by special appointment"
  }
];

export const PILGRIM_QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    question: "When was the Mary Help of Christians Parish in Maypajo established?",
    options: ["1942", "1952", "1962", "2003"],
    correctAnswerIndex: 1,
    explanation: "The Mary Help of Christians community in Maypajo, Caloocan, was founded in 1952, establishing a central place for Marian devotion."
  },
  {
    id: "q2",
    question: "Who is the beloved patron saint of Caloocan, invoked against pestilence and plagues?",
    options: ["Saint Augustine", "Saint James", "San Roque (Saint Roch)", "San Lorenzo Ruiz"],
    correctAnswerIndex: 2,
    explanation: "San Roque is the beloved patron saint of the San Roque Cathedral Parish, known as the healer of the sick and plagues."
  },
  {
    id: "q3",
    question: "What does PWA stand for, which solves the problem of cross-platform app development for students on Windows?",
    options: ["Personal Web Application", "Progressive Web App", "Public Wireless Access", "Programmed Web Asset"],
    correctAnswerIndex: 1,
    explanation: "PWA stands for Progressive Web App. It lets you develop single-codebase cross-platform mobile apps easily from a Windows laptop without Apple Xcode!"
  },
  {
    id: "q4",
    question: "The Diocese of Kalookan was officially established in what year?",
    options: ["1952", "1985", "2003", "2015"],
    correctAnswerIndex: 2,
    explanation: "The Diocese of Kalookan was carved out from the Archdiocese of Manila and officially established in 2003."
  },
  {
    id: "q5",
    question: "What is the parish book called in Mary Help of Christians Parish that recounts the church history?",
    options: ["Agos", "Sinag", "Gabay", "Liwanag"],
    correctAnswerIndex: 0,
    explanation: "The book is called 'Agos' (Flow), which records the beautiful spiritual history, community streams, and Marian miracles of the Maypajo parish."
  }
];

export interface ParishMassSchedule {
  // Mirrors the `coordinatesVerified` pattern already used for parish
  // coordinates elsewhere in this codebase: true only when the times below
  // came from the parish's own published schedule. False means the schedule
  // is a stand-in and must be visibly flagged as such wherever it renders —
  // never presented as if it were the parish's real Mass times.
  scheduleVerified: boolean;
  schedule: { day: string; time: string }[];
}

export const MASS_SCHEDULES: Record<string, ParishMassSchedule> = {
  "route-mhcp": {
    scheduleVerified: true,
    schedule: [
      { day: "Monday", time: "6:00 AM" },
      { day: "Tuesday", time: "6:00 AM" },
      { day: "Wednesday", time: "6:00 AM, 6:00 PM" },
      { day: "Thursday", time: "6:00 AM, 6:00 PM" },
      { day: "Friday", time: "6:00 AM, 6:00 PM" },
      { day: "Saturday", time: "6:00 AM, 6:00 PM" },
      { day: "Sunday", time: "6:00 AM, 7:30 AM, 9:00 AM, 10:30 AM, 4:30 PM, 6:00 PM" },
    ],
  },
  // PLACEHOLDER SCHEDULE — not from the parish. San Roque Cathedral's real
  // Mass schedule loads dynamically on the diocese site and could not be
  // scraped, so this is a deliberately-different stand-in that exists only
  // so the per-parish switch can be demoed before the parish office
  // supplies real times. scheduleVerified stays false until someone replaces
  // the array below with confirmed times from the parish and flips it to
  // true — do not remove the flag, and do not treat these times as real.
  "route-src": {
    scheduleVerified: false,
    schedule: [
      { day: "Monday", time: "6:00 PM" },
      { day: "Tuesday", time: "6:00 PM" },
      { day: "Wednesday", time: "6:00 PM" },
      { day: "Thursday", time: "6:00 PM" },
      { day: "Friday", time: "6:00 PM" },
      { day: "Saturday", time: "6:00 AM, 5:00 PM" },
      { day: "Sunday", time: "6:30 AM, 8:00 AM, 10:00 AM, 5:00 PM" },
    ],
  },
};

export interface ParishContact {
  address: string;
  phone?: string;
  email?: string;
}

// Only Mary Help of Christians' contact details were ever actually scraped
// from the diocese site. San Roque's are not yet available — MassSchedule
// must say so rather than leaving blank fields or borrowing MHCP's.
export const PARISH_CONTACTS: Record<string, ParishContact> = {
  "route-mhcp": {
    address: "J.P Rizal Street, Maypajo, Caloocan City",
    phone: "(8) 288-7482 / 0945 253 5329",
    email: "maryhelpofchristians@dioceseofkalookan.ph",
  },
  "route-src": {
    address: "A. Mabini St, Caloocan City",
  },
};

// Patron saint per live parish, for the map screen's parish cards. Route
// itself has no dedicated field for this, so it's pulled from the parish's
// own station content above rather than invented: MHCP's "mhcp-patron"
// station names Maria Auxiliadora, and SRC's "src-statue" station names
// San Roque.
/**
 * A photograph of each parish's patron image, for the collapsing header on
 * Home.
 *
 * Deliberately empty. No parish photography has been collected yet — the
 * field team's sheet asks for it — and the header renders the name alone
 * when a parish is missing from here, which is the same thing it looks like
 * once scrolled. That is the honest empty state.
 *
 * Do NOT fill this with stock imagery. This is the largest element on the
 * home screen, and a generic church photograph presented as *this* parish's
 * patron is the most visible possible version of the mistake the rest of
 * this file avoids (see coordinatesVerified / scheduleVerified). Add an
 * entry only when someone has photographed that parish's own image:
 *
 *   "route-mhcp": "/parish/mary-help-patron.jpg",
 */
export const PARISH_PATRON_IMAGES: Record<string, string | undefined> = {
  // The parish's own image of Maria Auxiliadora in its niche, photographed by
  // the client. Converted from the original iPhone HEIC — which no browser
  // outside Safari can display — and resized from 3024x4032 to 1200px wide.
  "route-mhcp": "/parish/mary-help-patron.jpg",

  // San Roque's patron, extracted from the PSD the parish supplied. Until
  // now this parish had no photograph at all and its history card fell back
  // to the placeholder illustration.
  "route-src": "/parish/san-roque-hero.jpg",
}

/**
 * The image behind the welcome header, which is a different picture from the
 * one on the history card: the header needs something that reads at a glance
 * behind text, the card needs the subject whole.
 */
export const PARISH_HEADER_IMAGES: Record<string, string | undefined> = {
  "route-mhcp": "/parish/mary-help-hero.jpg",
  "route-src": "/parish/san-roque-hero.jpg",
}

/**
 * How far down each header photograph the patron's face sits, as a fraction
 * of the picture's height.
 *
 * The home band collapses to a bar about 90px tall as the page scrolls, and
 * which part of the photograph survives that is decided by the picture's own
 * composition — so no single crop can serve both of these. Mary Help's is a
 * landscape frame with the faces just past the middle; San Roque's is a
 * portrait with his head in the top third. Left to one rule, Mary's face
 * ended up behind the sheet's rounded lip and only the crown and halo showed.
 *
 * Measured by opening each file and reading off where the face is:
 *
 *   mary-help-hero.jpg   1200x900   Mary's face y 455-575, the child's
 *                                   455-600; centred on the pair at y 535
 *   san-roque-hero.jpg   902x1265   head and hat y 200-445, centred at 322
 *
 * ParishWelcomeHeader turns this into the offset that lands the face in the
 * middle of the collapsed bar. A parish with no entry here — including one
 * whose photograph was uploaded through the admin portal, where nobody has
 * said where the face is — keeps the plain top-aligned crop.
 */
export const PARISH_HEADER_FACES: Record<string, number | undefined> = {
  "route-mhcp": 0.59,
  "route-src": 0.255,
}

export const PARISH_PATRON_SAINTS: Record<string, string> = {
  "route-mhcp": "Maria Auxiliadora (Mary Help of Christians)",
  "route-src": "San Roque",
};

export const ROUTES: Route[] = [
  {
    id: "route-mhcp",
    name: "Mary Help of Christians Parish Guide",
    description: "Pilgrim trail inside the Maypajo Parish, exploring the historical altar, the sacred image of Maria Auxiliadora, and spiritual milestones.",
    location: "Maypajo, Caloocan City",
    distanceKm: 0.5,
    durationMins: 20,
    difficulty: "Easy",
    estimatedSteps: 600,
    category: "Marian Church",
    accentColor: "from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)]",
    coordinates: { lat: 14.637702, lng: 120.97344 },
    coordinatesVerified: true,
    geofenceRadius: 100,
    status: "live",
    stations: [
      {
        id: "mhcp-altar",
        name: "Main Altar & Tabernacle",
        description: "The central sanctuary of Mary Help of Christians Parish, designed for deep worship and Eucharist celebration.",
        history: "Consecrated as the spiritual center of the parish. It holds the tabernacle and displays majestic holy figures depicting the Salesian devotions.",
        reflection: "Quiet your heart as you stand before the Altar. In the stillness, listen to God's whisper. What are you most grateful for today?",
        coordinates: { lat: 14.6305, lng: 120.9711 },
        imageUrl: "https://dioceseofkalookan.ph/wp-content/uploads/2020/12/maryhelpPic1-1-1024x680.jpg",
        qrCode: "MHCP-ALTAR"
      },
      {
        id: "mhcp-patron",
        name: "Maria Auxiliadora Patroness Statue",
        description: "The majestic crowned image of Mary Help of Christians holding the Child Jesus with open arms.",
        history: "A title promoted strongly by St. John Bosco. This specific parish image has been a source of spiritual comfort, community miracles, and grace since the parish's founding.",
        reflection: "Mary holds Jesus, presenting Him to us as our ultimate help. Where in your life do you need a helper today? Sincere prayer is never ignored.",
        coordinates: { lat: 14.6308, lng: 120.9715 },
        qrCode: "MHCP-PATRON"
      },
      {
        id: "mhcp-bapt",
        name: "Baptismal Sanctuary Font",
        description: "The holy font where infants and adults enter into God's family, baptized in water and the Spirit.",
        history: "Located at the church entrance, symbolizing baptism as the doorway to all other sacraments. Built in high-polish granite.",
        reflection: "Water brings life and cleanses. Remember that your life has a divine purpose. How can you bring a clean start and hope to someone who is down today?",
        coordinates: { lat: 14.6302, lng: 120.9708 },
        qrCode: "MHCP-BAPT"
      }
    ]
  },
  {
    id: "route-src",
    name: "San Roque Cathedral Parish Tour",
    description: "Pilgrimage of Caloocan's primary cathedral, established in 1815, home to Saint Roch the healer.",
    location: "A. Mabini St, Caloocan City",
    distanceKm: 0.8,
    durationMins: 25,
    difficulty: "Easy",
    estimatedSteps: 1100,
    category: "Historic Heritage",
    accentColor: "from-[var(--color-brand-primary)] to-[var(--color-brand-text)]",
    coordinates: { lat: 14.651647, lng: 120.972648 },
    coordinatesVerified: true,
    geofenceRadius: 100,
    status: "live",
    stations: [
      {
        id: "src-sanctuary",
        name: "Cathedral Central Sanctuary",
        description: "The solemn altar and seat of the Bishop of Kalookan, hosting major religious feasts and historical assemblies.",
        history: "Originally built in 1815, the church witnessed the Philippine Revolution as a stronghold. Consecrated as a Cathedral in 2003 under the first bishop.",
        reflection: "Reflect on the resilience of this cathedral, standing strong through wars and natural events. How resilient is your spirit in times of trial?",
        coordinates: { lat: 14.6514, lng: 120.9739 },
        qrCode: "SRC-ALTAR"
      },
      {
        id: "src-statue",
        name: "Miraculous Statue of San Roque",
        description: "The highly venerated statue of San Roque, representing his life of sacrifice and healing.",
        history: "Venerated by the community. San Roque was a layman who cared for plague-stricken people in Europe, and is invoked for protection against sickness and health crises.",
        reflection: "San Roque put his life at risk to nurse others. Who among your sick neighbors, friends, or family members can you pray for or reach out to today?",
        coordinates: { lat: 14.6518, lng: 120.9742 },
        qrCode: "SRC-ROQUE"
      }
    ]
  }
];

export const BADGES: Badge[] = [
  {
    id: "badge-1",
    name: "Mary Help Disciple",
    description: "Check in at the Mary Help of Christians Parish Maypajo altar.",
    icon: "Footprints"
  },
  {
    id: "badge-2",
    name: "Cathedral Pilgrim",
    description: "Complete all stations of the San Roque Cathedral Parish guide.",
    icon: "Compass"
  },
  {
    id: "badge-3",
    name: "Agos Scholar",
    description: "Scan pages of the 'Agos' book in the interactive AR viewer.",
    icon: "BookOpen"
  },
  {
    id: "badge-4",
    name: "Faith Defender",
    description: "Complete the Pilgrim Quiz with a perfect 5/5 score!",
    icon: "Award"
  },
  {
    id: "badge-5",
    name: "Community Active",
    description: "Post a spiritual reflection comment on any church station.",
    icon: "Heart"
  }
];
