import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doscientos Backoffice",
    short_name: "Doscientos",
    description: "CRM interno de doscientos · Leads, propuestas, facturas Verifactu.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#2a4227",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
