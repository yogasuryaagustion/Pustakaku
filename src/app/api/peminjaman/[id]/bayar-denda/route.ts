// Penerimaan pembayaran denda — boleh sebagian (cicilan).
//
// Nominal dikirim petugas, tetapi sisa denda dan status pinjaman diperiksa
// ulang di fungsi `bayar_denda` supaya tidak ada pembayaran melebihi sisa
// atau untuk pinjaman yang belum dikembalikan.

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
    const nominal = Number(body?.nominal);
    if (!Number.isInteger(nominal) || nominal < 1) {
      throw new GalatApi("Nominal pembayaran harus bilangan bulat lebih dari 0.");
    }
    const catatan =
      typeof body?.catatan === "string" && body.catatan.trim()
        ? body.catatan.trim().slice(0, 200)
        : null;

    const { data, error } = await k.supabase.rpc("bayar_denda", {
      p_peminjaman_id: id,
      p_nominal: nominal,
      p_catatan: catatan,
    });
    if (error) throw dariSupabase(error);

    // Fungsi mengembalikan { peminjaman, pembayaran }; UI memakai pinjaman
    // terbaru (total dibayar & sisa ikut berubah).
    const hasil = data as unknown as {
      peminjaman: BarisPeminjaman;
    };
    return json({ peminjaman: kePeminjaman(hasil.peminjaman) }, 201);
  });
}
