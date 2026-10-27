// Pengembalian satu pinjaman — dijalankan atomik di database
// (mencegah pengembalian ganda & status yang tidak konsisten).

import { dariSupabase, jalankan, json, konteksRoute } from "@/lib/supabase/konteks";
import { kePeminjaman, type BarisPeminjaman } from "@/lib/supabase/peta";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    const { data, error } = await k.supabase.rpc("kembalikan_buku", {
      p_peminjaman_id: id,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) });
  });
}
