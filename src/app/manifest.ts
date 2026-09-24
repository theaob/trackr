import type { MetadataRoute } from "next";

// Lets browsers install Trackr as an app with the proper icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trackr",
    short_name: "Trackr",
    start_url: "/projects",
    display: "standalone",
    background_color: "#F7F8FA",
    theme_color: "#2F5BEA",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
