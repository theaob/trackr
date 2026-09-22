import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  // All of src: class names also live in hooks, context and lib (role badges,
  // shortcut hints), and anything outside these globs silently gets no CSS.
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // Sizes the components use that Tailwind 3 lacks (they're Tailwind 4's
      // scale). Without these the classes silently produce no CSS.
      boxShadow: {
        "2xs": "0 1px rgb(0 0 0 / 0.05)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      blur: {
        "2xs": "2px",
        xs: "4px",
      },
      borderRadius: {
        xs: "0.125rem",
      },
      spacing: {
        "4.5": "1.125rem",
      },
      colors: {
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
            500: "#8993A4",
            600: "#6B778C",
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
