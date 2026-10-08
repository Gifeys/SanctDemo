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
  /**
   * The parish's patron photograph. Given, the pin becomes that picture in
   * a navy ring instead of the generic church glyph.
   *
   * Only a handful of parishes have one. The rest keep the glyph rather
   * than showing a stand-in: 31 identical placeholder discs would read as
   * 31 photographs nobody can tell apart, which is worse than a symbol
   * that is honestly a symbol.
   */
  photoUrl?: string
}

export function buildChurchPinElement(parish: MarkerParish): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  // Every pin is activatable, including coming-soon ones: tapping is how
  // you find out which parish a pin is, so silent pins would be a dead end.
  el.setAttribute('aria-label', parish.isLive ? parish.name : `${parish.name} — coming soon`)

  if (parish.photoUrl) {
    el.className = 'dmap__pin dmap__pin--photo'
    const img = document.createElement('img')
    img.src = parish.photoUrl
    img.alt = ''
    img.loading = 'lazy'
    // A photograph that 404s would leave a torn-image icon pinned to the
    // map, so the glyph takes over instead.
    img.addEventListener('error', () => {
      el.className = parish.isLive ? 'dmap__pin dmap__pin--live' : 'dmap__pin dmap__pin--soon'
      el.innerHTML = churchGlyph()
    })
    const disc = document.createElement('span')
    disc.className = 'dmap__pin-disc'
    disc.appendChild(img)
    const stem = document.createElement('span')
    stem.className = 'dmap__pin-stem'
    stem.setAttribute('aria-hidden', 'true')
    el.append(disc, stem)
    return el
  }

  el.className = parish.isLive ? 'dmap__pin dmap__pin--live' : 'dmap__pin dmap__pin--soon'
  el.innerHTML = churchGlyph()
  return el
}

/** A body, a roof and a cross — the client's own earlier prototype's glyph. */
function churchGlyph(): string {
  return (
    '<svg viewBox="-16 -18 32 32" aria-hidden="true">' +
    '<polygon points="-6,-2 0,-10 6,-2" />' +
    '<rect x="-5" y="-2" width="10" height="8" rx="1" />' +
    '<line x1="0" y1="-10" x2="0" y2="-14" stroke-width="1.5" />' +
    '<line x1="-2.5" y1="-12" x2="2.5" y2="-12" stroke-width="1.5" />' +
    '</svg>')
}
