"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import {
  SISTEM_DEFAULT,
  normalisasiSistem,
  sahkanSistem,
  type SistemPengaturan,
} from "./sistem-nilai";

// Pengaturan sistem perpustakaan — diatur admin di /admin/pengaturan.
// Nilai disimpan PERMANEN di database D1 (tabel `pengaturan`, lewat API
// /api/pengaturan) — bukan localStorage. Dibaca lewat useSyncExternalStore
// supaya aman terhadap hydration: render server & render pertama klien selalu
// memakai SISTEM_DEFAULT dengan referensi stabil, baru setelah fetch API
// berganti ke nilai tersimpan.

export type { SistemPengaturan };
export { SISTEM_DEFAULT, sahkanSistem };

// Snapshot untuk render server (referensi selalu sama).
const SNAPSHOT_SERVER: SistemPengaturan = SISTEM_DEFAULT;

let snapshot: SistemPengaturan = SISTEM_DEFAULT;
let diminta = false;
const pendengar = new Set<() => void>();

function beritahu() {
  pendengar.forEach((fn) => fn());
}

async function muatSistem() {
  if (diminta || typeof window === "undefined") return;
  diminta = true;
  try {
    const { pengaturan } = await apiFetch<{ pengaturan: unknown }>("/api/pengaturan");
    snapshot = normalisasiSistem(pengaturan);
    beritahu();
  } catch (e) {
    diminta = false;
    console.warn("Gagal memuat pengaturan sistem:", e);
  }
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);
  void muatSistem();
  return () => {
    pendengar.delete(kembali);
  };
}

function ambilSnapshot(): SistemPengaturan {
  return snapshot;
}

/** Baca pengaturan tersimpan dari luar React (mis. di dalam handler/context). */
export function ambilSistem(): SistemPengaturan {
  return typeof window === "undefined" ? SISTEM_DEFAULT : ambilSnapshot();
}

/**
 * Terapkan pengaturan tertentu TANPA menyimpan (pratinjau langsung di halaman
 * pengaturan; hilang saat reload bila tidak disimpan).
 */
export function terapkanSistem(partial: Partial<SistemPengaturan>) {
  if (typeof window === "undefined") return;
  snapshot = normalisasiSistem({ ...snapshot, ...partial });
  beritahu();
}

/**
 * Simpan pengaturan (persist ke DATABASE lewat API) dan terapkan ke semua
 * konsumen. Optimistik: nilai lokal langsung berubah, dibatalkan bila server
 * menolak.
 */
export function simpanSistem(s: SistemPengaturan) {
  if (typeof window === "undefined") return;
  const sebelum = snapshot;
  snapshot = normalisasiSistem(s);
  beritahu();
  void apiFetch("/api/pengaturan", { method: "PUT", body: { pengaturan: snapshot } }).catch(
    async (e) => {
      snapshot = sebelum;
      beritahu();
      // Muat ulang nilai asli dari server.
      try {
        const { pengaturan } = await apiFetch<{ pengaturan: unknown }>("/api/pengaturan");
        snapshot = normalisasiSistem(pengaturan);
        beritahu();
      } catch {
        /* biarkan nilai sebelumnya */
      }
      console.warn("Gagal menyimpan pengaturan sistem:", e);
    }
  );
}

/** Hook React: nilai pengaturan sistem, aman hydration. */
export function useSistem(): SistemPengaturan {
  return useSyncExternalStore(langganan, ambilSnapshot, () => SNAPSHOT_SERVER);
}

/** Bantuan format untuk teks aturan: "14 hari", "Rp2.000". */
export function useFormatSistem() {
  const s = useSistem();
  const rupiahSehari = useCallback(
    () =>
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(s.dendaPerHari),
    [s.dendaPerHari]
  );
  return { sistem: s, rupiahSehari: rupiahSehari() };
}
