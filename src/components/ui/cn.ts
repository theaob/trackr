import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's own scales; teach it the token names
// from tailwind.config.ts so `cn("rounded-control", "rounded-card")` keeps the last.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["control", "card", "dialog"] }],
      shadow: [{ shadow: ["raised", "overlay", "2xs", "xs"] }],
    },
  },
});

/** Joins class names, letting later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
