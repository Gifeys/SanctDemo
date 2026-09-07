// Church-glyph pin and popup-card DOM builders for the live diocese map
// (DioceseMapLive.tsx). Extracted into pure functions — MapLibre markers and
// popups live outside React's tree (they're detached DOM nodes handed to
// MapLibre, not JSX), and this environment's headless browser can't paint
// the MapLibre WebGL canvas at all (see docs/reports/
// map-prototype-design-swap.md), so this is the only way the pin markup
// and its live-vs-coming-soon branching can be verified — by
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
