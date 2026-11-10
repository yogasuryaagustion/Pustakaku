// Pelunasan denda satu peminjaman oleh petugas.
//
// Nominal diambil dari database (bukan dari klien) dan pembayaran dicatat
// penuh; pengulangan ditolak dengan pesan "sudah lunas" agar tidak ada
// pembayaran ganda yang menimpa riwayat.

import {
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { kePeminjaman, type BarisPeminjaman } from "@/lib/supabase/peta";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    // Izin, status pinjaman, dan nominal diperiksa ulang di dalam fungsi.
    const { data, error } = await k.supabase.rpc("lunasi_denda", {
      p_peminjaman_id: id,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) });
  });
}
