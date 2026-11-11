-- Bentuk label eksemplar bawaan (QR atau barcode 1D Code 128).
--
-- Halaman cetak label sudah punya tombol QR / Barcode 1D, tetapi pilihannya
-- selalu kembali ke QR setiap kali halaman dibuka. Petugas yang memakai barcode
-- gun harus memilih ulang tiap mencetak. Nilai ini disimpan di pengaturan
-- sistem (bukan localStorage) agar berlaku sama di semua komputer layanan.
--
-- Nilai sah: 'qr' (pemindai 2D / kamera) atau 'code128' (barcode gun).
-- Tombol di halaman cetak tetap bisa mengganti untuk satu kali cetak tanpa
-- mengubah pengaturan.

alter table public.pengaturan_sistem
  add column if not exists format_label text not null default 'qr'
    check (format_label in ('qr', 'code128'));

comment on column public.pengaturan_sistem.format_label is
  'Bentuk label eksemplar bawaan saat mencetak: qr atau code128.';

notify pgrst, 'reload schema';
