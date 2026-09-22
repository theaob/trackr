"use client";

import { useCallback, useRef, useState } from "react";

/**
 * The width an SVG chart should draw at, in CSS pixels.
 *
 * Charts use a viewBox and `w-full`, so a fixed viewBox width gets scaled to
 * the container: on a wide desktop a 680-wide chart became twice as tall and
 * its 10px labels became 20px. Drawing at the container's real width keeps
 * text and height at their designed size and spends the extra room on the
 * time axis instead. Below `baseWidth` the chart keeps scaling down as before,
 * so narrow screens are unchanged.
 *
 * Attach the returned ref to the element wrapping the <svg>.
 */
export function useChartWidth(baseWidth: number) {
  const [width, setWidth] = useState(baseWidth);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el) return;
      const update = () => setWidth(Math.max(baseWidth, Math.round(el.clientWidth)));
      update();
      if (typeof ResizeObserver === "undefined") return;
      observer.current = new ResizeObserver(update);
      observer.current.observe(el);
    },
    [baseWidth]
  );

  return [ref, width] as const;
}
