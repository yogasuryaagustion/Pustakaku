// Kerangka route handler: sesi, kebijakan akses, dan penanganan galat.
// Semua endpoint di src/app/api/* memakai berkas ini sehingga penegakan hak
// akses terpusat di server — bukan sekadar menyembunyikan menu di layar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "./server";
import {
  cekIzin,
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
  /** Wajib peran admin. */
  wajibAdmin?: boolean;
  /** Wajib izin tertentu dari matriks kebijakan akses. */
  wajibIzin?: string;
}

/**
 * Bangun konteks request: klien Supabase bersistes, profil/kebijakan terbaca,
 * lalu terapkan gerbang yang diminta. Melempar GalatApi bila ditolak.
 */
export async function konteksRoute(opsi: OpsiKonteks = {}): Promise<Konteks> {
  const supabase = await createSupabaseServer();

  // auth.getUser() memvalidasi token ke GoTrue (bukan sekadar membaca cookie).
  const { data: auth, error: errAuth } = await supabase.auth.getUser();
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

  // Matriks izin terbuka untuk semua peran (dipakai seluruh UI juga).
  const { data: barisKb, error: errKb } = await supabase
    .from("kebijakan_akses")
    .select("izin, versi, diubah_pada, diubah_oleh")
    .eq("id", true)
    .maybeSingle();
  if (errKb) throw dariSupabase(errKb);

  const kebijakan = normalisasiKebijakan(barisKb);
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
  if (opsi.wajibAdmin && peran !== "admin") {
    throw new GalatApi("Halaman ini hanya untuk admin.", 403);
  }
  if (opsi.wajibIzin && !izin(opsi.wajibIzin)) {
    throw new GalatApi("Anda tidak memiliki izin untuk melakukan aaksi ini.", 403);
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
