// Label eksemplar — satu label per salinan fisik untuk dicetak di kertas A4.
//
// Isi label hanya nomor inventaris (mis. "INV-0001"): bisa dipindai ke kolom
// pencarian mana pun tanpa membuka URL, dan tidak pernah basi ketika buku
// berpindah rak. Dua bentuk disediakan sekaligus:
//   * QR   — terbaca pemindai 2D / kamera ponsel;
//   * Code 128 (1D) — cocok untuk barcode gun biasa di meja sirkulasi.
// SVG dibuat di server supaya pustaka qrcode/bwip-js tidak masuk bundel browser.

import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import {
  dariSupabase,
  jalankan,
  json,
  kolomBelumAda,
  konteksRoute,
} from "@/lib/supabase/konteks";

export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibAdmin: true,
      wajibIzin: "katalog.kelola",
    });

    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .select("id,buku_id,nomor_inventaris")
      .order("nomor_inventaris", { ascending: true });
    if (error) throw dariSupabase(error);

    // Label hanya dicetak untuk judul yang masih tampil di katalog. Buku yang
    // diarsipkan (dihapus_pada terisi) tidak ikut, karena salinannya memang
    // tidak boleh dipinjam lagi.
    interface InfoJudul {
      id: string;
      judul: string;
      rak: string;
      dihapus_pada?: string | null;
    }

    const hasilBuku = await k.supabase
      .from("buku")
      .select("id,judul,rak,dihapus_pada");

    let daftarBuku: InfoJudul[] = (hasilBuku.data ?? []) as InfoJudul[];
    if (hasilBuku.error && kolomBelumAda(hasilBuku.error)) {
      // Migrasi arsip buku belum dijalankan: cetak label untuk semua judul.
      const tanpaArsip = await k.supabase.from("buku").select("id,judul,rak");
      if (tanpaArsip.error) throw dariSupabase(tanpaArsip.error);
      daftarBuku = (tanpaArsip.data ?? []) as InfoJudul[];
    } else if (hasilBuku.error) {
      throw dariSupabase(hasilBuku.error);
    }

    const peta = new Map(
      daftarBuku
        .filter((b) => !b.dihapus_pada)
        .map((b) => [
          b.id,
          { judul: b.judul ?? "", rak: b.rak ?? "" },
        ]),
    );

    const label = await Promise.all(
      (data ?? [])
        // Eksemplar milik judul berarsip tidak punya entri di peta.
        .filter((e) => peta.has(e.buku_id as string))
        .map(async (e) => {
        const nomor = e.nomor_inventaris as string;
        const info = peta.get(e.buku_id as string);
        return {
          id: e.id as string,
          nomor_inventaris: nomor,
          judul: info?.judul ?? "",
          rak: info?.rak ?? "",
          qr: await QRCode.toString(nomor, {
            type: "svg",
            margin: 2,
            errorCorrectionLevel: "M",
          }),
          // Code 128 memuat teks apa adanya. `paddingwidth` memberi quiet zone
          // minimal 10 modul di kiri-kanan (syarat agar barcode gun bisa
          // membaca); tinggi batang dipilih agar pas pada label 63 mm.
          barcode: bwipjs.toSVG({
            bcid: "code128",
            text: nomor,
            scale: 3,
            height: 8,
            includetext: false,
            paddingwidth: 10,
            paddingheight: 0,
          }),
        };
      }),
    );

    return json({ label });
  });
}
