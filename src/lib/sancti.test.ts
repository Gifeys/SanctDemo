import { describe, it, expect } from "vitest";
import {
  understand, findParish, findTime, aliasesFor, normalise,
  isImperative, needsConfirmation, readAnswer, itemAliases, findNamedItem,
  CONFIDENCE_FLOOR, type ParishName,
} from "./sancti";

const PARISHES: ParishName[] = [
  aliasesFor("route-mhcp", "Mary Help of Christians Parish Guide"),
  aliasesFor("route-src", "San Roque Cathedral Parish Tour"),
];

const ask = (text: string) => understand(text, PARISHES);

describe("the questions the brief names", () => {
  // These are the examples from the spec, verbatim. If any of them stop
  // working, Sancti has stopped doing the job it was asked for.
  it("'Where is the map?' opens the map", () => {
    expect(ask("Where is the map?").action).toBe("OPEN_MAP");
  });

  it("'Show me Mary Help.' opens that church", () => {
    const out = ask("Show me Mary Help.");
    expect(out.action).toBe("OPEN_CHURCH");
    expect(out.parishId).toBe("route-mhcp");
  });

  it("'Tell me the history of Mary Help.' asks for the history", () => {
    const out = ask("Tell me the history of Mary Help.");
    expect(out.action).toBe("OPEN_CHURCH_HISTORY");
    expect(out.parishId).toBe("route-mhcp");
  });

  it("'What time is Mass at Mary Help?' asks for the schedule", () => {
    const out = ask("What time is Mass at Mary Help?");
    expect(out.action).toBe("OPEN_MASS_SCHEDULE");
    expect(out.parishId).toBe("route-mhcp");
  });

  it("'Remind me about the 6 PM Mass at Mary Help.' makes a reminder", () => {
    const out = ask("Remind me about the 6 PM Mass at Mary Help.");
    expect(out.action).toBe("CREATE_REMINDER");
    expect(out.parishId).toBe("route-mhcp");
    expect(out.time).toBe("6:00 PM");
  });

  it("'Is baptism available?' goes to baptism", () => {
    expect(ask("Is baptism available?").action).toBe("OPEN_BAPTISM");
  });

  it("'How do I apply for baptism?' also goes to baptism", () => {
    expect(ask("How do I apply for baptism?").action).toBe("OPEN_BAPTISM");
  });

  it("'How far is Mary Help?' asks for the distance", () => {
    const out = ask("How far is Mary Help?");
    expect(out.action).toBe("ANSWER_DISTANCE");
    expect(out.parishId).toBe("route-mhcp");
  });

  it("'Take me to Mary Help.' shows it on the map", () => {
    const out = ask("Take me to Mary Help.");
    expect(out.action).toBe("SHOW_CHURCH_LOCATION");
    expect(out.parishId).toBe("route-mhcp");
  });

  it("'How do I use AR?' opens the scanner", () => {
    expect(ask("How do I use AR?").action).toBe("OPEN_AR");
  });
});

describe("longer phrases beat the short words inside them", () => {
  it("'mass schedule' is not just 'mass'", () => {
    // Both OPEN_MASS_SCHEDULE and a bare match could fire here. The
    // specific one has to win or Sancti answers the wrong question
    // confidently, which is worse than answering none.
    expect(ask("show me the mass schedule").action).toBe("OPEN_MASS_SCHEDULE");
  });

  it("'take me to' outranks the plain 'map' in the same sentence", () => {
    expect(ask("take me to San Roque on the map").action).toBe("SHOW_CHURCH_LOCATION");
  });

  it("asking to be reminded is a reminder, not a schedule lookup", () => {
    expect(ask("remind me about mass").action).toBe("CREATE_REMINDER");
  });
});

describe("naming a church", () => {
  it("matches the short name people actually type", () => {
    expect(findParish("mary help", PARISHES)).toBe("route-mhcp");
    expect(findParish("san roque", PARISHES)).toBe("route-src");
  });

  it("matches the initials", () => {
    expect(findParish("what time is mass at mhcp", PARISHES)).toBe("route-mhcp");
  });

  it("ignores the Guide and Tour suffixes nobody says", () => {
    const a = aliasesFor("route-mhcp", "Mary Help of Christians Parish Guide");
    expect(a.aliases.some(x => x.includes("guide"))).toBe(false);
  });

  it("is case and punctuation blind", () => {
    expect(findParish("MARY HELP!!", PARISHES)).toBe("route-mhcp");
  });

  it("returns nothing when no church is named", () => {
    expect(findParish("what time is mass", PARISHES)).toBeUndefined();
  });

  it("a bare church name on its own opens that church", () => {
    const out = ask("San Roque");
    expect(out.action).toBe("OPEN_CHURCH");
    expect(out.parishId).toBe("route-src");
  });
});

describe("reading a time", () => {
  it("reads the common ways people write one", () => {
    expect(findTime("the 6 PM mass")).toBe("6:00 PM");
    expect(findTime("6:30 am mass")).toBe("6:30 AM");
    expect(findTime("remind me at 10:30 PM")).toBe("10:30 PM");
  });

  it("reads 24-hour times", () => {
    expect(findTime("the 18:00 mass")).toBe("6:00 PM");
  });

  it("understands hapon and umaga", () => {
    expect(findTime("6 hapon")).toBe("6:00 PM");
    expect(findTime("6 umaga")).toBe("6:00 AM");
  });

  it("refuses to guess a bare morning number", () => {
    // "the 6 mass" could be either, and inventing one would create a
    // reminder for a Mass that does not exist. The caller checks the
    // real schedule anyway.
    expect(findTime("the 6 mass")).toBeUndefined();
  });

  it("returns nothing when there is no time", () => {
    expect(findTime("remind me about mass")).toBeUndefined();
  });
});

describe("admitting it does not know", () => {
  it("says nothing rather than guessing at an unrelated question", () => {
    // The thing that matters most. A guide that confidently answers
    // the wrong question is worse than one that says it did not follow.
    for (const q of ["what is the weather", "sing me a song", "qwerty asdf"]) {
      expect(ask(q).action).toBe("UNKNOWN");
    }
  });

  it("treats an empty message as nothing asked", () => {
    expect(ask("   ").action).toBe("UNKNOWN");
    expect(ask("").score).toBe(0);
  });

  it("only acts once it is reasonably sure", () => {
    const out = ask("Where is the map?");
    expect(out.score).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
  });

  it("offers help when asked what it can do", () => {
    expect(ask("what can you do?").action).toBe("HELP");
  });
});

describe("normalising", () => {
  it("drops punctuation and case but keeps the words and the colon", () => {
    expect(normalise("What TIME is Mass?!")).toBe("what time is mass");
    expect(normalise("at 6:30 pm")).toBe("at 6:30 pm");
  });
});

describe("Taglish, which is how people here actually type", () => {
  // The language setting decides what Sancti SAYS. It has no say in
  // what it understands: somebody reading in English still types
  // "anong oras ang misa", and refusing that would be the app telling
  // a pilgrim their own language is the wrong one.
  const cases: Array<[string, string]> = [
    ["anong oras ang misa", "OPEN_MASS_SCHEDULE"],
    ["anong oras ang mass", "OPEN_MASS_SCHEDULE"],
    ["kailan ang misa bukas", "OPEN_MASS_SCHEDULE"],
    ["schedule ng mass", "OPEN_MASS_SCHEDULE"],
    ["nasaan ang mapa", "OPEN_MAP"],
    ["paano magpabinyag", "OPEN_BAPTISM"],
    ["paano magpakasal", "OPEN_WEDDING"],
    ["gusto kong sumali sa choir", "OPEN_MINISTRIES"],
    ["ano ang kasaysayan ng simbahan", "OPEN_CHURCH_HISTORY"],
    ["gaano kalayo ang Mary Help", "ANSWER_DISTANCE"],
    ["dalhin mo ako sa San Roque", "SHOW_CHURCH_LOCATION"],
    ["paano mag scan", "OPEN_AR"],
    ["paalalahanan mo ako sa 6 PM na misa", "CREATE_REMINDER"],
    ["sino ka", "HELP"],
  ];

  it.each(cases)("%s", (question, expected) => {
    expect(ask(question).action).toBe(expected);
  });

  it("still picks the church out of a Taglish sentence", () => {
    const out = ask("anong oras ang misa sa mary help");
    expect(out.action).toBe("OPEN_MASS_SCHEDULE");
    expect(out.parishId).toBe("route-mhcp");
  });

  it("reads the time out of a Taglish reminder", () => {
    const out = ask("paalalahanan mo ako sa 6 PM na misa sa san roque");
    expect(out.action).toBe("CREATE_REMINDER");
    expect(out.time).toBe("6:00 PM");
    expect(out.parishId).toBe("route-src");
  });

  it("understands a sentence that mixes both in one breath", () => {
    expect(ask("saan ang map po").action).toBe("OPEN_MAP");
    expect(ask("pwede ba mag apply for baptism").action).toBe("OPEN_BAPTISM");
  });
});

describe('asking before acting', () => {
  const parishes = [aliasesFor('route-mhcp', 'Mary Help of Christians Parish')]

  it('hears a question as a question', () => {
    expect(understand('where is the map', parishes).imperative).toBe(false)
    expect(understand('what time is mass', parishes).imperative).toBe(false)
    expect(understand('nasaan ang mapa', parishes).imperative).toBe(false)
  })

  it('hears an instruction as an instruction', () => {
    expect(understand('open the map', parishes).imperative).toBe(true)
    expect(understand('take me to mary help', parishes).imperative).toBe(true)
    expect(understand('buksan ang mapa', parishes).imperative).toBe(true)
    expect(understand('show me on the map', parishes).imperative).toBe(true)
  })

  it('does not read a word inside another word as an instruction', () => {
    // "open" inside "opening hours" would otherwise fling the pilgrim
    // at a screen for asking what time the office opens.
    expect(isImperative('what are the opening hours')).toBe(false)
    expect(isImperative('reopen')).toBe(false)
  })

  it('offers rather than acts when asked where something is', () => {
    expect(needsConfirmation(understand('where is the map', parishes))).toBe(true)
    expect(needsConfirmation(understand('what time is mass', parishes))).toBe(true)
  })

  it('acts without asking when told to', () => {
    expect(needsConfirmation(understand('open the map', parishes))).toBe(false)
    expect(needsConfirmation(understand('take me to mary help', parishes))).toBe(false)
  })

  it('never stops to ask about something that opens nothing', () => {
    // A distance is answered in the chat; there is no screen to offer,
    // and asking would be a tap that leads nowhere.
    expect(needsConfirmation(understand('how far is mary help', parishes))).toBe(false)
    expect(needsConfirmation(understand('what can you do', parishes))).toBe(false)
    expect(needsConfirmation(understand('qwertyuiop', parishes))).toBe(false)
  })

  it('reads a bare yes, in either language', () => {
    for (const yes of ['yes', 'Yes', 'oo', 'opo', 'sige', 'ok', 'go ahead']) {
      expect(readAnswer(yes)).toBe('yes')
    }
  })

  it('reads a bare no, in either language', () => {
    for (const no of ['no', 'hindi', 'ayoko', 'later', 'never mind']) {
      expect(readAnswer(no)).toBe('no')
    }
  })

  it('treats a sentence containing yes as a sentence, not an answer', () => {
    // "yes but what time" is a new question. Reading the "yes" would
    // open a screen the pilgrim was still asking about.
    expect(readAnswer('yes but what time is mass')).toBeNull()
    expect(readAnswer('no idea where the map is')).toBeNull()
    expect(readAnswer('')).toBeNull()
  })

  it('still understands the follow-up chip it offers', () => {
    // The chip sends an instruction back through the same understanding.
    // If this broke, tapping the offer would ask the same question again.
    for (const [action, chip] of [
      ['OPEN_MAP', 'Open the map'],
      ['OPEN_MASS_SCHEDULE', 'Open the Mass schedule'],
      ['SHOW_CHURCH_LOCATION', 'Show me on the map'],
    ] as const) {
      const heard = understand(chip, parishes)
      expect(heard.action).toBe(action)
      expect(needsConfirmation(heard)).toBe(false)
    }
  })
})

describe('naming a ministry or sacrament directly', () => {
  const ITEMS = [
    itemAliases('min-choir-teatro', 'Teatro Pilipino Choir', 'ministry'),
    itemAliases('min-altar-servers', 'Ministry of Altar Servers (MAS)', 'ministry'),
    itemAliases('min-emhc', 'Extraordinary Ministers of Holy Communion (EMHC)', 'ministry'),
    itemAliases('min-youth', 'Ministry on Youth Affairs', 'ministry'),
  ]

  it('finds a ministry named in full', () => {
    expect(findNamedItem('open teatro pilipino choir', ITEMS)?.id)
      .toBe('min-choir-teatro')
  })

  it('finds it by the distinctive words alone', () => {
    // Nobody types "Ministry of Altar Servers (MAS)" into a chat box.
    expect(findNamedItem('i want to join altar servers', ITEMS)?.id)
      .toBe('min-altar-servers')
  })

  it('accepts Filipino spelt with an f', () => {
    // Pilipino and Filipino are the same word to everyone who types it.
    expect(findNamedItem('open teatro filipino', ITEMS)?.id)
      .toBe('min-choir-teatro')
  })

  it('forgives a single mistyped letter', () => {
    expect(findNamedItem('open teatri filipino ministry', ITEMS)?.id)
      .toBe('min-choir-teatro')
  })

  it('finds a ministry by a long acronym', () => {
    expect(findNamedItem('what is emhc', ITEMS)?.id).toBe('min-emhc')
  })

  it('does not match a short acronym that is also a word', () => {
    // "mas" is Tagalog for "more". As an alias for the altar servers it
    // would hijack "mas maaga ba ang misa".
    expect(findNamedItem('mas maaga ba ang misa', ITEMS)).toBeUndefined()
  })

  it('names nothing when nothing is named', () => {
    expect(findNamedItem('what time is mass', ITEMS)).toBeUndefined()
    expect(findNamedItem('', ITEMS)).toBeUndefined()
  })

  it('understands a named ministry as a request to open it', () => {
    const heard = understand('open teatro filipino', PARISHES, ITEMS)
    expect(heard.action).toBe('OPEN_MINISTRIES')
    expect(heard.itemId).toBe('min-choir-teatro')
    expect(heard.imperative).toBe(true)
  })

  it('offers rather than opens when the ministry is only asked about', () => {
    const heard = understand('what is the teatro pilipino choir', PARISHES, ITEMS)
    expect(heard.action).toBe('OPEN_MINISTRIES')
    expect(heard.itemId).toBe('min-choir-teatro')
    expect(needsConfirmation(heard)).toBe(true)
  })

  it('still answers the generic question with no item', () => {
    const heard = understand('what ministries are there', PARISHES, ITEMS)
    expect(heard.action).toBe('OPEN_MINISTRIES')
    expect(heard.itemId).toBeUndefined()
  })
})
