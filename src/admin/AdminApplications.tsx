import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Download, FileSpreadsheet, Inbox, Loader2, Printer, Search, X } from "lucide-react";
import { db } from "../lib/firebase";
import { STATUS_ORDER, STATUS_LABEL } from "../lib/applications";
import {
  applyFilters, sortApplications, typesPresent, yearsPresent, activeFilterCount,
  isArchived, MONTHS, NO_FILTERS, type Filters, type Scope, type SortKey,
} from "../lib/applicationFilters";
import { exportExcel, exportCsv } from "../lib/exportApplications";
import StatusBadge from "./StatusBadge";
import AdminNav from "./AdminNav";
import type { AdminSession } from "./AdminApp";
import type { ApplicationDoc, ApplicationStatus } from "../types";

/**
 * The parish's applications, as a table a parish secretary can work.
 *
 * ## Why everything is loaded and filtered here
 *
 * One query, `where churchId == mine` - which is also what the security
 * rules allow and nothing more. Every filter below runs in the browser.
 *
 * The alternative is a Firestore query per filter combination, and each
 * needs its own composite index: churchId+kind+status+createdAt is a
 * different index from churchId+type+status. A missing index does not
 * degrade, it throws, and the page a parish opens on a Monday morning
 * would be a permissions error. A parish has hundreds of applications,
 * not millions.
 *
 * ## The three views are one component
 *
 * /admin/applications, /ministry and /sacrament differ by a single locked
 * filter. Three components would be three places to fix the next bug.
 */
export default function AdminApplications({ session }: { session: AdminSession }) {
  const { kind } = useParams<{ kind?: string }>();
  const navigate = useNavigate();
  const churchId = session.profile.churchId;

  const locked: Filters["kind"] =
    kind === "ministry" ? "ministry" : kind === "sacrament" ? "sacrament" : null;

  // The archive is a fourth tab on the same route segment rather than a
  // query string, so it can be linked to from the dashboard and bookmarked
  // by a secretary who lives in it.
  const routeScope: Scope = kind === "archive" ? "archived" : "open";

  const [apps, setApps] = useState<ApplicationDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, kind: locked, scope: routeScope });
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // The locked filter follows the route, so switching tabs does not carry
  // "Ministry" into the Sacraments view.
  useEffect(() => {
    setFilters(f => ({ ...f, kind: locked, type: null, scope: routeScope }));
  }, [locked, routeScope]);

  useEffect(() => {
    const q = query(collection(db, "applications"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setApps(snap.docs.map(d => ({ id: d.id, ...(d.data() as ApplicationDoc) }))),
      err => setError(err.message),
    );
  }, [churchId]);

  const visible = useMemo(() => {
    if (!apps) return [];
    return sortApplications(applyFilters(apps, filters), sortKey, sortDir);
  }, [apps, filters, sortKey, sortDir]);

  const typeOptions = useMemo(
    () => typesPresent(apps ?? [], locked ?? undefined),
    [apps, locked],
  );
  const yearOptions = useMemo(() => yearsPresent(apps ?? []), [apps]);
  // The locked kind is the route, not a filter the admin chose - and on the
  // Archive tab neither is the scope.
  const activeCount = activeFilterCount({
    ...filters, kind: null, scope: routeScope === "archived" ? "open" : filters.scope,
  });

  // What the archive holds, so the tab can say so and an admin can see at
  // a glance that the finished work has gone somewhere rather than away.
  const archivedCount = (apps ?? []).filter(a => isArchived(a.status)).length;

  // The heading says which set is on screen, because the Show control can
  // change it without changing the tab. "All Applications" over a list
  // that was quietly hiding the finished ones was the original complaint.
  const title = locked === "ministry" ? "Ministry Applications"
    : locked === "sacrament" ? "Sacrament Applications"
    : filters.scope === "archived" ? "Archive"
    : filters.scope === "all" ? "All Applications"
    : "Open Applications";

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "submitted" ? "desc" : "asc"); }
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <div className="max-w-[1100px] mx-auto px-4 py-6">

        <AdminNav />

        <nav className="mb-5 flex flex-wrap gap-2 print:hidden">
          {[
            { to: "/admin/applications", label: "Open", on: locked === null && routeScope === "open" },
            { to: "/admin/applications/ministry", label: "Ministries", on: locked === "ministry" },
            { to: "/admin/applications/sacrament", label: "Sacraments", on: locked === "sacrament" },
            {
              to: "/admin/applications/archive",
              label: archivedCount > 0 ? `Archive (${archivedCount})` : "Archive",
              on: routeScope === "archived",
            },
          ].map(t => (
            <button
              key={t.to}
              onClick={() => navigate(t.to)}
              className={`rounded-full px-4 py-2 text-[15px] font-bold ${
                t.on
                  ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]"
                  : "border border-[var(--color-brand-border)] text-[var(--color-brand-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <h1 className="text-[24px] font-bold font-serif italic text-[var(--color-brand-text)]">{title}</h1>
        <p className="text-[15px] text-[var(--color-brand-secondary)]">
          {session.church?.name ?? churchId}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        {/* ---- filters ---- */}
        <div className="mt-5 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 print:hidden">
          <div className="flex flex-wrap gap-2.5 items-end">
            <Select label="Month" value={filters.month ?? ""} onChange={v =>
              setFilters(f => ({ ...f, month: v === "" ? null : Number(v) }))}>
              <option value="">Any month</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>

            <Select label="Year" value={filters.year ?? ""} onChange={v =>
              setFilters(f => ({ ...f, year: v === "" ? null : Number(v) }))}>
              <option value="">Any year</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>

            <Select
              label={locked === "sacrament" ? "Sacrament" : locked === "ministry" ? "Ministry" : "Ministry / Sacrament"}
              value={filters.type ?? ""}
              onChange={v => setFilters(f => ({ ...f, type: v || null }))}
            >
              <option value="">All</option>
              {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>

            {/* Shown on every tab, not just the archive one: an admin
                looking at Ministries needs the finished ones too, and
                without this the only way to them was a different tab that
                lost the ministry they were looking at. */}
            <Select label="Show" value={filters.scope} onChange={v =>
              setFilters(f => ({ ...f, scope: v as Scope }))}>
              <option value="open">Still open</option>
              <option value="archived">Archived</option>
              <option value="all">Everything</option>
            </Select>

            <Select label="Status" value={filters.status ?? ""} onChange={v =>
              setFilters(f => ({ ...f, status: (v || null) as ApplicationStatus | null }))}>
              <option value="">Any status</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>

            <div className="flex-1 min-w-[200px]">
              <label htmlFor="q" className="block text-[13px] font-bold text-[var(--color-brand-secondary)] mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-brand-secondary)]" />
                <input
                  id="q"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  placeholder="Name, email or reference"
                  className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] pl-9 pr-3 py-2 text-[15px]"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2.5 items-end">
            <DateField label="From" value={filters.from ?? ""} onChange={v => setFilters(f => ({ ...f, from: v || null }))} />
            <DateField label="To" value={filters.to ?? ""} onChange={v => setFilters(f => ({ ...f, to: v || null }))} />
            {activeCount > 0 && (
              <button
                onClick={() => setFilters({ ...NO_FILTERS, kind: locked, scope: routeScope })}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] px-3.5 py-2 text-[14px] font-bold text-[var(--color-brand-secondary)]"
              >
                <X className="w-3.5 h-3.5" /> Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>

        {/* ---- count + actions ---- */}
        <div className="mt-4 mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-bold text-[var(--color-brand-text)]">
            {apps === null ? "Loading…" : `Showing ${visible.length} application${visible.length === 1 ? "" : "s"}`}
            {apps && visible.length !== apps.length && (
              <span className="font-normal text-[var(--color-brand-secondary)]"> of {apps.length}</span>
            )}
          </p>

          <div className="ml-auto flex flex-wrap gap-2 print:hidden">
            <Action icon={<FileSpreadsheet className="w-4 h-4" />} label="Export Excel"
                    disabled={visible.length === 0}
                    onClick={() => exportExcel(visible, filters)} />
            <Action icon={<Download className="w-4 h-4" />} label="Export CSV"
                    disabled={visible.length === 0}
                    onClick={() => exportCsv(visible, filters)} />
            <Action icon={<Printer className="w-4 h-4" />} label="Print"
                    disabled={visible.length === 0}
                    onClick={() => window.print()} />
          </div>
        </div>

        {/* ---- table ---- */}
        {apps === null ? (
          <div className="py-14 text-center">
            <Loader2 className="mx-auto w-6 h-6 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] py-12 text-center">
            <Inbox className="mx-auto w-7 h-7 text-[var(--color-brand-secondary)]" />
            <p className="mt-2 text-[16px] font-bold">
              {apps.length === 0 ? "No applications yet"
                : filters.scope === "archived" ? "Nothing archived yet"
                : activeCount === 0 && filters.scope === "open" ? "Nothing waiting on you"
                : "Nothing matches these filters"}
            </p>
            <p className="mt-1 text-[14px] text-[var(--color-brand-secondary)]">
              {apps.length === 0
                ? "Applications from your parishioners appear here as they are submitted."
                : filters.scope === "archived"
                  ? "Applications move here once you mark them completed or rejected."
                  : activeCount === 0 && filters.scope === "open"
                    // The common case now that the archive exists, and the
                    // one most likely to be misread as a broken page.
                    ? `Every application has been dealt with. ${archivedCount} ${archivedCount === 1 ? "is" : "are"} in the archive.`
                    : "Try widening the month, the status, or clearing the search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[13px] uppercase tracking-wider text-[var(--color-brand-secondary)]">
                <tr>
                  <Th label="Reference" sortKey="reference" active={sortKey} dir={sortDir} onSort={sortBy} />
                  <Th label="Applicant" sortKey="name" active={sortKey} dir={sortDir} onSort={sortBy} />
                  <Th label={locked === "sacrament" ? "Sacrament" : locked === "ministry" ? "Ministry" : "Ministry / Sacrament"}
                      sortKey="type" active={sortKey} dir={sortDir} onSort={sortBy} />
                  <Th label="Applied" sortKey="submitted" active={sortKey} dir={sortDir} onSort={sortBy} />
                  <Th label="Status" sortKey="status" active={sortKey} dir={sortDir} onSort={sortBy} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-brand-border)]">
                {visible.map(a => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open ${a.type} from ${a.applicantName}`}
                    onClick={() => navigate(`/admin/applications/view/${a.id}`)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/admin/applications/view/${a.id}`);
                      }
                    }}
                    className="cursor-pointer hover:bg-[var(--color-brand-card-sunk)] focus:bg-[var(--color-brand-card-sunk)] outline-none"
                  >
                    <td className="px-4 py-3 font-mono text-[13px] whitespace-nowrap">{a.referenceNumber ?? a.id}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{a.applicantName || "—"}</span>
                      <span className="block text-[13px] text-[var(--color-brand-secondary)]">{a.applicantEmail}</span>
                    </td>
                    <td className="px-4 py-3">{a.type}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{shortDate(a.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ label, sortKey: key, active, dir, onSort }: {
  label: string; sortKey: SortKey; active: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const on = active === key;
  return (
    <th className="px-4 py-3 font-bold">
      <button
        type="button"
        onClick={() => onSort(key)}
        aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className="inline-flex items-center gap-1 uppercase tracking-wider"
      >
        {label}
        {/* An arrow only on the sorted column. One on every header is four
            arrows saying nothing. */}
        <span aria-hidden className={on ? "opacity-100" : "opacity-0"}>
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

function Select({ label, value, onChange, children }: {
  label: string; value: string | number; onChange: (v: string) => void; children: ReactNode;
}) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-bold text-[var(--color-brand-secondary)] mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2 text-[15px] max-w-[230px]"
      >
        {children}
      </select>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `d-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-bold text-[var(--color-brand-secondary)] mb-1">{label}</label>
      <input id={id} type="date" value={value} onChange={e => onChange(e.target.value)}
             className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-2 text-[15px]" />
    </div>
  );
}

function Action({ icon, label, onClick, disabled }: {
  icon: ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--color-brand-primary)] px-3.5 py-2 text-[14px] font-bold text-[var(--color-brand-primary)] disabled:opacity-40">
      {icon}{label}
    </button>
  );
}

function shortDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
