import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrackrLogo, TrackrLogoIcon } from "@/components/common/TrackrLogo";

describe("TrackrLogo", () => {
  it("renders animated logo by default", () => {
    const html = renderToStaticMarkup(React.createElement(TrackrLogo));
    expect(html).toContain("Trackr");
    expect(html).toContain("Project OS");
    expect(html).toContain("animateTransform");
    expect(html).toContain("<animate");
    expect(html).toContain("animate-ping");
  });

  it("renders static logo when animated is false", () => {
    const html = renderToStaticMarkup(React.createElement(TrackrLogo, { animated: false }));
    expect(html).toContain("Trackr");
    expect(html).not.toContain("animateTransform");
    expect(html).not.toContain("<animate");
    expect(html).not.toContain("animate-ping");
  });

  it("renders without text when showText is false", () => {
    const html = renderToStaticMarkup(React.createElement(TrackrLogo, { showText: false }));
    expect(html).not.toContain("Trackr");
    expect(html).not.toContain("Project OS");
  });

  it("handles different size presets", () => {
    const smHtml = renderToStaticMarkup(React.createElement(TrackrLogoIcon, { size: "sm" }));
    expect(smHtml).toContain('width="24"');
    expect(smHtml).toContain('height="24"');

    const mdHtml = renderToStaticMarkup(React.createElement(TrackrLogoIcon, { size: "md" }));
    expect(mdHtml).toContain('width="32"');
    expect(mdHtml).toContain('height="32"');

    const lgHtml = renderToStaticMarkup(React.createElement(TrackrLogoIcon, { size: "lg" }));
    expect(lgHtml).toContain('width="40"');
    expect(lgHtml).toContain('height="40"');

    const customHtml = renderToStaticMarkup(React.createElement(TrackrLogoIcon, { size: 48 }));
    expect(customHtml).toContain('width="48"');
    expect(customHtml).toContain('height="48"');
  });

  it("supports custom idPrefix to isolate SVG IDs", () => {
    const html = renderToStaticMarkup(React.createElement(TrackrLogoIcon, { idPrefix: "custom-prefix" }));
    expect(html).toContain("custom-prefix-bg");
    expect(html).toContain("custom-prefix-accent");
    expect(html).toContain("custom-prefix-shimmer");
  });
});
