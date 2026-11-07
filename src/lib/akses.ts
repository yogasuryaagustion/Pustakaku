
"use client";

import { useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import {
  KEBIJAKAN_BAWAAN,
  cekIzin,
  normalisasiKebijakan,
  type Kebijakan,
  type PeranAkses,
} from "./izin";

// Ekspor katalog izin dan fungsi murni dari izin.ts. Nama yang juga
// didefinisikan di file ini (ambilKebijakan, useKebijakan, bolehRute,
// tujuanRumah) sengaja TIDAK ikut diekspor ulang agar tidak bentrok.
export {
  PERAN_AKSES,
  INFO_PERAN,
  DAFTAR_IZIN,
  GRUP_IZIN,
  KUNCI_IZIN,
  KEBIJAKAN_BAWAAN,
  normalisasiKebijakan,
  salinKebijakan,
  bandingkanKebijakan,
  cekIzin,
  peranEfektif,
  petugas,
} from "./izin";

export type {
  PeranAkses,
  DefinisiIzin,
  KebijakanStore,
  Kebijakan,
} from "./izin";

// ============================================================
// STORE KEBIJAKAN AKSES
// ============================================================

const SNAPSHOT_SERVER: Kebijakan = KEBIJAKAN_BAWAAN;

let snapshot: Kebijakan = KEBIJAKAN_BAWAAN;
let diminta = false;

const pendengar = new Set<() => void>();

function beritahu(): void {
  pendengar.forEach((fn) => fn());
}

function ambilSnapshot(): Kebijakan {
  return snapshot;
}

async function muatKebijakan(): Promise<void> {
  if (diminta || typeof window === "undefined") return;

  diminta = true;

  try {
    const hasil = await apiFetch<{ kebijakan: unknown }>(
      "/api/kebijakan"
    );

    snapshot = normalisasiKebijakan(hasil.kebijakan);
    beritahu();
  } catch (error) {
    diminta = false;
    console.warn("Gagal memuat kebijakan akses:", error);
  }
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);

  void muatKebijakan();

  return () => {
    pendengar.delete(kembali);
  };
}

/**
 * Mengambil snapshot kebijakan secara sinkron.
 */
export function ambilKebijakan(): Kebijakan {
  return typeof window === "undefined"
    ? KEBIJAKAN_BAWAAN
    : snapshot;
}

/**
 * Menyimpan kebijakan melalui API /api/kebijakan.
 *
 * Mekanisme optimistik dipertahankan:
 * perubahan langsung terlihat, kemudian dikembalikan
 * apabila server menolak penyimpanan.
 */
export function simpanKebijakan(
  next: Kebijakan,
  oleh?: string
): void {
  if (typeof window === "undefined") return;

  const s = normalisasiKebijakan(next);

  s.diubahPada = new Date().toISOString();
  s.diubahOleh = oleh ?? null;

  const sebelum = snapshot;

  snapshot = s;
  beritahu();

  void apiFetch("/api/kebijakan", {
    method: "PUT",
    body: { kebijakan: s },
  }).catch(async (error) => {
    snapshot = sebelum;
    beritahu();

    try {
      const ulang = await apiFetch<{ kebijakan: unknown }>(
        "/api/kebijakan"
      );

      snapshot = normalisasiKebijakan(ulang.kebijakan);
      beritahu();
    } catch {
      // Pertahankan snapshot sebelumnya jika pemuatan ulang gagal.
    }

    console.warn("Gagal menyimpan kebijakan akses:", error);
  });
}

/**
 * Hook React untuk membaca kebijakan aktif.
 * Aman untuk server rendering dan hydration.
 */
export function useKebijakan(): Kebijakan {
  return useSyncExternalStore(
    langganan,
    ambilSnapshot,
    () => SNAPSHOT_SERVER
  );
}

// ============================================================
// PEMETAAN RUTE KE IZIN
// ============================================================

// Urutan penting: rute paling spesifik diperiksa terlebih dahulu.
const RUTE_IZIN: { path: string; izin: string }[] = [
  { path: "/panel/pinjaman", izin: "panel.pinjaman" },
  { path: "/panel/profil", izin: "panel.profil" },
  { path: "/panel/bantuan", izin: "panel.bantuan" },
  { path: "/panel", izin: "panel.lihat" },
  { path: "/dashboard", izin: "dashboard.lihat" },
  { path: "/sirkulasi", izin: "sirkulasi.lihat" },
  // Kartu pribadi anggota berada di bawah /anggota, tetapi izinnya berbeda —
  // entri ini harus lebih awal agar tidak tertangkap aturan /anggota.
  { path: "/anggota/kartu", izin: "kartu.lihat" },
  { path: "/anggota", izin: "anggota.lihat" },
  { path: "/laporan", izin: "laporan.lihat" },
  { path: "/statistik-kunjungan", izin: "laporan.lihat" },
  { path: "/inventaris", izin: "katalog.kelola" },
  { path: "/admin/akun", izin: "akun.kelola" },
  { path: "/admin/pengaturan", izin: "pengaturan.kelola" },
  { path: "/katalog", izin: "katalog.lihat" },
];

// Rute yang dapat dibuka tanpa autentikasi.
export const RUTE_TERBUKA = [
  "/",
  "/login",
  "/register",
  "/kunjungan",
];

// Rute khusus peran.
export const RUTE_PERAN: {
  path: string;
  peran: PeranAkses;
}[] = [
  { path: "/admin/akses", peran: "superadmin" },
  { path: "/admin/migrasi", peran: "superadmin" },
];

export function cariPeranRute(
  pathname: string
): PeranAkses | undefined {
  return RUTE_PERAN.find(
    (r) =>
      pathname === r.path ||
      pathname.startsWith(r.path + "/")
  )?.peran;
}

/**
 * Mengambil izin yang diperlukan suatu rute.
 */
export function cariIzinRute(
  pathname: string
): string | undefined {
  return RUTE_IZIN.find(
    (r) =>
      pathname === r.path ||
      pathname.startsWith(r.path + "/")
  )?.izin;
}

/**
 * Memeriksa apakah rute dapat diakses oleh suatu peran.
 */
export function bolehRute(
  kb: Kebijakan,
  peran: PeranAkses,
  path: string
): boolean {
  if (
    RUTE_TERBUKA.some(
      (r) => path === r || path.startsWith(r + "/")
    )
  ) {
    return true;
  }

  const peranRute = cariPeranRute(path);

  if (peranRute) {
    return peranRute === peran;
  }

  const izin = cariIzinRute(path);

  return izin ? cekIzin(kb, peran, izin) : true;
}

/**
 * Menentukan halaman utama berdasarkan peran dan izin.
 */
export function tujuanRumah(
  kb: Kebijakan,
  peran: PeranAkses
): string {
  const kandidat: [string, string][] =
    peran === "admin"
      ? [
          ["/dashboard", "dashboard.lihat"],
          ["/panel", "panel.lihat"],
          ["/katalog", "katalog.lihat"],
        ]
      : peran === "user"
        ? [
            ["/panel", "panel.lihat"],
            ["/katalog", "katalog.lihat"],
          ]
        : [
            ["/katalog", "katalog.lihat"],
          ];

  for (const [path, izin] of kandidat) {
    if (cekIzin(kb, peran, izin)) {
      return path;
    }
  }

  return "/";
}
