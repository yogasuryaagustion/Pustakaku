// Validasi & normalisasi body request di sisi server.
// Semua nilai yang masuk diverifikasi ulang di sini — validasi formulir di
// layar hanya kenyamanan, bukan keamanan.

import { KATEGORI_LIST, type Anggota, type Buku } from "../types";
import { GalatApi } from "./konteks";
import type { BarisEksemplar } from "./peta";

type Raw = Record<string, unknown> | null;

function objek(v: Raw): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function teks(
  v: unknown,
  ops: { wajib?: boolean; min?: number; max: number; nama: string; kosong?: string }
): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) {
    if (ops.wajib) throw new GalatApi(`${ops.nama} wajib diisi.`);
    return ops.kosong ?? "";
  }
  if (s.length > ops.max) throw new GalatApi(`${ops.nama} maksimal ${ops.max} karakter.`);
  if (ops.min && s.length < ops.min) {
    throw new GalatApi(`${ops.nama} minimal ${ops.min} karakter.`);
  }
  return s;
}

function bilangan(v: unknown, ops: { nama: string; min: number; max: number; bawaan?: number }): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    if (ops.bawaan !== undefined) return ops.bawaan;
    throw new GalatApi(`${ops.nama} harus berupa angka.`);
  }
  const bulat = Math.round(n);
  if (bulat < ops.min || bulat > ops.max) {
    throw new GalatApi(`${ops.nama} harus antara ${ops.min} dan ${ops.max}.`);
  }
  return bulat;
}

export function emailSah(v: unknown, { wajib = false }: { wajib?: boolean } = {}): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!s) {
    if (wajib) throw new GalatApi("Email wajib diisi.");
    return "";
  }
  if (s.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new GalatApi("Format email tidak valid.");
  }
  return s;
}

/** Validasi payload buku (tambah/ubah). */
export function sahkanBukuBody(body: Raw, { wajibSemua = false } = {}): Partial<Buku> {
  const o = objek(body);
  const out: Partial<Buku> = {};
  if (o.judul !== undefined || wajibSemua) {
    out.judul = teks(o.judul, { nama: "Judul", wajib: true, min: 1, max: 300 });
  }
  if (o.penulis !== undefined) out.penulis = teks(o.penulis, { nama: "Penulis", max: 200 });
  if (o.penerbit !== undefined) out.penerbit = teks(o.penerbit, { nama: "Penerbit", max: 200 });
  if (o.tahun !== undefined || wajibSemua) {
    out.tahun = bilangan(o.tahun, { nama: "Tahun", min: 1000, max: 2100, bawaan: wajibSemua ? 2020 : undefined });
  }
  if (o.isbn !== undefined) out.isbn = teks(o.isbn, { nama: "ISBN", max: 40 });
  if (o.kategori !== undefined || wajibSemua) {
    const k = teks(o.kategori, { nama: "Kategori", max: 20 });
    if (!KATEGORI_LIST.includes(k as Buku["kategori"])) {
      throw new GalatApi("Kategori tidak dikenal.");
    }
    out.kategori = k as Buku["kategori"];
  }
  if (o.rak !== undefined) out.rak = teks(o.rak, { nama: "Rak", max: 40 });
  if (o.stok !== undefined || wajibSemua) {
    out.stok = bilangan(o.stok, { nama: "Stok", min: 0, max: 100000, bawaan: wajibSemua ? 1 : undefined });
  }
  if (o.deskripsi !== undefined) out.deskripsi = teks(o.deskripsi, { nama: "Deskripsi", max: 5000 });
  if (o.harga !== undefined || wajibSemua) {
    out.harga = bilangan(o.harga, {
      nama: "Harga buku",
      min: 0,
      max: 100_000_000,
      bawaan: 0,
    });
  }
  if (o.gambar !== undefined) {
    out.gambar = o.gambar === null || o.gambar === "" ? null : teks(o.gambar, { nama: "Gambar", max: 2000 });
  }
  if (o.ditambahkanPada !== undefined) {
    out.ditambahkanPada = tanggal(o.ditambahkanPada, "Tanggal ditambahkan");
  }
  return out;
}

/** Validasi payload anggota (tambah/ubah). */
export function sahkanAnggotaBody(body: Raw, { wajibSemua = false } = {}): Partial<Anggota> {
  const o = objek(body);
  const out: Partial<Anggota> = {};
  if (o.nama !== undefined || wajibSemua) {
    out.nama = teks(o.nama, { nama: "Nama", wajib: true, min: 3, max: 120 });
  }
  if (o.email !== undefined || wajibSemua) out.email = emailSah(o.email);
  if (o.telepon !== undefined) out.telepon = teks(o.telepon, { nama: "Telepon", max: 40 });
  if (o.alamat !== undefined) out.alamat = teks(o.alamat, { nama: "Alamat", max: 500 });
  if (o.jenis !== undefined || wajibSemua) {
    const j = teks(o.jenis, { nama: "Jenis anggota", max: 20, kosong: "Umum" });
    if (!["Pelajar", "Mahasiswa", "Umum", "Staf"].includes(j)) throw new GalatApi("Jenis anggota tidak dikenal.");
    out.jenis = j as Anggota["jenis"];
  }
  if (o.aktif !== undefined) {
    if (typeof o.aktif !== "boolean") throw new GalatApi("Status aktif tidak valid.");
    out.aktif = o.aktif;
  }
  if (o.foto !== undefined) {
    if (o.foto === null || o.foto === "") {
      out.foto = null;
    } else {
      const foto = teks(o.foto, { nama: "Foto", max: 400_000 });
      if (!/^data:image\/(jpeg|png|webp);base64,/i.test(foto)) throw new GalatApi("Format foto tidak valid.");
      out.foto = foto;
    }
  }
  if (o.nomorAnggota !== undefined) out.nomorAnggota = teks(o.nomorAnggota, { nama: "Nomor anggota", max: 30 });
  if (o.bergabungPada !== undefined) out.bergabungPada = tanggal(o.bergabungPada, "Tanggal bergabung");
  return out;
}

/** Tanggal ISO (YYYY-MM-DD) — nilai lain ditolak. */
export function tanggal(v: unknown, nama: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new GalatApi(`${nama} harus berformat YYYY-MM-DD.`);
  }
  return s;
}

/** Ubah nilai apa pun menjadi string pendek (id/kunci asing). */
function keString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Payload eksemplar fisik (tambah/ubah). */
export type RawEksemplar = Partial<BarisEksemplar>;

export function sahkanEksemplarBody(body: Raw): Partial<BarisEksemplar> {
  const o = objek(body);
  const out: Partial<BarisEksemplar> = {};
  if (o.buku_id !== undefined) out.buku_id = keString(o.buku_id);
  if (o.nomor_inventaris !== undefined) out.nomor_inventaris = teks(o.nomor_inventaris, { nama: "Nomor inventaris", max: 120 });
  if (o.status !== undefined) out.status = teks(o.status, { nama: "Status", max: 20 });
  if (o.kondisi_fisik !== undefined) out.kondisi_fisik = teks(o.kondisi_fisik, { nama: "Kondisi fisik", max: 20 });
  if (o.tanggal_pengadaan !== undefined) {
    out.tanggal_pengadaan = tanggal(o.tanggal_pengadaan, "Tanggal pengadaan");
  }
  if (o.keterangan !== undefined) out.keterangan = teksOpsional(o.keterangan, 2000);
  return out;
}

/**
 * Jumlah salinan yang ditambahkan sekaligus. Batas 50 sama dengan batas di
 * fungsi database `tambah_eksemplar_banyak`; nilai kosong berarti 1 salinan
 * supaya pemanggil lama tetap berjalan.
 */
export function sahkanJumlahEksemplar(v: unknown): number {
  if (v === undefined || v === null || v === "") return 1;
  return bilangan(v, { nama: "Jumlah eksemplar", min: 1, max: 50 });
}

/** Validasi payload pemeriksaan nomor inventaris. */
export interface RawPemeriksaanBaris {
  /** id eksemplar dari baris pemeriksaan */
  id_eksemplar?: unknown;
  nomor_inventaris?: unknown;
  status?: unknown;
  kondisi_fisik?: unknown;
  keterangan?: unknown;
}

export interface RawPemeriksaan {
  pemeriksaan?: RawPemeriksaanBaris[];
}

export function sahkanPemeriksaanBody(body: Raw): RawPemeriksaan {
  const o = objek(body);
  const out: RawPemeriksaan = {};
  const daftar = Array.isArray(o.pemeriksaan) ? o.pemeriksaan : [];
  out.pemeriksaan = daftar.map((p) => {
    if (!p || typeof p !== "object") {
      throw new GalatApi("Baris pemeriksaan harus berupa objek.");
    }
    const baris: RawPemeriksaanBaris = {};
    if (p.id_eksemplar !== undefined) baris.id_eksemplar = p.id_eksemplar;
    if (p.nomor_inventaris !== undefined) baris.nomor_inventaris = teks(p.nomor_inventaris, { nama: "Nomor inventaris", max: 120 });
    if (p.status !== undefined) baris.status = teks(p.status, { nama: "Status", max: 20 });
    if (p.kondisi_fisik !== undefined) baris.kondisi_fisik = teks(p.kondisi_fisik, { nama: "Kondisi fisik", max: 20 });
    if (p.keterangan !== undefined) baris.keterangan = teksOpsional(p.keterangan, 2000);
    return baris;
  });
  return out;
}

/** Validasi payload stock opname. */
export interface RawOpnameBaris {
  id?: unknown;
  buku_id?: unknown;
  nomor_inventaris?: unknown;
  status?: unknown;
  kondisi_fisik?: unknown;
  tanggal_pengadaan?: unknown;
  keterangan?: unknown;
  jumlah_fisik?: unknown;
  ditemukan?: unknown;
  tidak_ditemukan?: unknown;
}

export interface RawOpname {
  komentar?: unknown;
  baris?: RawOpnameBaris[];
}

export function sahkanOpnameBody(body: Raw): RawOpname {
  const o = objek(body);
  const out: RawOpname = {};
  if (o.komentar !== undefined) out.komentar = teksOpsional(o.komentar, 2000);
  const daftar = Array.isArray(o.baris) ? o.baris : [];
  out.baris = daftar.map((b) => {
    if (!b || typeof b !== "object") {
      throw new GalatApi("Baris opname harus berupa objek.");
    }
    const baris: RawOpnameBaris = {};
    if (b.id !== undefined && b.id !== null) baris.id = b.id;
    if (b.buku_id !== undefined) baris.buku_id = keString(b.buku_id);
    if (b.nomor_inventaris !== undefined) baris.nomor_inventaris = teks(b.nomor_inventaris, { nama: "Nomor inventaris", max: 120 });
    if (b.status !== undefined) baris.status = teks(b.status, { nama: "Status", max: 20 });
    if (b.kondisi_fisik !== undefined) baris.kondisi_fisik = teks(b.kondisi_fisik, { nama: "Kondisi fisik", max: 20 });
    if (b.tanggal_pengadaan !== undefined) {
      baris.tanggal_pengadaan = tanggal(b.tanggal_pengadaan, "Tanggal pengadaan");
    }
    if (b.keterangan !== undefined) baris.keterangan = teksOpsional(b.keterangan, 2000);
    if (b.jumlah_fisik !== undefined) {
      const n = bilangan(b.jumlah_fisik, { nama: "Jumlah fisik", min: 0, max: 100000 });
      baris.jumlah_fisik = n;
    }
    if (b.ditemukan !== undefined) {
      const n = bilangan(b.ditemukan, { nama: "Ditemukan", min: 0, max: 100000 });
      baris.ditemukan = n;
    }
    if (b.tidak_ditemukan !== undefined) {
      const n = bilangan(b.tidak_ditemukan, { nama: "Tidak ditemukan", min: 0, max: 100000 });
      baris.tidak_ditemukan = n;
    }
    return baris;
  });
  return out;
}

/** Kata sandi: minimal 6 karakter (mengikuti aturan lama). */
export function sahkanSandi(v: unknown, nama = "Kata sandi"): string {
  const s = typeof v === "string" ? v : "";
  if (s.length < 6) throw new GalatApi(`${nama} minimal 6 karakter.`);
  if (s.length > 200) throw new GalatApi(`${nama} maksimal 200 karakter.`);
  return s;
}

/** String opsional apa pun (dipakai impor data lama). */
export function teksOpsional(v: unknown, max = 1000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
