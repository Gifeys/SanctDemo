// Which app tab a parish selection should land on, extracted as a pure
// function so the exact defect behind "View parish does nothing" can be
// unit-tested without rendering the full App tree (which needs Firebase
// auth/Firestore and a MapLibre instance, neither mocked in this project's
// test setup — see mapSearch.ts/mapMarkers.ts for the same extraction
// pattern used for the same reason).
//
// The bug: App.tsx's handleOpenTourFromPresence set activeTab to
// "navigator" — the map tab itself — and was reused as the click handler
// for the map popup's "View parish" button. When that popup lives on the
// map tab (which it does, in the diocese-wide map screen), setting the
// active tab to the tab already active is a no-op: nothing visibly happens,
// which reads as "the button isn't working" even though the click handler
// fires correctly.
//
// 'pin' covers every place a pilgrim picks *which* parish to look at — a
// map pin/popup, a search result, a parish card — and always opens that
// parish's own profile ("home": Dashboard, with Mass schedule/History/
// Ministries/Sacraments links), matching the pre-existing "Start Sanctuary
// Walk" card button in the church-selector screen, which already did this.
//
// 'presence-open-tour' is the presence sheet's own "Open Tour" button
// (paired with its "AR Tour" button) — the pilgrim is already standing at
// the parish, so jumping to the diocese map is the one case where that
// destination is actually correct, and stays unchanged.
export type Tab =
  | "home"
  | "navigator"
  | "rosary"
  | "mass"
  | "ministries"
  | "history"
  | "sacraments"
  | "ar"
  | "quiz"
  | "me"
  | "admin"
  | "pwa-devkit"

export type ParishSelectionSource = "pin" | "presence-open-tour"

export function tabForParishSelection(source: ParishSelectionSource): Tab {
  return source === "presence-open-tour" ? "navigator" : "home"
}
