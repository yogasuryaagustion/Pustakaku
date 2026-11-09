// Petugas menolak pengajuan pengembalian (mis. buku belum benar-benar
// diserahkan). Pinjaman tetap aktif dan anggota bisa mengajukan ulang.

import {
  bacaBody,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const alasan = typeof body?.alasan === "string" ? body.alasan : null;

    const { data, error } = await k.supabase.rpc("tolak_kembali", {
      p_peminjaman_id: id,
      p_alasan: alasan,
    });
    if (error) throw dariSupabase(error);

    return json({ ok: true, hasil: data });
  });
}
