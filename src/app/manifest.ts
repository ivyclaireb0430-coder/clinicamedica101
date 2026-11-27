import type { MetadataRoute } from "next";

// Lets staff "Add to Home Screen" with the clinic logo as the app icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clinica Medica 101",
    short_name: "CM 101",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#24745e",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
