import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApplicationDoc } from "../types";

/**
 * The applications table.
 *
 * Reaching it in a browser needs an account whose role is church_admin,
 * and the security rules deliberately make that a value no client can
 * write - so there is no way to produce one without the Firebase console.
 * Rendering it directly is the honest alternative to "it compiles".
 *
 * Firestore is mocked at the module boundary: what is under test is what
 * the screen does with a parish's applications, not whether the rules
 * would hand them over. The rules have their own suite.
 */
const h = vi.hoisted(() => ({
  handler: { current: null as ((snap: unknown) => void) | null },
  excel: vi.fn(),
  csv: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: (_q: unknown, next: (snap: unknown) => void) => {
    h.handler.current = next;
    return () => { h.handler.current = null; };
  },
}));
vi.mock("../lib/firebase", () => ({ db: {}, auth: { currentUser: { uid: "adminA" } } }));
vi.mock("../lib/exportApplications", () => ({ exportExcel: h.excel, exportCsv: h.csv }));

import AdminApplications from "./AdminApplications";
import type { AdminSession } from "./AdminApp";

const SESSION = {
  user: { uid: "adminA" },
  profile: { uid: "adminA", role: "church_admin", churchId: "route-mhcp", fullName: "Admin" },
  church: { id: "route-mhcp", name: "Mary Help of Christians Parish" },
} as unknown as AdminSession;

const app = (over: Partial<ApplicationDoc> & { id: string }): ApplicationDoc => ({
  uid: "u1", applicantName: "Juan Dela Cruz", applicantEmail: "juan@example.com",
  churchId: "route-mhcp", kind: "ministry", type: "Ministry of Altar Servers (MAS)",
  status: "pending", referenceNumber: "MIN-2026-AAAAAA",
  createdAt: "2026-08-12T02:00:00.000Z", ...over,
});

const DOCS: ApplicationDoc[] = [
  app({ id: "1", referenceNumber: "AUG-ALTAR-PENDING" }),
  app({ id: "2", referenceNumber: "AUG-ALTAR-APPROVED", status: "approved" }),
  app({ id: "3", referenceNumber: "SEP-ALTAR", createdAt: "2026-09-04T02:00:00.000Z" }),
  app({ id: "4", referenceNumber: "AUG-CHOIR", type: "Choir" }),
  app({ id: "5", referenceNumber: "AUG-BAPTISM", kind: "sacrament", type: "Holy Baptism",
        applicantName: "Maria Santos", applicantEmail: "maria@example.com",
        createdAt: "2026-08-20T02:00:00.000Z" }),
];

function renderAt(path: string) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/applications" element={<AdminApplications session={SESSION} />} />
        <Route path="/admin/applications/:kind" element={<AdminApplications session={SESSION} />} />
      </Routes>
    </MemoryRouter>,
  );
  h.handler.current?.({ docs: DOCS.map(d => ({ id: d.id, data: () => d })) });
  return view;
}

const refsShown = () =>
  screen.getAllByRole("link").map(r => within(r).getAllByRole("cell")[0]?.textContent ?? "");

beforeEach(() => {
  h.handler.current = null;
  h.excel.mockClear();
  h.csv.mockClear();
});

describe("AdminApplications", () => {
  it("shows the whole parish when nothing is filtered", async () => {
    renderAt("/admin/applications");
    expect(await screen.findByText(/Showing 5 applications/)).toBeTruthy();
  });

  it("the Ministries view excludes sacraments without the admin filtering", async () => {
    renderAt("/admin/applications/ministry");
    expect(await screen.findByText(/Showing 4 applications/)).toBeTruthy();
    expect(screen.queryByText("AUG-BAPTISM")).toBeNull();
  });

  it("the Sacraments view shows only sacraments", async () => {
    renderAt("/admin/applications/sacrament");
    expect(await screen.findByText(/Showing 1 application\b/)).toBeTruthy();
    expect(screen.getByText("AUG-BAPTISM")).toBeTruthy();
  });

  it("the coordinator case: August + Altar Servers + Pending leaves one row", async () => {
    renderAt("/admin/applications/ministry");
    await screen.findByText(/Showing 4 applications/);

    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Ministry"), {
      target: { value: "Ministry of Altar Servers (MAS)" },
    });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });

    await waitFor(() => expect(screen.getByText(/Showing 1 application\b/)).toBeTruthy());
    expect(refsShown()).toEqual(["AUG-ALTAR-PENDING"]);
  });

  it("searches by applicant", async () => {
    renderAt("/admin/applications");
    await screen.findByText(/Showing 5 applications/);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "maria" } });
    await waitFor(() => expect(screen.getByText(/Showing 1 application\b/)).toBeTruthy());
  });

  it("offers only the ministries somebody has actually applied for", async () => {
    renderAt("/admin/applications/ministry");
    await screen.findByText(/Showing 4 applications/);
    const options = within(screen.getByLabelText("Ministry")).getAllByRole("option")
      .map(o => o.textContent);
    expect(options).toEqual(["All", "Choir", "Ministry of Altar Servers (MAS)"]);
    // A sacrament must not leak into the ministry dropdown.
    expect(options).not.toContain("Holy Baptism");
  });

  it("exports what is on screen, not the whole parish", async () => {
    renderAt("/admin/applications/ministry");
    await screen.findByText(/Showing 4 applications/);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "approved" } });
    await waitFor(() => expect(screen.getByText(/Showing 1 application\b/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /export excel/i }));
    expect(h.excel).toHaveBeenCalledTimes(1);
    const [rows, filters] = h.excel.mock.calls[0]!;
    expect((rows as ApplicationDoc[]).map(r => r.referenceNumber)).toEqual(["AUG-ALTAR-APPROVED"]);
    expect((filters as { status: string }).status).toBe("approved");
  });

  it("will not export an empty list", async () => {
    renderAt("/admin/applications");
    await screen.findByText(/Showing 5 applications/);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "nobody" } });
    await waitFor(() => expect(screen.getByText(/Nothing matches these filters/)).toBeTruthy());

    // Disabled rather than removed: a button that vanishes makes the
    // toolbar jump and leaves the admin wondering where it went.
    const excel = screen.getByRole("button", { name: /export excel/i }) as HTMLButtonElement;
    expect(excel.disabled).toBe(true);
    fireEvent.click(excel);
    expect(h.excel).not.toHaveBeenCalled();
  });

  it("clears every filter at once", async () => {
    renderAt("/admin/applications");
    await screen.findByText(/Showing 5 applications/);
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });

    const clear = await screen.findByRole("button", { name: /clear 2 filters/i });
    fireEvent.click(clear);
    await waitFor(() => expect(screen.getByText(/Showing 5 applications/)).toBeTruthy());
  });

  it("sorts by applicant when the header is used", async () => {
    renderAt("/admin/applications");
    await screen.findByText(/Showing 5 applications/);
    fireEvent.click(screen.getByRole("button", { name: /applicant/i }));
    await waitFor(() => expect(refsShown()[0]).toBe("AUG-ALTAR-PENDING"));
    // Maria sorts after Juan ascending, so she must be last.
    expect(refsShown().at(-1)).toBe("AUG-BAPTISM");
  });
});
