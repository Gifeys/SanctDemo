/**
 * The accuracy disc's radius, in pixels, as a MapLibre expression.
 *
 * The GPS reports its confidence as a distance on the ground - "somewhere
 * within 20 metres". MapLibre's `circle-radius` is in SCREEN pixels, and
 * the two only line up at one zoom level. Hardcoding a pixel radius would
 * draw a disc that claims 20 m when zoomed in and 200 m when zoomed out
 * while looking identical, which is worse than drawing nothing: a
 * confident picture of the wrong thing.
 *
 * Web Mercator gives the conversion:
 *
 *     metresPerPixel = 156543.03392 * cos(latitude) / 2^zoom
 *
 * so
 *
 *     pixels = metres * 2^zoom / (156543.03392 * cos(latitude))
 *
 * The zoom term stays inside the expression, where MapLibre re-evaluates
 * it every frame as the map zooms. cos(latitude) is folded in here as a
 * constant: MapLibre expressions have no cos(), and the map never spans
 * enough latitude for the error to be visible - across the whole diocese
 * it is under a tenth of a percent.
 */
import type { DataDrivenPropertyValueSpecification } from "maplibre-gl";

/** Metres per pixel at zoom 0 on the equator, the Web Mercator constant. */
export const EQUATOR_METRES_PER_PIXEL = 156543.03392;

export function metresPerPixelAtZoomZero(latitude: number): number {
  return EQUATOR_METRES_PER_PIXEL * Math.cos((latitude * Math.PI) / 180);
}

/** What `pixels` the expression will produce at a given zoom. For tests. */
export function accuracyRadiusPixels(
  metres: number,
  latitude: number,
  zoom: number,
): number {
  return (metres * 2 ** zoom) / metresPerPixelAtZoomZero(latitude);
}

/**
 * The zoom range the stops span. MapLibre's own maximum is 24; 22 is past
 * anything this map allows and keeps the numbers small.
 */
const MIN_ZOOM = 0;
const MAX_ZOOM = 22;

/**
 * The radius as a top-level `interpolate` on zoom.
 *
 * ## Why not the arithmetic version
 *
 * This used to be the formula written straight out:
 *
 *     ["/", ["*", metres, ["^", 2, ["zoom"]]], metresPerPixel0]
 *
 * which is correct arithmetic and an illegal expression. MapLibre allows
 * `["zoom"]` ONLY as the direct input to a top-level `step` or
 * `interpolate`; nested inside `^` it is rejected with
 *
 *     "zoom" expression may only be used as input to a top-level "step"
 *     or "interpolate" expression
 *
 * on every single layer update. That had two consequences, and the second
 * was much worse than the first: the accuracy disc never drew at all, and
 * the stream of errors tripped the live map's error threshold and sent
 * the whole screen to the schematic fallback as soon as GPS produced a
 * fix. On a desktop with no GPS neither happened, which is why it looked
 * fine in a browser and broke on every phone.
 *
 * ## Why this is exact, not an approximation
 *
 * Interpolating with `["exponential", 2]` between two stops gives
 *
 *     r = r0 + (2^(z-z0) - 1) / (2^(z1-z0) - 1) * (r1 - r0)
 *
 * and substituting r0 = k·2^z0, r1 = k·2^z1 collapses it to exactly
 * k·2^z. So two stops reproduce the formula at every zoom between them,
 * not merely near them - there is no error to trade off against more
 * stops.
 */
export function accuracyRadiusExpression(
  metres: number,
  latitude: number,
): DataDrivenPropertyValueSpecification<number> {
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    MIN_ZOOM,
    accuracyRadiusPixels(metres, latitude, MIN_ZOOM),
    MAX_ZOOM,
    accuracyRadiusPixels(metres, latitude, MAX_ZOOM),
  ] as DataDrivenPropertyValueSpecification<number>;
}
