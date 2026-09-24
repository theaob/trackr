import { afterEach, vi } from "vitest";

// next/font is compiled away by Next; outside it the loaders don't exist.
// Tests that import the root layout get an empty stand-in.
vi.mock("next/font/google", () => {
  const font = () => ({ className: "", variable: "", style: { fontFamily: "sans-serif" } });
  return { IBM_Plex_Sans: font, IBM_Plex_Mono: font };
});

// Only the jsdom tests need the rest: node tests have no window.
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());

  // What Radix expects of a browser that jsdom doesn't provide.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
