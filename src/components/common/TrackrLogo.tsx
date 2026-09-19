import React, { useId } from "react";

export interface TrackrLogoIconProps {
  size?: "sm" | "md" | "lg" | number | string;
  className?: string;
  animated?: boolean;
  interactive?: boolean;
  idPrefix?: string;
}

export interface TrackrLogoProps {
  size?: "sm" | "md" | "lg" | number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  animated?: boolean;
  interactive?: boolean;
}

export function TrackrLogoIcon({
  size = 32,
  className = "",
  animated = true,
  interactive = true,
  idPrefix,
}: TrackrLogoIconProps) {
  const reactId = useId();
  const id = idPrefix || `trackr-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 24
      : size === "lg"
      ? 40
      : size === "md"
      ? 32
      : parseInt(size, 10) || 32;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${
        interactive
          ? "transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-0.5"
          : ""
      } ${className}`}
    >
      <defs>
        {/* Main Brand Gradient */}
        <linearGradient
          id={`${id}-bg`}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0052CC" />
          <stop offset="60%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Accent Glow for tracking velocity */}
        <linearGradient
          id={`${id}-accent`}
          x1="8"
          y1="8"
          x2="26"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>

        {/* Inner shadow/bevel for depth */}
        <linearGradient
          id={`${id}-bevel`}
          x1="0"
          y1="0"
          x2="0"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Squircle Clip for Shimmer Effect */}
        <clipPath id={`${id}-clip`}>
          <rect width="32" height="32" rx="8" />
        </clipPath>

        {/* Shimmer Light Beam Gradient */}
        {animated && (
          <linearGradient id={`${id}-shimmer`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        )}
      </defs>

      {/* Outer rounded squircle container */}
      <rect width="32" height="32" rx="8" fill={`url(#${id}-bg)`} />
      <rect width="32" height="32" rx="8" fill={`url(#${id}-bevel)`} />

      {/* Dynamic Ambient Shimmer Sweep */}
      {animated && (
        <g clipPath={`url(#${id}-clip)`}>
          <g transform="rotate(25 16 16)">
            <rect
              x="-35"
              y="-15"
              width="14"
              height="62"
              fill={`url(#${id}-shimmer)`}
              opacity="0.35"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="-35 0; 52 0; 52 0"
                dur="4s"
                repeatCount="indefinite"
                keyTimes="0; 0.45; 1"
                calcMode="spline"
                keySplines="0.25 0.1 0.25 1; 0 0 1 1"
              />
            </rect>
          </g>
        </g>
      )}

      {/* Trackr "T" Glyph: Top Agile Track (Horizontal Bar) */}
      <rect x="7" y="7" width="18" height="4.5" rx="2.25" fill="white" />

      {/* Vertical Agile Velocity Track (Stem of T) */}
      <rect x="13.75" y="10.5" width="4.5" height="13.5" rx="2.25" fill="white" />

      {/* Velocity Tracking Chevrons */}
      <g className="trackr-chevron-group">
        {/* Echo velocity trail */}
        {animated && (
          <path
            d="M17.5 15.5L20.5 18.5L17.5 21.5"
            stroke={`url(#${id}-accent)`}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.35"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 1.5 0; 0 0"
              dur="2.4s"
              repeatCount="indefinite"
              keyTimes="0; 0.5; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          </path>
        )}

        {/* Lead Velocity Chevron */}
        <path
          d="M20 15L23.5 18.5L20 22"
          stroke={`url(#${id}-accent)`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        >
          {animated && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 2 0; 0 0"
              dur="2.4s"
              repeatCount="indefinite"
              keyTimes="0; 0.5; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
            />
          )}
        </path>
      </g>

      {/* Velocity Tracking Point */}
      <circle cx="16" cy="25.5" r="1.5" fill="#38BDF8" />
    </svg>
  );
}

export function TrackrLogo({
  size = "md",
  showText = true,
  className = "",
  textClassName = "",
  animated = true,
  interactive = true,
}: TrackrLogoProps) {
  const iconSizes = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  const pixelSize = typeof size === "number" ? size : iconSizes[size];

  return (
    <div
      className={`flex items-center gap-2.5 select-none ${
        interactive ? "group/logo cursor-pointer" : ""
      } ${className}`}
    >
      <TrackrLogoIcon
        size={pixelSize}
        animated={animated}
        interactive={interactive}
        className={`shadow-sm rounded-lg ${
          interactive
            ? "transition-all duration-300 group-hover/logo:scale-105 group-hover/logo:-translate-y-0.5 group-hover/logo:shadow-md group-hover/logo:shadow-jira-blue/20"
            : ""
        }`}
      />

      {showText && (
        <div className={`flex flex-col leading-none ${textClassName}`}>
          <div className="flex items-center">
            <span
              className={`font-extrabold text-jira-navy tracking-tight text-lg ${
                interactive
                  ? "transition-colors duration-200 group-hover/logo:text-jira-blue"
                  : ""
              }`}
            >
              Trackr
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-jira-blue ml-1" />
          </div>
          <span
            className={`text-[10px] text-jira-gray-600 font-semibold tracking-wider uppercase ${
              interactive
                ? "transition-colors duration-200 group-hover/logo:text-jira-navy"
                : ""
            }`}
          >
            Project OS
          </span>
        </div>
      )}
    </div>
  );
}
