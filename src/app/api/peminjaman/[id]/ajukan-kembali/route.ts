// Anggota mengajukan pengembalian pinjamannya sendiri. Pinjaman baru ditutup
// setelah petugas memeriksa buku dan memilih kondisi layak/rusak ringan.

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
    const catatan = typeof body?.catatan === "string" ? body.catatan : null;

    // Kepemilikan pinjaman & status aktifnya diperiksa di database.
    const { data, error } = await k.supabase.rpc("ajukan_kembali", {
      p_peminjaman_id: id,
      p_catatan: catatan,
    });
    if (error) throw dariSupabase(error);

    return json({ pengajuan: data }, 201);
  });
}
