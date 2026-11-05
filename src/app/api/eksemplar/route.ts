// API Eksemplar fisik — satu eksemplar: daftar, tambah, ubah, hapus, plus
// pemeriksaan nomor inventaris, rekonsiliasi per judul, dan opname.
//
// Skema yang dijamin (lihat supabase/migrations/202611050001_eksemplar_buku.sql):
//   CREATE TABLE IF NOT EXISTS eksemplar_buku (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     buku_id UUID NOT NULL REFERENCES bukus(id) ON DELETE CASCADE,
//     nomor_inventaris TEXT NOT NULL,
//     status TEXT NOT NULL DEFAULT 'tersedia'
//       CHECK (status IN ('tersedia','dipinjam','rusak','hilang')),
//     kondisi_fisik TEXT NOT NULL DEFAULT 'layak'
//       CHECK (kondisi_fisik IN ('layak','rusak_ringan','rusak_beda','hilang')),
//     tanggal_pengadaan DATE NOT NULL DEFAULT CURRENT_DATE,
//     keterangan TEXT,
//     dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     diedit_pada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     UNIQUE (nomor_inventaris) WHERE nomor_inventaris IS NOT NULL,
//     UNIQUE (buku_id) WHERE status = 'dipinjam'
//   );
//   CREATE OR REPLACE VIEW v_inventaris_per_buku AS
//     SELECT b.id AS buku_id, b.judul, b.pengarang, b.penerbit, b.tahun_terbit,
//            b.tempat_terbit, b.bahasa, b.kategori, b.plat, b.dewey, b.cls,
//            b.sinopsis, b.cover_url, b.ditambahkan_pada, b.diedit_pada, b.dibuat_pada,
//            COUNT(e.id) AS total_eksemplar,
//            COUNT(e.id) FILTER (WHERE e.status = 'tersedia') AS tersedia,
//            COUNT(e.id) FILTER (WHERE e.status = 'dipinjam') AS dipinjam,
//            COUNT(e.id) FILTER (WHERE e.status = 'rusak') AS rusak,
//            COUNT(e.id) FILTER (WHERE e.status = 'hilang') AS hilang
//     FROM bukus b LEFT JOIN eksemplar_buku e ON e.buku_id = b.id
//     GROUP BY b.id;
//   CREATE OR REPLACE FUNCTION fn_sinkronisasi_stok_buku() RETURNS trigger
//     UPDATE bukus SET stok = v.total FROM (SELECT buku_id, COUNT(*) total
//       FROM eksemplar_buku WHERE buku_id IS NOT NULL GROUP BY buku_id) v
//       WHERE bukus.id = v.buku_id;
//   CREATE TRIGGER trg_sinkronisasi_stok_buku AFTER INSERT OR UPDATE OF buku_id, status
//     ON eksemplar_buku FOR EACH STATEMENT EXECUTE FUNCTION fn_sinkronisasi_stok_buku();
//
// Pola route handler:
//   * konteksPublik (GET publik) / konteksRoute (PUT/POST/DELETE berbasis sesi)
//     dari lib/supabase/konteks — akses RLS tetap menegakkan hierarki izin.
//   * Validasi server dengan sahkan*Body dari lib/supabase/validasi.
//   * Jejak aktivitas tercatat lewat catatJejakServer.
//   * Balasan galat PostgREST/GoTrue → GalatApi via dariSupabase.


import {
  keEksemplar,
  dariEksemplar,
  keInventarisPerBuku,
  type BarisEksemplar,
  type BarisInventarisPerBuku,
} from "@/lib/supabase/peta";
import {
  sahkanEksemplarBody,
  sahkanPemeriksaanBody,
  sahkanOpnameBody,
  tanggal,
  type RawEksemplar,
  type RawPemeriksaan,
  type RawOpname,
} from "@/lib/supabase/validasi";
import { catatJejakServer } from "@/lib/supabase/jejak";
import type { JenisJejak } from "@/lib/audit";
import { dariSupabase, GalatApi, jalankan, json, konteksPublik, konteksRoute } from "@/lib/supabase/konteks";
const envSupabase = () => ({});

export { envSupabase };



// ---------- helper pembacaan parameter -------------
interface Params {
  params: Promise<{ id: string }>;
}

// Status yang memenuhi syarat keterlibatan penyimpanan (stock patroli).
const STATUS_YANG_MENYIMPANGAN = new Set([
  "tersedia",
  "dipinjam",
  "rusak",
  "hilang",
]);

function okStatus(s: string): boolean {
  return STATUS_YANG_MENYIMPANGAN.has(s);
}

// ---------- GET /api/eksemplar  (publik: katalog.lihat) ----------
export async function GET() {
export async function GET() {
  return jalankan(async () => {
    const k = await konteksPublik();
    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .select(
        `id,buku_id,nomor_inventaris,status,kondisi_fisik,tanggal_pengadaan,keterangan,dibuat_pada,diedit_pada`,
      )
      .order("nomor_inventaris", { ascending: true })
      .order("diedit_pada", { ascending: false });
    if (error) throw fromSupabase(error);

    // Ringkasan per judul (view v_inventaris_per_buku).
    const { data: ringkasan, error: errRingkasan } = await k.supabase
      .from("v_inventaris_per_buku")
      .select(
        `buku_id,judul,total_eksemplar,tersedia,dipinjam,rusak,hilang`,
      )
      .order("judul", { ascending: true });
    if (errRingkasan) console.warn("[eksemplar] view ringkasan gagal:", errRingkasan.message);

    return json({
      eksemplar: ((data ?? []) as BarisEksemplar[]).map(keEksemplar),
      ringkasan: ((ringkasan ?? []) as BarisInventarisPerBuku[]).map(keInventarisPerBuku),
    });
  });
}

// ---------- POST /api/eksemplar  (admin: katalog.kelola) ----------
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const body = (await bacaBody<RawEksemplar>(request)) ?? {};
    const isi = sahkanEksemplarBody(body);
    if (!okStatus(isi.status)) throw new GalatApi("Status tidak dikenal.", 400);
    if (!okKondisi(isi.kondisi_fisik)) throw new GalatApi("Kondisi fisik tidak dikenal.", 400);

    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .insert({
        buku_id: isi.buku_id,
        nomor_inventaris: isi.nomor_inventaris,
        status: isi.status,
        kondisi_fisik: isi.kondisi_fisik,
        tanggal_pengadaan: isi.tanggal_pengadaan,
        keterangan: isi.keterangan ?? null,
      })
      .select("*")
      .single();
    if (error) throw fromSupabase(error);

    await catatJejakServer(k, {
      jenis: "eksemplar" as JenisJejak,
      aksi: "Eksemplar ditambahkan",
      objek: isi.nomor_inventaris,
      detail: `buku ${isi.buku_id}`,
      anggotaId: null,
    });

    return json({ eksemplar: keEksemplar(data as BarisEksemplar) }, 201);
  });
}

// ---------- PUT /api/eksemplar/[id]  (admin: katalog.kelola) ----------
export async function PUT(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });

    const { data: sekarang, error: errCari } = await k.supabase
      .from("eksemplar_buku")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errCari) throw fromSupabase(errCari);
    if (!sekarang) throw new GalatApi("Eksemplar tidak ditemukan.", 404);

    const body = (await bacaBody<RawEksemplar>(request)) ?? {};
    const patch = sahkanEksemplarBody(body);
    if (!okStatus(patch.status)) throw new GalatApi("Status tidak dikenal.", 400);
    if (!okKondisi(patch.kondisi_fisik)) throw new GalatApi("Kondisi fisik tidak dikenal.", 400);

    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .update({
        buku_id: patch.buku_id,
        nomor_inventaris: patch.nomor_inventaris,
        status: patch.status,
        kondisi_fisik: patch.kondisi_fisik,
        tanggal_pengadaan: patch.tanggal_pengadaan,
        keterangan: patch.keterangan ?? null,
        diedit_pada: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw fromSupabase(error);

    await catatJejakServer(k, {
      jenis: "eksemplar" as JenisJejak,
      aksi: "Eksemplar diubah",
      objek: patch.nomor_inventaris ?? sekarang.nomor_inventaris,
      detail: `buku ${patch.buku_id}`,
      anggotaId: null,
    });

    return json({ eksemplar: keEksemplar(data as BarisEksemplar) });
  });
}

// ---------- DELETE /api/eksemplar/[id]  (admin: katalog.kelola) ----------
export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });

    const { error } = await k.supabase
      .from("eksemplar_buku")
      .delete()
      .eq("id", id);
    if (error) throw fromSupabase(error);

    await catatJejakServer(k, {
      jenis: "eksemplar" as JenisJejak,
      aksi: "Eksemplar dihapus",
      objek: id,
      detail: "eksemplar",
      anggotaId: null,
    });

    return json({ ok: true });
  });
}

// ---------- GET /api/eksemplar/rekonsiliasi  (Super Admin: sinkronisasi) ----------
export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });

    const { data, error } = await k.supabase
      .from("v_inventaris_per_buku")
      .select(
        `buku_id,judul,total_eksemplar,tersedia,dipinjam,rusak,hilang`,
      )
      .order("judul", { ascending: true });
    if (error) throw fromSupabase(error);

    const ringkasan = (data ?? []) as BarisInventarisPerBuku[];
    const ringkas = ringkasan.map((r) => ({
      buku_id: r.buku_id,
      judul: r.judul,
      total_eksemplar: r.total_eksemplar,
      tersedia: r.tersedia,
      dipinjam: r.dipinjam,
      rusak: r.rusak,
      hilang: r.hilang,
      status_sistem: statusRingkasan(r),
      fasilitas: fasilitas(r),
      selisih: 0,
    }));

    return json({
      ringkasan: ringkas,
      total_eksemplar: ringkasan.reduce((acc, r) => acc + (r.total_eksemplar ?? 0), 0),
      total_tersedia: ringkasan.reduce((acc, r) => acc + (r.tersedia ?? 0), 0),
      total_dipinjam: ringkasan.reduce((acc, r) => acc + (r.dipinjam ?? 0), 0),
      total_rusak: ringkasan.reduce((acc, r) => acc + (r.rusak ?? 0), 0),
      total_hilang: ringkasan.reduce((acc, r) => acc + (r.hilang ?? 0), 0),
    });
  });
}

// ---------- GET /api/eksemplar/[id]/pemeriksaan  (Super Admin) ----------
export async function GET(
  _request: Request,
  { params }: Params,
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
    if (error) throw fromSupabase(error);

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
  { params }: Params,
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

    const trans = k.supabase;
    if (!trans) throw new GalatApi("Klien Supabase tidak tersedia.", 503);

    for (const baris of isi.pemeriksaan) {
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

// ---------- POST /api/opname  (petugas: catat opname) ----------
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const body = (await bacaBody<RawOpname>(request)) ?? {};
    const isi = sahkanOpnameBody(body);

    if (!Array.isArray(isi.baris) || isi.baris.length === 0) {
      throw new GalatApi("Minimal satu baris opname harus diterima.", 400);
    }
    for (const b of isi.baris) {
      if (b.jumlah_fisik === undefined && b.ditemukan === undefined && b.tidak_ditemukan === undefined) {
        throw new GalatApi("Setiap baris opname harus memuat jumlah_fisik / ditemukan / tidak_ditemukan.", 400);
      }
      if (b.id === undefined || b.buku_id === undefined || b.nomor_inventaris === undefined) {
        throw new GalatApi("Setiap baris opname harus memuat id, buku_id, nomor_inventaris.", 400);
      }
      if (b.status && !okStatus(b.status)) {
        throw new GalatApi(`Baris "${b.nomor_inventaris}" memiliki status tidak dikenal.`, 400);
      }
      if (b.kondisi_fisik && !okKondisi(b.kondisi_fisik)) {
        throw new GalatApi(`Baris "${b.nomor_inventaris}" memiliki kondisi tidak dikenal.`, 400);
      }
    }

    // Transaksi: konsistensi stok vs catatan opname, tanpa bergantung pada view.
    const { error } = await k.supabase.transaction(async (tx) => {
      for (const b of isi.baris) {
        const jml = b.jumlah_fisik ?? b.ditemukan ?? b.tidak_ditemukan ?? 0;
        for (const b of isi.baris) {
        const { error: e1 } = await tx
          .from("eksemplar_buku")
          .update({
            status: (b as RawOpnameBaris).status ?? "tersedia",
            kondisi_fisik: (b as RawOpnameBaris).kondisi_fisik ?? "layak",
            tanggal_pengadaan: (b as RawOpnameBaris).tanggal_pengadaan ?? new Date().toISOString().slice(0, 10),
            keterangan: (b as RawOpnameBaris).keterangan ?? null,
            diedit_pada: new Date().toISOString(),
          })
          .eq("id", (b as RawOpnameBaris).id)
          .eq("buku_id", (b as RawOpnameBaris).buku_id)
              .eq("nomor_inventaris", (b as RawOpnameBaris).nomor_inventaris);
        }
        if (e1) throw e1;
      }
    });

    if (error) throw fromSupabase(error);

    await catatJejakServer(k, {
      jenis: "opname" as JenisJejak,
      aksi: "Opname dicatat",
      objek: isi.baris.length + " baris",
      detail: "stock opname",
      anggotaId: null,
    });

    return json({ ok: true, diterima: isi.baris.length });
  });
}

// ---------- GET /api/opname  (petugas: daftar opname) ----------
export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("opname")
      .select(
        `id,komentar,nilai,jumlah_ditemukan,jumlah_tidak_ditemukan,jumlah_dibandingkan,selisih,judul,dibuat_pada,dikerjakan_bynama`,
      )
      .order("dibuat_pada", { ascending: false });
    if (error) throw fromSupabase(error);
    return json({ opname: ((data ?? []) as BarisOpname[]).map(keOpname) });
  });
}

// ---------- GET /api/opname/[id]  (petugas: satu opname) ----------
export async function GET(
  _request: Request,
  { params }: Params,
) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("opname")
      .select(
        `id,komentar,nilai,jumlah_ditemukan,jumlah_tidak_ditemukan,jumlah_dibandingkan,selisih,judul,dibuat_pada,dikerjakan_bynama`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw fromSupabase(error);
    if (!data) throw new GalatApi("Opname tidak ditemukan.", 404);
    return json({ opname: keOpname(data as BarisOpname) });
  });
}

// ---------- PUT /api/opname/[id]  (petugas: kelola opname) ----------
export async function PUT(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const body = (await bacaBody<RawOpname>(request)) ?? {};
    const isi = sahkanOpnameBody(body);

    const { data: sebelum, error: errCari } = await k.supabase
      .from("opname")
      .select(
        `id,komentar,nilai,jumlah_ditemukan,jumlah_tidak_ditemukan,jumlah_dibandingkan,selisih,judul,dibuat_pada,dikerjakan_bynama`,
      )
      .eq("id", id)
      .maybeSingle();
    if (errCari) throw fromSupabase(errCari);
    if (!sebelum) throw new GalatApi("Opname tidak ditemukan.", 404);

    const { error } = await k.supabase
      .from("opname")
      .update({
        komentar: isi.komentar ?? (sebelum as BarisOpname).komentar,
        nilai: isi.nilai ?? (sebelum as BarisOpname).nilai,
        jumlah_ditemukan: isi.baris?.reduce((acc, b) => acc + (b.ditemukan ?? 0), 0) ?? (sebelum as BarisOpname).jumlah_ditemukan,
        jumlah_tidak_ditemukan: isi.baris?.reduce((acc, b) => acc + (b.tidak_ditemukan ?? 0), 0) ?? (sebelum as BarisOpname).jumlah_tidak_ditemukan,
        jumlah_dibandingkan: isi.baris?.length ?? (sebelum as BarisOpname).jumlah_dibandingkan,
        selisih: isi.baris?.reduce((acc, b) => acc + ((b.ditemukan ?? 0) - (b.tidak_ditemukan ?? 0)), 0) ?? (sebelum as BarisOpname).selisih,
        dikerjakan_bynama: isi.dikerjakan_bynama ?? (sebelum as BarisOpname).dikerjakan_bynama,
        diperbarui_pada: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw fromSupabase(error);

    await catatJejakServer(k, {
      jenis: "opname" as JenisJejak,
      aksi: "Opname diperbarui",
      objek: id,
      detail: "stok opname",
      anggotaId: null,
    });

    return json({ ok: true });
  });
}

// ---------- DELETE /api/opname/[id]  (petugas: hapus opname) ----------
export async function DELETE(
  _request: Request,
  { params }: Params,
) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });

    const { error } = await k.supabase.from("opname").delete().eq("id", id);
    if (error) throw fromSupabase(error);

    await catatJejakServer(k, {
      jenis: "opname" as JenisJejak,
      aksi: "Opname dihapus",
      objek: id,
      detail: "stok opname",
      anggotaId: null,
    });

    return json({ ok: true });
  });
}

// ---------- pembantu -------------------------------------------------------------

// Ringkasan status sistem dari agregat per judul.
function statusRingkasan(r: BarisInventarisPerBuku): string {
  if ((r.total_eksemplar ?? 0) === 0) return "tidak ada";
  const t = r.total_eksemplar ?? 0;
  const ter = r.tersedia ?? 0;
  const pin = r.dipinjam ?? 0;
  const rus = r.rusak ?? 0;
  const hil = r.hilang ?? 0;
  if (t === ter) return "semua-tersedia";
  if (pin > 0) return "ada-dipinjam";
  if (rus > 0 || hil > 0) return "ada-rusak";
  return "tidak ada";
}

function fasilitas(r: BarisInventarisPerBuku): string {
  const bagian: string[] = [];
  if (r.tersedia ?? 0 > 0) bagian.push("tersedia");
  if (r.dipinjam ?? 0 > 0) bagian.push("dipinjam");
  if (r.rusak ?? 0 > 0) bagian.push("rusak");
  if (r.hilang ?? 0 > 0) bagian.push("hilang");
  return bagian.join(", ") || "tidak ada eksemplar";
}

// Tipe domain untuk opname baris.
export interface BarisOpname {
  id: string;
  buku_id: string;
  nomor_inventaris: string;
  status: string;
  kondisi_fisik: string;
  tanggal_pengadaan: string;
  keterangan: string | null;
  jumlah_fisik: number;
  ditemukan: number;
  tidak_ditemukan: number;
  selisih: number;
  dikerjakan_bynama: string;
  diperbarui_pada: string;
}

// Pemetaan view opname → tipe domain.
export function keOpname(r: BarisOpname): BarisOpname {
  return { ...r };
}

export {}
