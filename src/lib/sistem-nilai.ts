// Tipe, default, dan normalisasi Pengaturan Sistem — MODUL PURA tanpa React.
// Dipakai frontend (src/lib/sistem.ts) dan Worker D1 (worker/index.ts) agar
// validasi yang berlaku di layar dan di server identik.

import { DENDA_PER_HARI, LAMA_PINJAM_HARI } from "./types";

export type SistemPengaturan = {
  /** Nama perpustakaan — tampil di logo, navbar, judul, footer. */
  nama: string;
  /** Tagline di bawah nama. */
  tagline: string;
  /** Lama pinjam standar (hari). */
  lamaPinjam: number;
  /** Denda keterlambatan per hari (rupiah). */
  dendaPerHari: number;
  /** Batas maksimal buku yang boleh dipinjam satu anggota. */
  maksPinjaman: number;
};

// Default = konstanta klasik di types.ts.
export const SISTEM_DEFAULT: SistemPengaturan = {
  nama: "PustakaKu",
  tagline: "Sistem Perpustakaan",
  lamaPinjam: LAMA_PINJAM_HARI,
  dendaPerHari: DENDA_PER_HARI,
  maksPinjaman: 5,
};

/** Isi field yang tidak valid/corrupt dengan default. */
export function normalisasiSistem(raw: unknown): SistemPengaturan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<SistemPengaturan>;
  const teks = (v: unknown, def: string) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : def;
  const angka = (v: unknown, def: number, min: number, max: number) =>
    Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v as number))) : def;
  return {
    nama: teks(o.nama, SISTEM_DEFAULT.nama),
    tagline: teks(o.tagline, SISTEM_DEFAULT.tagline),
    lamaPinjam: angka(o.lamaPinjam, SISTEM_DEFAULT.lamaPinjam, 1, 90),
    dendaPerHari: angka(o.dendaPerHari, SISTEM_DEFAULT.dendaPerHari, 0, 1_000_000),
    maksPinjaman: angka(o.maksPinjaman, SISTEM_DEFAULT.maksPinjaman, 1, 50),
  };
}

/** Sahkan objek pengaturan sistem — field tak valid jatuh ke default. */
export function sahkanSistem(raw: unknown): SistemPengaturan {
  return normalisasiSistem(raw);
}
