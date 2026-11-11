import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents dimatikan karena route memakai render dinamis
  // (perhitungan denda bergantung waktu sekarang).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Sampul buku berasal dari Open Library dan arsip Internet Archive. Host
    // itu harus terdaftar agar next/image boleh mengoptimasi (resize + format
    // modern) sampulnya; tanpa ini optimizer menolak URL luar tersebut.
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "**.archive.org" },
    ],
  },
};

export default nextConfig;
