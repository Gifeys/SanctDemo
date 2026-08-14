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

export interface AgosBookPage {
  id: string;
  pageNumber: number;
  title: string;
  description: string;
  arModelName: string;
  arModelIcon: string;
  overlayText: string;
  audioFileUrl?: string;
  reflectionPrompt: string;
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

export const AGOS_BOOK_PAGES: AgosBookPage[] = [
  {
    id: "agos-p5",
    pageNumber: 5,
    title: "Chapter 1: The Foundations of Maypajo",
    description: "Highlights the historic establishment of the Mary Help of Christians community in 1952, marking the seeds of Marian pilgrimage.",
    arModelName: "Interactive 1952 Founding Altar 3D",
    arModelIcon: "Building2",
    overlayText: "Behold the replica of the original wooden Maypajo chapel! Built by local volunteers in 1952 using simple nipa and bamboo, this historical layout holds the spiritual roots of our parish.",
    reflectionPrompt: "Look at this simple wooden chapel. How does the faith of our parish founders inspire you to build a community of love with what you have?"
  },
  {
    id: "agos-p18",
    pageNumber: 18,
    title: "Chapter 3: The Call of Maria Auxiliadora",
    description: "Documents the consecration of the parish under the maternal protection of Mary, Help of Christians (Maria Auxiliadora).",
    arModelName: "The Consecrated Crown and Scepter 3D",
    arModelIcon: "Sparkles",
    overlayText: "Behold the Golden Crown and Scepter of Maria Auxiliadora! Symbolizing Mary's queenly intercession and her maternal defense of Christians in all trials.",
    reflectionPrompt: "Reflect on Mary's crown. True power in God's eyes is shown through humble service. How can you serve those around you with a crown of love?"
  },
  {
    id: "agos-p35",
    pageNumber: 35,
    title: "Chapter 5: Diocese of Kalookan Consecration",
    description: "Details the official establishment of the Diocese of Kalookan in 2003, uniting Caloocan, Malabon, and Navotas under one shepherd.",
    arModelName: "Bishop's Mitre & Diocesan Seal 3D",
    arModelIcon: "ShieldAlert",
    overlayText: "Behold the official Diocesan Seal of Kalookan in AR! Displaying the keys of Peter, the pastoral staff, and the waves of Manila Bay, representing our coastal parishes sailing under Christ's anchor.",
    reflectionPrompt: "The Bishop's staff guides the flock. Who are the mentors or guides in your life whom you are grateful for today?"
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
    accentColor: "from-[#5A5A40] to-[#4A4A35]",
    stations: [
      {
        id: "mhcp-altar",
        name: "Main Altar & Tabernacle",
        description: "The central sanctuary of Mary Help of Christians Parish, designed for deep worship and Eucharist celebration.",
        history: "Consecrated as the spiritual center of the parish. It holds the tabernacle and displays majestic holy figures depicting the Salesian devotions.",
        reflection: "Quiet your heart as you stand before the Altar. In the stillness, listen to God's whisper. What are you most grateful for today?",
        coordinates: { lat: 14.6305, lng: 120.9711 },
        audioDuration: "1:30",
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
        audioDuration: "2:05",
        imageUrl: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=800&q=80",
        qrCode: "MHCP-PATRON"
      },
      {
        id: "mhcp-bapt",
        name: "Baptismal Sanctuary Font",
        description: "The holy font where infants and adults enter into God's family, baptized in water and the Spirit.",
        history: "Located at the church entrance, symbolizing baptism as the doorway to all other sacraments. Built in high-polish granite.",
        reflection: "Water brings life and cleanses. Remember that your life has a divine purpose. How can you bring a clean start and hope to someone who is down today?",
        coordinates: { lat: 14.6302, lng: 120.9708 },
        audioDuration: "1:45",
        imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
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
    accentColor: "from-[#5A5A40] to-[#33332D]",
    stations: [
      {
        id: "src-sanctuary",
        name: "Cathedral Central Sanctuary",
        description: "The solemn altar and seat of the Bishop of Kalookan, hosting major religious feasts and historical assemblies.",
        history: "Originally built in 1815, the church witnessed the Philippine Revolution as a stronghold. Consecrated as a Cathedral in 2003 under the first bishop.",
        reflection: "Reflect on the resilience of this cathedral, standing strong through wars and natural events. How resilient is your spirit in times of trial?",
        coordinates: { lat: 14.6514, lng: 120.9739 },
        audioDuration: "2:20",
        imageUrl: "https://images.unsplash.com/photo-1590076241314-e2c7c724490d?auto=format&fit=crop&w=800&q=80",
        qrCode: "SRC-ALTAR"
      },
      {
        id: "src-statue",
        name: "Miraculous Statue of San Roque",
        description: "The highly venerated statue of San Roque, representing his life of sacrifice and healing.",
        history: "Venerated by the community. San Roque was a layman who cared for plague-stricken people in Europe, and is invoked for protection against sickness and health crises.",
        reflection: "San Roque put his life at risk to nurse others. Who among your sick neighbors, friends, or family members can you pray for or reach out to today?",
        coordinates: { lat: 14.6518, lng: 120.9742 },
        audioDuration: "1:55",
        imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
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
