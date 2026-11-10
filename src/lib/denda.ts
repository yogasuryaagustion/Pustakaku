// Aturan denda yang dipakai bersama oleh UI dan uji unit.
//
// Satu peminjaman menyimpan `denda` (nominal yang timbul saat pengembalian)
// dan `dendaDibayar` (bagian yang sudah dilunasi petugas). Anggota dianggap
// punya tunggakan bila total `denda - dendaDibayar` miliknya masih > 0 — dan
// selama itu `pinjam_buku` di database menolak peminjaman baru.

export interface DendaPeminjaman {
  anggotaId: string;
  denda: number;
  dendaDibayar?: number;
}

/** Sisa denda satu peminjaman; tidak pernah negatif. */
export function sisaDenda(denda: number, dibayar = 0): number {
  const total = Math.max(0, Math.round(denda || 0));
  const bayar = Math.max(0, Math.round(dibayar || 0));
  return Math.max(0, total - bayar);
}

/** Total tunggakan denda seorang anggota (semua pinjaman). */
export function totalDendaTertunggak(
  daftar: readonly DendaPeminjaman[],
  anggotaId: string,
): number {
  return daftar
    .filter((p) => p.anggotaId === anggotaId)
    .reduce((total, p) => total + sisaDenda(p.denda, p.dendaDibayar), 0);
}

/** Peminjaman yang dendanya masih harus dibayar. */
export function belumLunas(p: DendaPeminjaman): boolean {
  return sisaDenda(p.denda, p.dendaDibayar) > 0;
}

/**
 * Periksa nominal pembayaran (boleh sebagian). Mengembalikan pesan galat
 * untuk UI, atau null bila sah. Aturan yang sama diperiksa `bayar_denda`.
 */
export function pesanNominalDenda(nominal: number, sisa: number): string | null {
  if (!Number.isInteger(nominal) || nominal < 1) {
    return "Nominal pembayaran harus bilangan bulat lebih dari 0.";
  }
  if (nominal > sisa) {
    return "Nominal pembayaran melebihi sisa denda.";
  }
  return null;
}
