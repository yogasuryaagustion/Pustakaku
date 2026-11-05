// API pemeriksaan nomor inventaris eksemplar untuk satu judul.
//
// GET  /api/eksemplar/[id]/pemeriksaan → daftar eksemplar (baris) + total
// POST /api/eksemplar/[id]/pemeriksaan   → perbarui status/kondisi tiap
//                                          eksemplar (Super Admin / petugas)
//

import {
  bacaBody,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { keEksemplar, type BarisEksemplar } from "@/lib/supabase/peta";
import {
  sahkanPemeriksaanBody,
  type RawPemeriksaan,
  type RawPemeriksaanBaris,
} from "@/lib/supabase/validasi";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { JenisJejak } from "@/lib/audit";
import { GalatApi } from "@/lib/supabase/konteks";
import { DAFTAR_IZIN, cekIzin, type PeranAkses } from "@/lib/izin";

// ---------- GET /api/eksemplar/[id]/pemeriksaan  (Super Admin) ----------
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });

    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .select("*")
      .eq("buku_id", id)
      .order("nomor_inventaris", { ascending: true });
    if (error) throw dariSupabase(error);

    const eksemplar = (data ?? []) as BarisEksemplar[];
    return json({
      pemeriksaan: eksemplar.map((e) => ({
        id: e.id,
        nomor_inventaris: e.nomor_inventaris,
        status: e.status,
        kondisi_fisik: e.kondisi_fisik,
        tanggal_pengadaan: e.tanggal_pengadaan,
        keterangan: e.keterangan ?? "",
      })),
      total: eksemplar.length,
    });
  });
}

// ---------- POST /api/eksemplar/[id]/pemeriksaan  (Super Admin / petugas) ----------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });

    const body = (await bacaBody<RawPemeriksaan>(request)) ?? {};
    const isi = sahkanPemeriksaanBody(body);
    if (!Array.isArray(isi.pemeriksaan)) {
      throw new GalatApi("List pemeriksaan harus berupa array.", 400);
    }
    if (isi.pemeriksaan.some((p) => !p.nomor_inventaris)) {
      throw new GalatApi("Setiap baris pemeriksaan harus memuat nomor_inventaris.", 400);
    }

    const trans = await k.supabase;
    if (!trans) throw new GalatApi("Klien Supabase tidak tersedia.", 503);

    for (const baris of (isi.pemeriksaan as RawPemeriksaan[]) as BarisEksemplar[]) {
      // cek status & kondisi dari nomor inventaris (dari `buku`) — basis data
      // yang sudah aktif, daripada mengandalkan body yang bisa korup.
      if (!okStatus(baris.status)) {
        throw new GalatApi(`Baris "${baris.nomor_inventaris}" memiliki status tidak dikenal.`, 400);
      }
      if (!okKondisi(baris.kondisi_fisik)) {
        throw new GalatApi(`Baris "${baris.nomor_inventaris}" memiliki kondisi tidak dikenal.`, 400);
      }
      const { error } = await trans
        .from("eksemplar_buku")
        .update({
          status: baris.status,
          kondisi_fisik: baris.kondisi_fisik,
          keterangan: baris.keterangan ?? null,
          diedit_pada: new Date().toISOString(),
        })
        .eq("id", baris.id_eksemplar ?? "");
      if (error) throw dariSupabase(error);
    }

    await catatJejakServer(k, {
      jenis: "eksemplar" as JenisJejak,
      aksi: "Pemeriksaan dikerjakan",
      objek: isi.pemeriksaan.length + " baris",
      detail: "pemeriksaan inventaris",
      anggotaId: null,
    });

    return json({ ok: true, diterima: isi.pemeriksaan.length });
  });
}

// ---- pembantu -------------------------------------------------------------

function okStatus(s: string): boolean {
  return s === "tersedia" || s === "dipinjam" || s === "rusak" || s === "hilang";
}

function okKondisi(k: string): boolean {
  return k === "layak" || k === "rusak_ringan" || k === "rusak_beda" || k === "hilang";
}

function dariSupabase(err: { code?: string; message?: string; details?: string }) {
  const kode = err.code ?? "";
  const pesan = err.message ?? "";

  if (kode === "42501" || /row-level security/i.test(pesan)) {
    return new GalatApi("Anda tidak memiliki izin untuk melakukan aksi ini.", 403);
  }
  if (kode === "P0001") return new GalatApi(pesan, 400);
  if (kode === "23505") return new GalatApi("Data duplikat — nomor inventaris sudah terdaftar.", 409);
  if (kode === "23503") {
    return new GalatApi("Data masih dirujuk peminjaman/riwayat dan tidak dapat dihapus.", 409);
  }
  if (kode === "22P02" || kode === "22007" || kode === "22008") {
    return new GalatApi("Format data tidak valid.", 400);
  }
  if (kode === "PGRST301" || kode === "401" || /jwt|token/i.test(pesan)) {
    return new GalatApi("Sesi Anda berakhir — silakan masuk kembali.", 401);
  }
  if (/duplicate key/i.test(pesan)) {
    return new GalatApi("Data duplikat — nomor inventaris sudah terdaftar.", 409);
  }
  if (kode.startsWith("PGRST")) return new GalatApi(pesan || "Permintaan gagal diproses.", 400);
  return new GalatApi(pesan || "Terjadi kesalahan di server.", 500);
}
