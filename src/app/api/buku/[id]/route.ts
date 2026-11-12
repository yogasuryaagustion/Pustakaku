// Ubah / hapus satu buku.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  kolomBelumAda,
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

    const baris = dariBuku(patch);

    let { data, error } = await k.supabase
      .from("buku")
      .update(baris)
      .eq("id", id)
      .select("*")
      .single();

    // Kolom harga baru ada setelah migrasi denda buku hilang; tanpa migrasi
    // perubahan lain tetap disimpan.
    if (kolomBelumAda(error) && "harga" in baris) {
      const tanpaHarga = { ...baris };
      delete tanpaHarga.harga;
      ({ data, error } = await k.supabase
        .from("buku")
        .update(tanpaHarga)
        .eq("id", id)
        .select("*")
        .single());
    }

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

    const buku = sebelum as BarisBuku;

    // Buku tanpa riwayat dibuang permanen. Buku yang pernah dipinjam ditolak FK
    // `peminjaman.buku_id on delete restrict`; untuk itu barisnya hanya ditandai
    // dihapus_pada — katalog bersih, riwayat peminjaman/denda tetap utuh.
    const { error } = await k.supabase.from("buku").delete().eq("id", id);
    if (!error) {
      await catatJejakServer(k, {
        jenis: "buku",
        aksi: "Buku dihapus",
        objek: buku.judul,
        detail: buku.kategori,
      });
      return json({ ok: true, diarsipkan: false });
    }
    if (error.code !== "23503") throw dariSupabase(error);

    const { error: errArsip } = await k.supabase
      .from("buku")
      .update({ dihapus_pada: new Date().toISOString() })
      .eq("id", id);

    if (errArsip) {
      // Kolom belum ada berarti migrasi 202611120001 belum dijalankan; beri tahu
      // langkah perbaikannya alih-alih pesan FK yang membingungkan.
      if (kolomBelumAda(errArsip)) {
        throw new GalatApi(
          "Buku ini punya riwayat peminjaman sehingga tidak bisa dihapus permanen. Jalankan migrasi supabase/migrations/202611120001_arsip_buku.sql agar buku bisa diarsipkan.",
          409
        );
      }
      throw dariSupabase(errArsip);
    }

    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Buku diarsipkan",
      objek: buku.judul,
      detail: `riwayat peminjaman dipertahankan · ${buku.kategori}`,
    });
    return json({ ok: true, diarsipkan: true });
  });
}
