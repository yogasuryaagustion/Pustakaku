// Pemetaan baris database (snake_case) ⇄ tipe domain aplikasi (camelCase).
// Satu-satunya tempat yang tahu bentuk kolom, sehingga perubahan skema tidak
// merambat ke halaman.
//
// Menangkap: baris `eksemplar_buku` (sumber kebenaran inventaris fisik),
// view `v_inventaris_per_buku`, dan helper arah baca/tulis.
// Kolom `buku.stok` diatur oleh trigger fn_sinkronisasi_stok_buku (hitungan
// baris) sehingga ikut sinkronisasi dari eksemplar.

import type {
  AjuanKembali,
  Anggota,
  Buku,
  Peminjaman,
  StatusAjuanKembali,
  StatusPinjam,
} from "../types";
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

export interface BarisEksemplar {
  id: string;
  buku_id: string;
  nomor_inventaris: string;
  status: string;
  kondisi_fisik: string;
  tanggal_pengadaan: string;
  keterangan: string | null;
  dibuat_pada: string;
  diedit_pada: string;
}

export interface BarisInventarisPerBuku {
  buku_id: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: number;
  isbn: string;
  kategori: string;
  rak: string;
  stok: number;
  total_eksemplar: number;
  tersedia: number;
  dipinjam: number;
  rusak: number;
  hilang: number;
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
  /** Kolom migrasi 202611100002 — opsional agar pemanggil lama tetap sah. */
  denda_dibayar?: number | null;
  denda_dibayar_pada?: string | null;
  catatan: string;
  /** Embed opsional tabel pembayaran_denda (migrasi 202611100003). */
  pembayaran_denda?: BarisPembayaranDenda[] | null;
  eksemplar_id?: string | null;
  /** Diisi fungsi RPC pinjam/kembali, atau hasil embed `eksemplar_buku`. */
  nomor_inventaris?: string | null;
  eksemplar_buku?: { nomor_inventaris: string } | null;
}

export interface BarisPembayaranDenda {
  id: string;
  nominal: number;
  catatan: string | null;
  dibuat_pada: string;
}

export interface BarisAjuanKembali {
  id: string;
  peminjaman_id: string;
  anggota_id: string;
  status: string;
  kondisi_divalidasi: string | null;
  catatan: string | null;
  dibuat_pada: string;
  diproses_pada: string | null;
}

/** Kondisi validasi pengembalian yang dikenali UI. */
const KONDISI_AJUAN = ["layak", "rusak_ringan", "rusak_beda", "hilang"];

/** Pengajuan pengembalian anggota → bentuk yang dipakai UI. */
export function keAjuanKembali(r: BarisAjuanKembali): AjuanKembali {
  return {
    id: r.id,
    peminjamanId: r.peminjaman_id,
    anggotaId: r.anggota_id,
    status: r.status as StatusAjuanKembali,
    kondisiDivalidasi: KONDISI_AJUAN.includes(r.kondisi_divalidasi ?? "")
      ? (r.kondisi_divalidasi as AjuanKembali["kondisiDivalidasi"])
      : null,
    catatan: r.catatan ?? "",
    dibuatPada: r.dibuat_pada,
    diprosesPada: r.diproses_pada,
  };
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

// ---- Eksemplar ------------------------------------------------------------
export function keEksemplar(r: BarisEksemplar): BarisEksemplar {
  return { ...r };
}

export function dariEksemplar(e: Partial<BarisEksemplar>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (e.buku_id !== undefined) p.buku_id = e.buku_id;
  if (e.nomor_inventaris !== undefined) p.nomor_inventaris = e.nomor_inventaris;
  if (e.status !== undefined) p.status = e.status;
  if (e.kondisi_fisik !== undefined) p.kondisi_fisik = e.kondisi_fisik;
  if (e.tanggal_pengadaan !== undefined) p.tanggal_pengadaan = e.tanggal_pengadaan;
  if (e.keterangan !== undefined) p.keterangan = e.keterangan;
  if (e.dibuat_pada !== undefined) p.dibuat_pada = e.dibuat_pada;
  if (e.diedit_pada !== undefined) p.diedit_pada = e.diedit_pada;
  return p;
}

// ---- View ringkasan per judul (v_inventaris_per_buku) ---------------------
export function keInventarisPerBuku(r: BarisInventarisPerBuku): BarisInventarisPerBuku {
  return { ...r };
}

// ---- Arah baca/tulis eksemplar -------------------------------------------
/** Kiri ke kanan: baris view → tipe domain (jika dibutuhkan halaman gambar). */
export type DariEksemplar = BarisEksemplar;

/** Kiri ke kanan: tipe domain → baris view. */
export type KeEksemplar = BarisEksemplar;

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
    dendaDibayar: r.denda_dibayar ?? 0,
    dendaDibayarPada: r.denda_dibayar_pada ?? null,
    pembayaranDenda: (r.pembayaran_denda ?? [])
      .map((b) => ({
        id: b.id,
        nominal: b.nominal,
        catatan: b.catatan ?? "",
        dibuatPada: b.dibuat_pada,
      }))
      .sort((a, b) => (a.dibuatPada < b.dibuatPada ? 1 : -1)),
    catatan: r.catatan,
    eksemplarId: r.eksemplar_id ?? null,
    nomorInventaris: r.nomor_inventaris ?? r.eksemplar_buku?.nomor_inventaris ?? null,
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
    peran: p.peran === "admin" ? "admin" : p.peran === "superadmin" ? "superadmin" : "user",
    anggotaId: p.anggota_id ?? undefined,
    dibuatPada: p.dibuat_pada,
  };
}
