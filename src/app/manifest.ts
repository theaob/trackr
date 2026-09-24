import type { MetadataRoute } from "next";

// Lets browsers install Tamam as an app with the proper icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tamam",
    short_name: "Tamam",
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
