"use client";

import { useLayoutEffect } from "react";

export default function ThemeInitializer() {
  useLayoutEffect(() => {
    try {
      const temaTersimpan = localStorage.getItem("tema-pustakaku");

      if (!temaTersimpan) return;

      const tema = JSON.parse(temaTersimpan);

      if (tema && typeof tema === "object") {
        const root = document.documentElement;

        if (typeof tema.warnaDasar === "string") {
          root.style.setProperty("--warna-dasar", tema.warnaDasar);
        }

        if (typeof tema.gradien === "string") {
          root.style.setProperty("--gradien-tema", tema.gradien);
        }
      }
    } catch (error) {
      console.error("Gagal memuat tema PustakaKu:", error);
    }
  }, []);

  return null;
}