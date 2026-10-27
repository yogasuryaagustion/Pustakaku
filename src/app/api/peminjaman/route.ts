// Peminjaman: daftar (difilter RLS per peran) & pencatatan pinjam baru.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { kePeminjaman, type BarisPeminjaman } from "@/lib/supabase/peta";
import { tanggal } from "@/lib/supabase/validasi";

export async function GET() {
  return jalankan(async () => {
    // RLS: admin/petugas melihat semua (sirkulasi.lihat), anggota hanya
    // miliknya sendiri (panel.pinjaman), tamu tidak melihat apa pun.
    const k = await konteksRoute();
    const { data, error } = await k.supabase
      .from("peminjaman")
      .select("*")
      .order("created_at", { ascending: false })
      .order("kode_pinjam", { ascending: true });
    if (error) throw dariSupabase(error);
    return json({ peminjaman: ((data ?? []) as BarisPeminjaman[]).map(kePeminjaman) });
  });
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const bukuId = typeof body?.bukuId === "string" ? body.bukuId : "";
    const anggotaId = typeof body?.anggotaId === "string" ? body.anggotaId : "";
    if (!bukuId || !anggotaId) throw new GalatApi("Buku dan anggota harus dipilih.");
    const tgl = body?.tanggalPinjam ? tanggal(body.tanggalPinjam, "Tanggal pinjam") : undefined;

    // Validasi izin, stok, batas pinjaman, dan penomoran → atomik di database.
    const { data, error } = await k.supabase.rpc("pinjam_buku", {
      p_buku_id: bukuId,
      p_anggota_id: anggotaId,
      p_tanggal_pinjam: tgl ?? null,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) }, 201);
  });
}
