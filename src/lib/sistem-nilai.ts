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
  /**
   * Pola nomor inventaris otomatis untuk eksemplar baru.
   * Token: {tahun}, {bulan}, {urut} (boleh {urut:3} untuk 3 digit).
   */
  formatInventaris: string;
};

/** Pola bawaan nomor inventaris. */
export const FORMAT_INVENTARIS_BAWAAN = "INV-{tahun}-{urut}";

// Default = konstanta klasik di types.ts.
export const SISTEM_DEFAULT: SistemPengaturan = {
  nama: "PustakaKu",
  tagline: "Sistem Perpustakaan",
  lamaPinjam: LAMA_PINJAM_HARI,
  dendaPerHari: DENDA_PER_HARI,
  maksPinjaman: 5,
  formatInventaris: FORMAT_INVENTARIS_BAWAAN,
};

/** Pola dianggap sah bila memuat {urut} dan hanya memakai aksara aman. */
export function formatInventarisSah(nilai: string): boolean {
  return (
    nilai.length > 0 &&
    nilai.length <= 40 &&
    /\{urut(:\d{1,2})?\}/i.test(nilai) &&
    /^[A-Za-z0-9\-_./{}: ]+$/.test(nilai)
  );
}

/**
 * Contoh hasil pola untuk pratinjau di layar (juga dipakai server untuk
 * memastikan tampilan dan hasil database sama).
 */
export function nomorInventarisContoh(
  format: string,
  urut = 1,
  tanggal: Date = new Date(),
): string {
  const tahun = String(tanggal.getFullYear());
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  return format
    .replace(/\{tahun\}/gi, tahun)
    .replace(/\{bulan\}/gi, bulan)
    .replace(/\{urut:(\d{1,2})\}/gi, (_, digit: string) =>
      String(urut).padStart(Number(digit), "0"),
    )
    .replace(/\{urut\}/gi, () => String(urut).padStart(4, "0"));
}

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
    formatInventaris:
      typeof o.formatInventaris === "string" && formatInventarisSah(o.formatInventaris.trim())
        ? o.formatInventaris.trim()
        : SISTEM_DEFAULT.formatInventaris,
  };
}

/** Sahkan objek pengaturan sistem — field tak valid jatuh ke default. */
export function sahkanSistem(raw: unknown): SistemPengaturan {
  return normalisasiSistem(raw);
}
