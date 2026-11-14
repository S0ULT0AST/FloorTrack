import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FloorTrack",
    short_name: "FloorTrack",
    description: "Floor inventory for appliance stores.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#101318",
    theme_color: "#101318",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
