import { describe, it, expect } from "vitest";
import {
  applyFilters, sortApplications, typesPresent, yearsPresent,
  activeFilterCount, isArchived, NO_FILTERS, type Filters,
} from "./applicationFilters";
import { isClosed } from "./applications";
import { exportFilename, rowsFor, csvSafeCell } from "./exportApplications";
import type { ApplicationDoc } from "../types";

const app = (over: Partial<ApplicationDoc>): ApplicationDoc => ({
  uid: "u1", applicantName: "Juan Dela Cruz", applicantEmail: "juan@example.com",
  churchId: "route-mhcp", kind: "ministry", type: "Ministry of Altar Servers (MAS)",
  status: "pending", referenceNumber: "MIN-2026-AAAAAA",
  createdAt: "2026-08-12T02:00:00.000Z", ...over,
});

const SET: ApplicationDoc[] = [
  app({ referenceNumber: "A", createdAt: "2026-08-02T02:00:00.000Z" }),
  app({ referenceNumber: "B", createdAt: "2026-08-28T02:00:00.000Z", status: "approved" }),
  app({ referenceNumber: "C", createdAt: "2026-09-04T02:00:00.000Z" }),
  app({ referenceNumber: "D", createdAt: "2026-08-15T02:00:00.000Z", type: "Choir" }),
  app({ referenceNumber: "E", createdAt: "2026-08-20T02:00:00.000Z", kind: "sacrament",
        type: "Holy Baptism", applicantName: "Maria Santos",
        applicantEmail: "maria@example.com",
        formData: { preferredDate: "2026-11-02", hasPSA: true } }),
];

const f = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });

describe("filtering the parish's applications", () => {
  it("the coordinator case: August 2026, Altar Servers, pending", () => {
    const out = applyFilters(SET, f({
      month: 8, year: 2026, kind: "ministry",
      type: "Ministry of Altar Servers (MAS)", status: "pending",
    }));
    // B is August and Altar Servers but approved; C is September; D is
    // Choir; E is a sacrament.
    expect(out.map(a => a.referenceNumber)).toEqual(["A"]);
  });

  it("no filters shows everything", () => {
    expect(applyFilters(SET, NO_FILTERS)).toHaveLength(5);
  });

  it("separates ministries from sacraments", () => {
    expect(applyFilters(SET, f({ kind: "ministry" }))).toHaveLength(4);
    expect(applyFilters(SET, f({ kind: "sacrament" }))).toHaveLength(1);
  });

  it("a month without a year still means that month", () => {
    expect(applyFilters(SET, f({ month: 9 })).map(a => a.referenceNumber)).toEqual(["C"]);
  });

  it("treats the end of a date range as the whole day", () => {
    // D was submitted ON the 15th. An exclusive bound would drop it, and
    // a parish asked for "up to the 15th" means including it.
    const out = applyFilters(SET, f({ from: "2026-08-15", to: "2026-08-15" }));
    expect(out.map(a => a.referenceNumber)).toEqual(["D"]);
  });

  it("searches name, email, type and reference", () => {
    expect(applyFilters(SET, f({ search: "maria" })).map(a => a.referenceNumber)).toEqual(["E"]);
    expect(applyFilters(SET, f({ search: "choir" })).map(a => a.referenceNumber)).toEqual(["D"]);
    expect(applyFilters(SET, f({ search: "juan@" }))).toHaveLength(4);
  });

  it("drops undated rows from a dated view rather than guessing", () => {
    const undated = [...SET, app({ referenceNumber: "X", createdAt: "" })];
    expect(applyFilters(undated, NO_FILTERS)).toHaveLength(6);
    expect(applyFilters(undated, f({ month: 8, year: 2026 })).map(a => a.referenceNumber))
      .not.toContain("X");
  });

  it("offers only the types actually applied for", () => {
    expect(typesPresent(SET, "sacrament")).toEqual(["Holy Baptism"]);
    expect(typesPresent(SET, "ministry")).toEqual([
      "Choir", "Ministry of Altar Servers (MAS)",
    ]);
  });

  it("lists the years present, newest first", () => {
    expect(yearsPresent(SET)).toEqual([2026]);
  });

  it("counts the filters in use", () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ month: 8, year: 2026, status: "pending" }))).toBe(3);
  });
});

describe("the archive", () => {
  // The complaint this answers: a parish that had finished with every
  // application still saw the same totals it started with, because a
  // completed baptism counted exactly as much as one submitted an hour
  // ago.
  const WORKED_THROUGH: ApplicationDoc[] = [
    app({ referenceNumber: "P", status: "pending" }),
    app({ referenceNumber: "U", status: "under_review" }),
    app({ referenceNumber: "A", status: "approved" }),
    app({ referenceNumber: "C", status: "completed" }),
    app({ referenceNumber: "R", status: "rejected" }),
  ];

  it("hides finished applications by default", () => {
    expect(applyFilters(WORKED_THROUGH, NO_FILTERS).map(a => a.referenceNumber))
      .toEqual(["P", "U", "A"]);
  });

  it("an approved application is still open - the parish has work left on it", () => {
    // Approving a baptism is not performing it. This is the line the
    // whole feature turns on, so it is asserted rather than assumed.
    expect(isArchived("approved")).toBe(false);
    expect(isArchived("completed")).toBe(true);
    expect(isArchived("rejected")).toBe(true);
  });

  it("the archive holds exactly the finished ones", () => {
    expect(applyFilters(WORKED_THROUGH, f({ scope: "archived" })).map(a => a.referenceNumber))
      .toEqual(["C", "R"]);
  });

  it("everything means everything", () => {
    expect(applyFilters(WORKED_THROUGH, f({ scope: "all" }))).toHaveLength(5);
  });

  it("an explicit status wins over the scope, rather than returning nothing", () => {
    // Choosing "Completed" while the view is scoped to open work must not
    // produce an empty table - that is read as "there are none".
    expect(applyFilters(WORKED_THROUGH, f({ scope: "open", status: "completed" }))
      .map(a => a.referenceNumber)).toEqual(["C"]);
  });

  it("the default scope is not counted as a filter to clear", () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ scope: "archived" }))).toBe(1);
    expect(activeFilterCount(f({ scope: "all" }))).toBe(1);
  });

  it("the detail page and the table agree on what finished means", () => {
    // Two copies of this rule would let the table file a row as archived
    // while the detail page still offered to decide it.
    for (const s of ["pending", "under_review", "approved", "rejected", "completed"] as const) {
      expect(isClosed(s)).toBe(isArchived(s));
    }
  });
});

describe("sorting", () => {
  it("newest first by default direction", () => {
    const out = sortApplications(SET, "submitted", "desc");
    expect(out[0]!.referenceNumber).toBe("C");
  });
  it("by applicant name", () => {
    const out = sortApplications(SET, "name", "asc");
    expect(out[0]!.applicantName).toBe("Juan Dela Cruz");
  });
});

describe("the exported file", () => {
  it("is named after what the admin filtered to", () => {
    expect(exportFilename(f({
      kind: "ministry", type: "Ministry of Altar Servers (MAS)", month: 8, year: 2026,
    }), "xlsx")).toBe("Ministry_of_Altar_Servers_MAS_August_2026.xlsx");
  });

  it("says when it is the archive, so the wrong list is not worked through", () => {
    expect(exportFilename(f({ scope: "archived", kind: "ministry" }), "xlsx"))
      .toBe("Ministry_Applications_Archive.xlsx");
    // The ordinary case stays unlabelled.
    expect(exportFilename(f({ kind: "ministry" }), "xlsx"))
      .toBe("Ministry_Applications.xlsx");
  });

  it("strips characters that break a download", () => {
    const name = exportFilename(f({ type: "Lectors / Commentators" }), "csv");
    expect(name).not.toMatch(/[/\?*:[\]]/);
    expect(name.endsWith(".csv")).toBe(true);
  });

  it("gives ministries and sacraments their own columns", () => {
    const min = rowsFor(applyFilters(SET, f({ kind: "ministry" })), "ministry")[0]!;
    expect(Object.keys(min)).toContain("Ministry");
    expect(Object.keys(min)).toContain("Contact Number");
    expect(Object.keys(min)).not.toContain("Preferred Date");

    const sac = rowsFor(applyFilters(SET, f({ kind: "sacrament" })), "sacrament")[0]!;
    expect(Object.keys(sac)).toContain("Sacrament");
    expect(Object.keys(sac)).toContain("Preferred Date");
    expect(sac["Preferred Date"]).toBe("2026-11-02");
    // Booleans have to read as words in a spreadsheet a person will scan.
    expect(sac["PSA Prepared"]).toBe("Yes");
  });

  it("numbers the rows from 1 so the file reads as a list", () => {
    const rows = rowsFor(SET, null);
    expect(rows[0]!["No."]).toBe(1);
    expect(rows[4]!["No."]).toBe(5);
  });

  it("writes dates sortable, not localised", () => {
    const rows = rowsFor(SET, null);
    expect(rows[0]!["Date Applied"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("CSV formula injection", () => {
  // These files are built to be emailed to a ministry coordinator and
  // opened in Excel. Everything in them was typed by an applicant, so a
  // name or a message is untrusted input arriving on someone else's
  // machine. CSV carries no cell types - the first character decides
  // whether the text is text.
  const attacks = [
    "=cmd|'/c calc'!A1",
    '+1+1',
    '-2+3',
    '@SUM(1+1)',
    "\tleading tab",
    "\rleading carriage return",
  ];

  it.each(attacks)("neutralises %j", attack => {
    const out = csvSafeCell(attack);
    expect(typeof out).toBe("string");
    // The apostrophe is Excel's own "this is text" marker; it is not
    // displayed and the value reads back unchanged.
    expect(out as string).toBe("'" + attack);
  });

  it("leaves ordinary text and numbers alone", () => {
    expect(csvSafeCell("Juan Dela Cruz")).toBe("Juan Dela Cruz");
    expect(csvSafeCell("Niño de Pajotan")).toBe("Niño de Pajotan");
    expect(csvSafeCell("2026-08-12")).toBe("2026-08-12");
    expect(csvSafeCell(7)).toBe(7);
  });

  it("a hostile applicant name does not survive into a formula", () => {
    const hostile = rowsFor([app({
      applicantName: "=HYPERLINK(\"http://evil.example\",\"click\")",
    })], "ministry")[0]!;
    expect(csvSafeCell(hostile["Applicant Name"] as string)).toMatch(/^'=/);
  });
});
