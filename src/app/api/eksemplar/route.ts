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
import { sahkanEksemplarBody } from "@/lib/supabase/validasi";
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

/** POST /api/eksemplar — tambah satu eksemplar (petugas: katalog.kelola). */
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const isi = sahkanEksemplarBody(await bacaBody(request));

    if (!isi.buku_id) throw new GalatApi("Buku wajib dipilih.", 400);
    if (!isi.nomor_inventaris) throw new GalatApi("Nomor inventaris wajib diisi.", 400);

    const status = isi.status ?? "tersedia";
    const kondisi = isi.kondisi_fisik ?? "layak";
    if (!statusDikenal(status)) throw new GalatApi("Status eksemplar tidak dikenal.", 400);
    if (!kondisiDikenal(kondisi)) throw new GalatApi("Kondisi fisik tidak dikenal.", 400);

    const { data, error } = await k.supabase
      .from("eksemplar_buku")
      .insert({
        buku_id: isi.buku_id,
        nomor_inventaris: isi.nomor_inventaris,
        status,
        kondisi_fisik: kondisi,
        tanggal_pengadaan: isi.tanggal_pengadaan ?? new Date().toISOString().slice(0, 10),
        keterangan: isi.keterangan ?? null,
      })
      .select(KOLOM_EKSEMPLAR)
      .single();
    if (error) throw dariSupabase(error);

    const eksemplar = keEksemplar(data as BarisEksemplar);
    await catatJejakServer(k, {
      jenis: "buku",
      aksi: "Eksemplar ditambahkan",
      objek: eksemplar.nomor_inventaris,
      detail: `status ${eksemplar.status} · kondisi ${eksemplar.kondisi_fisik}`,
    });

    return json({ eksemplar }, 201);
  });
}
