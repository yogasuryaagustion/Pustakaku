// Daftar buku yang diarsipkan.
//
// Buku beriwayat peminjaman tidak bisa dihapus permanen (FK
// peminjaman.buku_id on delete restrict), jadi penghapusannya berupa tanda
// `dihapus_pada`. Tanpa endpoint ini buku tersebut hilang tanpa jejak di UI,
// padahal pengelola harus bisa memeriksa dan memulihkannya.
//
// Tidak publik: arsip hanya untuk pemegang izin `katalog.kelola`.

import { dariSupabase, jalankan, json, konteksRoute } from "@/lib/supabase/konteks";

export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibIzin: "katalog.kelola",
    });

    const { data, error } = await k.supabase
      .from("buku")
      .select("id,judul,penulis,kategori,rak,stok,dihapus_pada")
      .not("dihapus_pada", "is", null)
      .order("dihapus_pada", { ascending: false });

    if (error) throw dariSupabase(error);

    return json({
      buku: (data ?? []).map((b) => ({
        id: b.id as string,
        judul: b.judul as string,
        penulis: b.penulis as string,
        kategori: b.kategori as string,
        rak: b.rak as string,
        stok: Number(b.stok) || 0,
        dihapusPada: (b.dihapus_pada as string | null) ?? null,
      })),
    });
  });
}
