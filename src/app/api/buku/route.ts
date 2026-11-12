// Katalog buku: daftar (publik sesuai izin) & penambahan (admin).

import {
  bacaBody,
  dariSupabase,
  jalankan,
  json,
  kolomBelumAda,
  konteksPublik,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { dariBuku, keBuku, type BarisBuku } from "@/lib/supabase/peta";
import { sahkanBukuBody } from "@/lib/supabase/validasi";

export async function GET() {
  return jalankan(async () => {
    // Baris yang boleh dilihat sudah ditentukan RLS (matriks izin `katalog.lihat`),
    // sehingga tamu, anggota, dan admin masing-masing menerima set yang benar —
    // GET ini tidak membaca k.pengguna, jadi konteksPublik (tanpa validasi sesi)
    // sudah cukup dan menghemat dua roundtrip per muat halaman.
    const k = await konteksPublik();

    // Katalog hanya memuat buku yang belum diarsipkan. Buku beriwayat
    // peminjaman tidak bisa dibuang permanen (FK buku_id on delete restrict),
    // jadi penghapusannya berupa tanda dihapus_pada — riwayat tetap utuh.
    const muatBuku = () =>
      k.supabase
        .from("buku")
        .select("*")
        .is("dihapus_pada", null)
        .order("created_at", { ascending: false })
        .order("ditambahkan_pada", { ascending: true });

    // Daftar buku & agregat ketersediaan diambil PARALEL — roundtrip Supabase
    // yang dulu berurutan kini tumpang tindih.
    const [hasilBuku, hasilRpc, hasilTersedia] = await Promise.all([
      muatBuku(),
      k.supabase.rpc("jumlah_dipinjam"),
      k.supabase.rpc("jumlah_tersedia"),
    ]);

    let dataBuku = hasilBuku.data;
    if (hasilBuku.error && kolomBelumAda(hasilBuku.error)) {
      // Migrasi arsip buku belum dijalankan: tampilkan katalog apa adanya agar
      // halaman tetap terbuka (tanpa penyaringan arsip).
      const ulang = await k.supabase
        .from("buku")
        .select("*")
        .order("created_at", { ascending: false })
        .order("ditambahkan_pada", { ascending: true });
      if (ulang.error) throw dariSupabase(ulang.error);
      dataBuku = ulang.data;
    } else if (hasilBuku.error) {
      throw dariSupabase(hasilBuku.error);
    }

    // Jumlah peminjaman aktif per buku (agregat, tanpa identitas peminjam)
    // agar ketersediaan stok benar untuk semua peran — bukan hanya admin.
    const { data: hitung, error: errHitung } = hasilRpc;
    const dipinjam: Record<string, number> = {};
    if (!errHitung && Array.isArray(hitung)) {
      for (const baris of hitung as { buku_id: string; jumlah: number }[]) {
        dipinjam[baris.buku_id] = Number(baris.jumlah) || 0;
      }
    } else if (errHitung) {
      console.warn("[buku] agregat ketersediaan gagal:", errHitung.message);
    }

    // Salinan yang benar-benar bisa dipinjam (rusak/hilang tidak dihitung).
    // Bila fungsi belum ada (migrasi terlewat), biarkan kosong agar klien
    // memakai perhitungan lama `stok - dipinjam`.
    const { data: hitungTersedia, error: errTersedia } = hasilTersedia;
    const tersedia: Record<string, number> = {};
    if (!errTersedia && Array.isArray(hitungTersedia)) {
      for (const baris of hitungTersedia as { buku_id: string; jumlah: number }[]) {
        tersedia[baris.buku_id] = Number(baris.jumlah) || 0;
      }
    } else if (errTersedia) {
      console.warn("[buku] agregat salinan tersedia gagal:", errTersedia.message);
    }

    return json({
      buku: ((dataBuku ?? []) as BarisBuku[]).map(keBuku),
      dipinjam,
      tersedia,
    });
  });
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "katalog.kelola" });
    const isi = sahkanBukuBody(await bacaBody(request), { wajibSemua: true });

    const baris = dariBuku(isi);

    let { data, error } = await k.supabase
      .from("buku")
      .insert(baris)
      .select("*")
      .single();

    // Database yang belum menjalankan migrasi denda buku hilang belum punya
    // kolom harga; simpan buku tanpa harga agar input tetap berhasil.
    if (kolomBelumAda(error) && "harga" in baris) {
      const tanpaHarga = { ...baris };
      delete tanpaHarga.harga;
      ({ data, error } = await k.supabase
        .from("buku")
        .insert(tanpaHarga)
        .select("*")
        .single());
    }

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
