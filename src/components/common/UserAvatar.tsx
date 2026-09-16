"use client";

import React from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface UserAvatarProps {
  user: {
    name: string;
    avatarUrl?: string | null;
  } | null | undefined;
  size?: AvatarSize;
  className?: string;
  showTooltip?: boolean;
  tooltipPrefix?: string;
}

const SIZE_MAP: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: "w-5 h-5", text: "text-[10px]" },
  sm: { container: "w-6 h-6", text: "text-[11px]" },
  md: { container: "w-7 h-7", text: "text-xs" },
  lg: { container: "w-8 h-8", text: "text-sm" },
  xl: { container: "w-10 h-10", text: "text-base" },
};

// Curated palette — visually distinct, accessible on white backgrounds
const AVATAR_COLORS = [
  { bg: "#1a73e8", text: "#ffffff" }, // Blue
  { bg: "#e8710a", text: "#ffffff" }, // Orange
  { bg: "#0b8043", text: "#ffffff" }, // Green
  { bg: "#c5221f", text: "#ffffff" }, // Red
  { bg: "#8430ce", text: "#ffffff" }, // Purple
  { bg: "#d93025", text: "#ffffff" }, // Coral
  { bg: "#1967d2", text: "#ffffff" }, // Royal Blue
  { bg: "#188038", text: "#ffffff" }, // Forest
  { bg: "#a142f4", text: "#ffffff" }, // Violet
  { bg: "#e37400", text: "#ffffff" }, // Amber
  { bg: "#007b83", text: "#ffffff" }, // Teal
  { bg: "#b5179e", text: "#ffffff" }, // Magenta
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit int
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || "?").toUpperCase();
}

export default function UserAvatar({
  user,
  size = "md",
  className = "",
  showTooltip = false,
  tooltipPrefix,
}: UserAvatarProps) {
  const sizeConfig = SIZE_MAP[size];
  const name = user?.name || "Unknown";
  const tooltipText = tooltipPrefix ? `${tooltipPrefix}: ${name}` : name;

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        title={showTooltip ? tooltipText : undefined}
        className={`${sizeConfig.container} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  const colorIndex = hashName(name) % AVATAR_COLORS.length;
  const color = AVATAR_COLORS[colorIndex];
  const initials = getInitials(name);

  return (
    <div
      title={showTooltip ? tooltipText : undefined}
      className={`${sizeConfig.container} rounded-full ${sizeConfig.text} font-bold flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {initials}
    </div>
  );
}
