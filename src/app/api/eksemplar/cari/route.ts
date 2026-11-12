// Pencarian satu salinan lewat barcode nomor inventaris.
//
// Dipakai formulir peminjaman: petugas memindai label eksemplar (INV-…), lalu
// kode itu diterjemahkan menjadi buku + salinan fisik yang akan dipinjam.

import {
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { keBuku, type BarisBuku } from "@/lib/supabase/peta";

const KOLOM =
  "id,buku_id,nomor_inventaris,status,kondisi_fisik";

export async function GET(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibIzin: "sirkulasi.kelola",
    });

    // Scanner mengetik kode apa adanya; nomor inventaris disimpan huruf besar.
    const mentah = new URL(request.url).searchParams.get("kode") ?? "";
    const kode = mentah.trim().toUpperCase();

    if (!kode) throw new GalatApi("Kode barcode kosong.", 400);
    if (kode.length > 40) throw new GalatApi("Kode barcode terlalu panjang.", 400);

    const { data: eksemplar, error } = await k.supabase
      .from("eksemplar_buku")
      .select(KOLOM)
      .eq("nomor_inventaris", kode)
      .maybeSingle();

    if (error) throw dariSupabase(error);
    if (!eksemplar) {
      throw new GalatApi(`Barcode ${kode} tidak terdaftar di inventaris.`, 404);
    }

    const { data: buku, error: errBuku } = await k.supabase
      .from("buku")
      .select("*")
      .eq("id", eksemplar.buku_id)
      .maybeSingle();

    if (errBuku) throw dariSupabase(errBuku);
    if (!buku) throw new GalatApi("Judul untuk salinan ini tidak ditemukan.", 404);

    // Buku berarsip disembunyikan dari katalog, tetapi salinan fisiknya masih
    // terdaftar di inventaris. Hentikan di sini supaya formulir peminjaman tidak
    // menawarkan judul yang sudah ditarik.
    if (buku.dihapus_pada) {
      throw new GalatApi(
        `Buku "${buku.judul}" sudah diarsipkan dan tidak bisa dipinjam.`,
        409
      );
    }

    return json({
      eksemplar: {
        id: eksemplar.id as string,
        bukuId: eksemplar.buku_id as string,
        nomorInventaris: eksemplar.nomor_inventaris as string,
        status: eksemplar.status as string,
        kondisiFisik: eksemplar.kondisi_fisik as string,
      },
      buku: keBuku(buku as BarisBuku),
    });
  });
}
