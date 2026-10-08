/**
 * The questions an application asks, as data.
 *
 * ## Why a schema and not fifteen hand-written forms
 *
 * The brief is explicit that different ministries need different
 * questions - a choir asks what you sing, altar servers ask whether you
 * have served before - and equally explicit that the same questions must
 * not be forced on all of them. Hard-coding that would be fifteen forms
 * to keep in step, and the validation would drift between them within a
 * month.
 *
 * As data it is one form component, one validator, and one place to add
 * a question. It is also the shape a parish admin could eventually edit:
 * the step from "this array lives in the code" to "this array lives in
 * parishContent" is a loader, not a rewrite.
 *
 * ## Why nothing here invents a requirement
 *
 * Every question below is administrative - who you are, how to reach
 * you, when you are free. Nothing asks for a certificate, a seminar or a
 * fee, because this codebase has a standing rule against inventing
 * parish policy, and the real requirements are already in data.ts where
 * the parish put them.
 */

export type FieldKind = "text" | "tel" | "email" | "date" | "textarea" | "choices" | "confirm";

export interface Field {
  /** Key in the application's formData. Stable - the parish reads these. */
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Shown under the label; a hint, not a placeholder. */
  help?: string;
  placeholder?: string;
  /** For "choices": the options, chosen as many as apply. */
  options?: string[];
  maxLength?: number;
}

export interface Step {
  title: string;
  /** One sentence on why this step is being asked. */
  blurb?: string;
  fields: Field[];
}

/** Everything a person types, before it becomes formData. */
export type Answers = Record<string, string | string[] | boolean>;

const AVAILABILITY: Field = {
  name: "availability",
  label: "When are you usually free?",
  kind: "choices",
  required: true,
  options: ["Weekday mornings", "Weekday evenings", "Saturday", "Sunday"],
};

/** Asked of everyone, ministry or sacrament. */
function personalStep(kind: "ministry" | "sacrament"): Step {
  return {
    title: "Your details",
    blurb: kind === "ministry"
      ? "So the ministry coordinator can reach you."
      : "So the parish office can reach you about the arrangements.",
    fields: [
      {
        name: "fullName",
        label: "Full name",
        kind: "text",
        required: true,
        help: "As it should appear on parish records.",
        maxLength: 80,
      },
      { name: "mobile", label: "Contact number", kind: "tel", required: true, placeholder: "09XX XXX XXXX" },
      { name: "address", label: "Address", kind: "text", required: false, maxLength: 120 },
      { name: "birthDate", label: "Date of birth", kind: "date", required: false },
    ],
  };
}

const EMERGENCY_STEP: Step = {
  title: "Someone we can call",
  blurb: "Only used if something happens while you are serving.",
  fields: [
    { name: "emergencyName", label: "Name", kind: "text", required: false, maxLength: 80 },
    { name: "emergencyRelation", label: "Relationship to you", kind: "text", required: false, maxLength: 40 },
    { name: "emergencyMobile", label: "Contact number", kind: "tel", required: false },
  ],
};

/**
 * The questions that belong to one ministry rather than to all of them.
 *
 * Keyed by id, so renaming a ministry cannot silently drop its questions.
 * A ministry with no entry gets the common step and nothing more, which
 * is the right default - an empty object here means "nothing special to
 * ask", not "unfinished".
 */
const MINISTRY_FIELDS: Record<string, Field[]> = {
  "min-altar-servers": [
    {
      name: "servedBefore",
      label: "Have you served at the altar before?",
      kind: "textarea",
      required: false,
      help: "Where, and for roughly how long. Leave blank if this would be your first time.",
      maxLength: 300,
    },
  ],
  "min-lectors": [
    {
      name: "languages",
      label: "Which languages can you read aloud confidently?",
      kind: "choices",
      required: true,
      options: ["Filipino", "English"],
    },
    {
      name: "readingExperience",
      label: "Any experience reading or speaking in public?",
      kind: "textarea",
      required: false,
      maxLength: 300,
    },
  ],
  "min-emhc": [
    {
      name: "homeVisits",
      label: "Could you bring Communion to the sick at home?",
      kind: "choices",
      required: false,
      options: ["Yes", "Not at the moment"],
    },
  ],
};

/** Choirs ask the same things, and there are several of them. */
const CHOIR_FIELDS: Field[] = [
  {
    name: "voicePart",
    label: "Which part do you usually sing?",
    kind: "choices",
    required: false,
    options: ["Soprano", "Alto", "Tenor", "Bass", "Not sure"],
  },
  {
    name: "instrument",
    label: "Do you play an instrument?",
    kind: "text",
    required: false,
    placeholder: "Guitar, keyboard, none…",
    maxLength: 60,
  },
  {
    name: "singingExperience",
    label: "Any singing or musical experience?",
    kind: "textarea",
    required: false,
    maxLength: 300,
  },
];

function ministrySpecific(ministryId: string, ministryName: string): Field[] {
  if (MINISTRY_FIELDS[ministryId]) return MINISTRY_FIELDS[ministryId];
  // Matched on the name as well as the id, because the parish has
  // several choirs and they were added at different times under
  // different id conventions.
  if (/cho(ir|rale)/i.test(ministryName)) return CHOIR_FIELDS;
  return [];
}

export function ministrySteps(ministryId: string, ministryName: string): Step[] {
  return [
    personalStep("ministry"),
    {
      title: `About joining ${ministryName}`,
      fields: [
        {
          name: "message",
          label: "Why would you like to join?",
          kind: "textarea",
          required: true,
          help: "A sentence or two is plenty.",
          maxLength: 500,
        },
        ...ministrySpecific(ministryId, ministryName),
        AVAILABILITY,
      ],
    },
    EMERGENCY_STEP,
    {
      title: "Before you send it",
      fields: [
        {
          name: "consent",
          label: "The parish may keep these details and contact me about this ministry.",
          kind: "confirm",
          required: true,
        },
      ],
    },
  ];
}

export function sacramentSteps(sacramentName: string): Step[] {
  return [
    personalStep("sacrament"),
    {
      title: `About the ${sacramentName}`,
      blurb: "The parish office will confirm everything with you before anything is fixed.",
      fields: [
        {
          name: "preferredDate",
          label: "Preferred date",
          kind: "date",
          required: true,
          help: "A request, not a booking — the office will confirm what is possible.",
        },
        {
          name: "sponsorOrParent",
          label: "Parent, sponsor or the other party",
          kind: "text",
          required: false,
          help: "Whoever else this concerns, if anyone.",
          maxLength: 120,
        },
        {
          name: "notes",
          label: "Anything the office should know?",
          kind: "textarea",
          required: false,
          maxLength: 500,
        },
      ],
    },
    {
      title: "Documents",
      blurb: "You will bring the originals to the parish office. This only tells them what you already have.",
      fields: [
        {
          name: "documentsReady",
          label: "Which of these do you already have?",
          kind: "choices",
          required: false,
          options: [
            "PSA birth certificate",
            "Baptismal certificate",
            "Confirmation certificate",
            "Marriage contract",
            "None of these yet",
          ],
        },
      ],
    },
    {
      title: "Before you send it",
      fields: [
        {
          name: "consent",
          label: "The parish may keep these details and contact me about this application.",
          kind: "confirm",
          required: true,
        },
      ],
    },
  ];
}

/**
 * What is missing from one step, keyed by field name.
 *
 * Returns per-field messages rather than one summary, so each one can sit
 * under the field it is about. A list at the top of a four-field form
 * makes someone count down the form to find which box is wrong.
 */
export function validateStep(step: Step, answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of step.fields) {
    if (!field.required) continue;
    const value = answers[field.name];

    if (field.kind === "confirm") {
      if (value !== true) errors[field.name] = "Please tick this to continue.";
      continue;
    }
    if (field.kind === "choices") {
      if (!Array.isArray(value) || value.length === 0) {
        errors[field.name] = `Please choose at least one.`;
      }
      continue;
    }
    if (typeof value !== "string" || value.trim() === "") {
      errors[field.name] = `Please enter your ${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.kind === "tel" && !isPlausiblePhone(value)) {
      errors[field.name] = "That does not look like a contact number.";
    }
  }
  return errors;
}

/**
 * Deliberately loose.
 *
 * Philippine mobiles are 11 digits starting 09, but people write them
 * with +63, with spaces, with dashes, and a parish would rather have a
 * landline than nothing. This rejects what is obviously not a number and
 * waves through everything else - a form that refuses a real person's
 * real number is worse than one that accepts an odd one.
 */
export function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Every answer, flattened the way the parish's export expects to read it. */
export function toFormData(steps: Step[], answers: Answers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const step of steps) {
    for (const field of step.fields) {
      const value = answers[field.name];
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        if (value.length > 0) out[field.name] = value.join(", ");
        continue;
      }
      if (typeof value === "string") {
        if (value.trim()) out[field.name] = value.trim();
        continue;
      }
      out[field.name] = value;
    }
  }
  return out;
}

/** The answers as label/value pairs, for the review screen. */
export function reviewRows(steps: Step[], answers: Answers): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const step of steps) {
    for (const field of step.fields) {
      if (field.kind === "confirm") continue;
      const value = answers[field.name];
      const text = Array.isArray(value) ? value.join(", ")
        : typeof value === "string" ? value.trim()
        : "";
      // Blank optional answers are left out rather than shown as "—".
      // A review screen is for checking what you said, not for counting
      // what you did not.
      if (text) rows.push({ label: field.label, value: text });
    }
  }
  return rows;
}
