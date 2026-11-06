// Pemeriksaan nomor inventaris per judul buku: [id] adalah id buku.
// GET  — daftar eksemplar milik buku tersebut beserta status/kondisinya.
// POST — terapkan hasil pemeriksaan (status, kondisi, keterangan) ke eksemplar.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { keEksemplar, type BarisEksemplar } from "@/lib/supabase/peta";
import { sahkanPemeriksaanBody } from "@/lib/supabase/validasi";
import { kondisiDikenal, statusDikenal } from "@/lib/supabase/inventaris";

interface Params {
  params: Promise<{ id: string }>;
}

const KOLOM_EKSEMPLAR =
  "id,buku_id,nomor_inventaris,status,kondisi_fisik,tanggal_pengadaan,keterangan,dibuat_pada,diedit_pada";

/** GET /api/eksemplar/[id]/pemeriksaan — eksemplar satu judul. */
export async function GET(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .select(KOLOM_EKSEMPLAR)
      .eq("buku_id", id)
      .order("nomor_inventaris", { ascending: true });
    if (error) throw dariSupabase(error);

    const eksemplar = ((data ?? []) as BarisEksemplar[]).map(keEksemplar);
    return json({ eksemplar, total: eksemplar.length });
  });
}

/** POST /api/eksemplar/[id]/pemeriksaan — simpan hasil pemeriksaan. */
export async function POST(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const isi = sahkanPemeriksaanBody(await bacaBody(request));
    const baris = isi.pemeriksaan ?? [];
    if (baris.length === 0) {
      throw new GalatApi("Minimal satu baris pemeriksaan harus dikirim.", 400);
    }

    for (const b of baris) {
      const idEksemplar = b.id_eksemplar ? String(b.id_eksemplar) : "";
      if (!idEksemplar) {
        throw new GalatApi("Setiap baris pemeriksaan harus memuat id eksemplar.", 400);
      }

      const patch: Record<string, unknown> = { diedit_pada: new Date().toISOString() };
      if (typeof b.status === "string" && b.status) {
        if (!statusDikenal(b.status)) {
          throw new GalatApi(`Status "${b.status}" tidak dikenal.`, 400);
        }
        patch.status = b.status;
      }
      if (typeof b.kondisi_fisik === "string" && b.kondisi_fisik) {
        if (!kondisiDikenal(b.kondisi_fisik)) {
          throw new GalatApi(`Kondisi "${b.kondisi_fisik}" tidak dikenal.`, 400);
        }
        patch.kondisi_fisik = b.kondisi_fisik;
      }
      if (b.keterangan !== undefined) patch.keterangan = b.keterangan ?? null;

      const { data, error } = await k.supabase
        .from("eksemplar_buku")
        .update(patch)
        .eq("id", idEksemplar)
        .eq("buku_id", id)
        .select("id");
      if (error) throw dariSupabase(error);
      if (!data || data.length === 0) {
        throw new GalatApi("Eksemplar yang diperiksa tidak ditemukan pada buku ini.", 404);
      }
    }

    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Pemeriksaan inventaris",
      objek: `${baris.length} eksemplar`,
      detail: `buku ${id}`,
    });

    return json({ ok: true, diperiksa: baris.length });
  });
}
