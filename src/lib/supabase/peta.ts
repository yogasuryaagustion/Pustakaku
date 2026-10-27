// Pemetaan baris database (snake_case) ⇄ tipe domain aplikasi (camelCase).
// Satu-satunya tempat yang tahu bentuk kolom, sehingga perubahan skema tidak
// merambat ke halaman.

import type { Anggota, Buku, Peminjaman, StatusPinjam } from "../types";
import type { JejakAksi, JenisJejak } from "../audit";
import type { Pengguna } from "../auth";

export interface BarisBuku {
  id: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: number;
  isbn: string;
  kategori: string;
  rak: string;
  stok: number;
  deskripsi: string;
  gambar: string | null;
  ditambahkan_pada: string;
}

export interface BarisAnggota {
  id: string;
  nomor_anggota: string;
  nama: string;
  email: string;
  telepon: string;
  alamat: string;
  jenis: string;
  bergabung_pada: string;
  aktif: boolean;
  foto: string | null;
}

export interface BarisPeminjaman {
  id: string;
  kode_pinjam: string;
  buku_id: string;
  anggota_id: string;
  tanggal_pinjam: string;
  tanggal_kembali: string;
  tanggal_kembali_aktual: string | null;
  status: string;
  denda: number;
  catatan: string;
}

export interface BarisJejak {
  id: string;
  waktu: string;
  aktor: string;
  peran: string;
  jenis: string;
  aksi: string;
  objek: string;
  detail: string | null;
}

export interface BarisProfil {
  id: string;
  nama: string;
  email: string;
  peran: string;
  anggota_id: string | null;
  dibuat_pada: string;
}

// ---- Buku -----------------------------------------------------------------
export function keBuku(r: BarisBuku): Buku {
  return {
    id: r.id,
    judul: r.judul,
    penulis: r.penulis,
    penerbit: r.penerbit,
    tahun: r.tahun,
    isbn: r.isbn,
    kategori: r.kategori as Buku["kategori"],
    rak: r.rak,
    stok: r.stok,
    deskripsi: r.deskripsi,
    gambar: r.gambar,
    ditambahkanPada: r.ditambahkan_pada,
  };
}

export function dariBuku(b: Partial<Buku>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (b.judul !== undefined) p.judul = b.judul;
  if (b.penulis !== undefined) p.penulis = b.penulis;
  if (b.penerbit !== undefined) p.penerbit = b.penerbit;
  if (b.tahun !== undefined) p.tahun = b.tahun;
  if (b.isbn !== undefined) p.isbn = b.isbn;
  if (b.kategori !== undefined) p.kategori = b.kategori;
  if (b.rak !== undefined) p.rak = b.rak;
  if (b.stok !== undefined) p.stok = b.stok;
  if (b.deskripsi !== undefined) p.deskripsi = b.deskripsi;
  if (b.gambar !== undefined) p.gambar = b.gambar;
  if (b.ditambahkanPada !== undefined) p.ditambahkan_pada = b.ditambahkanPada;
  return p;
}

// ---- Anggota --------------------------------------------------------------
export function keAnggota(r: BarisAnggota): Anggota {
  return {
    id: r.id,
    nomorAnggota: r.nomor_anggota,
    nama: r.nama,
    email: r.email,
    telepon: r.telepon,
    alamat: r.alamat,
    jenis: r.jenis as Anggota["jenis"],
    bergabungPada: r.bergabung_pada,
    aktif: r.aktif,
    foto: r.foto,
  };
}

export function dariAnggota(a: Partial<Anggota>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (a.nomorAnggota !== undefined) p.nomor_anggota = a.nomorAnggota;
  if (a.nama !== undefined) p.nama = a.nama;
  if (a.email !== undefined) p.email = a.email;
  if (a.telepon !== undefined) p.telepon = a.telepon;
  if (a.alamat !== undefined) p.alamat = a.alamat;
  if (a.jenis !== undefined) p.jenis = a.jenis;
  if (a.bergabungPada !== undefined) p.bergabung_pada = a.bergabungPada;
  if (a.aktif !== undefined) p.aktif = a.aktif;
  if (a.foto !== undefined) p.foto = a.foto;
  return p;
}

// ---- Peminjaman -----------------------------------------------------------
export function kePeminjaman(r: BarisPeminjaman): Peminjaman {
  return {
    id: r.id,
    kodePinjam: r.kode_pinjam,
    bukuId: r.buku_id,
    anggotaId: r.anggota_id,
    tanggalPinjam: r.tanggal_pinjam,
    tanggalKembali: r.tanggal_kembali,
    tanggalKembaliAktual: r.tanggal_kembali_aktual,
    status: r.status as StatusPinjam,
    denda: r.denda,
    catatan: r.catatan,
  };
}

// ---- Jejak aktivitas ------------------------------------------------------
export function keJejak(r: BarisJejak): JejakAksi {
  return {
    id: r.id,
    waktu: r.waktu,
    aktor: r.aktor,
    peran: r.peran,
    jenis: r.jenis as JenisJejak,
    aksi: r.aksi,
    objek: r.objek,
    detail: r.detail ?? undefined,
  };
}

// ---- Profil / akun --------------------------------------------------------
export function kePengguna(p: BarisProfil): Pengguna {
  return {
    id: p.id,
    nama: p.nama,
    email: p.email,
    sandiHash: "", // tidak pernah disimpan/dikirim — Supabase Auth yang mengelola
    peran: p.peran === "admin" ? "admin" : "user",
    anggotaId: p.anggota_id ?? undefined,
    dibuatPada: p.dibuat_pada,
  };
}
