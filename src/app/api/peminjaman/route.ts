// Peminjaman: daftar (difilter RLS per peran) & pencatatan pinjam baru.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksPublik,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { kePeminjaman, type BarisPeminjaman } from "@/lib/supabase/peta";
import { tanggal } from "@/lib/supabase/validasi";

export async function GET() {
  return jalankan(async () => {
    // RLS: admin/petugas melihat semua (sirkulasi.lihat), anggota hanya
    // miliknya sendiri (panel.pinjaman), tamu tidak melihat apa pun.
    // GET ini tidak membaca k.pengguna → konteksPublik tanpa validasi sesi.
    const k = await konteksPublik();
    const { data, error } = await k.supabase
      .from("peminjaman")
      // Sertakan nomor inventaris salinan fisik yang dipinjam (bila ada).
      .select(
        "*,eksemplar_buku(nomor_inventaris),pembayaran_denda(id,nominal,catatan,dibuat_pada)",
      )
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

    // Lama pinjam opsional: bila kosong, database memakai nilai standar dari
    // Pengaturan Sistem. Rentang 1–90 hari juga diperiksa ulang di sana.
    let lamaHari: number | null = null;
    if (body?.lamaHari !== undefined && body?.lamaHari !== null && body?.lamaHari !== "") {
      const angka = Number(body.lamaHari);
      if (!Number.isInteger(angka) || angka < 1 || angka > 90) {
        throw new GalatApi("Lama pinjam harus antara 1 dan 90 hari.");
      }
      lamaHari = angka;
    }

    // Salinan spesifik hasil pindai barcode (opsional). Bila diisi, database
    // meminjam salinan itu; bila kosong, dipilih salinan tersedia pertama.
    const eksemplarId =
      typeof body?.eksemplarId === "string" && body.eksemplarId
        ? body.eksemplarId
        : null;

    // Validasi izin, stok, batas pinjaman, dan penomoran → atomik di database.
    const { data, error } = await k.supabase.rpc("pinjam_buku", {
      p_buku_id: bukuId,
      p_anggota_id: anggotaId,
      p_tanggal_pinjam: tgl ?? null,
      p_lama_hari: lamaHari,
      p_eksemplar_id: eksemplarId,
    });
    if (error) throw dariSupabase(error);

    return json({ peminjaman: kePeminjaman(data as unknown as BarisPeminjaman) }, 201);
  });
}
