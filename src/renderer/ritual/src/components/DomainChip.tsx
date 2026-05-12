import React from "react";
import { cn } from "@common/lib/utils";

interface DomainChipProps {
  domain: string;
  size?: "sm" | "md";
  className?: string;
}

const PALETTE = [
  { bg: "#FEE2E2", fg: "#B91C1C" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#DCFCE7", fg: "#166534" },
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#E0F2FE", fg: "#075985" },
  { bg: "#FFEDD5", fg: "#9A3412" },
];

// Stable hash so the same domain always gets the same color.
function hashDomain(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Strip "www." and pick the first character for the avatar letter.
function avatarLetter(domain: string): string {
  const clean = domain.replace(/^www\./, "");
  return (clean[0] ?? "?").toUpperCase();
}

function prettyName(domain: string): string {
  return domain.replace(/^www\./, "");
}

export const DomainChip: React.FC<DomainChipProps> = ({
  domain,
  size = "md",
  className,
}) => {
  const palette = PALETTE[hashDomain(domain) % PALETTE.length];
  const isSm = size === "sm";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-white",
        "border-neutral-200 shadow-sm",
        isSm ? "px-2 py-1" : "px-2.5 py-1.5",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold",
          isSm ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[11px]"
        )}
        style={{ background: palette.bg, color: palette.fg }}
      >
        {avatarLetter(domain)}
      </span>
      <span
        className={cn(
          "truncate font-medium text-neutral-700",
          isSm ? "text-[11px]" : "text-xs"
        )}
        title={prettyName(domain)}
      >
        {prettyName(domain)}
      </span>
    </div>
  );
};
