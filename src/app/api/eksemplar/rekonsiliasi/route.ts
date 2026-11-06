// Rekonsiliasi inventaris: bandingkan stok tercatat (buku.stok) dengan jumlah
// eksemplar fisik (eksemplar_buku) dan perbaiki bila menyimpang.
// Hanya Super Admin — operasi ini mengubah stok katalog secara massal.

import {
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { keInventarisPerBuku, type BarisInventarisPerBuku } from "@/lib/supabase/peta";
import { ringkasInventaris } from "@/lib/supabase/inventaris";

const KOLOM_RINGKASAN =
  "buku_id,judul,penulis,penerbit,tahun,isbn,kategori,rak,stok,total_eksemplar,tersedia,dipinjam,rusak,hilang";

/** GET /api/eksemplar/rekonsiliasi — hasil sinkronisasi stok vs eksemplar. */
export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });

    const { data, error } = await k.supabase
      .from("v_inventaris_per_buku")
      .select(KOLOM_RINGKASAN)
      .order("judul", { ascending: true });
    if (error) throw dariSupabase(error);

    const ringkasan = ((data ?? []) as BarisInventarisPerBuku[])
      .map(keInventarisPerBuku)
      .map(ringkasInventaris);

    const jumlah = (pilih: (r: typeof ringkasan[number]) => number) =>
      ringkasan.reduce((acc, r) => acc + pilih(r), 0);

    return json({
      ringkasan,
      total_judul: ringkasan.length,
      total_eksemplar: jumlah((r) => Number(r.total_eksemplar) || 0),
      total_tersedia: jumlah((r) => Number(r.tersedia) || 0),
      total_dipinjam: jumlah((r) => Number(r.dipinjam) || 0),
      total_rusak: jumlah((r) => Number(r.rusak) || 0),
      total_hilang: jumlah((r) => Number(r.hilang) || 0),
      perlu_diperbaiki: ringkasan.filter((r) => r.selisih !== 0).length,
    });
  });
}

/** POST /api/eksemplar/rekonsiliasi — samakan buku.stok dengan jumlah eksemplar. */
export async function POST() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });

    const { data, error } = await k.supabase.rpc("rekonsiliasi_stok_inventaris");
    if (error) throw dariSupabase(error);

    const diperbaiki = Number(data) || 0;
    await catatJejakServer(k, {
      jenis: "sistem",
      aksi: "Rekonsiliasi stok",
      objek: `${diperbaiki} judul`,
      detail: "stok disamakan dengan jumlah eksemplar fisik",
    });

    return json({ ok: true, diperbaiki });
  });
}
