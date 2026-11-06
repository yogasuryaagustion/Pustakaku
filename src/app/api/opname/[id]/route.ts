// Satu sesi stock opname — detail, ubah catatan, dan hapus.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { sahkanOpnameBody } from "@/lib/supabase/validasi";
import {
  KOLOM_OPNAME,
  KOLOM_OPNAME_BARIS,
  type BarisOpname,
  type BarisOpnameBaris,
} from "@/lib/supabase/inventaris";

interface Params {
  params: Promise<{ id: string }>;
}

/** GET /api/opname/[id] — sesi opname beserta barisnya. */
export async function GET(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("opname")
      .select(KOLOM_OPNAME)
      .eq("id", id)
      .maybeSingle();
    if (error) throw dariSupabase(error);
    if (!data) throw new GalatApi("Sesi opname tidak ditemukan.", 404);

    const { data: baris, error: errBaris } = await k.supabase
      .from("opname_baris")
      .select(KOLOM_OPNAME_BARIS)
      .eq("opname_id", id)
      .order("nomor_inventaris", { ascending: true });
    if (errBaris) throw dariSupabase(errBaris);

    return json({
      opname: data as BarisOpname,
      baris: (baris ?? []) as BarisOpnameBaris[],
    });
  });
}

/** PUT /api/opname/[id] — perbarui judul/komentar sesi. */
export async function PUT(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data: sekarang, error: errCari } = await k.supabase
      .from("opname")
      .select(KOLOM_OPNAME)
      .eq("id", id)
      .maybeSingle();
    if (errCari) throw dariSupabase(errCari);
    if (!sekarang) throw new GalatApi("Sesi opname tidak ditemukan.", 404);

    const isi = sahkanOpnameBody(await bacaBody(request));
    const lama = sekarang as BarisOpname;

    const { data, error } = await k.supabase
      .from("opname")
      .update({
        komentar: isi.komentar !== undefined ? isi.komentar : lama.komentar,
        diperbarui_pada: new Date().toISOString(),
      })
      .eq("id", id)
      .select(KOLOM_OPNAME)
      .single();
    if (error) throw dariSupabase(error);

    await catatJejakServer(k, {
      jenis: "sistem",
      aksi: "Catatan opname diubah",
      objek: lama.judul || id,
      detail: "stock opname",
    });

    return json({ opname: data as BarisOpname });
  });
}

/** DELETE /api/opname/[id] — hapus sesi beserta barisnya. */
export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    if (!id) throw new GalatApi("Parameter id kosong.", 400);

    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("opname")
      .delete()
      .eq("id", id)
      .select("judul")
      .maybeSingle();
    if (error) throw dariSupabase(error);
    if (!data) throw new GalatApi("Sesi opname tidak ditemukan.", 404);

    await catatJejakServer(k, {
      jenis: "sistem",
      aksi: "Sesi opname dihapus",
      objek: (data as { judul: string }).judul || id,
      detail: "stock opname",
    });

    return json({ ok: true });
  });
}
