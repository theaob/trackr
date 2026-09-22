import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
  plugins: [],
};
export default config;
