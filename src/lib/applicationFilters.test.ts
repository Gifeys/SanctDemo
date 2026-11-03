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

describe("separating new applicants from existing members", () => {
  const MIXED: ApplicationDoc[] = [
    app({ referenceNumber: "NEW", registrationType: "new_applicant" }),
    app({ referenceNumber: "MEMBER", registrationType: "existing_member" }),
    app({ referenceNumber: "OLD" }),
  ];

  it("shows everyone when no type is chosen", () => {
    expect(applyFilters(MIXED, f({})).map(a => a.referenceNumber))
      .toEqual(["NEW", "MEMBER", "OLD"]);
  });

  it("gives the secretary one queue at a time", () => {
    expect(applyFilters(MIXED, f({ registrationType: "existing_member" }))
      .map(a => a.referenceNumber)).toEqual(["MEMBER"]);
  });

  it("files an application written before this field as the new applicant it was", () => {
    // Not into limbo. Without this, every application already in the
    // parish's collection would vanish from both queues.
    expect(applyFilters(MIXED, f({ registrationType: "new_applicant" }))
      .map(a => a.referenceNumber)).toEqual(["NEW", "OLD"]);
  });

  it("counts as an active filter, so Clear filters offers itself", () => {
    expect(activeFilterCount(f({ registrationType: "existing_member" }))).toBe(1);
    expect(activeFilterCount(f({}))).toBe(0);
  });
});

describe("the ministry export's membership columns", () => {
  const APPLIED = app({ uid: "u1", itemId: "min-lectors", type: "Lectors", status: "approved" });

  const membership = {
    uid: "u1",
    churchId: "route-mhcp",
    itemId: "min-lectors",
    ministryName: "Lectors",
    registrationType: "new_applicant" as const,
    applicationId: "app-1",
    approvedAt: "2026-09-21T02:00:00.000Z",
    approvedBy: "adminA",
  };

  it("reads Member from the memberships, not from the status", () => {
    // The column the parish asked for. An approved application whose
    // membership was later withdrawn must read No - reporting the
    // status here would list somebody the parish had removed.
    const row = rowsFor([APPLIED], "ministry", [])[0]!;
    expect(row["Status"]).toBe("Approved");
    expect(row["Member"]).toBe("No");
  });

  it("says Yes, and when, for somebody who is in the ministry", () => {
    const row = rowsFor([APPLIED], "ministry", [membership])[0]!;
    expect(row["Member"]).toBe("Yes");
    expect(row["Date Approved"]).toBe("2026-09-21");
  });

  it("does not count a membership in a different ministry", () => {
    const row = rowsFor([APPLIED], "ministry", [{ ...membership, itemId: "min-choir" }])[0]!;
    expect(row["Member"]).toBe("No");
  });

  it("does not count somebody else's membership", () => {
    const row = rowsFor([APPLIED], "ministry", [{ ...membership, uid: "u2" }])[0]!;
    expect(row["Member"]).toBe("No");
  });

  it("leaves Member blank rather than guessing when it has nothing to consult", () => {
    // An export taken before the memberships loaded would otherwise
    // state that nobody in the parish serves in anything - a wrong
    // answer dressed as a real one.
    const row = rowsFor([APPLIED], "ministry")[0]!;
    expect(row["Member"]).toBe("");
    expect(row["Date Approved"]).toBe("");
  });

  it("names the application type on every ministry row", () => {
    const rows = rowsFor(
      [APPLIED, app({ uid: "u2", itemId: "min-choir", registrationType: "existing_member" })],
      "ministry",
      [],
    );
    expect(rows[0]!["Application Type"]).toBe("New Applicant");
    expect(rows[1]!["Application Type"]).toBe("Existing Member");
  });

  it("carries the coordinator and length of service an existing member gave", () => {
    const row = rowsFor([app({
      itemId: "min-lectors",
      registrationType: "existing_member",
      formData: { coordinatorName: "Mrs Reyes", yearsOfService: "3 years" },
    })], "ministry", [])[0]!;
    expect(row["Coordinator"]).toBe("Mrs Reyes");
    expect(row["Years of Service"]).toBe("3 years");
  });

  it("keeps the columns the parish already reads", () => {
    // The guard against a new column quietly replacing an old one.
    const row = rowsFor([APPLIED], "ministry", [])[0]!;
    for (const column of [
      "No.", "Reference", "Applicant Name", "Ministry", "Contact Number",
      "Email", "Message", "Date Applied", "Status", "Last Updated", "Parish Note",
    ]) {
      expect(Object.keys(row)).toContain(column);
    }
  });

  it("adds nothing about membership to the sacrament sheet", () => {
    // A sacrament is an event, not something you belong to.
    const row = rowsFor([app({ kind: "sacrament", type: "Holy Baptism" })], "sacrament")[0]!;
    expect(Object.keys(row)).not.toContain("Member");
    expect(Object.keys(row)).not.toContain("Application Type");
  });
});
