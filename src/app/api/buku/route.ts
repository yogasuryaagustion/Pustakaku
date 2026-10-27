// Katalog buku: daftar (publik sesuai izin) & penambahan (admin).

import {
  bacaBody,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { dariBuku, keBuku, type BarisBuku } from "@/lib/supabase/peta";
import { sahkanBukuBody } from "@/lib/supabase/validasi";

export async function GET() {
  return jalankan(async () => {
    // Baris yang boleh dilihat sudah ditentukan RLS (matriks izin `katalog.lihat`),
    // sehingga tamu, anggota, dan admin masing-masing menerima set yang benar.
    const k = await konteksRoute();
    const { data, error } = await k.supabase
      .from("buku")
      .select("*")
      .order("created_at", { ascending: false })
      .order("ditambahkan_pada", { ascending: true });
    if (error) throw dariSupabase(error);

    // Jumlah peminjaman aktif per buku (agregat, tanpa identitas peminjam)
    // agar ketersediaan stok benar untuk semua peran — bukan hanya admin.
    const { data: hitung, error: errHitung } = await k.supabase.rpc("jumlah_dipinjam");
    const dipinjam: Record<string, number> = {};
    if (!errHitung && Array.isArray(hitung)) {
      for (const baris of hitung as { buku_id: string; jumlah: number }[]) {
        dipinjam[baris.buku_id] = Number(baris.jumlah) || 0;
      }
    } else if (errHitung) {
      console.warn("[buku] agregat ketersediaan gagal:", errHitung.message);
    }

    return json({ buku: ((data ?? []) as BarisBuku[]).map(keBuku), dipinjam });
  });
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const isi = sahkanBukuBody(await bacaBody(request), { wajibSemua: true });

    const { data, error } = await k.supabase
      .from("buku")
      .insert(dariBuku(isi))
      .select("*")
      .single();
    if (error) throw dariSupabase(error);

    const buku = keBuku(data as BarisBuku);
    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Buku ditambahkan",
      objek: buku.judul,
      detail: `stok ${buku.stok} · ${buku.kategori}`,
    });
    return json({ buku }, 201);
  });
}
