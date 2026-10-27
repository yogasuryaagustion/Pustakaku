// Ubah / hapus satu buku.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { dariBuku, keBuku, type BarisBuku } from "@/lib/supabase/peta";
import { sahkanBukuBody } from "@/lib/supabase/validasi";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const patch = sahkanBukuBody(await bacaBody(request));
    if (Object.keys(patch).length === 0) throw new GalatApi("Tidak ada perubahan yang dikirim.");

    const { data: sebelum, error: errSebelum } = await k.supabase
      .from("buku")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errSebelum) throw dariSupabase(errSebelum);
    if (!sebelum) throw new GalatApi("Buku tidak ditemukan.", 404);

    const { data, error } = await k.supabase
      .from("buku")
      .update(dariBuku(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw dariSupabase(error);

    const buku = keBuku(data as BarisBuku);
    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Buku diubah",
      objek: patch.judul ?? (sebelum as BarisBuku).judul,
      detail: patch.stok !== undefined ? `stok → ${buku.stok}` : "data diperbarui",
    });
    return json({ buku });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });

    const { data: sebelum, error: errSebelum } = await k.supabase
      .from("buku")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errSebelum) throw dariSupabase(errSebelum);
    if (!sebelum) throw new GalatApi("Buku tidak ditemukan.", 404);

    const { error } = await k.supabase.from("buku").delete().eq("id", id);
    if (error) throw dariSupabase(error);

    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Buku dihapus",
      objek: (sebelum as BarisBuku).judul,
      detail: (sebelum as BarisBuku).kategori,
    });
    return json({ ok: true });
  });
}
