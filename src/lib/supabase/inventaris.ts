// Aturan domain inventaris fisik (eksemplar) + stock opname.
// Dipakai bersama oleh route /api/eksemplar, /api/opname, dan halaman UI agar
// daftar status, kondisi, dan cara meringkas selisih stok tidak berbeda-beda.

import type { BarisInventarisPerBuku } from "./peta";

export const STATUS_EKSEMPLAR = ["tersedia", "dipinjam", "rusak", "hilang"] as const;
export type StatusEksemplar = (typeof STATUS_EKSEMPLAR)[number];

export const KONDISI_EKSEMPLAR = ["layak", "rusak_ringan", "rusak_beda", "hilang"] as const;
export type KondisiEksemplar = (typeof KONDISI_EKSEMPLAR)[number];

export const LABEL_STATUS: Record<string, string> = {
  tersedia: "Tersedia",
  dipinjam: "Dipinjam",
  rusak: "Rusak",
  hilang: "Hilang",
};

export const LABEL_KONDISI: Record<string, string> = {
  layak: "Layak",
  rusak_ringan: "Rusak ringan",
  rusak_beda: "Rusak berbeda",
  hilang: "Hilang",
};

export function statusDikenal(nilai: string): boolean {
  return (STATUS_EKSEMPLAR as readonly string[]).includes(nilai);
}

export function kondisiDikenal(nilai: string): boolean {
  return (KONDISI_EKSEMPLAR as readonly string[]).includes(nilai);
}

/** Satu kata tentang kondisi inventaris sebuah judul. */
export type StatusSistem = "tanpa-eksemplar" | "sesuai" | "stok-kurang" | "stok-lebih";

export interface RingkasanInventaris extends BarisInventarisPerBuku {
  status_sistem: StatusSistem;
  selisih: number;
  keterangan: string;
}

/**
 * Bandingkan stok tercatat (buku.stok) dengan jumlah eksemplar fisik.
 * selisih > 0 berarti stok tercatat lebih banyak daripada barang fisik.
 *
 * Judul yang belum punya eksemplar sama sekali sengaja TIDAK dihitung
 * menyimpang: stoknya masih angka katalog yang diisi manual, dan menghitungnya
 * sebagai selisih membuat seluruh katalog tampak perlu diperbaiki (stoknya akan
 * jadi 0 bila rekonsiliasi dijalankan).
 */
export function ringkasInventaris(r: BarisInventarisPerBuku): RingkasanInventaris {
  const total = Number(r.total_eksemplar) || 0;
  const stok = Number(r.stok) || 0;
  const selisih = total === 0 ? 0 : stok - total;

  let status: StatusSistem = "sesuai";
  if (total === 0) status = "tanpa-eksemplar";
  else if (selisih < 0) status = "stok-kurang";
  else if (selisih > 0) status = "stok-lebih";

  const bagian = [
    `${Number(r.tersedia) || 0} tersedia`,
    `${Number(r.dipinjam) || 0} dipinjam`,
  ];
  if ((Number(r.rusak) || 0) > 0) bagian.push(`${r.rusak} rusak`);
  if ((Number(r.hilang) || 0) > 0) bagian.push(`${r.hilang} hilang`);

  return {
    ...r,
    status_sistem: status,
    selisih,
    keterangan: total === 0 ? "Belum ada eksemplar tercatat" : bagian.join(" · "),
  };
}

/** Sesi stock opname (tabel opname). */
export interface BarisOpname {
  id: string;
  judul: string;
  komentar: string | null;
  jumlah_dibandingkan: number;
  jumlah_ditemukan: number;
  jumlah_tidak_ditemukan: number;
  selisih: number;
  dikerjakan_bynama: string;
  dikerjakan_oleh: string | null;
  dibuat_pada: string;
  diperbarui_pada: string;
}

/** Satu baris pemeriksaan dalam sesi opname (tabel opname_baris). */
export interface BarisOpnameBaris {
  id: string;
  opname_id: string;
  eksemplar_id: string | null;
  buku_id: string | null;
  nomor_inventaris: string;
  judul: string;
  status_sistem: string;
  kondisi_sistem: string;
  ditemukan: boolean;
  jumlah_fisik: number;
  status_fisik: string | null;
  kondisi_fisik: string | null;
  keterangan: string | null;
}

export const KOLOM_OPNAME =
  "id,judul,komentar,jumlah_dibandingkan,jumlah_ditemukan,jumlah_tidak_ditemukan,selisih,dikerjakan_bynama,dikerjakan_oleh,dibuat_pada,diperbarui_pada";

export const KOLOM_OPNAME_BARIS =
  "id,opname_id,eksemplar_id,buku_id,nomor_inventaris,judul,status_sistem,kondisi_sistem,ditemukan,jumlah_fisik,status_fisik,kondisi_fisik,keterangan";

/** Total baris sebuah sesi opname. */
export function hitungOpname(
  baris: Array<{ ditemukan?: number; tidak_ditemukan?: number }>,
): {
  jumlah_dibandingkan: number;
  jumlah_ditemukan: number;
  jumlah_tidak_ditemukan: number;
  selisih: number;
} {
  let ditemukan = 0;
  let tidak = 0;
  for (const b of baris) {
    ditemukan += Number(b.ditemukan) || 0;
    tidak += Number(b.tidak_ditemukan) || 0;
  }
  return {
    jumlah_dibandingkan: ditemukan + tidak,
    jumlah_ditemukan: ditemukan,
    jumlah_tidak_ditemukan: tidak,
    // Selisih = barang yang tidak ditemukan saat opname.
    selisih: tidak,
  };
}
