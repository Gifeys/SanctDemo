import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { usePresence } from "../context/PresenceContext";
import { DIOCESE_BOUNDS } from "../lib/project";
import parishData from "../data/diocese-parishes.json";
import DioceseMap from "./DioceseMap";

interface DioceseMapLiveProps {
  onSelectParish: (parishId: string) => void;
}

interface ParishRecord {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  status: "live" | "coming_soon";
}

const PARISHES = parishData.parishes as ParishRecord[];

// Free, keyless vector tiles — OpenFreeMap (openfreemap.org), an unlimited
// no-signup host of OpenMapTiles-schema data (MIT/ODbL). No API key, no
// billing account, nothing that can expire mid-defense — the client's own
// requirement, which is also why this isn't Google Maps or Mapbox (both
// need billing set up).
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const TILE_HOST = "tiles.openfreemap.org";

// diocese-parishes.json carries all 31 parishes, including the 2 that are
// already "live" in ROUTES (src/data.ts) — but under different ids
// (parish-mary-help-of-christians-parish / parish-san-roque-cathedral
// rather than route-mhcp / route-src). Tapping a live pin must open the
// tour via the route id App.tsx already wires up, so this maps the JSON id
// to the route id for just those two instead of drawing duplicate pins.
const LIVE_PARISH_TO_ROUTE_ID: Record<string, string> = {
  "parish-mary-help-of-christians-parish": "route-mhcp",
  "parish-san-roque-cathedral": "route-src",
};

// Reads a CSS custom property (optionally through a color-mix() expression,
// exactly like the ones already used in index.css for DioceseMap.tsx's SVG)
// by letting the browser resolve it on a detached element, rather than
// hardcoding any hex value here. MapLibre paint properties need a literal
// color string, not a live var() reference, so this is the runtime-read
// equivalent of what the SVG map does purely in CSS.
function resolveColor(expr: string): string {
  const probe = document.createElement("div");
  probe.style.color = expr;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved || "#151B53";
}

interface Tokens {
  land: string;
  water: string;
  road: string;
  roadCasing: string;
  roadLabel: string;
  placeLabel: string;
  waterLabel: string;
}

function readTokens(): Tokens {
  return {
    land: resolveColor("var(--color-brand-bg)"),
    water: resolveColor("color-mix(in srgb, var(--color-brand-accent) 30%, var(--color-brand-bg))"),
    road: resolveColor("color-mix(in srgb, var(--color-brand-card) 40%, transparent)"),
    roadCasing: resolveColor("color-mix(in srgb, var(--color-brand-bg) 55%, black)"),
    roadLabel: resolveColor("var(--color-brand-card)"),
    placeLabel: resolveColor("color-mix(in srgb, var(--color-brand-card) 85%, var(--color-brand-accent))"),
    waterLabel: resolveColor("color-mix(in srgb, var(--color-brand-card) 65%, var(--color-brand-accent))"),
  };
}

// Declutters the OpenFreeMap "liberty" (OpenMapTiles schema) style down to
// street geometry, water and the main road/place names, then restyles what
// remains to the app's dark-navy palette. This is what the client's
// complaint about the old OSM attempt ("not accurate", "hard to
// understand") was really about: raw OSM shows every shop, house number
// and bus stop. Hiding those, not swapping the map for a drawing, is the
// fix — matched to source-layer/id rather than one frozen layer list, so a
// future OpenFreeMap style update degrades gracefully instead of silently
// re-cluttering.
function declutterAndRestyle(map: MapLibreMap) {
  const tokens = readTokens();
  const style = map.getStyle();
  if (!style?.layers) return;

  const hide = (id: string) => map.setLayoutProperty(id, "visibility", "none");

  for (const layer of style.layers) {
    const id = layer.id;
    const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
    const type = layer.type;

    // Raster shaded-relief underlay: baked-in colours we can't restyle, so
    // hide it and let the recoloured vector background stand in for it.
    if (id === "natural_earth") {
      hide(id);
      continue;
    }
    if (id === "background") {
      map.setPaintProperty(id, "background-color", tokens.land);
      continue;
    }

    // POIs / business icons, buildings, landuse & landcover fills, parks,
    // aeroway, administrative boundaries — the exact clutter the client
    // rejected the old map for. None of it helps someone find a parish.
    if (
      sourceLayer === "poi" ||
      sourceLayer === "building" ||
      sourceLayer === "landuse" ||
      sourceLayer === "landcover" ||
      sourceLayer === "park" ||
      sourceLayer === "aeroway" ||
      sourceLayer === "aerodrome_label" ||
      sourceLayer === "boundary"
    ) {
      hide(id);
      continue;
    }

    if (sourceLayer === "water") {
      map.setPaintProperty(id, "fill-color", tokens.water);
      continue;
    }
    if (sourceLayer === "waterway") {
      map.setPaintProperty(id, "line-color", tokens.water);
      continue;
    }
    if (sourceLayer === "water_name") {
      map.setPaintProperty(id, "text-color", tokens.waterLabel);
      map.setPaintProperty(id, "text-halo-color", tokens.land);
      map.setLayoutProperty(id, "text-size", 14);
      continue;
    }

    if (sourceLayer === "transportation") {
      // Rail (incl. transit hatching), one-way arrows and the textured
      // road-area fill are transit/decoration, not street geometry.
      if (/rail/.test(id) || id === "road_one_way_arrow" || id === "road_one_way_arrow_opposite" || id === "road_area_pattern") {
        hide(id);
        continue;
      }
      if (type === "line") {
        const isCasing = id.includes("casing");
        map.setPaintProperty(id, "line-color", isCasing ? tokens.roadCasing : tokens.road);
      }
      continue;
    }

    if (sourceLayer === "transportation_name") {
      // Keep only the main road names; drop minor/path names and every
      // route-shield layer (the client explicitly asked shields gone).
      if (id === "highway-name-major") {
        map.setPaintProperty(id, "text-color", tokens.roadLabel);
        map.setPaintProperty(id, "text-halo-color", tokens.land);
        map.setLayoutProperty(id, "text-size", 14);
      } else {
        hide(id);
      }
      continue;
    }

    if (sourceLayer === "place") {
      // Village/"other" labels are barangay-level clutter; city/town names
      // are what actually orients a viewer across Caloocan/Malabon/Navotas.
      if (id === "label_village" || id === "label_other") {
        hide(id);
        continue;
      }
      map.setPaintProperty(id, "text-color", tokens.placeLabel);
      map.setPaintProperty(id, "text-halo-color", tokens.land);
      map.setLayoutProperty(id, "text-size", 14);
      continue;
    }
  }
}

function shortLabel(name: string): string {
  return name.replace(/ Guide$/, "").replace(/ Tour$/, "").replace(/ Parish$/, "");
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

export default function DioceseMapLive({ onSelectParish }: DioceseMapLiveProps) {
  const { position } = usePresence();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mode, setMode] = useState<"loading" | "live" | "fallback">("loading");
  const [offlineFlagged, setOfflineFlagged] = useState(false);

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
      declutterAndRestyle(map);
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
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "fallback"]);

  // Markers are (re)built whenever the map finishes loading or the
  // pilgrim's own position changes, so "you are here" tracks live GPS/sim
  // updates without tearing down the whole map.
  useEffect(() => {
    const map = mapRef.current;
    if (mode !== "live" || !map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    for (const parish of PARISHES) {
      const routeId = LIVE_PARISH_TO_ROUTE_ID[parish.id];
      const isLive = parish.status === "live" && routeId;

      const el = document.createElement(isLive ? "button" : "div");
      el.className = `dmap-live__marker ${isLive ? "dmap-live__marker--live" : "dmap-live__marker--soon"}`;
      el.title = shortLabel(parish.name);

      if (isLive) {
        const button = el as HTMLButtonElement;
        button.type = "button";
        button.setAttribute("aria-label", `Open ${shortLabel(parish.name)}`);
        button.addEventListener("click", () => onSelectParish(routeId));
      }

      const marker = new MapLibreMarker({ element: el, anchor: "center" })
        .setLngLat([parish.coordinates.lng, parish.coordinates.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }

    if (position) {
      const you = document.createElement("div");
      you.className = "dmap-live__marker dmap-live__marker--you";
      you.title = "You are here";
      const youMarker = new MapLibreMarker({ element: you, anchor: "center" })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
      markersRef.current.push(youMarker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, position?.lat, position?.lng]);

  if (mode === "fallback") {
    return (
      <div className="dmap-live" data-map-mode="fallback">
        {offlineFlagged && <div className="dmap-live__fallback-badge">Offline map</div>}
        <DioceseMap onSelectParish={onSelectParish} />
      </div>
    );
  }

  return (
    <div className="dmap-live" data-map-mode={mode}>
      <div ref={containerRef} className="dmap-live__canvas" role="img" aria-label="Map of the Diocese of Kalookan" />
    </div>
  );
}
