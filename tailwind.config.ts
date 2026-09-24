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
      },
      colors: {
        // Semantic tokens (see globals.css). New code uses these; the jira-*
        // palette below is retired screen by screen as each one is redesigned.
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
        jira: {
          blue: {
            DEFAULT: "#0052CC",
            hover: "#0747A6",
            light: "#DEEBFF",
            subtle: "#E9F2FF",
          },
          navy: "#172B4D",
          green: "#00875A",
          red: "#DE350B",
          yellow: "#FFAB00",
          gray: {
            50: "#FAFBFC",
            100: "#F4F5F7",
            200: "#EBECF0",
            300: "#DFE1E6",
            400: "#C1C7D0",
            // 500 and 600 are text greys. Darkened from Atlassian's #8993A4
            // and #6B778C (3.1:1 and 4.5:1 on white) so secondary text meets
            // 4.5:1 on every light surface the app uses, the blue ones included.
            500: "#5A677D",
            600: "#505E75",
            700: "#5E6C84",
            800: "#42526E",
            900: "#172B4D",
          },
          status: {
            backlog: "#DFE1E6",
            todo: "#DFE1E6",
            inprogress: "#0052CC",
            inreview: "#8F44FD",
            done: "#00875A",
          }
        },
      },
    },
  },
  plugins: [animate],
};
export default config;
