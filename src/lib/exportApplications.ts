import * as XLSX from "xlsx";
import type { ApplicationDoc } from "../types";
import { STATUS_LABEL } from "./applications";
import { MONTHS, type Filters } from "./applicationFilters";

/**
 * Exporting the filtered list, for sending to a coordinator.
 *
 * ## What goes in the file
 *
 * Only fields the forms actually collect. The brief asked for an Age
 * column; nothing in SanctiWalk ever asks anyone's age, and a column of
 * blanks in a file going to a ministry coordinator is worse than no
 * column - it reads as data that was lost rather than data never asked
 * for.
 *
 * Ministry and sacrament applications get DIFFERENT columns, because they
 * collect different things. One merged sheet would be half empty whichever
 * way it was filtered.
 */

function dateOnly(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD: sorts correctly in a spreadsheet
}

function field(app: ApplicationDoc, key: string): string {
  const v = app.formData?.[key];
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

type Row = Record<string, string | number>;

function ministryRows(apps: ApplicationDoc[]): Row[] {
  return apps.map((a, i) => ({
    "No.": i + 1,
    "Reference": a.referenceNumber ?? "",
    "Applicant Name": a.applicantName ?? "",
    "Ministry": a.type ?? "",
    "Contact Number": field(a, "mobile"),
    "Email": a.applicantEmail ?? "",
    "Message": field(a, "message"),
    "Date Applied": dateOnly(a.createdAt),
    "Status": STATUS_LABEL[a.status] ?? a.status,
    "Last Updated": dateOnly(a.reviewedAt ?? a.updatedAt),
    "Parish Note": a.adminNote ?? "",
  }));
}

function sacramentRows(apps: ApplicationDoc[]): Row[] {
  return apps.map((a, i) => ({
    "No.": i + 1,
    "Reference": a.referenceNumber ?? "",
    "Applicant Name": a.applicantName ?? "",
    "Sacrament": a.type ?? "",
    "Preferred Date": field(a, "preferredDate"),
    "Sponsor / Parent": field(a, "sponsorOrParent"),
    "PSA Prepared": field(a, "hasPSA"),
    "Baptismal Prepared": field(a, "hasBaptismal"),
    "Email": a.applicantEmail ?? "",
    "Date Applied": dateOnly(a.createdAt),
    "Status": STATUS_LABEL[a.status] ?? a.status,
    "Last Updated": dateOnly(a.reviewedAt ?? a.updatedAt),
    "Parish Note": a.adminNote ?? "",
  }));
}

/** Both kinds together, on the columns they share. */
function mixedRows(apps: ApplicationDoc[]): Row[] {
  return apps.map((a, i) => ({
    "No.": i + 1,
    "Reference": a.referenceNumber ?? "",
    "Applicant Name": a.applicantName ?? "",
    "Type": a.kind === "ministry" ? "Ministry" : "Sacrament",
    "Ministry / Sacrament": a.type ?? "",
    "Contact Number": field(a, "mobile"),
    "Email": a.applicantEmail ?? "",
    "Preferred Date": field(a, "preferredDate"),
    "Date Applied": dateOnly(a.createdAt),
    "Status": STATUS_LABEL[a.status] ?? a.status,
    "Last Updated": dateOnly(a.reviewedAt ?? a.updatedAt),
  }));
}

export function rowsFor(apps: ApplicationDoc[], kind: Filters["kind"]): Row[] {
  if (kind === "ministry") return ministryRows(apps);
  if (kind === "sacrament") return sacramentRows(apps);
  return mixedRows(apps);
}

/**
 * A filename that says what is in the file.
 *
 * "Altar_Servers_August_2026" rather than "applications(3)". The file
 * leaves the app and lands in someone's inbox beside a dozen others, so
 * the name has to survive on its own.
 */
export function exportFilename(f: Filters, extension: string): string {
  const parts: string[] = [];

  if (f.type) parts.push(f.type);
  else if (f.kind === "ministry") parts.push("Ministry Applications");
  else if (f.kind === "sacrament") parts.push("Sacrament Applications");
  else parts.push("Applications");

  // Which set this was taken from, when it is not the ordinary one. A
  // file of finished applications landing in a coordinator's inbox named
  // like a file of live ones is how the wrong list gets worked through.
  if (f.scope === "archived") parts.push("Archive");
  else if (f.scope === "all") parts.push("All");

  if (f.status) parts.push(STATUS_LABEL[f.status] ?? f.status);
  if (f.month !== null) parts.push(MONTHS[f.month - 1]!);
  if (f.year !== null) parts.push(String(f.year));
  if (f.month === null && f.year === null && (f.from || f.to)) {
    parts.push(`${f.from || "start"}_to_${f.to || "today"}`);
  }

  const safe = parts
    .join("_")
    .replace(/[^A-Za-z0-9 _-]/g, "")   // parentheses and slashes break downloads
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  return `${safe}.${extension}`;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Freed on the next tick: revoking immediately cancels the download in
  // some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportExcel(apps: ApplicationDoc[], f: Filters): void {
  const rows = rowsFor(apps, f.kind);
  const sheet = XLSX.utils.json_to_sheet(rows);

  // Column widths from the content. Without these every column is the
  // same narrow default and the coordinator's first action is dragging
  // eleven borders.
  const headers = Object.keys(rows[0] ?? {});
  sheet["!cols"] = headers.map(h => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, String(r[h] ?? "").length),
      h.length,
    );
    return { wch: Math.min(Math.max(longest + 2, 10), 48) };
  });

  const book = XLSX.utils.book_new();
  // Sheet names cannot exceed 31 characters or contain : \ / ? * [ ]
  const sheetName = (f.type || (f.kind === "ministry" ? "Ministry" : f.kind === "sacrament" ? "Sacraments" : "Applications"))
    .replace(/[:\\/?*[\]]/g, "")
    .slice(0, 31);
  XLSX.utils.book_append_sheet(book, sheet, sheetName);

  const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    exportFilename(f, "xlsx"),
  );
}

/**
 * Defuses a cell that a spreadsheet would run as a formula.
 *
 * Everything in these files is typed by an applicant - their name, their
 * message to the parish - and the whole point of the export is to email
 * it to a coordinator who opens it in Excel. A message of
 * `=cmd|'/c calc'!A1` is a formula on that coordinator's machine, not
 * text. CSV carries no types, so the first character decides.
 *
 * A leading apostrophe is Excel's own "this is text" marker: it is not
 * shown in the cell and the value reads back unchanged. The tab and
 * carriage return are in the list because they let a cell smuggle a
 * second one past the delimiter.
 *
 * Only the CSV path needs this. json_to_sheet writes .xlsx cells with an
 * explicit string type, so Excel never parses those as formulas, and an
 * apostrophe there would be a literal character in the coordinator's
 * spreadsheet.
 */
/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvSafeCell(value: string | number): string | number {
  if (typeof value !== "string") return value;
  return FORMULA_START.test(value) ? `'${value}` : value;
}
export function exportCsv(apps: ApplicationDoc[], f: Filters): void {
  const rows = rowsFor(apps, f.kind).map(row => {
    const safe: Row = {};
    for (const [key, value] of Object.entries(row)) safe[key] = csvSafeCell(value);
    return safe;
  });
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  // BOM, so Excel opens UTF-8 correctly: without it "Niño" arrives as
  // "NiÃ±o", which matters in a list of Filipino names.
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), exportFilename(f, "csv"));
}
