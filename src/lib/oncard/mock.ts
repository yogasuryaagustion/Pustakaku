// Data contoh untuk pengembangan integrasi OnCard.
//
// Dipakai saat ONCARD_MOCK=1 sehingga route sinkronisasi bisa diuji tanpa
// kredensial vendor. Isinya sengaja memuat kasus yang paling sering merusak
// sinkronisasi: email kosong, email bentrok dengan akun petugas, nama terlalu
// pendek, NIS ganda, dan pelajar yang sudah nonaktif (alumni).

import type { AnggotaOnCard, HalamanOnCard } from "./tipe";

const CONTOH: AnggotaOnCard[] = [
  {
    id: "oc-1001",
    nis: "2024001",
    nama: "Aisyah Nur Fadilah",
    email: "aisyah.nur@example.sch.id",
    telepon: "0812-1111-0001",
    alamat: "Jl. Cihampelas No. 15, Bandung",
    kelas: "XI IPA 2",
    jenis: "Pelajar",
    foto: "https://oncard.example/foto/oc-1001.jpg",
    uidKartu: "RF-0001",
    aktif: true,
    diperbaruiPada: "2026-11-10T02:15:00Z",
  },
  {
    id: "oc-1002",
    nis: "2024002",
    nama: "Muhammad Rizky Pratama",
    email: "rizky.pratama@example.sch.id",
    telepon: "0812-1111-0002",
    kelas: "X IPS 1",
    jenis: "Pelajar",
    uidKartu: "RF-0002",
    aktif: true,
    diperbaruiPada: "2026-11-10T02:16:00Z",
  },
  {
    // Tanpa email: nomor induk satu-satunya kunci yang tersisa, sehingga
    // pencocokan baru bisa otomatis setelah tabel anggota_oncard ada.
    id: "oc-1003",
    nis: "2024003",
    nama: "Siti Halimah",
    email: null,
    kelas: "XII TKJ",
    jenis: "Pelajar",
    uidKartu: "RF-0003",
    aktif: true,
  },
  {
    // Email milik akun petugas — harus dilaporkan bentrok, bukan ditimpa.
    id: "oc-1004",
    nis: "2024004",
    nama: "Abdul Rahman Hakim",
    email: "admin@perpus.id",
    kelas: "XI IPA 1",
    jenis: "Pelajar",
    aktif: true,
  },
  {
    // Alumni: kartu perpustakaan ikut dinonaktifkan, bukan dihapus.
    id: "oc-1005",
    nis: "2020110",
    nama: "Nur Aini Rahmawati",
    email: "nur.aini@example.sch.id",
    kelas: "Alumni",
    jenis: "Pelajar",
    aktif: false,
    diperbaruiPada: "2026-07-01T08:00:00Z",
  },
  {
    // Nama di bawah 3 karakter: ditolak validasi sebelum menyentuh database.
    id: "oc-1006",
    nis: "2024006",
    nama: "Al",
    jenis: "Pelajar",
    aktif: true,
  },
  {
    // NIS ganda: satu nomor induk untuk dua kartu (kartu lama belum dicabut).
    id: "oc-1007",
    nis: "2024001",
    nama: "Aisyah Nur Fadilah (kartu lama)",
    email: "aisyah.nur@example.sch.id",
    kelas: "XI IPA 2",
    jenis: "Pelajar",
    uidKartu: "RF-0001-LAMA",
    aktif: false,
  },
];

export const JUMLAH_CONTOH = CONTOH.length;

/** Meniru endpoint berpaginasi milik vendor. */
export function halamanMock(page: number, limit: number): HalamanOnCard {
  const batas = Math.max(1, Math.trunc(limit));
  const mulai = Math.max(0, (Math.max(1, Math.trunc(page)) - 1) * batas);
  const potong = CONTOH.slice(mulai, mulai + batas);
  return {
    anggota: potong,
    adaLagi: mulai + potong.length < CONTOH.length,
    total: CONTOH.length,
  };
}
