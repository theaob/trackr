"use client";

import React, { createContext, useContext, useMemo } from "react";

// Status name -> the color set for it in the project's workflow.
const StatusColorsContext = createContext<ReadonlyMap<string, string> | null>(null);

/** Makes the project's workflow colors available to every status lozenge below it. */
export function StatusColorsProvider({
  statuses,
  children,
}: {
  statuses: { name: string; color: string }[];
  children: React.ReactNode;
}) {
  const colors = useMemo(() => new Map(statuses.map((s) => [s.name, s.color])), [statuses]);
  return <StatusColorsContext.Provider value={colors}>{children}</StatusColorsContext.Provider>;
}

/** The workflow color for a status, or undefined outside a project or for an unknown status. */
export function useStatusColor(status: string | null | undefined): string | undefined {
  const colors = useContext(StatusColorsContext);
  return status ? colors?.get(status) : undefined;
}
