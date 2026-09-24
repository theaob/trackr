/**
 * Writes every app icon from the one drawing in src/lib/logo.ts:
 *
 *   src/app/icon.svg            favicon (Next serves it and links it)
 *   src/app/apple-icon.png      180 px home-screen icon, square: iOS rounds it
 *   public/icon-512.png         512 px install icon with rounded corners
 *   public/icon-maskable-512.png 512 px, full bleed, glyph inside the safe zone
 *
 * The outputs are committed. Run after changing the logo:
 *   npx tsx scripts/generate-icons.ts
 */
import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";
import { logoSvg } from "../src/lib/logo";

const root = path.resolve(__dirname, "..");

async function main() {
  fs.writeFileSync(path.join(root, "src/app/icon.svg"), logoSvg() + "\n");

  const pngs: { file: string; size: number; svg: string }[] = [
    { file: "src/app/apple-icon.png", size: 180, svg: logoSvg({ size: 180, rounded: false }) },
    { file: "public/icon-512.png", size: 512, svg: logoSvg({ size: 512 }) },
    // Android crops maskable icons to as little as a circle 80% across.
    { file: "public/icon-maskable-512.png", size: 512, svg: logoSvg({ size: 512, rounded: false, inset: 0.8 }) },
  ];

  const browser = await chromium.launch();
  try {
    for (const { file, size, svg } of pngs) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      await page.locator("svg").screenshot({ path: path.join(root, file), omitBackground: true });
      await page.close();
      console.log(`wrote ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
