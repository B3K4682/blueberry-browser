import React, { useId } from "react";

interface RitualTimelineProps {
  domains: string[];
  height?: number;
  showLabels?: boolean;
}

const PALETTE = [
  { bg: "#FECACA", fg: "#991B1B" },
  { bg: "#FDE68A", fg: "#92400E" },
  { bg: "#BBF7D0", fg: "#166534" },
  { bg: "#BFDBFE", fg: "#1E40AF" },
  { bg: "#DDD6FE", fg: "#5B21B6" },
  { bg: "#FBCFE8", fg: "#9D174D" },
  { bg: "#BAE6FD", fg: "#075985" },
  { bg: "#FED7AA", fg: "#9A3412" },
];

const VIEWBOX_W = 400;
const NODE_R = 11;
const TRACK_Y = 18;

function hashDomain(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarLetter(domain: string): string {
  return (domain.replace(/^www\./, "")[0] ?? "?").toUpperCase();
}

function prettyName(domain: string): string {
  return domain.replace(/^www\./, "");
}

function truncateLabel(s: string): string {
  return s.length > 12 ? `${s.slice(0, 11)}…` : s;
}

// SVG: circle nodes with letter avatars connected by smooth curves.
// Curves draw in via stroke-dasharray, nodes pop in sequentially.
export const RitualTimeline: React.FC<RitualTimelineProps> = ({
  domains,
  height = 64,
  showLabels = true,
}) => {
  const gradientId = useId();
  const n = domains.length;
  if (n === 0) return null;

  const padX = NODE_R + 8;
  const xs = domains.map((_, i) =>
    n === 1
      ? VIEWBOX_W / 2
      : padX + (i / (n - 1)) * (VIEWBOX_W - padX * 2)
  );

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={height}
      style={{ overflow: "visible", cursor: "default", userSelect: "none" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgb(96, 165, 250)" />
          <stop offset="100%" stopColor="rgb(59, 130, 246)" />
        </linearGradient>
      </defs>

      {xs.slice(0, -1).map((x1, i) => {
        const x2 = xs[i + 1];
        const cx1 = x1 + (x2 - x1) * 0.45;
        const cx2 = x1 + (x2 - x1) * 0.55;
        const d = `M ${x1} ${TRACK_Y} C ${cx1} ${TRACK_Y - 8}, ${cx2} ${
          TRACK_Y + 8
        }, ${x2} ${TRACK_Y}`;
        return (
          <path
            key={`p-${i}`}
            d={d}
            stroke={`url(#${gradientId})`}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="400"
            strokeDashoffset="400"
            style={{
              animation: "dash-in 600ms ease-out forwards",
              animationDelay: `${i * 80}ms`,
            }}
          />
        );
      })}

      {domains.map((domain, i) => {
        const palette = PALETTE[hashDomain(domain) % PALETTE.length];
        const cx = xs[i];
        return (
          <g key={`n-${i}`} transform={`translate(${cx} ${TRACK_Y})`}>
            <g
              style={{
                animation:
                  "node-in 360ms cubic-bezier(0.22,1,0.36,1) forwards",
                animationDelay: `${i * 80 + 120}ms`,
                opacity: 0,
                transformOrigin: "0 0",
              }}
            >
              <circle
                r={NODE_R}
                fill={palette.bg}
                stroke="white"
                strokeWidth={2}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fontWeight={700}
                fill={palette.fg}
              >
                {avatarLetter(domain)}
              </text>
              {showLabels && (
                <text
                  y={NODE_R + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgb(115,115,115)"
                >
                  {truncateLabel(prettyName(domain))}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
};
