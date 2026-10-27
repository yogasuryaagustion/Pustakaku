// Validasi & normalisasi body request di sisi server.
// Semua nilai yang masuk diverifikasi ulang di sini — validasi formulir di
// layar hanya kenyamanan, bukan keamanan.

import { KATEGORI_LIST, type Anggota, type Buku } from "../types";
import { GalatApi } from "./konteks";

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
    if (!["Pelajar", "Umum", "Staf"].includes(j)) throw new GalatApi("Jenis anggota tidak dikenal.");
    out.jenis = j as Anggota["jenis"];
  }
  if (o.aktif !== undefined) {
    if (typeof o.aktif !== "boolean") throw new GalatApi("Status aktif tidak valid.");
    out.aktif = o.aktif;
  }
  if (o.foto !== undefined) {
    out.foto = o.foto === null || o.foto === "" ? null : teks(o.foto, { nama: "Foto", max: 400_000 });
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
