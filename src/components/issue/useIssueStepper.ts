"use client";

import type { Issue } from "@/types";
import type { IssueNavigation } from "./IssueView";

/** "3 of 6" and previous/next for an issue opened from a list, or nothing if it isn't in it. */
export function useIssueStepper(current: Issue | null, list: Issue[], onStep: (issue: Issue) => void): IssueNavigation | undefined {
  if (!current || list.length < 2) return undefined;
  const index = list.findIndex((i) => i.id === current.id);
  if (index < 0) return undefined;
  const prev = list[index - 1];
  const next = list[index + 1];
  return {
    index,
    total: list.length,
    prevKey: prev?.key,
    nextKey: next?.key,
    onPrev: prev ? () => onStep(prev) : undefined,
    onNext: next ? () => onStep(next) : undefined,
  };
}
