// Pemetaan OnCard → tabel anggota, plus pembanding perubahan.
//
// Aturan yang dipakai di sini sengaja konservatif: hanya menyalin identitas,
// memotong panjang sesuai batas kolom di skema (nama 120, telepon 40, alamat
// 500), dan tidak pernah menyalin foto karena kolom anggota.foto menyimpan data
// URL thumbnail 256px — bukan URL luar seperti yang dikirim OnCard.

import type { Anggota } from "../types";
import type { AnggotaOnCard } from "./tipe";

// Sama persis dengan constraint anggota_jenis_check di database.
export type JenisAnggota = "Pelajar" | "Mahasiswa" | "Umum" | "Staf";

/** Email dibandingkan tanpa spasi & huruf besar — sama dengan indeks unik DB. */
export function normalisasiEmail(nilai?: string | null): string {
  return (nilai ?? "").trim().toLowerCase();
}

/** Teks satu baris: spasi berlebih dirapatkan, tanpa spasi di ujung. */
export function normalisasiTeks(nilai?: string | null): string {
  return (nilai ?? "").replace(/\s+/g, " ").trim();
}

/**
 * OnCard menulis peran sebagai teks bebas ("Pelajar", "Guru", "Santri", …).
 * Requirement perpustakaan hanya mengenal empat jenis, jadi peran guru/staf
 * dipetakan ke "Staf" dan sisanya jatuh ke "Pelajar" bila ada kelasnya.
 */
export function petakanJenis(
  jenisOnCard?: string | null,
  kelas?: string | null,
): JenisAnggota {
  const teks = normalisasiTeks(jenisOnCard).toLowerCase();
  if (teks === "mahasiswa") return "Mahasiswa";
  if (teks === "umum") return "Umum";
  if (teks === "staf" || teks === "guru" || teks === "pegawai" || teks === "karyawan") {
    return "Staf";
  }
  if (normalisasiTeks(kelas)) return "Pelajar";
  return "Pelajar";
}

/** Nilai kolom anggota yang akan dipakai bila baris OnCard ini dibuat baru. */
export interface CalonAnggota {
  nama: string;
  email: string;
  telepon: string;
  alamat: string;
  jenis: JenisAnggota;
  aktif: boolean;
}

export function keCalonAnggota(a: AnggotaOnCard): CalonAnggota {
  return {
    nama: normalisasiTeks(a.nama).slice(0, 120),
    email: normalisasiEmail(a.email).slice(0, 200),
    telepon: normalisasiTeks(a.telepon).slice(0, 40),
    alamat: normalisasiTeks(a.alamat).slice(0, 500),
    jenis: petakanJenis(a.jenis, a.kelas),
    aktif: a.aktif !== false,
  };
}

/**
 * Daftar field yang berbeda antara anggota lokal dan data OnCard.
 * Nama field memakai istilah tabel (lowercase) supaya mudah dibaca di log.
 */
export function bandingkan(b: Anggota, a: AnggotaOnCard): string[] {
  const calon = keCalonAnggota(a);
  const ubah: string[] = [];

  if (normalisasiTeks(b.nama) !== calon.nama) ubah.push("nama");
  if (normalisasiEmail(b.email) !== calon.email) ubah.push("email");
  if (normalisasiTeks(b.telepon) !== calon.telepon) ubah.push("telepon");
  if (normalisasiTeks(b.alamat) !== calon.alamat) ubah.push("alamat");
  if (b.jenis !== calon.jenis) ubah.push("jenis");
  if (b.aktif !== calon.aktif) ubah.push("aktif");

  return ubah;
}
