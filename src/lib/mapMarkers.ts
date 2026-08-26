// Church-glyph pin and popup-card DOM builders for the live diocese map
// (DioceseMapLive.tsx). Extracted into pure functions — MapLibre markers and
// popups live outside React's tree (they're detached DOM nodes handed to
// MapLibre, not JSX), and this environment's headless browser can't paint
// the MapLibre WebGL canvas at all (see docs/reports/
// map-prototype-design-swap.md), so this is the only way the pin/popup
// markup and its live-vs-coming-soon branching can be verified — by
// building the DOM directly in a unit test rather than by screenshot.
//
// The glyph itself (a body, a roof and a cross) is the client's own earlier
// prototype's design (DioceseMap.jsx), reused verbatim.

export interface MarkerParish {
  name: string
  location?: string
  isLive: boolean
}

export function buildChurchPinElement(parish: MarkerParish): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = parish.isLive ? 'dmap__pin dmap__pin--live' : 'dmap__pin dmap__pin--soon'
  // Every pin is activatable, including coming-soon ones: tapping is how
  // you find out which parish a pin is, so silent pins would be a dead end.
  el.setAttribute('aria-label', parish.isLive ? parish.name : `${parish.name} — coming soon`)
  el.innerHTML =
    '<svg viewBox="-16 -18 32 32" aria-hidden="true">' +
    '<polygon points="-6,-2 0,-10 6,-2" />' +
    '<rect x="-5" y="-2" width="10" height="8" rx="1" />' +
    '<line x1="0" y1="-10" x2="0" y2="-14" stroke-width="1.5" />' +
    '<line x1="-2.5" y1="-12" x2="2.5" y2="-12" stroke-width="1.5" />' +
    '</svg>'
  return el
}

export interface PopupBuild {
  el: HTMLDivElement
  action: HTMLButtonElement | null
  // "Get directions" — live parishes only, alongside "View parish". Built
  // here (not added later) so it exists in the DOM from the start and the
  // caller can wire a click handler without re-querying/rebuilding the
  // popup. `directionsStatus` is the paragraph the caller updates in place
  // (distance/time once known, or why it can't route yet) — starts empty
  // and hidden via :empty in CSS, so a parish nobody has asked directions
  // for yet shows no stray blank line.
  directionsAction: HTMLButtonElement | null
  /**
   * "Start walking" — begins a live turn-by-turn session. Distinct from
   * `directionsAction`, which draws a route and leaves it: navigation follows
   * the pilgrim, advances the instruction, and reroutes when they leave it.
   */
  navigateAction: HTMLButtonElement | null
  directionsStatus: HTMLParagraphElement | null
}

// Popup body. Built as DOM rather than JSX for the same reason as the pin,
// and returned with its action button so the caller can wire up routing
// without re-querying the DOM. Anchored `bottom` by the caller (MapLibre
// Popup), so this card opens upward over the map rather than clipping past
// its edge.
export function buildPopupContent(parish: MarkerParish): PopupBuild {
  const el = document.createElement('div')
  el.className = 'dmap-card'

  const name = document.createElement('h3')
  name.className = 'dmap-card__name'
  name.textContent = parish.name
  el.append(name)

  if (parish.location) {
    const where = document.createElement('p')
    where.className = 'dmap-card__where'
    where.textContent = parish.location
    el.append(where)
  }

  let action: HTMLButtonElement | null = null
  let directionsAction: HTMLButtonElement | null = null
  let directionsStatus: HTMLParagraphElement | null = null
  let navigateAction: HTMLButtonElement | null = null
  if (parish.isLive) {
    action = document.createElement('button')
    action.type = 'button'
    action.className = 'dmap-card__action'
    action.textContent = 'View parish'
    el.append(action)

    directionsAction = document.createElement('button')
    directionsAction.type = 'button'
    directionsAction.className = 'dmap-card__action dmap-card__action--secondary'
    directionsAction.textContent = 'Get directions'
    el.append(directionsAction)

    // "Get directions" draws the route and leaves it there. "Start walking"
    // begins a live turn-by-turn session that follows the pilgrim and
    // reroutes — a different thing, so it gets its own button rather than
    // overloading the first.
    navigateAction = document.createElement('button')
    navigateAction.type = 'button'
    navigateAction.className = 'dmap-card__action dmap-card__action--navigate'
    navigateAction.textContent = 'Start walking'
    el.append(navigateAction)

    directionsStatus = document.createElement('p')
    directionsStatus.className = 'dmap-card__directions-status'
    el.append(directionsStatus)
  } else {
    const soon = document.createElement('p')
    soon.className = 'dmap-card__soon'
    soon.textContent = 'Coming soon to SanctiWalk'
    el.append(soon)
  }

  return { el, action, directionsAction, directionsStatus, navigateAction }
}
