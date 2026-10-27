import { useId, useMemo, useState } from "react";

import type { MonthlyUsers } from "../lib/pageEvents";

/**
 * Monthly active users, as a line.
 *
 * ## Why hand-drawn SVG and not a charting library
 *
 * One line over at most a couple of dozen points. Recharts and its
 * peers are several hundred kilobytes to a parish on mobile data, for
 * a shape that is a polyline and some text. The app already draws its
 * bar charts this way.
 *
 * ## What the line means
 *
 * Distinct people who opened the app in each calendar month - not
 * registrations, and not cumulative. See lib/pageEvents.monthlyActiveUsers.
 *
 * ## Reading it on a phone
 *
 * The viewBox scales, so the drawing is resolution-independent, but
 * labels do not: twenty-four months of "Nov 2026" on a 360px screen
 * is a smear. Only a handful are labelled, chosen by spacing, and the
 * rest are reachable by tapping a point.
 */
export default function UsersOverTime({ data }: { data: MonthlyUsers[] }) {
  const titleId = useId();
  const [picked, setPicked] = useState<number | null>(null);

  // A chart of one point is a dot with no line through it, which reads
  // as a fault rather than as "one month so far".
  if (data.length === 0) {
    return (
      <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
        No usage recorded yet. This fills in as people open SanctiWalk — one
        point per month, counting how many different people opened it.
      </p>
    );
  }

  if (data.length === 1) {
    const only = data[0];
    return (
      <p className="text-[15px] leading-relaxed text-[var(--color-brand-text)]">
        <strong className="text-[22px] tabular-nums">{only.users}</strong>{" "}
        {only.users === 1 ? "person" : "people"} opened SanctiWalk in{" "}
        {only.label}. The chart appears once there is a second month to
        compare it with.
      </p>
    );
  }

  const W = 720;
  const H = 260;
  const PAD = { top: 16, right: 16, bottom: 44, left: 44 };

  const geometry = useMemo(() => {
    const peak = Math.max(...data.map(d => d.users), 1);
    // A round ceiling, so the gridline labels are whole numbers people
    // can read rather than 37.333.
    const step = Math.max(1, Math.ceil(peak / 4));
    const ceiling = step * 4;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / ceiling) * innerH;

    return {
      ceiling,
      step,
      x,
      y,
      points: data.map((d, i) => ({ ...d, cx: x(i), cy: y(d.users) })),
    };
  }, [data]);

  // Label roughly six months, whatever the range, so they never collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  const line = geometry.points.map(p => `${p.cx},${p.cy}`).join(" ");
  const shown = picked === null ? geometry.points[geometry.points.length - 1] : geometry.points[picked];

  return (
    <div>
      <p className="mb-2 text-[14px] text-[var(--color-brand-secondary)]">
        <strong className="text-[var(--color-brand-text)]">{shown.users}</strong>
        {" "}{shown.users === 1 ? "person" : "people"} in {shown.label}
        {picked === null && " (most recent)"}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-labelledby={titleId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>
          People who opened SanctiWalk each month, from {data[0].label} to{" "}
          {data[data.length - 1].label}.
        </title>

        {/* Gridlines and the count axis. */}
        {[0, 1, 2, 3, 4].map(n => {
          const value = geometry.step * n;
          const yy = geometry.y(value);
          return (
            <g key={n}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={yy} y2={yy}
                stroke="var(--color-brand-border)" strokeWidth={1}
              />
              <text
                x={PAD.left - 8} y={yy + 4} textAnchor="end"
                fontSize={13} fill="var(--color-brand-secondary)"
              >
                {value}
              </text>
            </g>
          );
        })}

        <polyline
          points={line}
          fill="none"
          stroke="var(--color-brand-primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {geometry.points.map((p, i) => (
          <g key={p.month}>
            {/* A generous invisible target: the dot itself is 4px and
                a fingertip is nearer 40. */}
            <circle
              cx={p.cx} cy={p.cy} r={18} fill="transparent"
              onClick={() => setPicked(i)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${p.label}: ${p.users}`}</title>
            </circle>
            <circle
              cx={p.cx} cy={p.cy}
              r={picked === i ? 6 : 4}
              fill="var(--color-brand-primary)"
            />
            {(i % labelEvery === 0 || i === data.length - 1) && (
              <text
                x={p.cx} y={H - 16} textAnchor="middle"
                fontSize={13} fill="var(--color-brand-secondary)"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
