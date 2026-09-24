/**
 * The Check T: a T whose stem sprouts a green tick, on a signal-blue tile.
 * One drawing on a 32-unit grid, used by the React logo, src/app/icon.svg and
 * the PNG app icons (scripts/generate-icons.mjs), so they can't drift apart.
 */

export const LOGO_COLORS = {
  tile: "#2F5BEA",
  ink: "#FFFFFF",
  /** Tamam green, on blue and dark tiles. */
  tick: "#4ADE80",
} as const;

export const LOGO_TILE_RADIUS = 8;
export const LOGO_STROKE_WIDTH = 4;

/** Crossbar, stem and tick, drawn as round-capped 4-unit strokes. */
export const LOGO_PATHS = {
  crossbar: "M9 9H23",
  stem: "M16 9V23",
  tick: "M16 19.4L19.2 22.6L25.4 16.4",
} as const;

/**
 * The mark as a standalone SVG document. `inset` shrinks the glyph towards the
 * centre, for maskable icons whose platform crops to a circle.
 */
export function logoSvg({ size = 32, inset = 1, rounded = true }: { size?: number; inset?: number; rounded?: boolean } = {}) {
  const radius = rounded ? LOGO_TILE_RADIUS : 0;
  const shift = Number((16 * (1 - inset)).toFixed(3));
  const glyph = inset === 1 ? "" : ` transform="translate(${shift} ${shift}) scale(${inset})"`;
  const stroke = `fill="none" stroke-width="${LOGO_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="${radius}" fill="${LOGO_COLORS.tile}"/>` +
    `<g${glyph}>` +
    `<path d="${LOGO_PATHS.crossbar} ${LOGO_PATHS.stem}" stroke="${LOGO_COLORS.ink}" ${stroke}/>` +
    `<path d="${LOGO_PATHS.tick}" stroke="${LOGO_COLORS.tick}" ${stroke}/>` +
    `</g></svg>`
  );
}
