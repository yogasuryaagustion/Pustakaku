# Panduan Petugas Perpustakaan — PustakaKu

Panduan ini untuk petugas yang memakai aplikasi sehari-hari. Tidak perlu
pengetahuan teknis. Bagian yang berurusan dengan server ada di
[`SUPABASE.md`](./SUPABASE.md).

---

## 1. Masuk dan mengenal tiga jenis akun

Buka alamat perpustakaan sekolah Anda, lalu masuk di halaman **Masuk**.

| Peran | Bisa apa saja |
|---|---|
| **Anggota** (siswa/guru) | Beranda, Katalog Buku, Peminjaman Saya, Riwayat, Kartu Anggota, Profil |
| **Admin** (petugas) | Semua pekerjaan harian: Dashboard, Katalog, Peminjaman & Pengembalian, Inventaris, Data Anggota, Kunjungan, Laporan |
| **Super Admin** (kepala perpustakaan / operator) | Semua di atas **plus** Kelola Akun, Hak Akses Pengguna, dan Pengaturan |

Akun petugas **tidak dibuat sendiri**. Minta Super Admin membuatkannya di
**Kelola Akun**, lalu ganti sandi setelah masuk pertama kali.

Belum ada tombol "lupa sandi". Kalau lupa, Super Admin meresetnya dari
**Kelola Akun**.

## 2. Sekali saja, saat pertama memakai

1. **Pengaturan** → isi durasi peminjaman (hari), maksimal judul per anggota,
   dan denda per hari. Simpan.
2. **Katalog Buku** → masukkan buku yang ada. Untuk setiap judul, tentukan
   jumlah salinan (buku fisik) yang dimiliki.
3. **Inventaris Buku → Salinan Buku** → pastikan setiap salinan punya nomor
   inventaris. Nomor dibuat otomatis mengikuti format yang diatur di
   Pengaturan.
4. **Inventaris Buku → Cetak Label QR Buku** → cetak dan tempel label pada
   setiap buku fisik. Label inilah yang dipindai saat melayani peminjaman.
5. **Data Anggota** → masukkan anggota, atau biarkan mereka mendaftar sendiri
   di halaman **Daftar**. Setiap anggota mendapat nomor seperti `AGT-0001`.

> Nama perpustakaan pada header/tanggal masih perlu diatur oleh admin teknis
> (lihat `SUPABASE.md` bagian 6).

## 3. Rutinitas harian

### Mencatat kunjungan
Buka **Kunjungan & Presensi**, lalu halaman **Check-in**. Pindai kartu anggota
atau ketik nomor anggotanya (`AGT-0001`), tekan Enter. Nama anggota muncul
sebagai konfirmasi. Gunakan tombol yang sama untuk mencatat kunjungan berikutnya.

### Melayani peminjaman
1. Buka **Peminjaman & Pengembalian** → tombol **Pinjam Buku**.
2. Pilih buku (hanya yang salinannya tersedia) dan pilih anggota (hanya yang
   aktif).
3. Periksa **Lama pinjam (hari)**. Nilainya dimulai dari standar Pengaturan,
   tetapi bisa diubah untuk peminjaman ini saja (tombol cepat 7/14/30 atau
   ketik 1–90). Tanggal **Jatuh tempo** di bawahnya ikut menyesuaikan.
4. Simpan. Sistem membuat kode pinjam dan menghitung tanggal jatuh tempo dari
   lama pinjam yang dipilih. Pengaturan tidak berubah karena transaksi ini.

Batas jumlah judul per anggota dan sisa stok diperiksa otomatis. Kalau stok
habis, buku tidak muncul di daftar pilihan — bukan aplikasi yang rusak.

### Menerima pengembalian
1. Cari peminjaman lewat kotak pencarian (judul, nama anggota, atau kode).
2. Tekan **Proses Kembali**, lalu pilih kondisi buku:
   - **Layak** → status `tersedia`, kembali ke rak dan bisa dipinjam lagi.
   - **Rusak ringan** → status `rusak`, tidak ditawarkan untuk dipinjam.
   - **Rusak berbeda** → status `rusak`; buku yang kembali tidak sesuai catatan
     (edisi/judul lain), jadi dipisahkan dari rak.
   - **Hilang** → status `hilang`; buku tidak kembali. Stok katalog baru
     menyusut saat **Perbaiki Selisih** dijalankan di halaman inventaris.
3. Simpan. Denda keterlambatan langsung dihitung sesuai Pengaturan.

### Menerima pembayaran denda (boleh dicicil)
Denda tercatat per pinjaman saat buku dikembalikan. Bila anggota membayar:

1. Cari baris pinjaman bersangkutan di **Peminjaman & Pengembalian** — kolom
   tindakan menampilkan **Bayar Rp…** selama dendanya belum lunas.
2. Tekan tombol itu untuk membuka **Denda Pinjaman**: total denda, jumlah yang
   sudah dibayar, sisa, dan **riwayat pembayaran** pinjaman tersebut.
3. Isi **Nominal diterima** (boleh sebagian dari sisa) dan catatan bila perlu
   (mis. “cicilan pertama”), lalu tekan **Catat pembayaran**. Tombol
   **Lunasi sisa** memakai jalur yang sama untuk melunasi sekaligus.
4. Setiap penerimaan tersimpan sebagai baris riwayat (nominal, catatan, waktu)
   dan masuk jejak aktivitas. Baris berubah menjadi **Denda lunas** hanya setelah
   sisanya habis.

Anggota melihat riwayat cicilannya sendiri di panel: **Peminjaman Saya** (atau
**Riwayat**) → buka *Riwayat pembayaran denda* pada pinjaman yang berdenda.
Daftar itu hanya memuat pembayaran miliknya, bukan milik anggota lain.

Selama masih ada sisa denda, sistem **menolak peminjaman baru** untuk anggota
itu (pesannya menyebut nominal yang harus dilunasi) — cicilan sebagian belum
membuka blokir. Tombol **Catat Peminjaman** juga dinonaktifkan bila anggota yang
dipilih masih berutang denda. Aturan ini tidak membedakan jenis pinjaman; lunasi
sampai habis dulu, baru boleh meminjam.

Bila pinjaman lama belum tertaut ke salinan fisik, muncul pilihan **Salinan yang
Anda terima**. Pilih nomor inventaris yang tertulis di buku — tanpa itu, pilihan
kondisi tidak bisa disimpan ke inventaris dan salinannya tetap dianggap layak.

### Pengembalian yang diajukan anggota
Anggota bisa menekan **Ajukan Kembali** di panelnya. Pinjaman **belum** selesai
sampai petugas memeriksa bukunya:

1. Di **Peminjaman & Pengembalian**, baris pinjaman itu bertanda
   **“Diajukan kembali”**.
2. Setelah buku benar-benar diterima, tekan **Proses Kembali** dan pilih kondisi
   **Layak**, **Rusak ringan**, **Rusak berbeda**, atau **Hilang**. Pilihan itulah
   validasi petugas, dan tercatat pada pengajuan anggota.
3. Bila buku belum diserahkan, abaikan dulu — anggota bisa mengajukan ulang, dan
   pinjaman tetap aktif sampai divalidasi.

Alur lama tetap sama: petugas juga masih bisa langsung memproses pengembalian
tanpa menunggu pengajuan anggota.

### Memperpanjang
Tombol **Perpanjang** pada baris peminjaman menambah durasi sesuai Pengaturan.
Perpanjangan tidak memadamkan denda yang sudah tercatat, dan anggota yang masih
berdenda tetap tidak bisa meminjam judul baru.

### Di ponsel
Di layar kecil, daftar peminjaman tampil sebagai kartu (bukan tabel), dengan
tombol Perpanjang/Proses Kembali di dalam kartu.

## 4. Mengelola buku dan salinan

- **Katalog Buku** = data judul (judul, penulis, penerbit, kategori, rak).
- **Inventaris Buku → Salinan Buku** = buku fisik satu per satu, lengkap dengan
  nomor inventaris dan kondisinya.
- Tambah satu judul dengan 3 salinan berarti 3 buku fisik bisa dipinjam
  bersamaan.

**Jangan mengubah format nomor inventaris di tengah tahun ajaran.** Nomor yang
sudah tercetak di label tidak akan cocok lagi dengan sistem.

## 5. Mengelola anggota

- **Data Anggota** → tambah anggota baru, ubah data, atau nonaktifkan anggota
  yang sudah lulus/keluar.
- Anggota nonaktif tidak bisa meminjam. Aplikasi menampilkan pesan penjelasan,
  bukan pesan kesalahan teknis.
- Tombol **Kartu** membuka kartu anggota digital (dengan QR) yang bisa
  ditunjukkan dari ponsel atau dicetak.

## 6. Hitung fisik (stock opname)

Lakukan berkala, misalnya setiap akhir semester:

1. **Inventaris Buku → Hitung Fisik** → mulai hitung, lalu masukkan jumlah
   salinan yang benar-benar ada di rak untuk setiap judul.
2. Sistem menandai judul yang jumlahnya berbeda dengan catatan.
3. **Perbaiki Selisih** → selisih muncul bila stok katalog lebih besar daripada
   salinan yang benar-benar ada, biasanya karena salinan dinyatakan hilang saat
   hitung fisik. Tombol **Perbaiki Stok** menulis habis salinan hilang itu agar
   stok katalog sesuai rak. Lakukan hanya setelah rak benar-benar dihitung ulang.
4. **Riwayat Hitung** menyimpan catatan siapa mengoreksi apa dan kapan.

**Hilang dan rusak diperlakukan berbeda saat Perbaiki Selisih:**

| Kondisi salinan | Dihitung sebagai barang di rak? | Tindakan Perbaiki Selisih |
| --- | --- | --- |
| `hilang` | Tidak | Salinan dihapus dari koleksi, stok katalog ikut turun |
| `rusak` (termasuk rusak ringan dan rusak berbeda) | Ya | Tidak disentuh; salinan tetap ada dan tetap tidak ditawarkan untuk dipinjam |

Jadi salinan **hilang** tidak lagi muncul di daftar salinan setelah diperbaiki,
sedangkan salinan **rusak** tetap tercatat sampai Anda memperbaikinya sendiri
(misalnya setelah buku diganti atau dibuang lewat menu salinan). Selama salinan
rusak masih ada, angka selisih tetap 0 — jangan menghapusnya lewat Perbaiki
Selisih.

## 7. Laporan

**Laporan** berisi laporan buku, laporan peminjaman, dan tunggakan. Setiap
laporan bisa dicetak atau diunduh PDF untuk diserahkan ke kepala sekolah.

Perhatikan: **denda hanya dihitung dan dilaporkan, tidak ada pencatatan
pembayaran.** Bila sekolah memungut denda, catat pembayarannya di buku kas
terpisah atau tandai secara manual.

## 8. Hak akses dan pengaturan

- **Hak Akses Pengguna** (Super Admin): menentukan apa yang boleh dilakukan
  Admin dan Anggota, termasuk membuka/menutup pendaftaran mandiri.
- **Pengaturan** (Super Admin): durasi pinjam, batas judul, denda, format nomor
  inventaris.
- **Kelola Akun** (Super Admin): membuat akun petugas, mengganti peran,
  mereset sandi, menghapus akun.

## 9. Kalau ada masalah

| Yang terjadi | Yang dilakukan |
|---|---|
| Anggota tidak bisa meminjam | Cek status anggota di Data Anggota — mungkin nonaktif atau batas judul sudah penuh |
| Buku tidak muncul saat meminjam | Semua salinan sedang dipinjam atau ditandai rusak; cek Salinan Buku |
| Jumlah stok di layar tidak cocok dengan rak | Jalankan Hitung Fisik, lalu Perbaiki Selisih |
| Petugas lupa sandi | Super Admin mereset dari Kelola Akun |
| Muncul pesan "kebijakan akses" | Fitur itu ditutup di Hak Akses Pengguna |
| Data terasa hilang atau salah | Berhenti memakai aplikasi, hubungi admin teknis untuk pemulihan dari backup |

## 10. Yang sebaiknya tidak dilakukan

- Menghapus anggota/buku yang masih punya peminjaman aktif.
- Mengubah format nomor inventaris saat ada label tercetak.
- Menjalankan **Perbaiki Selisih** tanpa menghitung ulang rak.
- Memakai satu akun petugas untuk banyak orang — jejak aktivitas jadi tidak
  berguna saat menelusuri masalah.
