// Pengembalian satu pinjaman — dijalankan atomik di database
// (mencegah pengembalian ganda & status yang tidak konsisten).

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

/** Kondisi fisik yang boleh dicatat saat pengembalian. */
const KONDISI_KEMBALI = ["layak", "rusak_ringan", "rusak_beda", "hilang"] as const;

export async function POST(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    // Opsional: petugas mencatat kondisi salinan yang diterima kembali.
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const mentah = body?.kondisi_fisik;
    const kondisi = typeof mentah === "string" && mentah ? mentah : null;
    if (kondisi && !(KONDISI_KEMBALI as readonly string[]).includes(kondisi)) {
      throw new GalatApi(
        "Kondisi pengembalian harus layak, rusak_ringan, rusak_beda, atau hilang.",
        400,
      );
    }

    // Opsional: salinan fisik yang diterima, dipakai untuk menautkan pinjaman
    // lama yang belum punya eksemplar agar kondisinya tercatat di inventaris.
    const mentahEksemplar = body?.eksemplar_id;
    const eksemplarId =
      typeof mentahEksemplar === "string" && mentahEksemplar
        ? mentahEksemplar
        : null;

    // Bila anggota sudah mengajukan pengembalian, proses ini sekaligus menjadi
    // validasi petugas: kondisi yang dipilih dicatat pada pengajuannya.
    const { data: ajuan } = await k.supabase
      .from("pengembalian_ajuan")
      .select("id")
      .eq("peminjaman_id", id)
      .eq("status", "menunggu")
      .maybeSingle();

    // Parameter salinan hanya dikirim bila ada, sehingga database yang belum
    // menjalankan migrasi tautan salinan tetap bisa memproses pengembalian.
    const argumen: Record<string, unknown> = {
      p_peminjaman_id: id,
      p_kondisi_fisik: ajuan ? kondisi ?? "layak" : kondisi,
    };
    if (eksemplarId) argumen.p_eksemplar_id = eksemplarId;

    const { data, error } = await k.supabase.rpc(
      ajuan ? "verifikasi_kembali" : "kembalikan_buku",
      argumen,
    );
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) });
  });
}
