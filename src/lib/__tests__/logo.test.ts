import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrackrLogo, TrackrLogoIcon } from "@/components/common/TrackrLogo";
import { LOGO_COLORS, LOGO_PATHS, logoSvg } from "@/lib/logo";

describe("TrackrLogo", () => {
  it("shows the mark and the name, without the retired tagline", () => {
    const html = renderToStaticMarkup(React.createElement(TrackrLogo));
    expect(html).toContain("Trackr");
    expect(html).not.toContain("Project OS");
  });

  it("names the mark for screen readers only when the text is hidden", () => {
    const withText = renderToStaticMarkup(React.createElement(TrackrLogo));
    expect(withText).toContain('aria-hidden="true"');
    expect(withText).not.toContain('role="img"');

    const iconOnly = renderToStaticMarkup(React.createElement(TrackrLogo, { showText: false }));
    expect(iconOnly).toContain('role="img"');
    expect(iconOnly).toContain('aria-label="Trackr"');
    expect(iconOnly).not.toContain(">Trackr<");
  });

  it("handles different size presets", () => {
    for (const [size, px] of [["sm", 24], ["md", 32], ["lg", 40], [48, 48]] as const) {
      const html = renderToStaticMarkup(React.createElement(TrackrLogoIcon, { size }));
      expect(html).toContain(`width="${px}"`);
      expect(html).toContain(`height="${px}"`);
    }
  });

  it("draws the Check T: a white T and a green tick on a blue tile, no gradients or ids", () => {
    const html = renderToStaticMarkup(React.createElement(TrackrLogoIcon));
    expect(html).toContain(LOGO_COLORS.tile);
    expect(html).toContain(LOGO_COLORS.tick);
    expect(html).toContain(LOGO_PATHS.tick);
    expect(html).toContain(`${LOGO_PATHS.crossbar} ${LOGO_PATHS.stem}`);
    expect(html).not.toContain("Gradient");
    expect(html).not.toContain(" id=");
  });
});

describe("app icons", () => {
  it("icon.svg is generated from the same drawing as the React logo", () => {
    // Regenerate with: npx tsx scripts/generate-icons.ts
    const file = fs.readFileSync(path.resolve("src/app/icon.svg"), "utf8").trim();
    expect(file).toBe(logoSvg());
  });

  it("the PNG icons and the manifest's icons exist", () => {
    for (const file of ["src/app/apple-icon.png", "public/icon-512.png", "public/icon-maskable-512.png"]) {
      const bytes = fs.readFileSync(path.resolve(file));
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    }
  });

  it("insets the glyph for maskable icons without moving its centre", () => {
    const svg = logoSvg({ inset: 0.8, rounded: false });
    expect(svg).toContain('rx="0"');
    expect(svg).toContain('transform="translate(3.2 3.2) scale(0.8)"');
  });
});
