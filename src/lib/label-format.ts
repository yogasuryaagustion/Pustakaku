// Pilihan bentuk kode label eksemplar — dipakai halaman Pengaturan (nilai
// bawaan) dan halaman cetak label (tombol pilihan), agar teks dan urutannya
// tidak berbeda di dua tempat.

import type { FormatLabel } from "./sistem-nilai";

export type { FormatLabel };

export const PILIHAN_FORMAT_LABEL: Array<{
  nilai: FormatLabel;
  judul: string;
  ket: string;
}> = [
  { nilai: "qr", judul: "QR", ket: "Pemindai 2D / kamera ponsel" },
  {
    nilai: "code128",
    judul: "Barcode 1D (Code 128)",
    ket: "Untuk barcode gun biasa",
  },
];
