// Eksemplar fisik buku — daftar inventaris & penambahan satu eksemplar.
//
// Tabel `eksemplar_buku` adalah sumber kebenaran inventaris fisik; kolom
// `buku.stok` disinkronkan oleh trigger fn_sinkronisasi_stok_buku. Ringkasan
// per judul dibaca dari view v_inventaris_per_buku.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksPublik,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import {
  keEksemplar,
  keInventarisPerBuku,
  type BarisEksemplar,
  type BarisInventarisPerBuku,
} from "@/lib/supabase/peta";
import {
  sahkanEksemplarBody,
  sahkanJumlahEksemplar,
} from "@/lib/supabase/validasi";
import { kondisiDikenal, statusDikenal } from "@/lib/supabase/inventaris";

const KOLOM_EKSEMPLAR =
  "id,buku_id,nomor_inventaris,status,kondisi_fisik,tanggal_pengadaan,keterangan,dibuat_pada,diedit_pada";

const KOLOM_RINGKASAN =
  "buku_id,judul,penulis,penerbit,tahun,isbn,kategori,rak,stok,total_eksemplar,tersedia,dipinjam,rusak,hilang";

/** GET /api/eksemplar — daftar eksemplar + ringkasan per judul. */
export async function GET() {
  return jalankan(async () => {
    const k = await konteksPublik();
    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .select(KOLOM_EKSEMPLAR)
      .order("nomor_inventaris", { ascending: true });
    if (error) throw dariSupabase(error);

    const { data: ringkasan, error: errRingkasan } = await k.supabase
      .from("v_inventaris_per_buku")
      .select(KOLOM_RINGKASAN)
      .order("judul", { ascending: true });
    if (errRingkasan) {
      console.warn("[eksemplar] ringkasan inventaris gagal:", errRingkasan.message);
    }

    return json({
      eksemplar: ((data ?? []) as BarisEksemplar[]).map(keEksemplar),
      ringkasan: ((ringkasan ?? []) as BarisInventarisPerBuku[]).map(keInventarisPerBuku),
    });
  });
}

/**
 * POST /api/eksemplar — tambah satu atau beberapa eksemplar sekaligus
 * (petugas: katalog.kelola).
 *
 * `jumlah` > 1 menyisipkan sekian salinan dalam satu transaksi database; setiap
 * salinan mendapat nomor inventaris berurutan dari pola Pengaturan.
 */
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const badan = await bacaBody(request);
    const isi = sahkanEksemplarBody(badan);
    const jumlah = sahkanJumlahEksemplar(badan?.jumlah);

    if (!isi.buku_id) throw new GalatApi("Buku wajib dipilih.", 400);

    const status = isi.status ?? "tersedia";
    const kondisi = isi.kondisi_fisik ?? "layak";
    if (!statusDikenal(status)) throw new GalatApi("Status eksemplar tidak dikenal.", 400);
    if (!kondisiDikenal(kondisi)) throw new GalatApi("Kondisi fisik tidak dikenal.", 400);

    // Nomor manual hanya masuk akal untuk satu salinan: kalau petugas meminta
    // 5 salinan sekaligus, penomoran harus berurutan dari pola Pengaturan.
    if (jumlah > 1 && isi.nomor_inventaris) {
      throw new GalatApi(
        "Nomor manual hanya untuk satu eksemplar. Kosongkan nomor agar dibuat otomatis berurutan.",
        400,
      );
    }

    // Nomor kosong → database membuat nomor berikutnya sesuai pola di
    // Pengaturan, di dalam transaksi yang sama dengan penyisipan.
    const { data, error } = await k.supabase.rpc("tambah_eksemplar_banyak", {
      p_buku_id: isi.buku_id,
      p_jumlah: jumlah,
      p_status: status,
      p_kondisi: kondisi,
      p_tanggal: isi.tanggal_pengadaan ?? null,
      p_keterangan: isi.keterangan ?? null,
    });
    if (error) throw dariSupabase(error);

    // Fungsi database selalu mengembalikan larik, termasuk saat jumlah = 1.
    const baris = (Array.isArray(data) ? data : [data]) as BarisEksemplar[];
    const eksemplar = baris.map(keEksemplar);
    if (eksemplar.length === 0) {
      throw new GalatApi("Eksemplar gagal disimpan.", 500);
    }

    const pertama = eksemplar[0].nomor_inventaris;
    const terakhir = eksemplar[eksemplar.length - 1].nomor_inventaris;
    await catatJejakServer(k, {
      jenis: "buku",
      aksi: eksemplar.length > 1 ? "Eksemplar ditambahkan (banyak)" : "Eksemplar ditambahkan",
      objek: eksemplar.length > 1 ? `${pertama} … ${terakhir}` : pertama,
      detail:
        `${eksemplar.length} salinan · status ${status} · kondisi ${kondisi}`,
    });

    return json({ eksemplar, jumlah: eksemplar.length }, 201);
  });
}
