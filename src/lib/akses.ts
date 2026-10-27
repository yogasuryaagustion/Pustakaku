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

// === Kebijakan Akses Berbasis Peran (RBAC) =====================================
// Matriks izin (peran × aksi/halaman) — katalog izin & logikanya ada di
// src/lib/izin.ts (modul murni yang dipakai juga oleh Worker D1, sehingga
// server menegakkan matriks yang SAMA dengan yang tampil di layar).
// Nilai tersimpan PERMANEN di tabel `kebijakan` (API /api/kebijakan), dibaca
// lewat useSyncExternalStore. SEMUA pengecekan izin aplikasi melewati modul
// ini (cekIzin/useBoleh), sehingga mengubah kebijakan lewat /admin/akses
// langsung menutup/membuka akses di seluruh halaman, tombol, dan mutasi data.
//
// Prinsip: DEFAULT-DENY, NORMALISASI, CATAT JEJAK (dicatat oleh halaman
// pengelola setelah simpan).

export * from "./izin";

// === Store API ================================================================
// Snapshot untuk render server (referensi selalu sama → aman hydration).
const SNAPSHOT_SERVER: Kebijakan = KEBIJAKAN_BAWAAN;

let snapshot: Kebijakan = KEBIJAKAN_BAWAAN;
let diminta = false;
const pendengar = new Set<() => void>();

function beritahu() {
  pendengar.forEach((fn) => fn());
}

async function muatKebijakan() {
  if (diminta || typeof window === "undefined") return;
  diminta = true;
  try {
    const { kebijakan } = await apiFetch<{ kebijakan: unknown }>("/api/kebijakan");
    snapshot = normalisasiKebijakan(kebijakan);
    beritahu();
  } catch (e) {
    diminta = false;
    console.warn("Gagal memuat kebijakan akses:", e);
  }
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);
  void muatKebijakan();
  return () => {
    pendengar.delete(kembali);
  };
}

/** Baca kebijakan dari luar React (mis. di dalam mutasi context). */
export function ambilKebijakan(): Kebijakan {
  return typeof window === "undefined" ? KEBIJAKAN_BAWAAN : snapshot;
}

/**
 * Simpan kebijakan (dinormalisasi + kunci anti-lockout ditegakkan) ke
 * DATABASE lewat API. Optimistik: diterapkan langsung, dibatalkan bila
 * server menolak.
 */
export function simpanKebijakan(next: Kebijakan, oleh?: string) {
  if (typeof window === "undefined") return;
  const s = normalisasiKebijakan(next);
  s.diubahPada = new Date().toISOString();
  s.diubahOleh = oleh ?? null;
  const sebelum = snapshot;
  snapshot = s;
  beritahu();
  void apiFetch("/api/kebijakan", { method: "PUT", body: { kebijakan: s } }).catch(async (e) => {
    snapshot = sebelum;
    beritahu();
    try {
      const ulang = await apiFetch<{ kebijakan: unknown }>("/api/kebijakan");
      snapshot = normalisasiKebijakan(ulang.kebijakan);
      beritahu();
    } catch {
      /* biarkan nilai sebelumnya */
    }
    console.warn("Gagal menyimpan kebijakan akses:", e);
  });
}

/** Hook React: kebijakan aktif, aman hydration. */
export function useKebijakan(): Kebijakan {
  return useSyncExternalStore(langganan, ambilSnapshot, () => SNAPSHOT_SERVER);
}

function ambilSnapshot(): Kebijakan {
  return snapshot;
}

// === Pemetaan rute → izin =====================================================
// Urutan penting: yang paling spesifik dulu (/panel/pinjaman sebelum /panel).
const RUTE_IZIN: { path: string; izin: string }[] = [
  { path: "/panel/pinjaman", izin: "panel.pinjaman" },
  { path: "/panel/profil", izin: "panel.profil" },
  { path: "/panel/bantuan", izin: "panel.bantuan" },
  { path: "/panel", izin: "panel.lihat" },
  { path: "/dashboard", izin: "dashboard.lihat" },
  { path: "/sirkulasi", izin: "sirkulasi.lihat" },
  { path: "/anggota", izin: "anggota.lihat" },
  { path: "/laporan", izin: "laporan.lihat" },
  { path: "/statistik-kunjungan", izin: "laporan.lihat" },
  { path: "/admin/akun", izin: "akun.kelola" },
  { path: "/admin/pengaturan", izin: "pengaturan.kelola" },
  { path: "/katalog", izin: "katalog.lihat" },
];

/** Rute yang selalu bisa dibuka tanpa masuk (otentikasi, beranda, kios kunjungan). */
export const RUTE_TERBUKA = ["/", "/login", "/register", "/kunjungan"];

/**
 * Rute khusus peran — di LUAR matriks izin (tak muncul di Kontrol Akses
 * dan tak bisa dicabut lewat sana). Salah peran: tamu → halaman masuk,
 * sesi salah peran → dialihkan ke rumah TANPA layar "Akses Ditolak".
 */
export const RUTE_PERAN: { path: string; peran: PeranAkses }[] = [
  { path: "/admin/akses", peran: "admin" },
  { path: "/admin/migrasi", peran: "admin" },
];

export function cariPeranRute(pathname: string): PeranAkses | undefined {
  return RUTE_PERAN.find((r) => pathname === r.path || pathname.startsWith(r.path + "/"))?.peran;
}

/** Izin yang dibutuhkan sebuah rute; undefined = rute selalu terbuka. */
export function cariIzinRute(pathname: string): string | undefined {
  return RUTE_IZIN.find((r) => pathname === r.path || pathname.startsWith(r.path + "/"))?.izin;
}

/**
 * Apakah sebuah rute boleh dibuka peran ini di bawah kebijakan ini?
 * Dipakai untuk memvalidasi tautan "dari" saat masuk — pengguna tak boleh
 * diantar ke halaman yang perannya tak punya izin.
 */
export function bolehRute(kb: Kebijakan, peran: PeranAkses, path: string): boolean {
  if (RUTE_TERBUKA.some((r) => path === r || path.startsWith(r + "/"))) return true;
  const peranRute = cariPeranRute(path);
  if (peranRute) return peranRute === peran;
  const izin = cariIzinRute(path);
  return izin ? cekIzin(kb, peran, izin) : true;
}

/** Halaman tujuan yang paling relevan yang masih diizinkan untuk peran ini. */
export function tujuanRumah(kb: Kebijakan, peran: PeranAkses): string {
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
        : [["/katalog", "katalog.lihat"]];
  for (const [path, izin] of kandidat) if (cekIzin(kb, peran, izin)) return path;
  return "/";
}
