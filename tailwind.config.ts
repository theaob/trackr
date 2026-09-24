import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";

// A design token from globals.css, with Tailwind's opacity modifier support.
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  // All of src: class names also live in hooks, context and lib (role badges,
  // shortcut hints), and anything outside these globs silently gets no CSS.
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Sizes the components use that Tailwind 3 lacks (they're Tailwind 4's
      // scale). Without these the classes silently produce no CSS.
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        "2xs": "0 1px rgb(0 0 0 / 0.05)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
      blur: {
        "2xs": "2px",
        xs: "4px",
      },
      borderRadius: {
        xs: "0.125rem",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        dialog: "var(--radius-dialog)",
      },
      spacing: {
        "4.5": "1.125rem",
        // Density tokens (globals.css): smaller under data-density="compact".
        row: "var(--row)",
        "row-tight": "var(--row-tight)",
        "list-row": "var(--list-row)",
        "card-x": "var(--card-x)",
        "card-y": "var(--card-y)",
      },
      colors: {
        // Semantic tokens (see globals.css): components ask for a role, never a hex value.
        page: token("page"),
        surface: { DEFAULT: token("surface"), sunk: token("surface-sunk") },
        subtle: token("border"),
        strong: token("border-strong"),
        ink: { DEFAULT: token("ink"), 2: token("ink-2") },
        muted: token("muted"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          soft: token("accent-soft"),
          fg: token("on-accent"),
        },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft") },
        success: { DEFAULT: token("success"), soft: token("success-soft") },
        warning: { DEFAULT: token("warning"), soft: token("warning-soft") },
        check: token("check"),
        epic: { DEFAULT: token("epic"), soft: token("epic-soft") },
        series: { 1: token("series-1"), "1-soft": token("series-1-soft"), 2: token("series-2"), 3: token("series-3") },
      },
    },
  },
  plugins: [animate],
};
export default config;
