import { describe, it, expect } from "vitest";
import {
  accuracyRadiusPixels,
  accuracyRadiusExpression,
  metresPerPixelAtZoomZero,
  EQUATOR_METRES_PER_PIXEL,
} from "./mapAccuracy";

/** Caloocan, which is where every parish in this app is. */
const CALOOCAN_LAT = 14.65;

describe("the accuracy disc's radius", () => {
  it("is one pixel per 156543 m at zoom 0 on the equator", () => {
    expect(accuracyRadiusPixels(EQUATOR_METRES_PER_PIXEL, 0, 0)).toBeCloseTo(1, 6);
  });

  it("doubles with every zoom level", () => {
    const z16 = accuracyRadiusPixels(20, CALOOCAN_LAT, 16);
    const z17 = accuracyRadiusPixels(20, CALOOCAN_LAT, 17);
    // This is the whole point of the expression. A fixed pixel radius
    // would hold still here and silently misstate the accuracy at every
    // zoom but one.
    expect(z17 / z16).toBeCloseTo(2, 10);
  });

  it("draws a 20 m fix at a sane size on a street-level map", () => {
    // At z16 over Caloocan a metre is about 0.43px, so 20 m lands near
    // 9px - a disc you can see around a 16px dot, not one that swallows
    // the map.
    const px = accuracyRadiusPixels(20, CALOOCAN_LAT, 16);
    expect(px).toBeGreaterThan(6);
    expect(px).toBeLessThan(12);
  });

  it("scales linearly with the reported accuracy", () => {
    const tight = accuracyRadiusPixels(10, CALOOCAN_LAT, 16);
    const loose = accuracyRadiusPixels(80, CALOOCAN_LAT, 16);
    expect(loose / tight).toBeCloseTo(8, 10);
  });

  it("narrows towards the poles, as Mercator requires", () => {
    // Same ground distance covers more pixels further from the equator,
    // because Mercator stretches the map there.
    expect(metresPerPixelAtZoomZero(60)).toBeLessThan(metresPerPixelAtZoomZero(0));
    expect(accuracyRadiusPixels(20, 60, 16)).toBeGreaterThan(
      accuracyRadiusPixels(20, 0, 16),
    );
  });

  it("builds an expression MapLibre re-evaluates on zoom", () => {
    // This used to assert expr[0] === "/" - the arithmetic form, which
    // MapLibre rejects outright. The test passed for as long as the bug
    // lived, because it checked that the expression was the shape the
    // code happened to build rather than a shape MapLibre accepts. The
    // suite below now asserts the rule instead.
    const expr = accuracyRadiusExpression(20, CALOOCAN_LAT) as unknown as unknown[];
    // The zoom term has to stay INSIDE the expression. Evaluated in JS and
    // baked to a number, the disc would freeze at whatever zoom happened
    // to be current when the fix arrived.
    expect(JSON.stringify(expr)).toContain('["zoom"]');
  });
});

describe('the expression MapLibre will actually accept', () => {
  // The previous version was arithmetically correct and illegal:
  // ["/", ["*", m, ["^", 2, ["zoom"]]], k]. MapLibre rejected it on every
  // layer update, the disc never drew, and the error stream tripped the
  // live map's fallback the moment GPS produced a fix. These tests are
  // about the SHAPE of the expression, which is what was wrong.
  const expr = accuracyRadiusExpression(20, 14.65) as unknown[]

  it('is a top-level interpolate', () => {
    expect(expr[0]).toBe('interpolate')
  })

  it('feeds zoom straight into it, not through arithmetic', () => {
    // The whole rule: ["zoom"] may only be the direct input to a
    // top-level step or interpolate.
    expect(expr[2]).toEqual(['zoom'])
  })

  it('never nests ["zoom"] inside another operator', () => {
    const nested = (node: unknown, depth: number): boolean => {
      if (!Array.isArray(node)) return false
      if (node[0] === 'zoom') return depth > 1
      return node.some(child => nested(child, depth + 1))
    }
    expect(nested(expr, 0)).toBe(false)
  })

  it('interpolates exponentially with base 2, which is what makes it exact', () => {
    expect(expr[1]).toEqual(['exponential', 2])
  })
})

describe('the radius it produces', () => {
  const metres = 20
  const lat = 14.65

  it('matches the Web Mercator formula at the stops', () => {
    const expr = accuracyRadiusExpression(metres, lat) as unknown[]
    expect(expr[4]).toBeCloseTo(accuracyRadiusPixels(metres, lat, 0), 10)
    expect(expr[6]).toBeCloseTo(accuracyRadiusPixels(metres, lat, 22), 4)
  })

  it('matches the formula BETWEEN the stops too', () => {
    // Exponential-base-2 interpolation between r=k*2^z0 and r=k*2^z1
    // collapses to exactly k*2^z, so two stops are not an approximation.
    const expr = accuracyRadiusExpression(metres, lat) as number[]
    const [, , , z0, r0, z1, r1] = expr as unknown as [string, unknown, unknown, number, number, number, number]
    for (const z of [12, 14.5, 16, 18, 19.3]) {
      const t = (2 ** (z - z0) - 1) / (2 ** (z1 - z0) - 1)
      const interpolated = r0 + t * (r1 - r0)
      expect(interpolated).toBeCloseTo(accuracyRadiusPixels(metres, lat, z), 6)
    }
  })

  it('grows with the reported uncertainty', () => {
    const tight = accuracyRadiusPixels(5, lat, 16)
    const loose = accuracyRadiusPixels(50, lat, 16)
    expect(loose).toBeCloseTo(tight * 10, 6)
  })
})
