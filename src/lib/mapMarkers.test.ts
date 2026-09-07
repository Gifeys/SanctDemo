import { describe, it, expect } from 'vitest'
import { buildChurchPinElement } from './mapMarkers'

describe('buildChurchPinElement', () => {
  it('marks a live parish pin as live, full-size', () => {
    const el = buildChurchPinElement({ name: 'San Roque Cathedral', isLive: true })
    expect(el.tagName).toBe('BUTTON')
    expect(el.type).toBe('button')
    expect(el.className).toBe('dmap__pin dmap__pin--live')
    expect(el.getAttribute('aria-label')).toBe('San Roque Cathedral')
  })

  it('marks a coming-soon parish pin as dimmed and labels it as such', () => {
    const el = buildChurchPinElement({ name: 'Birhen ng Lourdes Parish', isLive: false })
    expect(el.className).toBe('dmap__pin dmap__pin--soon')
    expect(el.getAttribute('aria-label')).toBe('Birhen ng Lourdes Parish — coming soon')
  })

  it('is always a real, focusable/tappable button — even coming-soon pins', () => {
    for (const isLive of [true, false]) {
      const el = buildChurchPinElement({ name: 'X', isLive })
      expect(el.tagName).toBe('BUTTON')
      expect(el.type).toBe('button')
    }
  })

  it('renders the church glyph (body, roof, cross) as an SVG', () => {
    const el = buildChurchPinElement({ name: 'X', isLive: true })
    const svg = el.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.querySelector('rect')).not.toBeNull() // body
    expect(svg!.querySelector('polygon')).not.toBeNull() // roof
    expect(svg!.querySelectorAll('line').length).toBe(2) // cross
  })
})
