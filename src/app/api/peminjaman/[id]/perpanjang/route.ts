// Perpanjangan pinjaman — atomik di database, dengan cek izin:
// petugas sirkulasi untuk semua pinjaman, anggota hanya untuk miliknya.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { kePeminjaman, type BarisPeminjaman } from "@/lib/supabase/peta";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const hari =
      typeof body?.hari === "number" && Number.isFinite(body.hari) ? body.hari : null;
    if (hari !== null && (hari < 1 || hari > 90)) {
      throw new GalatApi("Lama perpanjaman harus antara 1 dan 90 hari.");
    }

    const { data, error } = await k.supabase.rpc("perpanjang_buku", {
      p_peminjaman_id: id,
      p_hari: hari,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) });
  });
}
