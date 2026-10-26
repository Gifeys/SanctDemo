import { describe, expect, it } from "vitest";

import { routeFeatures } from "./DioceseMapLive";
import type { WalkingRoute } from "../lib/routing";
import type { Coordinates } from "../lib/geo";

const PATH: Coordinates[] = [
  { lat: 14.6377, lng: 120.973 },
  { lat: 14.6377, lng: 120.974 },
  { lat: 14.6377, lng: 120.975 },
];

const route = (over: Partial<WalkingRoute> = {}): WalkingRoute =>
  ({ kind: "walking", path: PATH, distanceMeters: 220, durationSeconds: 180, steps: [], ...over }) as WalkingRoute;

const legs = (fc: GeoJSON.FeatureCollection) =>
  fc.features.map(f => f.properties?.leg);

describe("routeFeatures", () => {
  it("shows the whole route as ahead before there is a position", () => {
    // Browsing a route on the map, not walking it.
    const { data } = routeFeatures(route(), null, 0);
    expect(legs(data)).toEqual(["ahead"]);
  });

  it("splits into walked and remaining once the walker is on it", () => {
    const { data } = routeFeatures(route(), { lat: 14.6377, lng: 120.9745 }, 0);
    expect(legs(data)).toEqual(["done", "ahead"]);
  });

  it("emits coordinates as [lng, lat], which is what GeoJSON means", () => {
    // Swapping these puts the route in the Indian Ocean, and it is the
    // easiest mistake to make here because the app's own type is {lat,lng}.
    const { data } = routeFeatures(route(), null, 0);
    const line = data.features[0].geometry as GeoJSON.LineString;
    expect(line.coordinates[0]).toEqual([120.973, 14.6377]);
  });

  it("omits a half with nothing in it rather than drawing a stub", () => {
    // At the very start there is no walked part. A one-point LineString
    // renders as a dot under the round cap.
    const { data } = routeFeatures(route(), PATH[0], 0);
    expect(legs(data)).toEqual(["ahead"]);
  });

  it("reports the leg so the next fix cannot cut backwards", () => {
    const { legIndex } = routeFeatures(route(), { lat: 14.6377, lng: 120.9745 }, 0);
    expect(legIndex).toBe(1);
  });

  it("treats a route too short to split as all ahead", () => {
    const { data } = routeFeatures(route({ path: [PATH[0]] }), PATH[0], 0);
    expect(legs(data)).toEqual(["ahead"]);
  });
});
