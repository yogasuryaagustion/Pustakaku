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
import { dariSupabase, jalankan, json, konteksRoute } from "@/lib/supabase/konteks";

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

    const { data: buku, error: galatBuku } = await k.supabase
      .from("buku")
      .select("id,judul,rak");
    if (galatBuku) throw dariSupabase(galatBuku);

    const peta = new Map(
      (buku ?? []).map((b) => [
        b.id as string,
        { judul: (b.judul as string) ?? "", rak: (b.rak as string) ?? "" },
      ]),
    );

    const label = await Promise.all(
      (data ?? []).map(async (e) => {
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
