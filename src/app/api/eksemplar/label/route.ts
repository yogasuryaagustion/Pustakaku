// Label QR eksemplar — satu label per salinan fisik untuk dicetak di kertas A4.
//
// QR hanya berisi nomor inventaris (mis. "INV-0001"): bisa dipindai ke kolom
// pencarian mana pun tanpa membuka URL, dan tidak pernah basi ketika buku
// berpindah rak. SVG dibuat di server supaya pustaka qrcode tidak ikut masuk
// bundel browser.

import QRCode from "qrcode";
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
        };
      }),
    );

    return json({ label });
  });
}
