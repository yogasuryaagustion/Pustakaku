// Kerangka route handler: sesi, kebijakan akses, dan penanganan galat.
// Semua endpoint di src/app/api/* memakai berkas ini sehingga penegakan hak
// akses terpusat di server — bukan sekadar menyembunyikan menu di layar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "./server";
import {
  cekIzin,
  KEBIJAKAN_BAWAAN,
  normalisasiKebijakan,
  peranEfektif,
  type Kebijakan,
  type PeranAkses,
} from "../izin";
import { kePengguna, type BarisProfil } from "./peta";
import type { Pengguna } from "../auth";

/** Galat yang sudah membawa status HTTP dan pesan ramah untuk pengguna. */
export class GalatApi extends Error {
  status: number;
  constructor(pesan: string, status = 400) {
    super(pesan);
    this.name = "GalatApi";
    this.status = status;
  }
}

export interface Konteks {
  supabase: SupabaseClient;
  /** Akun yang sedang masuk (null bila tamu). */
  pengguna: Pengguna | null;
  peran: PeranAkses;
  kebijakan: Kebijakan;
  /** Cek matriks izin yang sama dengan cekIzin() di sisi klien. */
  izin: (idIzin: string) => boolean;
}

interface OpsiKonteks {
  /** Wajib ada sesi login. */
  wajibMasuk?: boolean;
  /** Wajib peran petugas (Admin ATAU Super Admin). */
  wajibAdmin?: boolean;
  /** Wajib peran Super Admin — kelola akun, kebijakan akses, & pengaturan. */
  wajibSuperAdmin?: boolean;
  /** Wajib izin tertentu dari matriks kebijakan akses. */
  wajibIzin?: string;
}

// === Cache matriks izin =====================================================
// Baris `kebijakan_akses` dibaca pada SETIAP request API (konteksRoute) tetapi
// hanya berubah saat admin menyimpannya lewat PUT /api/kebijakan. Tanpa cache,
// tiap request menambah satu roundtrip Supabase (~150–300 ms) — terasa sebagai
// jeda sebelum seluruh halaman terisi. TTL pendek + invalidasi eksplisit saat
// menyimpan membuat perubahan kebijakan tetap berlaku seketika; proses lain
// paling lama menunggu TTL.
const TTL_KEBIJAKAN_MS = 30_000;
let cacheKebijakan: { nilai: Kebijakan; kedaluwarsa: number } | null = null;

/** Buang cache matriks izin — dipanggil setiap kali admin menyimpan kebijakan. */
export function hapusCacheKebijakan(): void {
  cacheKebijakan = null;
}

/** Matriks izin terbaru (dari cache bila masih berlaku). */
async function bacaKebijakan(supabase: SupabaseClient): Promise<Kebijakan> {
  const kini = Date.now();
  if (cacheKebijakan && cacheKebijakan.kedaluwarsa > kini) {
    return cacheKebijakan.nilai;
  }
  const { data, error } = await supabase
    .from("kebijakan_akses")
    .select("izin, versi, diubah_pada, diubah_oleh")
    .eq("id", true)
    .maybeSingle();
  if (error) throw dariSupabase(error);
  const nilai = normalisasiKebijakan(data ?? KEBIJAKAN_BAWAAN);
  cacheKebijakan = { nilai, kedaluwarsa: kini + TTL_KEBIJAKAN_MS };
  return nilai;
}

/**
 * Matriks izin untuk pembacaan publik (GET /api/kebijakan): tanpa sesi, dan
 * tanpa query tambahan bila cache masih berlaku — endpoint ini dibaca setiap
 * kali halaman dibuka untuk menentukan menu & tombol yang tampil.
 */
export async function kebijakanPublik(): Promise<Kebijakan> {
  const kini = Date.now();
  if (cacheKebijakan && cacheKebijakan.kedaluwarsa > kini) return cacheKebijakan.nilai;
  return bacaKebijakan(await createSupabaseServer());
}

/**
 * Konteks untuk pembacaan murni-RLS (route GET tanpa gerbang):
 * TANPA validasi sesi ke GoTrue dan TANPA baca tabel `profiles`.
 *
 * Data yang dikembalikan tetap persis sama karena scoping dilakukan RLS di
 * database memakai token cookie — dua roundtrip (~0,4–1 dtk) dihemat pada
 * setiap muat halaman. `pengguna`/`peran` sengaja `null`/`tamu`, sehingga bila
 * route mulai membaca k.pengguna, k.peran, atau k.izin, ia harus kembali ke
 * konteksRoute() (baca komentar di pemakaian).
 */
export async function konteksPublik(): Promise<Konteks> {
  const supabase = await createSupabaseServer();
  const kebijakan = await bacaKebijakan(supabase);
  return {
    supabase,
    pengguna: null,
    peran: "tamu",
    kebijakan,
    izin: (idIzin: string) => cekIzin(kebijakan, "tamu", idIzin),
  };
}

/**
 * Bangun konteks request: klien Supabase bersistes, profil/kebijakan terbaca,
 * lalu terapkan gerbang yang diminta. Melempar GalatApi bila ditolak.
 */
export async function konteksRoute(opsi: OpsiKonteks = {}): Promise<Konteks> {
  const supabase = await createSupabaseServer();

  // Validasi sesi (GoTrue) dan pembacaan matriks izin berjalan PARALEL —
  // dahulu berurutan, sehingga menambah satu jeda roundtrip penuh tiap request.
  const [hasilAuth, kebijakan] = await Promise.all([
    // auth.getUser() memvalidasi token ke GoTrue (bukan sekadar membaca cookie).
    supabase.auth.getUser(),
    bacaKebijakan(supabase),
  ]);
  const { data: auth, error: errAuth } = hasilAuth;
  const uid = auth.user?.id ?? null;

  let profil: BarisProfil | null = null;
  if (uid) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nama, email, peran, anggota_id, dibuat_pada")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw dariSupabase(error);
    profil = data;
  }

  const peran: PeranAkses = peranEfektif(profil?.peran);
  const izin = (idIzin: string) => cekIzin(kebijakan, peran, idIzin);

  const pengguna: Pengguna | null = profil ? kePengguna(profil) : null;

  if (opsi.wajibMasuk && !pengguna) {
    throw new GalatApi(
      errAuth && errAuth.name !== "AuthSessionMissingError"
        ? "Sesi Anda berakhir — silakan masuk kembali."
        : "Silakan masuk terlebih dahulu.",
      401
    );
  }
  if (opsi.wajibSuperAdmin && peran !== "superadmin") {
    throw new GalatApi("Halaman ini hanya untuk Super Admin.", 403);
  }
  if (opsi.wajibAdmin && peran !== "admin" && peran !== "superadmin") {
    throw new GalatApi("Halaman ini hanya untuk Admin dan Super Admin.", 403);
  }
  if (opsi.wajibIzin && !izin(opsi.wajibIzin)) {
    throw new GalatApi("Anda tidak memiliki izin untuk melakukan aksi ini.", 403);
  }

  return { supabase, pengguna, peran, kebijakan, izin };
}

/** Balasan JSON standar. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Balasan galat dengan format { pesan } yang dipahami apiFetch(). */
export function galat(pesan: string, status = 400): Response {
  return Response.json({ pesan }, { status });
}

/**
 * Bungkus handler: GalatApi → status & pesannya; galat tak terduga → 500
 * (pesan lengkap hanya di log, kecuali mode pengembangan).
 */
export async function jalankan(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GalatApi) return galat(e.message, e.status);
    if (e instanceof Error && e.message.includes("belum dikonfigurasi")) {
      return galat(e.message, 503);
    }
    console.error("[api]", e);
    const rincian = process.env.NODE_ENV !== "production" && e instanceof Error ? e.message : "";
    return galat(
      rincian
        ? `Terjadi kesalahan di server: ${rincian}`
        : "Terjadi kesalahan di server. Coba lagi nanti.",
      500
    );
  }
}

/** Ubah galat PostgREST/GoTrue menjadi GalatApi berbahasa Indonesia. */
/**
 * True bila galat Supabase berarti kolom yang ditulis belum ada di database —
 * terjadi saat kode lebih baru daripada migrasi yang dijalankan. Pemanggil
 * memakai ini untuk menyimpan sisa data agar halaman tetap berfungsi.
 */
export function kolomBelumAda(err: { code?: string } | null | undefined): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

export function dariSupabase(err: { code?: string; message?: string; details?: string }): GalatApi {
  const kode = err.code ?? "";
  const pesan = err.message ?? "";

  if (kode === "42501" || /row-level security/i.test(pesan)) {
    return new GalatApi("Anda tidak memiliki izin untuk melakukan aksi ini.", 403);
  }
  if (kode === "P0001") return new GalatApi(pesan, 400); // raise exception dari RPC
  if (kode === "23505") return new GalatApi("Data duplikat — data sama sudah tersimpan.", 409);
  if (kode === "23503") {
    return new GalatApi(
      "Data masih dirujuk peminjaman/riwayat dan tidak dapat dihapus.",
      409
    );
  }
  if (kode === "22P02" || kode === "22007" || kode === "22008") {
    return new GalatApi("Format data tidak valid.", 400);
  }
  if (kode === "PGRST301" || kode === "401" || /jwt|token/i.test(pesan)) {
    return new GalatApi("Sesi Anda berakhir — silakan masuk kembali.", 401);
  }
  if (/duplicate key/i.test(pesan)) return new GalatApi("Data duplikat — data sama sudah tersimpan.", 409);
  if (kode.startsWith("PGRST")) return new GalatApi(pesan || "Permintaan gagal diproses.", 400);
  return new GalatApi(pesan || "Terjadi kesalahan di server.", 500);
}

/** Baca body JSON request (null bila kosong / bukan JSON). */
export async function bacaBody<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
