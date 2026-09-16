import React from "react";

interface TrackrLogoProps {
  size?: "sm" | "md" | "lg" | number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export function TrackrLogoIcon({ size = 32, className = "" }: { size?: number | string; className?: string }) {
  const pixelSize = typeof size === "number" ? size : size === "sm" ? 24 : size === "lg" ? 40 : 32;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Main Brand Gradient */}
        <linearGradient id="trackr-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC" />
          <stop offset="60%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Accent Glow for tracking velocity */}
        <linearGradient id="trackr-accent" x1="8" y1="8" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>

        {/* Inner shadow/bevel for depth */}
        <linearGradient id="trackr-bevel" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer rounded squircle container */}
      <rect width="32" height="32" rx="8" fill="url(#trackr-bg)" />
      <rect width="32" height="32" rx="8" fill="url(#trackr-bevel)" />

      {/* Trackr "T" Glyph: Top Agile Track (Horizontal Bar) */}
      <rect x="7" y="7" width="18" height="4.5" rx="2.25" fill="white" />

      {/* Vertical Agile Velocity Track (Stem of T) */}
      <rect x="13.75" y="10.5" width="4.5" height="13.5" rx="2.25" fill="white" />

      {/* Dynamic Velocity Tracking Chevron (pointing forward/upward) */}
      <path
        d="M20 15L23.5 18.5L20 22"
        stroke="url(#trackr-accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Subtle pulse radar / tracking point at the bottom */}
      <circle cx="16" cy="25.5" r="1.5" fill="#38BDF8" />
    </svg>
  );
}

export function TrackrLogo({
  size = "md",
  showText = true,
  className = "",
  textClassName = "",
}: TrackrLogoProps) {
  const iconSizes = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  const pixelSize = typeof size === "number" ? size : iconSizes[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <TrackrLogoIcon size={pixelSize} className="shadow-sm rounded-lg" />

      {showText && (
        <div className={`flex flex-col leading-none ${textClassName}`}>
          <div className="flex items-center">
            <span className="font-extrabold text-jira-navy tracking-tight text-lg">
              Trackr
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-jira-blue ml-0.5 animate-pulse" />
          </div>
          <span className="text-[10px] text-jira-gray-600 font-semibold tracking-wider uppercase">
            Project OS
          </span>
        </div>
      )}
    </div>
  );
}
