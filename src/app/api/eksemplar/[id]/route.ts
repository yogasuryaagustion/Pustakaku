// Satu eksemplar fisik — ubah & hapus (petugas: katalog.kelola).

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
import { sahkanEksemplarBody } from "@/lib/supabase/validasi";
import { kondisiDikenal, statusDikenal } from "@/lib/supabase/inventaris";

interface Params {
  params: Promise<{ id: string }>;
}

const KOLOM_EKSEMPLAR =
  "id,buku_id,nomor_inventaris,status,kondisi_fisik,tanggal_pengadaan,keterangan,dibuat_pada,diedit_pada";

/** PUT /api/eksemplar/[id] — ubah data eksemplar. */
export async function PUT(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data: sekarang, error: errCari } = await k.supabase
      .from("eksemplar_buku")
      .select(KOLOM_EKSEMPLAR)
      .eq("id", id)
      .maybeSingle();
    if (errCari) throw dariSupabase(errCari);
    if (!sekarang) throw new GalatApi("Eksemplar tidak ditemukan.", 404);

    const isi = sahkanEksemplarBody(await bacaBody(request));
    const lama = sekarang as BarisEksemplar;

    const status = isi.status ?? lama.status;
    const kondisi = isi.kondisi_fisik ?? lama.kondisi_fisik;
    if (!statusDikenal(status)) throw new GalatApi("Status eksemplar tidak dikenal.", 400);
    if (!kondisiDikenal(kondisi)) throw new GalatApi("Kondisi fisik tidak dikenal.", 400);

    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .update({
        buku_id: isi.buku_id ?? lama.buku_id,
        nomor_inventaris: isi.nomor_inventaris ?? lama.nomor_inventaris,
        status,
        kondisi_fisik: kondisi,
        tanggal_pengadaan: isi.tanggal_pengadaan ?? lama.tanggal_pengadaan,
        keterangan: isi.keterangan !== undefined ? isi.keterangan : lama.keterangan,
        diedit_pada: new Date().toISOString(),
      })
      .eq("id", id)
      .select(KOLOM_EKSEMPLAR)
      .single();
    if (error) throw dariSupabase(error);

    const eksemplar = keEksemplar(data as BarisEksemplar);
    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Eksemplar diubah",
      objek: eksemplar.nomor_inventaris,
      detail: `status ${eksemplar.status} · kondisi ${eksemplar.kondisi_fisik}`,
    });

    return json({ eksemplar });
  });
}

/** DELETE /api/eksemplar/[id] — hapus eksemplar (stok buku ikut tersinkron). */
export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .delete()
      .eq("id", id)
      .select("nomor_inventaris")
      .maybeSingle();
    if (error) throw dariSupabase(error);
    if (!data) throw new GalatApi("Eksemplar tidak ditemukan.", 404);

    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Eksemplar dihapus",
      objek: (data as { nomor_inventaris: string }).nomor_inventaris,
      detail: "inventaris fisik",
    });

    return json({ ok: true });
  });
}
