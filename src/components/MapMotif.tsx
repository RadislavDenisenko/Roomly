"use client";

/**
 * MapMotif — a small library of reusable "treasure-map dotted-line" visuals,
 * styled CLEAN + MODERN to match Roomly's fuchsia→violet brand.
 *
 * Pure SVG + CSS. No npm deps, no images, no globals.css changes.
 * All class/keyframe names are prefixed `mm-`. Animations respect
 * `prefers-reduced-motion: reduce`.
 *
 * Usage:
 *
 *   import { DottedTrail, RoutePin, TrailDivider } from "@/components/MapMotif";
 *
 *   // An animated dashed route that draws in + marches along, full-width:
 *   <DottedTrail variant="wave" height={96} className="my-4" />
 *
 *   // A bobbing map pin with a soft pulsing ring:
 *   <RoutePin label="Your place" />
 *   <RoutePin color="#c026d3" size={36} />
 *
 *   // A divider between page sections:
 *   <TrailDivider variant="arc" />
 */

import type { CSSProperties } from "react";

/* -------------------------------------------------------------------------- */
/*  One-time style injection                                                  */
/* -------------------------------------------------------------------------- */

const MM_STYLE_ID = "mm-motif-styles";

const MM_CSS = `
.mm-trail-draw {
  stroke-dasharray: var(--mm-len, 2000);
  stroke-dashoffset: var(--mm-len, 2000);
  animation: mm-draw 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.mm-trail-march {
  animation: mm-march 18s linear infinite;
}
.mm-pin-bob {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: mm-bob 2.6s ease-in-out infinite;
}
.mm-pin-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: mm-pulse 2.6s ease-out infinite;
}

@keyframes mm-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes mm-march {
  to { stroke-dashoffset: -100; }
}
@keyframes mm-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes mm-pulse {
  0%   { transform: scale(0.7); opacity: 0.55; }
  70%  { transform: scale(1.9); opacity: 0; }
  100% { transform: scale(1.9); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .mm-trail-draw {
    animation: none;
    stroke-dashoffset: 0;
  }
  .mm-trail-march,
  .mm-pin-bob,
  .mm-pin-ring {
    animation: none;
  }
}
`;

/**
 * Renders the shared stylesheet exactly once per document. On the server every
 * instance emits the <style>; in the browser we mark the document so repeated
 * mounts don't duplicate it. React de-dupes identical adjacent <style> nodes by
 * id well enough that this stays harmless if it ever slips through.
 */
function MotifStyles() {
  if (typeof document !== "undefined") {
    if (document.getElementById(MM_STYLE_ID)) return null;
  }
  return <style id={MM_STYLE_ID} dangerouslySetInnerHTML={{ __html: MM_CSS }} />;
}

/* -------------------------------------------------------------------------- */
/*  DottedTrail                                                               */
/* -------------------------------------------------------------------------- */

type TrailVariant = "wave" | "arc" | "zigzag";

const TRAIL_PATHS: Record<TrailVariant, string> = {
  // Gentle sine-like wave across the full width.
  wave: "M 10 70 C 170 10, 330 10, 500 50 S 830 90, 990 30",
  // A single sweeping arc.
  arc: "M 10 85 Q 500 -25, 990 85",
  // Angular, hand-drawn-route feel.
  zigzag: "M 10 80 L 200 25 L 380 75 L 560 25 L 740 75 L 990 30",
};

export interface DottedTrailProps {
  className?: string;
  /** Stroke color for the dashed route. Defaults to brand violet. */
  color?: string;
  /** Rendered pixel height of the SVG. Defaults to 80. */
  height?: number;
  /** Which built-in path shape to draw. Defaults to "wave". */
  variant?: TrailVariant;
}

export function DottedTrail({
  className,
  color = "#7c3aed",
  height = 80,
  variant = "wave",
}: DottedTrailProps) {
  const d = TRAIL_PATHS[variant];

  return (
    <>
      <MotifStyles />
      <svg
        className={className}
        width="100%"
        height={height}
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Faint base path so the route reads even before/under the dashes. */}
        <path
          d={d}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeOpacity={0.14}
        />
        {/* Marching dashes that also "draw in" on mount. */}
        <path
          className="mm-trail-draw mm-trail-march"
          d={d}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="2 18"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  RoutePin                                                                  */
/* -------------------------------------------------------------------------- */

export interface RoutePinProps {
  /** Optional text shown beside the pin. */
  label?: string;
  /** Pin fill color. Defaults to brand violet. */
  color?: string;
  /** Pin glyph size in pixels. Defaults to 28. */
  size?: number;
}

export function RoutePin({ label, color = "#7c3aed", size = 28 }: RoutePinProps) {
  const ringStyle: CSSProperties = { color };

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <MotifStyles />
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 36"
        fill="none"
        aria-hidden={label ? undefined : "true"}
        role={label ? "img" : undefined}
        aria-label={label || undefined}
        focusable="false"
        style={{ display: "block", overflow: "visible", color }}
      >
        {/* Soft pulsing ring radiating from the pin tip. */}
        <circle
          className="mm-pin-ring"
          cx="16"
          cy="33"
          r="4"
          fill="currentColor"
          style={ringStyle}
        />
        <g className="mm-pin-bob">
          {/* Pin body. */}
          <path
            d="M16 1.5c-6.6 0-12 5.2-12 11.7 0 8.4 10.6 18.4 11.1 18.8a1.3 1.3 0 0 0 1.8 0c.5-.4 11.1-10.4 11.1-18.8 0-6.5-5.4-11.7-12-11.7Z"
            fill={color}
          />
          {/* Inner dot. */}
          <circle cx="16" cy="13" r="4.4" fill="#ffffff" fillOpacity={0.92} />
        </g>
      </svg>
      {label ? (
        <span
          style={{ fontSize: 14, fontWeight: 600, lineHeight: 1, color }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  TrailDivider                                                              */
/* -------------------------------------------------------------------------- */

export interface TrailDividerProps {
  className?: string;
  /** Path shape passed through to the inner DottedTrail. Defaults to "wave". */
  variant?: TrailVariant;
  /** Trail color. Defaults to brand violet. */
  color?: string;
  /** Trail height. Defaults to 64. */
  height?: number;
}

export function TrailDivider({
  className,
  variant = "wave",
  color = "#7c3aed",
  height = 64,
}: TrailDividerProps) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ width: "100%", display: "flex", justifyContent: "center" }}
    >
      <div style={{ width: "100%", maxWidth: 640 }}>
        <DottedTrail variant={variant} color={color} height={height} />
      </div>
    </div>
  );
}
