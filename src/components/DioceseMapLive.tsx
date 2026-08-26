import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker as MapLibreMarker, Popup, NavigationControl, LngLatBounds, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { usePresence } from "../context/PresenceContext";
import { DIOCESE_BOUNDS } from "../lib/project";
import { haversineMeters, type Coordinates } from "../lib/geo";
import { formatDistance, formatWalkingMinutes, getWalkingDirections, type WalkingRoute } from "../lib/routing";
import { searchParishesScored, type SearchableParish } from "../lib/mapSearch";
import { buildChurchPinElement, buildPopupContent } from "../lib/mapMarkers";
import { shortestAngleDelta } from "../lib/heading";
import { useDeviceHeading } from "../lib/useDeviceHeading";
import CompassControl, { type MapOrientationMode } from "./CompassControl";
import parishData from "../data/diocese-parishes.json";
import DioceseMap from "./DioceseMap";

// Beyond this, a position change is a relocation (first fix, or the demo
// simulator being switched) rather than walking, and easing across it looks
// like the map flying somewhere. 120m is far more than GPS noise and far
// less than a walk between parishes.
const MARKER_SNAP_METERS = 120;

// One GPS tick is roughly a second; easing a little under that keeps the
// marker continuously in motion without lagging visibly behind the fix.
const MARKER_EASE_MS = 800;

// Below this the map is already pointing where it should be, and issuing a
// fresh easeTo would restart the animation on every sensor event.
const MAP_BEARING_EPSILON = 1;

interface DioceseMapLiveProps {
  onSelectParish: (parishId: string) => void;
  /**
   * A diocese parish id handed over by Home's "Walk there". The map draws the
   * walking route to it as soon as it is ready, then calls onWalkToConsumed
   * so returning to this tab later does not silently redraw a route nobody
   * asked for a second time.
   */
  walkToParishId?: string | null;
  onWalkToConsumed?: () => void;
  // When set, the map surface itself is given this fixed pixel height and
  // the legend/open-link stack below it at their natural height, instead of
  // the map flexing to fill a fixed-height ancestor (the h-72/h-64 cards on
  // the dashboard and church selector). Used by the dedicated map screen so
  // the map keeps ~374px regardless of how tall the legend/link end up.
  heightPx?: number;
}

// The client's own Google My Map ("SanctDemoMap") — a fully public link that
// costs nothing to keep around and is genuinely useful (e.g. sharing outside
// the app), even though the map itself is now reproduced here instead of
// embedded.
const MY_MAP_ID = "1gNkblHn4JSJoWLb6zP4D_h6E6WIZomg";
export const OPEN_IN_GOOGLE_MAPS_URL = `https://www.google.com/maps/d/viewer?mid=${MY_MAP_ID}`;

// The client's study-area polygon, reproduced exactly from their exported
// KML — 7 points in [lng, lat] order, the last repeating the first to close
// the ring (GeoJSON requires a closed LinearRing). This is the client's
// stated scope of their capstone study, not a decorative shape, hence the
// caption drawn under the map explaining what it is.
export const SCOPE_POLYGON_RING: [number, number][] = [
  [120.972677, 14.651797],
  [120.971767, 14.643635],
  [120.971149, 14.637125],
  [120.976676, 14.638188],
  [120.976539, 14.639782],
  [120.975187, 14.652067],
  [120.972677, 14.651797],
];

const SCOPE_SOURCE_ID = "scope-polygon-src";
const SCOPE_FILL_LAYER_ID = "scope-polygon-fill";
const SCOPE_LINE_LAYER_ID = "scope-polygon-line";

function scopePolygonFeature(): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [SCOPE_POLYGON_RING] },
  };
}

// Added once, right after the map is created and before any marker or route
// layer exists — so the fill/outline always sits below everything else
// MapLibre draws, and (since parish/you-are-here pins are HTML markers
// layered on top of the whole canvas by the browser, not MapLibre paint
// layers) it is never able to hide a pin regardless of add order.
function addScopePolygon(map: MapLibreMap, fillColor: string, lineColor: string) {
  if (map.getSource(SCOPE_SOURCE_ID)) return;
  map.addSource(SCOPE_SOURCE_ID, { type: "geojson", data: scopePolygonFeature() });
  map.addLayer({
    id: SCOPE_FILL_LAYER_ID,
    type: "fill",
    source: SCOPE_SOURCE_ID,
    // Positron's ground is light, unlike the old dark basemap this polygon
    // used to sit on — fill-opacity raised from 0.22 so the client's scope
    // shape stays legible against it rather than washing out (see the
    // contrast note on --color-brand-scope in index.css).
    paint: { "fill-color": fillColor, "fill-opacity": 0.3 },
  });
  map.addLayer({
    id: SCOPE_LINE_LAYER_ID,
    type: "line",
    source: SCOPE_SOURCE_ID,
    layout: { "line-join": "round" },
    paint: { "line-color": lineColor, "line-width": 2 },
  });
}

interface ParishRecord {
  id: string;
  name: string;
  vicariate: string;
  coordinates: { lat: number; lng: number };
  status: "live" | "coming_soon";
}

const PARISHES = parishData.parishes as ParishRecord[];

// Free, keyless vector tiles — OpenFreeMap (openfreemap.org), an unlimited
// no-signup host of OpenMapTiles-schema data (MIT/ODbL). No API key, no
// billing account, nothing that can expire mid-defense — the client's own
// requirement. `positron` is the client's preferred design, taken from
// their own earlier prototype (DioceseMap.jsx): a light, deliberately plain
// basemap, so the church pins stay the loudest thing on screen. It ships
// pre-styled and pre-decluttered, unlike the "liberty" style this replaces,
// which needed hand-tuned layer-by-layer restyling to reach the same
// result — that restyling is gone with it.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
export const TILE_HOST = "tiles.openfreemap.org";

// diocese-parishes.json carries all 31 parishes, including the 2 that are
// already "live" in ROUTES (src/data.ts) — but under different ids
// (parish-mary-help-of-christians-parish / parish-san-roque-cathedral
// rather than route-mhcp / route-src). Tapping a live pin's popup action
// must open the tour via the route id App.tsx already wires up, so this
// maps the JSON id to the route id for just those two instead of drawing
// duplicate pins.
const LIVE_PARISH_TO_ROUTE_ID: Record<string, string> = {
  "parish-mary-help-of-christians-parish": "route-mhcp",
  "parish-san-roque-cathedral": "route-src",
};

interface LiveParish {
  routeId: string;
  name: string;
  coordinates: Coordinates;
}

// The subset of PARISHES that are actually navigable (status "live" and
// mapped to a route id) — both the distance panel and the walking-route
// layers only ever target these, never a "coming soon" pin.
const LIVE_PARISHES: LiveParish[] = PARISHES.filter(
  p => p.status === "live" && LIVE_PARISH_TO_ROUTE_ID[p.id],
).map(p => ({
  routeId: LIVE_PARISH_TO_ROUTE_ID[p.id],
  name: p.name,
  coordinates: p.coordinates,
}));

// Reads a CSS custom property (optionally through a color-mix() expression)
// by letting the browser resolve it on a detached element, rather than
// hardcoding any hex value here. MapLibre paint properties need a literal
// color string, not a live var() reference, so this is the runtime-read
// equivalent of what plain CSS classes do for the HTML pin/popup/search
// elements below.
function resolveColor(expr: string): string {
  const probe = document.createElement("div");
  probe.style.color = expr;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved || "var(--color-brand-primary)";
}

function shortLabel(name: string): string {
  return name.replace(/ Guide$/, "").replace(/ Tour$/, "").replace(/ Parish$/, "");
}

// Every parish's vicariate in diocese-parishes.json is flagged
// `vicariateVerified: false` — each one was assigned to its nearest
// vicariate seat, not sourced from the diocese as official. It's still
// shown (the rule this codebase holds itself to: unverified data is
// labelled, never hidden — see coordinatesVerified/scheduleVerified), but
// never as a bare fact, and — per mapSearch.ts — never matched against.
function vicariateLabel(vicariate: string): string {
  return `${vicariate} (unconfirmed)`;
}

// Search shows a parish's vicariate as its secondary "location" line — the
// same role `location` plays in the client's prototype data
// (churches.json), which this dataset doesn't carry a dedicated field for
// — but, unlike the prototype, does not match against it (see
// mapSearch.ts's searchParishes for why).
interface SearchParish extends SearchableParish {
  routeId?: string;
  isLive: boolean;
}

const SEARCHABLE_PARISHES: SearchParish[] = PARISHES.map(p => ({
  id: p.id,
  name: shortLabel(p.name),
  location: vicariateLabel(p.vicariate),
  coordinates: p.coordinates,
  routeId: LIVE_PARISH_TO_ROUTE_ID[p.id],
  isLive: p.status === "live" && Boolean(LIVE_PARISH_TO_ROUTE_ID[p.id]),
}));

function routeLineId(routeId: string): { sourceId: string; layerId: string } {
  return { sourceId: `route-line-src-${routeId}`, layerId: `route-line-${routeId}` };
}

function routeFeature(route: WalkingRoute): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: route.path.map(p => [p.lng, p.lat]),
    },
  };
}

// Draws (or updates) one parish's walking-route line. A 'direct' route
// (OSRM unreachable/timed out — see routing.ts) is dashed so it reads
// visually distinct from a real routed street path, matching the
// distance-panel label ("direct" vs a walking time).
function upsertRouteLayer(map: MapLibreMap, routeId: string, route: WalkingRoute, accentColor: string) {
  const { sourceId, layerId } = routeLineId(routeId);
  const data = routeFeature(route);
  const dasharray = route.kind === "direct" ? [2, 2] : [1, 0];

  const existingSource = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(sourceId, { type: "geojson", data });
  }

  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, "line-dasharray", dasharray);
  } else {
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": accentColor,
        "line-width": 3,
        "line-dasharray": dasharray,
      },
    });
  }
}

function removeRouteLayer(map: MapLibreMap, routeId: string) {
  const { sourceId, layerId } = routeLineId(routeId);
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

// Detects whether a request the browser attempted actually reached the
// tile host — being "online" per navigator.onLine but unable to resolve or
// reach the tile host (captive portal, DNS failure, firewalled venue
// Wi-Fi) is the more common failure in a defense room than a literal
// offline flag, so this is checked in addition to it, not instead of it.
function isTileHostError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(TILE_HOST) || /Failed to fetch|NetworkError|ERR_/.test(message);
}

export default function DioceseMapLive({ onSelectParish, heightPx, walkToParishId, onWalkToConsumed }: DioceseMapLiveProps) {
  const { position, accuracyMeters, simulation } = usePresence();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Parish markers keyed by parish id, so a search result can fly to and
  // open the matching pin's popup — mirrors the client's prototype, which
  // keeps the same lookup for the same reason.
  const markersRef = useRef<Map<string, MapLibreMarker>>(new Map());
  const youMarkerRef = useRef<MapLibreMarker | null>(null);
  // The rotating direction cone inside the "you are here" marker, held
  // directly so heading updates can be written to its style at sensor rate
  // without re-rendering this component.
  const youConeRef = useRef<HTMLDivElement | null>(null);
  // Where the marker currently *appears*, which lags the latest fix while
  // the ease runs — the start point for the next ease.
  const animatedPositionRef = useRef<Coordinates | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"loading" | "live" | "fallback">("loading");
  const [offlineFlagged, setOfflineFlagged] = useState(false);
  const [routes, setRoutes] = useState<Record<string, WalkingRoute>>({});
  const [query, setQuery] = useState("");
  // North-up by default, matching Google Maps: the map only starts turning
  // with the pilgrim once they ask it to.
  const [orientationMode, setOrientationMode] = useState<MapOrientationMode>("north-up");
  const { heading, status: headingStatus, requestPermission: requestHeadingPermission } = useDeviceHeading();
  // Held in a ref so the marker-building effect doesn't need `onSelectParish`
  // in its dependency array — App.tsx passes a fresh function each render,
  // and re-running that effect on every render would tear down and rebuild
  // every marker for no reason.
  const onSelectParishRef = useRef(onSelectParish);
  onSelectParishRef.current = onSelectParish;

  // Read by the popup's "Get directions" click handler, which is wired once
  // when markers are built (see the marker-building effect) and must always
  // see the pilgrim's *current* position, not whatever it was when the
  // popup happened to be constructed.
  const positionRef = useRef<Coordinates | null>(position);
  positionRef.current = position;

  // Invalidates an in-flight OSRM request when a newer "Get directions" tap
  // lands first, so a slow response can never overwrite a fresher route.
  const directionsRequestRef = useRef(0);

  // Fetches and draws the walking route to one live parish, for the popup's
  // "Get directions" button. This is the only path that ever draws a route
  // line — nothing is drawn merely because a position became known.
  function getDirectionsFor(
    routeId: string,
    coords: Coordinates,
    statusEl: HTMLParagraphElement,
    buttonEl: HTMLButtonElement,
  ) {
    const from = positionRef.current;
    const requestId = ++directionsRequestRef.current;
    buttonEl.disabled = true;
    statusEl.textContent = from
      ? "Finding a route…"
      : "Your position is unknown — enable GPS or the location simulator to get directions.";
    if (!from) {
      buttonEl.disabled = false;
      return;
    }

    getWalkingDirections(from, coords).then(result => {
      // A newer "Get directions" click (this parish or another) landed
      // first — this response is stale and must not clobber it.
      if (directionsRequestRef.current !== requestId) return;
      buttonEl.disabled = false;
      if (result.status === "no-position") return; // from was truthy above; unreachable, kept for type narrowing

      const { route, label } = result;
      const map = mapRef.current;
      if (map) {
        const accent = resolveColor("var(--color-brand-accent)");
        upsertRouteLayer(map, routeId, route, accent);
        setRoutes(prev => ({ ...prev, [routeId]: route }));
        const [first, ...rest] = route.path;
        const bounds = rest.reduce(
          (b, p) => b.extend([p.lng, p.lat]),
          new LngLatBounds([first.lng, first.lat], [first.lng, first.lat]),
        );
        map.fitBounds(bounds, { padding: 64, duration: 500 });
      }
      statusEl.textContent = label;
    });
  }

  const getDirectionsRef = useRef(getDirectionsFor);
  getDirectionsRef.current = getDirectionsFor;

  // Scored rather than filtered, and ranked against the pilgrim's own
  // position so "churches near me" can be answered with real distances and
  // equally-relevant names break ties by which is closer.
  const results = useMemo(
    () => searchParishesScored(query, SEARCHABLE_PARISHES, { origin: position }),
    [query, position?.lat, position?.lng],
  );

  // Falls back the instant the browser reports offline, even mid-session —
  // a live map needs network and this app must never be caught showing an
  // empty grey box because Wi-Fi dropped after the map had already loaded.
  useEffect(() => {
    const goOffline = () => {
      setOfflineFlagged(true);
      setMode("fallback");
    };
    window.addEventListener("offline", goOffline);
    if (!navigator.onLine) goOffline();
    return () => window.removeEventListener("offline", goOffline);
  }, []);

  useEffect(() => {
    if (mode === "fallback" || !containerRef.current) return;
    if (mapRef.current) return; // StrictMode double-invoke guard

    let cancelled = false;
    const toFallback = () => {
      if (cancelled) return;
      cancelled = true;
      setMode("fallback");
    };

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [DIOCESE_BOUNDS.lngMin + (DIOCESE_BOUNDS.lngMax - DIOCESE_BOUNDS.lngMin) / 2, 14.655],
      zoom: 12.3,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // MapLibre's error event fires for style/sprite/glyph/tile fetch
    // failures alike — this is the primary offline-detection path, since a
    // venue can be "online" (navigator.onLine === true) while unable to
    // reach the tile host specifically. A map that keeps erroring on every
    // frame (observed in one constrained test environment, where repeated
    // render-loop errors were frequent enough to starve the JS timer queue
    // and delay the setTimeout safety net below) is just as unusable as one
    // that never loads, so any error is also counted — several in quick
    // succession fall back even when the individual message doesn't name
    // the tile host. The counter check runs synchronously inside the event
    // handler itself, so it isn't subject to that same starvation risk.
    let errorCount = 0;
    map.on("error", e => {
      errorCount += 1;
      if (isTileHostError(e.error) || errorCount >= 3) toFallback();
    });

    // A render-loop failure inside MapLibre's own renderer can throw as a
    // plain uncaught exception rather than a MapLibre ErrorEvent (observed
    // in one constrained test environment lacking full WebGL/Worker
    // support), which map.on("error") above never sees. Falling back on
    // that too, rather than only on MapLibre's own event, is what keeps
    // this from ever being stuck rendering a broken canvas — the specific
    // failure mode matters less than "the map isn't usable, and we have a
    // known-good drawing to show instead".
    const isFromMapLibre = (stack: unknown) => typeof stack === "string" && stack.includes("maplibre-gl");
    const onWindowError = (e: ErrorEvent) => {
      if (e.filename?.includes("maplibre-gl") || isFromMapLibre(e.error?.stack)) {
        e.preventDefault(); // already switching to the known-good fallback; no need to also surface this in the console
        toFallback();
      }
    };
    // Some renderer failures surface as a rejected promise rather than a
    // thrown exception, which "error" above never sees.
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (isFromMapLibre(reason?.stack) || isFromMapLibre(String(reason))) {
        e.preventDefault();
        toFallback();
      }
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);

    const loadTimeout = window.setTimeout(toFallback, 8000);

    map.on("load", () => {
      window.clearTimeout(loadTimeout);
      if (cancelled) return;
      addScopePolygon(map, resolveColor("var(--color-brand-scope)"), resolveColor("var(--color-brand-scope)"));
      map.fitBounds(
        [
          [DIOCESE_BOUNDS.lngMin, DIOCESE_BOUNDS.latMin],
          [DIOCESE_BOUNDS.lngMax, DIOCESE_BOUNDS.latMax],
        ],
        { padding: 24, duration: 0 },
      );
      setMode("live");
    });

    return () => {
      cancelled = true;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(loadTimeout);
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      youMarkerRef.current?.remove();
      youMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "fallback"]);

  // Parish pins are built once, when the map finishes loading — unlike the
  // old dot markers, every pin here (including coming-soon ones) carries its
  // own popup, so there is nothing about a pin that needs to change when the
  // pilgrim's own GPS position updates. Rebuilding on every position tick
  // would also tear down any popup the pilgrim currently has open.
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== "live" || !map || markersRef.current.size > 0) return;

    for (const parish of PARISHES) {
      const routeId = LIVE_PARISH_TO_ROUTE_ID[parish.id];
      const isLive = parish.status === "live" && Boolean(routeId);
      const displayName = shortLabel(parish.name);

      const el = buildChurchPinElement({ name: displayName, isLive });
      const { el: card, action, directionsAction, directionsStatus } = buildPopupContent({
        name: displayName,
        location: vicariateLabel(parish.vicariate),
        isLive,
      });

      // MapLibre popups render *inside* the map container, which is
      // clipped by the canvas wrapper's overflow:hidden. Anchoring to
      // 'bottom' opens the card upward over the map instead of downward
      // past its edge.
      const popup = new Popup({
        anchor: "bottom",
        offset: isLive ? 20 : 14,
        closeButton: false,
        focusAfterOpen: false,
        maxWidth: "220px",
        className: "dmap-popup",
      }).setDOMContent(card);

      if (action && routeId) {
        action.addEventListener("click", () => onSelectParishRef.current(routeId));
      }
      if (directionsAction && directionsStatus && routeId) {
        directionsAction.addEventListener("click", () =>
          getDirectionsRef.current(routeId, parish.coordinates, directionsStatus, directionsAction),
        );
      }

      const lngLat: [number, number] = [parish.coordinates.lng, parish.coordinates.lat];

      // The map frame is short, so a pin near the top edge would have its
      // card clipped. Easing the pin below centre on open reserves room
      // above it.
      popup.on("open", () => {
        mapRef.current?.easeTo({ center: lngLat, offset: [0, 70], duration: 300 });
      });

      const marker = new MapLibreMarker({ element: el, anchor: "center" })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);
      markersRef.current.set(parish.id, marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // The pilgrim's own position gets its own marker, separate from the
  // parish pins above, so GPS updates only ever touch this one element
  // instead of rebuilding all 31 parish markers (and closing whatever
  // popup the pilgrim currently has open) on every tick.
  //
  // The marker is created once and then moved. An earlier version removed
  // and re-added it on every fix, which is what made the dot jump: each
  // update tore the element out of the DOM and dropped a new one at the new
  // coordinates, so there was nothing left to animate between.
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== "live" || !map) return;

    if (!position) {
      youMarkerRef.current?.remove();
      youMarkerRef.current = null;
      youConeRef.current = null;
      animatedPositionRef.current = null;
      return;
    }

    if (!youMarkerRef.current) {
      const you = document.createElement("div");
      you.className = "dmap-live__marker dmap-live__marker--you";
      you.title = "You are here";

      // The direction cone is a child rather than the marker element
      // itself, so heading rotation never fights MapLibre's own transform
      // on the marker (which positions it, and would be overwritten).
      const cone = document.createElement("div");
      cone.className = "dmap-live__cone";
      you.append(cone);
      youConeRef.current = cone;

      youMarkerRef.current = new MapLibreMarker({ element: you, anchor: "center" })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
      animatedPositionRef.current = position;
      return;
    }

    // Ease from wherever the marker currently is to the new fix, rather
    // than teleporting. GPS delivers a fix every second or so and each one
    // carries several metres of noise; without this the dot twitches
    // constantly even when the pilgrim is standing still.
    const marker = youMarkerRef.current;
    const from = animatedPositionRef.current ?? position;
    const to = position;

    if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current);

    // A large jump is a genuine relocation (first fix, or the simulator
    // being switched) rather than walking, and easing across a kilometre
    // looks like the map is flying somewhere. Snap those instead.
    if (haversineMeters(from, to) > MARKER_SNAP_METERS) {
      marker.setLngLat([to.lng, to.lat]);
      animatedPositionRef.current = to;
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / MARKER_EASE_MS);
      // easeOutQuad — quick off the mark, settling gently, which reads as
      // movement rather than as a slide.
      const eased = 1 - (1 - t) * (1 - t);
      const lat = from.lat + (to.lat - from.lat) * eased;
      const lng = from.lng + (to.lng - from.lng) * eased;
      marker.setLngLat([lng, lat]);
      animatedPositionRef.current = { lat, lng };
      moveFrameRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    moveFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (moveFrameRef.current !== null) {
        cancelAnimationFrame(moveFrameRef.current);
        moveFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, position?.lat, position?.lng]);

  // Points the direction cone. Written straight to the element's style
  // rather than through React, because heading updates arrive at sensor
  // rate and re-rendering the whole map component on each one would be its
  // own performance problem.
  useEffect(() => {
    const cone = youConeRef.current;
    if (!cone) return;
    if (heading === null) {
      // No heading is not the same as "facing north" — an arrow that
      // confidently points north on a device with no magnetometer is a lie.
      // Fall back to the plain dot instead.
      cone.style.opacity = "0";
      return;
    }
    cone.style.opacity = "1";
    // In heading-up mode the map is rotated to match the pilgrim, so the
    // cone must sit still at the top of the screen; in north-up the map is
    // fixed and the cone does the turning.
    cone.style.transform = `rotate(${orientationMode === "heading-up" ? 0 : heading}deg)`;
  }, [heading, orientationMode]);

  // Heading-up mode: the map turns so the way the pilgrim faces is up.
  //
  // MapLibre keeps point labels viewport-aligned by default and flips
  // street labels rather than letting them run upside-down, so place names
  // stay readable at any bearing without extra work here.
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== "live" || !map) return;

    if (orientationMode === "north-up") {
      if (Math.abs(map.getBearing()) > 0.5) map.easeTo({ bearing: 0, duration: 400 });
      return;
    }
    if (heading === null) return;

    // `heading` is already smoothed and deadbanded upstream, so this only
    // fires on real turns. easeTo's own interpolation then covers the gap
    // between updates, which is what keeps the rotation from stepping.
    if (Math.abs(shortestAngleDelta(map.getBearing(), heading)) < MAP_BEARING_EPSILON) return;
    map.easeTo({ bearing: heading, duration: 300, easing: t => t });
  }, [mode, heading, orientationMode]);

  // No route is drawn automatically. Directions appear only when the pilgrim
  // asks for them from a parish's popup — the same contract as Google Maps or
  // Waze, where turning location on shows you where you are and nothing more.
  // An earlier version quietly drew a line to every live parish the moment a
  // position was known, which read as the app having already decided where you
  // were going.

  // Dismisses a drawn route. Directions are a thing the pilgrim asked for,
  // so there has to be a way to take them back off the map without hunting
  // for the popup that produced them.
  function clearDirections() {
    const map = mapRef.current;
    directionsRequestRef.current++; // any in-flight response is now stale
    if (map) {
      for (const routeId of Object.keys(routes)) removeRouteLayer(map, routeId);
    }
    setRoutes({});
  }

  // Honours Home's "Walk there". Waits for `mode === "live"` because a route
  // layer cannot be added to a map that has not finished loading, and for a
  // position because a route needs somewhere to start.
  useEffect(() => {
    if (!walkToParishId || mode !== "live") return;
    const map = mapRef.current;
    const from = positionRef.current;
    const parish = PARISHES.find(p => p.id === walkToParishId);
    if (!map || !parish) return;
    if (!from) {
      // No fix yet — drop the request rather than holding it forever, since
      // the pilgrim is already looking at the map and can ask again.
      onWalkToConsumed?.();
      return;
    }

    let live = true;
    const requestId = ++directionsRequestRef.current;
    void getWalkingDirections(from, parish.coordinates).then(result => {
      if (!live || directionsRequestRef.current !== requestId) return;
      if (result.status === "no-position") return;
      const currentMap = mapRef.current;
      if (currentMap) {
        upsertRouteLayer(currentMap, parish.id, result.route, resolveColor("var(--color-brand-accent)"));
        setRoutes(prev => ({ ...prev, [parish.id]: result.route }));
        const [first, ...rest] = result.route.path;
        const bounds = rest.reduce(
          (b, pt) => b.extend([pt.lng, pt.lat]),
          new LngLatBounds([first.lng, first.lat], [first.lng, first.lat]),
        );
        currentMap.fitBounds(bounds, { padding: 64, duration: 500 });
      }
      onWalkToConsumed?.();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkToParishId, mode]);

  function recentreOnMe() {
    const map = mapRef.current;
    if (!map || !position) return;
    map.flyTo({ center: [position.lng, position.lat], zoom: Math.max(map.getZoom(), 15) });
  }

  // Selecting a search result flies to the parish and opens its card, so
  // search and tapping a pin directly end in exactly the same state —
  // including for coming-soon parishes, which never navigate.
  function selectSearchResult(parish: SearchParish) {
    const map = mapRef.current;
    const marker = markersRef.current.get(parish.id);
    if (!map || !marker) return;

    setQuery("");
    map.flyTo({
      center: marker.getLngLat(),
      zoom: 16,
      offset: [0, 70],
      duration: 800,
    });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }

  // Straight-line distance only, and labelled "direct" so it is never
  // mistaken for a walking distance. A real routed figure needs an OSRM
  // round-trip per parish, and firing those off just to populate a caption
  // is what used to draw an unasked-for line across the map.
  const distancePanel = (
    <div className="dmap-live__panel" data-testid="parish-distances">
      {LIVE_PARISHES.map(parish => {
        const straightLine = position ? haversineMeters(position, parish.coordinates) : null;
        const route = routes[parish.routeId];
        return (
          <div className="dmap-live__panel-row" key={parish.routeId}>
            <span className="dmap-live__panel-name">{shortLabel(parish.name)}</span>
            <span className="dmap-live__panel-distance">
              {route
                ? route.kind === "routed"
                  ? `${formatDistance(route.distanceMeters)} walk · ${formatWalkingMinutes(route.durationMinutes)}`
                  : `${formatDistance(route.distanceMeters)} direct (no route)`
                : straightLine === null
                  ? "Distance unknown"
                  : `${formatDistance(straightLine)} direct`}
            </span>
          </div>
        );
      })}
    </div>
  );

  // The scope-polygon caption only applies to the live MapLibre map (the
  // fallback is a separate hand-drawn illustration that never draws the
  // polygon), so it renders alongside the canvas, not in the fallback
  // branch below.
  const scopeLegend = (
    <p className="dmap-live__legend">
      <span className="dmap-live__legend-swatch" aria-hidden="true" />
      Shaded area marks the study/coverage area for this capstone.
    </p>
  );

  // With heightPx set, the map surface gets that fixed height directly and
  // the wrapper stops relying on flex-1/h-full against an ancestor's fixed
  // height — so the legend/link below it get their own natural height
  // instead of being squeezed out of a shared budget.
  const frameStyle = heightPx != null ? { height: heightPx } : undefined;
  const frameClassName = heightPx != null ? "dmap-live" : "dmap-live flex-1 min-h-0";
  const wrapClassName = heightPx != null ? "flex flex-col gap-2" : "flex flex-col gap-2 h-full min-h-0";

  if (mode === "fallback") {
    return (
      <div className={wrapClassName}>
        <div className={frameClassName} style={frameStyle} data-map-mode="fallback">
          {offlineFlagged && <div className="dmap-live__fallback-badge">Offline map</div>}
          <DioceseMap onSelectParish={onSelectParish} />
          {distancePanel}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClassName}>
      <div className={frameClassName} style={frameStyle} data-map-mode={mode}>
        <div ref={containerRef} className="dmap-live__canvas" role="img" aria-label="Map of the Diocese of Kalookan" />

        {/* Floating pill-shaped search bar, top-left, inset so it never
            overlaps the NavigationControl's zoom buttons (top-right). */}
        <div className="dmap-search">
          <svg className="dmap-search__icon" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="6" />
            <line x1="13.5" y1="13.5" x2="18" y2="18" />
          </svg>
          <input
            type="search"
            className="dmap-search__input"
            placeholder="Search parish or place"
            aria-label="Search parish or place"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {query.trim() !== "" && (
          <ul className="dmap-results">
            {results.length === 0 && <li className="dmap-results__empty">No parish found</li>}
            {results.map(({ parish, distanceMeters }) => (
              <li key={parish.id}>
                <button
                  type="button"
                  className="dmap-results__item"
                  onClick={() => selectSearchResult(parish)}
                >
                  <span className="dmap-results__name">{parish.name}</span>
                  <span className="dmap-results__where">
                    {/* Distance leads when it is known — it is the more
                        useful discriminator between two similarly-named
                        parishes, and the vicariate behind it is an inferred
                        guess, so it is labelled as one. */}
                    {distanceMeters !== null && (
                      <span className="dmap-results__distance">{formatDistance(distanceMeters)} away</span>
                    )}
                    {parish.location && <span>{parish.location} (unconfirmed)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <CompassControl
          heading={heading}
          status={headingStatus}
          mode={orientationMode}
          onToggleMode={() => setOrientationMode(m => (m === "north-up" ? "heading-up" : "north-up"))}
          onRequestPermission={() => void requestHeadingPermission()}
        />

        <button
          type="button"
          className="dmap-live__recentre"
          onClick={recentreOnMe}
          disabled={!position}
          title={
            !position
              ? "Your position is unknown — enable GPS or the location simulator"
              : simulation !== "off"
                ? "Recentre the map on your simulated position"
                : accuracyMeters != null
                  ? `Recentre the map on your position (accurate to ±${Math.round(accuracyMeters)} m)`
                  : "Recentre the map on your position"
          }
          aria-label="Recentre map on my location"
        >
          Recentre on me
        </button>

        {Object.keys(routes).length > 0 && (
          <button
            type="button"
            className="dmap-live__clear-route"
            onClick={clearDirections}
            aria-label="Clear directions from the map"
          >
            Clear directions
          </button>
        )}

        {/* Honest status for the you-are-here marker: a simulated position
            is clearly labelled as such (never mistaken for a real fix), and
            a real GPS fix shows its own reported accuracy radius rather than
            asserting a precise dot — wifi-based geolocation on a desktop is
            routinely only accurate to within a few hundred metres, and this
            says so instead of pretending otherwise. */}
        {position && (
          <div
            className={simulation !== "off" ? "dmap-live__position-badge dmap-live__position-badge--sim" : "dmap-live__position-badge"}
            data-testid="position-accuracy-badge"
          >
            {simulation !== "off" ? "Simulated location" : accuracyMeters != null ? `Accurate to ±${Math.round(accuracyMeters)} m` : "Accuracy unknown"}
          </div>
        )}
        {distancePanel}
      </div>
      {scopeLegend}
    </div>
  );
}
