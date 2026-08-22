import { usePresence } from "../context/PresenceContext";
import { projectToMap, DIOCESE_BOUNDS } from "../lib/project";
import { ROUTES } from "../data";

const WIDTH = 300;
const HEIGHT = 400;

interface DioceseMapProps {
  onSelectParish: (parishId: string) => void;
}

// A tiny hand-drawn church glyph: a square body, a triangular roof, and a
// cross above it. `scale` shrinks the whole glyph for coming-soon pins. No
// fill/stroke are set on the children — they inherit from the parent <g>'s
// class (`.dmap__pin--live` / `.dmap__pin--soon`), which is how this stays
// token-only without repeating colours per shape.
function ChurchGlyph({ scale = 1 }: { scale?: number }) {
  return (
    <>
      <rect x={-5 * scale} y={-2 * scale} width={10 * scale} height={8 * scale} rx={1 * scale} />
      <polygon points={`${-6 * scale},${-2 * scale} 0,${-10 * scale} ${6 * scale},${-2 * scale}`} />
      <line x1="0" y1={-10 * scale} x2="0" y2={-14 * scale} strokeWidth={1.5 * scale} />
      <line
        x1={-2.5 * scale}
        y1={-12 * scale}
        x2={2.5 * scale}
        y2={-12 * scale}
        strokeWidth={1.5 * scale}
      />
    </>
  );
}

// Drop trailing " Guide"/" Tour"/" Parish" wording so labels fit the
// 300-unit-wide frame — matches the trimming App.tsx already does elsewhere
// for the same names.
function shortLabel(name: string): string {
  return name.replace(/ Guide$/, "").replace(/ Tour$/, "").replace(/ Parish$/, "");
}

// The map is displayed inside a height-capped card, so the SVG is scaled
// down from its 300x400 viewBox on screen. Text set in the SVG's own
// coordinate system scales down with it, so to keep the *rendered* text at
// or above the 14px floor at the narrowest supported viewport, the nominal
// font-size (set in index.css) is inflated well past 14. A single line of a
// full parish name no longer fits at that size, so names wrap onto at most
// two lines instead of shrinking below the floor.
const LINE_HEIGHT = 24;

// Split a label into at most two roughly-balanced lines, breaking on the
// word boundary that minimises the length difference between the lines.
function wrapLabel(name: string): string[] {
  const clean = shortLabel(name);
  const words = clean.split(" ");
  if (words.length <= 1) return [clean];

  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(" ");
    const line2 = words.slice(i).join(" ");
    const diff = Math.abs(line1.length - line2.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
}

// Renders a (possibly two-line) pin label. `anchorAbove` stacks the lines
// upward from just above the pin instead of downward from just below it,
// which is how nearby live pins avoid colliding.
function PinLabel({
  x,
  y,
  name,
  anchorAbove = false,
}: {
  x: number;
  y: number;
  name: string;
  anchorAbove?: boolean;
}) {
  const lines = wrapLabel(name);
  const startY = anchorAbove ? y - 18 - LINE_HEIGHT * (lines.length - 1) : y + 26;
  return (
    <text x={x} y={startY} className="dmap__pin-label">
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// The diocese-level map shown before a parish is chosen. A geographically
// calibrated illustration (not a street map — see the plan for why), with
// both parishes plotted at their real projected positions and the pilgrim's
// own position when known. This is a different feature from `MapTab`, which
// is a walking tour of stations *inside* one already-selected church.
export default function DioceseMap({ onSelectParish }: DioceseMapProps) {
  const { position } = usePresence();

  const live = ROUTES.filter(r => r.status === "live");
  const comingSoon = ROUTES.filter(r => r.status === "coming_soon");

  const you = projectToMap(position, DIOCESE_BOUNDS, WIDTH, HEIGHT);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      className="dmap rounded-2xl"
    >
      <title>Map of the Diocese of Kalookan</title>

      {/* Manila Bay along the west edge */}
      <rect x="0" y="0" width="58" height="400" rx="28" ry="60" className="dmap__water" />

      {/* Three land areas — suggestive shapes, not a traced coastline */}
      <rect x="55" y="15" width="200" height="195" rx="55" className="dmap__land" />
      <rect x="38" y="225" width="130" height="175" rx="50" className="dmap__land" />
      <rect x="150" y="70" width="145" height="320" rx="45" className="dmap__land" />

      {/* Tullahan river, dividing Malabon from Caloocan */}
      <path
        d="M148,10 Q168,90 142,170 Q116,250 152,330 Q176,375 166,400"
        className="dmap__river"
        strokeWidth="3"
      />

      {/* A few arterial roads, for orientation only */}
      <path d="M60,340 L280,120" className="dmap__road" strokeWidth="2" />
      <path d="M70,55 L235,375" className="dmap__road" strokeWidth="2" />
      <path d="M20,150 L292,210" className="dmap__road" strokeWidth="2" />

      <text x="118" y="48" className="dmap__area-label">MALABON</text>
      {/* Nudged up from the land shape's visual centre so it clears Mary
          Help of Christians' pin label below it — measured with getBBox()
          (see Task 9 report). */}
      {/* Moved 298 -> 248 after Mary Help's coordinates were corrected to the
          diocese's real value, which shifted its pin label up into this one.
          Measured collision was 34.9 x 20.4 units. */}
      <text x="103" y="248" className="dmap__area-label">NAVOTAS</text>
      <text x="225" y="100" className="dmap__area-label">CALOOCAN</text>

      {live.map((route, i) => {
        if (!route.coordinates) return null;
        const p = projectToMap(route.coordinates, DIOCESE_BOUNDS, WIDTH, HEIGHT);
        if (!p) return null;
        // Alternate the label above/below the pin so nearby live pins never
        // collide with each other.
        const anchorAbove = i % 2 === 1;
        return (
          <g
            key={route.id}
            className="dmap__hit"
            role="button"
            tabIndex={0}
            aria-label={`Open ${shortLabel(route.name)}`}
            onClick={() => onSelectParish(route.id)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectParish(route.id);
              }
            }}
          >
            <g transform={`translate(${p.x},${p.y})`} className="dmap__pin--live">
              <ChurchGlyph scale={1} />
            </g>
            <PinLabel x={p.x} y={p.y} name={route.name} anchorAbove={anchorAbove} />
          </g>
        );
      })}

      {comingSoon.map(route => {
        if (!route.coordinates) return null;
        const p = projectToMap(route.coordinates, DIOCESE_BOUNDS, WIDTH, HEIGHT);
        if (!p) return null;
        return (
          <g key={route.id} transform={`translate(${p.x},${p.y})`} className="dmap__pin--soon">
            <title>{shortLabel(route.name)}</title>
            <ChurchGlyph scale={0.7} />
          </g>
        );
      })}

      {you && (
        <g>
          <circle cx={you.x} cy={you.y} r="8" className="dmap__you-ring" />
          <circle cx={you.x} cy={you.y} r="5" className="dmap__you" />
        </g>
      )}
    </svg>
  );
}
