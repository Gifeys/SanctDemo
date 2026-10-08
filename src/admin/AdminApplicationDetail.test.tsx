import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApplicationDoc } from "../types";

/**
 * The parish office's decision screen.
 *
 * It cannot be exercised in the browser here: reaching it needs an account
 * whose role is church_admin, and the security rules deliberately make that
 * a value no client can write - so there is no way to produce one without
 * the Firebase console. Rendering it directly is the honest alternative to
 * saying "it compiles".
 *
 * Firestore is mocked at the module boundary rather than run against the
 * emulator, because what is under test here is what the screen does with a
 * document, not whether the rules would hand one over. The rules have their
 * own suite.
 */

// vi.mock is hoisted above everything, so anything its factory closes over
// has to be hoisted with it. vi.hoisted is how that is said.
const h = vi.hoisted(() => ({
  setStatus: vi.fn().mockResolvedValue(undefined),
  handler: { current: null as ((snap: unknown) => void) | null },
}));
const setStatus = h.setStatus;

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: (_ref: unknown, next: (snap: unknown) => void) => {
    h.handler.current = next;
    return () => { h.handler.current = null; };
  },
}));

vi.mock("../lib/firebase", () => ({ db: {}, auth: { currentUser: { uid: "adminA" } } }));

vi.mock("../lib/applications", async () => {
  const actual = await vi.importActual<typeof import("../lib/applications")>("../lib/applications");
  return { ...actual, setApplicationStatus: h.setStatus };
});

import AdminApplicationDetail from "./AdminApplicationDetail";
import type { AdminSession } from "./AdminApp";

/** Who the decision must be addressed to, taken from the document itself. */
const TELL = { uid: "userA", churchId: "route-mhcp", what: "Baptism" };

const SESSION = {
  user: { uid: "adminA" },
  profile: { uid: "adminA", role: "church_admin", churchId: "route-mhcp", fullName: "Admin" },
  church: { id: "route-mhcp", name: "Mary Help of Christians Parish" },
} as unknown as AdminSession;

const APP: ApplicationDoc = {
  uid: "userA",
  applicantName: "Juan Dela Cruz",
  applicantEmail: "juan@example.com",
  churchId: "route-mhcp",
  kind: "sacrament",
  type: "Baptism",
  status: "pending",
  referenceNumber: "SAC-2026-ACDEFG",
  formData: { preferredDate: "2026-11-02", hasPSA: true, sponsorOrParent: "" },
  createdAt: "2026-10-06T02:00:00.000Z",
  history: [{ status: "pending", at: "2026-10-06T02:00:00.000Z" }],
};

function renderWith(app: ApplicationDoc) {
  const view = render(
    <MemoryRouter initialEntries={["/admin/applications/abc"]}>
      <Routes>
        <Route path="/admin/applications/:id" element={<AdminApplicationDetail session={SESSION} />} />
      </Routes>
    </MemoryRouter>,
  );
  h.handler.current?.({ exists: () => true, id: "abc", data: () => app });
  return view;
}

beforeEach(() => {
  h.handler.current = null;
  setStatus.mockClear();
});

describe("AdminApplicationDetail", () => {
  it("shows the applicant, the reference and the parish", async () => {
    renderWith(APP);
    expect(await screen.findByText("Juan Dela Cruz")).toBeTruthy();
    expect(screen.getByText("SAC-2026-ACDEFG")).toBeTruthy();
    expect(screen.getByText("Mary Help of Christians Parish")).toBeTruthy();
    expect(screen.getByText("Baptism")).toBeTruthy();
  });

  it("renders the form answers as readable labels, not variable names", async () => {
    renderWith(APP);
    expect(await screen.findByText("Preferred date")).toBeTruthy();
    expect(screen.getByText("2026-11-02")).toBeTruthy();
    // Booleans read as words; an empty answer reads as a dash rather than
    // as nothing at all, so the reviewer can tell it was asked.
    expect(screen.getByText("Has psa")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
  });

  it("approving saves immediately, with no dialog in the way", async () => {
    renderWith(APP);
    fireEvent.click(await screen.findByRole("button", { name: /approve/i }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("abc", "approved", undefined, TELL));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rejecting asks first, and does not save until confirmed", async () => {
    renderWith(APP);
    fireEvent.click(await screen.findByRole("button", { name: /reject/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, reject/i }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("abc", "rejected", undefined, TELL));
  });

  it("cancelling the rejection saves nothing", async () => {
    renderWith(APP);
    fireEvent.click(await screen.findByRole("button", { name: /reject/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("passes the office note along with the decision", async () => {
    renderWith(APP);
    const note = await screen.findByLabelText(/note for the record/i);
    fireEvent.change(note, { target: { value: "Interview booked for Tuesday." } });
    fireEvent.click(screen.getByRole("button", { name: /under review/i }));
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith(
        "abc", "under_review", "Interview booked for Tuesday.", TELL));
  });

  it("will not re-apply the status it already has", async () => {
    renderWith({ ...APP, status: "approved" });
    const approve = await screen.findByRole("button", { name: /approve/i });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
  });

  it("says so plainly when the document is not readable", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/applications/abc"]}>
        <Routes>
          <Route path="/admin/applications/:id" element={<AdminApplicationDetail session={SESSION} />} />
        </Routes>
      </MemoryRouter>,
    );
    // What another parish's application looks like: the rules deny it, and
    // the subscription reports an error rather than a document.
    h.handler.current?.({ exists: () => false, id: "abc", data: () => undefined });
    expect(await screen.findByText(/not available/i)).toBeTruthy();
    expect(screen.getByText(/belongs to another parish/i)).toBeTruthy();
  });
});
