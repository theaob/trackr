import React from "react";
import {
  LOGO_COLORS,
  LOGO_PATHS,
  LOGO_STROKE_WIDTH,
  LOGO_TILE_RADIUS,
} from "@/lib/logo";

type LogoSize = "sm" | "md" | "lg" | number;

export interface TamamLogoIconProps {
  size?: LogoSize | string;
  className?: string;
  /** Names the mark for screen readers. Leave unset when a visible name sits beside it. */
  title?: string;
}

export interface TamamLogoProps {
  size?: LogoSize;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  interactive?: boolean;
}

const PRESET_SIZES = { sm: 24, md: 32, lg: 40 } as const;

function pixelSize(size: LogoSize | string): number {
  if (typeof size === "number") return size;
  if (size in PRESET_SIZES) return PRESET_SIZES[size as keyof typeof PRESET_SIZES];
  return parseInt(size, 10) || 32;
}

/** The Check T: three rounded strokes on a signal-blue tile. See src/lib/logo.ts. */
export function TamamLogoIcon({ size = 32, className = "", title }: TamamLogoIconProps) {
  const px = pixelSize(size);
  const stroke = {
    fill: "none",
    strokeWidth: LOGO_STROKE_WIDTH,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
    >
      <rect width="32" height="32" rx={LOGO_TILE_RADIUS} fill={LOGO_COLORS.tile} />
      <path d={`${LOGO_PATHS.crossbar} ${LOGO_PATHS.stem}`} stroke={LOGO_COLORS.ink} {...stroke} />
      <path d={LOGO_PATHS.tick} stroke={LOGO_COLORS.tick} {...stroke} />
    </svg>
  );
}

/** The mark and the wordmark, "tamam", always lowercase. In a sentence the name is "Tamam". */
export function TamamLogo({
  size = "md",
  showText = true,
  className = "",
  textClassName = "",
  interactive = true,
}: TamamLogoProps) {
  const px = pixelSize(size);

  return (
    <div
      className={`flex items-center gap-2 select-none ${interactive ? "group/logo cursor-pointer" : ""} ${className}`}
    >
      <TamamLogoIcon size={px} title={showText ? undefined : "Tamam"} />
      {showText && (
        <span
          className={`font-semibold tracking-tight text-ink leading-none ${
            px >= 40 ? "text-xl" : px >= 32 ? "text-lg" : "text-base"
          } ${interactive ? "transition-colors duration-150 group-hover/logo:text-accent" : ""} ${textClassName}`}
        >
          tamam
        </span>
      )}
    </div>
  );
}
