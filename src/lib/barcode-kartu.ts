"use client";

// Barcode Code 128 untuk nomor anggota (mis. "AGT-0001").
//
// Kartu anggota selama ini hanya memuat QR; barcode 1D ditambahkan agar kartu
// bisa dipindai barcode gun di meja sirkulasi. Pustaka bwip-js dimuat dinamis
// supaya bundel halaman lain tidak bertambah.

/** Lebar barcode relatif terhadap tinggi batang — dipakai untuk tata letak. */
export const RASIO_BARCODE = 5.74;

const OPSI_DASAR = {
  bcid: "code128",
  scale: 3,
  height: 8,
  includetext: false,
  // Quiet zone minimal 10 modul di kiri-kanan agar scanner bisa membaca.
  paddingwidth: 10,
  paddingheight: 0,
} as const;

/** SVG barcode untuk ditampilkan di kartu (aman untuk dangerouslySetInnerHTML). */
export async function svgCode128(teks: string): Promise<string> {
  const { default: bwipjs } = await import("bwip-js/browser");
  return bwipjs.toSVG({ ...OPSI_DASAR, text: teks });
}

/** PNG data URL barcode — dipakai saat menyusun PDF kartu. */
export async function pngCode128(teks: string): Promise<string> {
  const { default: bwipjs } = await import("bwip-js/browser");
  const kanvas = document.createElement("canvas");
  bwipjs.toCanvas(kanvas, { ...OPSI_DASAR, text: teks });
  return kanvas.toDataURL("image/png");
}
