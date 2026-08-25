// Regression coverage for defect 1 ("View parish is not clicking"). Root
// cause: App.tsx's handleOpenTourFromPresence set activeTab to "navigator"
// — the map tab itself — and was reused, unchanged, as the map popup's
// "View parish" click handler. Because that popup lives ON the map/
// "navigator" tab, setting the active tab to the tab already active is a
// no-op: the click handler fires, nothing visibly happens, and it reads as
// a broken button. See docs/reports/map-fixes-and-directions.md.
import { describe, it, expect } from 'vitest'
import { tabForParishSelection } from './parishSelection'

describe('tabForParishSelection', () => {
  it('opens the parish’s own profile ("home") for a pin/card/search selection', () => {
    expect(tabForParishSelection('pin')).toBe('home')
  })

  it('never routes a pin/card selection to "navigator" — the map tab it may already be on', () => {
    // This is the exact assertion that would have caught defect 1: the old
    // code used "navigator" for this handler, which is a no-op when the
    // popup triggering it lives on the navigator tab itself.
    expect(tabForParishSelection('pin')).not.toBe('navigator')
  })

  it('keeps the presence sheet’s "Open Tour" button going to the map tab', () => {
    // Standing at the parish already, "Open Tour" (paired with "AR Tour")
    // means "show me the diocese map" — jumping to "navigator" here is
    // correct and must stay unchanged.
    expect(tabForParishSelection('presence-open-tour')).toBe('navigator')
  })
})
