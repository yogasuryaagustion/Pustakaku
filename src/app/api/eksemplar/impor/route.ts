// Impor eksemplar massal dari CSV.
// GET  — unduh template berisi semua judul (satu baris per salinan).
// POST — impor baris CSV: cocokkan judul, validasi, lalu simpan eksemplar.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { kondisiDikenal, statusDikenal } from "@/lib/supabase/inventaris";
import {
  bacaCsvEksemplar,
  selCsv,
  type BarisBermasalah,
} from "@/lib/supabase/impor-eksemplar";

const BATAS_BARIS = 2000;
const BATAS_BYTE = 512 * 1024;

const KOLOM_TEMPLATE = ["buku_id", "judul", "isbn", "nomor_inventaris"] as const;

/** GET /api/eksemplar/impor — template CSV dari data buku yang ada. */
export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });

    const { data, error } = await k.supabase
      .from("buku")
      .select("id,judul,isbn,stok")
      .order("judul", { ascending: true });
    if (error) throw dariSupabase(error);

    const baris: string[] = [KOLOM_TEMPLATE.join(",")];
    for (const b of (data ?? []) as { id: string; judul: string; isbn: string; stok: number }[]) {
      // Satu baris per salinan yang tercatat di stok; nomor inventaris
      // sengaja dikosongkan untuk diisi petugas.
      const jumlah = Math.min(Math.max(Number(b.stok) || 0, 1), 100);
      for (let i = 0; i < jumlah; i += 1) {
        baris.push([selCsv(b.id), selCsv(b.judul), selCsv(b.isbn), ""].join(","));
      }
    }

    const csv = `${baris.join("\r\n")}\r\n`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template-impor-eksemplar.csv"',
        "Cache-Control": "no-store",
      },
    });
  });
}

interface BukuRingkas {
  id: string;
  judul: string;
  isbn: string;
}

/** POST /api/eksemplar/impor — simpan eksemplar dari CSV. */
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });

    const body = (await bacaBody<{ csv?: unknown }>(request)) ?? {};
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) throw new GalatApi("Isi berkas CSV belum ada.", 400);
    if (csv.length > BATAS_BYTE) {
      throw new GalatApi("Berkas CSV terlalu besar (maksimal 512 KB).", 400);
    }

    const { baris, galat } = bacaCsvEksemplar(csv);
    if (baris.length === 0 && galat.length === 0) {
      throw new GalatApi("Tidak ada baris data yang bisa diimpor.", 400);
    }
    if (baris.length > BATAS_BARIS) {
      throw new GalatApi(`Maksimal ${BATAS_BARIS} baris per impor.`, 400);
    }

    // Peta pencocokan buku: id, ISBN, dan judul (tanpa beda huruf besar/kecil).
    const { data: daftarBuku, error: errBuku } = await k.supabase
      .from("buku")
      .select("id,judul,isbn");
    if (errBuku) throw dariSupabase(errBuku);

    const lewatId = new Map<string, BukuRingkas>();
    const lewatIsbn = new Map<string, BukuRingkas[]>();
    const lewatJudul = new Map<string, BukuRingkas[]>();
    for (const b of (daftarBuku ?? []) as BukuRingkas[]) {
      lewatId.set(b.id, b);
      const isbn = (b.isbn ?? "").trim();
      if (isbn) {
        const ada = lewatIsbn.get(isbn) ?? [];
        ada.push(b);
        lewatIsbn.set(isbn, ada);
      }
      const judul = (b.judul ?? "").trim().toLowerCase();
      const adaJudul = lewatJudul.get(judul) ?? [];
      adaJudul.push(b);
      lewatJudul.set(judul, adaJudul);
    }

    // Nomor inventaris yang sudah dipakai — duplikat dilewati, bukan gagal.
    const { data: nomorAda, error: errNomor } = await k.supabase
      .from("eksemplar_buku")
      .select("nomor_inventaris");
    if (errNomor) throw dariSupabase(errNomor);
    const terpakai = new Set(
      ((nomorAda ?? []) as { nomor_inventaris: string }[]).map((e) => e.nomor_inventaris),
    );

    const galatBaris: BarisBermasalah[] = [...galat];
    const siap: Array<Record<string, unknown>> = [];
    let dilewati = 0;

    for (const b of baris) {
      if (terpakai.has(b.nomor_inventaris)) {
        dilewati += 1;
        galatBaris.push({
          baris: b.baris,
          pesan: `Nomor inventaris "${b.nomor_inventaris}" sudah terdaftar — dilewati.`,
        });
        continue;
      }

      // Cocokkan buku: id → ISBN → judul.
      let buku: BukuRingkas | undefined;
      if (b.buku_id) buku = lewatId.get(b.buku_id);
      if (!buku && b.isbn) {
        const kandidat = lewatIsbn.get(b.isbn) ?? [];
        if (kandidat.length === 1) buku = kandidat[0];
        else if (kandidat.length > 1) {
          galatBaris.push({
            baris: b.baris,
            pesan: `ISBN "${b.isbn}" dipakai lebih dari satu judul — gunakan buku_id.`,
          });
          continue;
        }
      }
      if (!buku && b.judul) {
        const kandidat = lewatJudul.get(b.judul.trim().toLowerCase()) ?? [];
        if (kandidat.length === 1) buku = kandidat[0];
        else if (kandidat.length > 1) {
          galatBaris.push({
            baris: b.baris,
            pesan: `Judul "${b.judul}" cocok dengan lebih dari satu buku — gunakan buku_id atau ISBN.`,
          });
          continue;
        }
      }
      if (!buku) {
        galatBaris.push({
          baris: b.baris,
          pesan: `Buku tidak ditemukan untuk ${b.buku_id ? `buku_id "${b.buku_id}"` : b.isbn ? `ISBN "${b.isbn}"` : `judul "${b.judul ?? ""}"`}.`,
        });
        continue;
      }

      if (!statusDikenal(b.status)) {
        galatBaris.push({ baris: b.baris, pesan: `Status "${b.status}" tidak dikenal.` });
        continue;
      }
      if (!kondisiDikenal(b.kondisi_fisik)) {
        galatBaris.push({ baris: b.baris, pesan: `Kondisi "${b.kondisi_fisik}" tidak dikenal.` });
        continue;
      }

      terpakai.add(b.nomor_inventaris);
      siap.push({
        buku_id: buku.id,
        nomor_inventaris: b.nomor_inventaris,
        status: b.status,
        kondisi_fisik: b.kondisi_fisik,
        tanggal_pengadaan: b.tanggal_pengadaan ?? new Date().toISOString().slice(0, 10),
        keterangan: b.keterangan,
      });
    }

    if (siap.length > 0) {
      const { error } = await k.supabase.from("eksemplar_buku").insert(siap);
      if (error) throw dariSupabase(error);

      await catatJejakServer(k, {
        jenis: "buku",
        aksi: "Impor eksemplar",
        objek: `${siap.length} eksemplar`,
        detail: `CSV · ${dilewati} dilewati · ${galatBaris.length} galat`,
      });
    }

    return json(
      {
        ditambahkan: siap.length,
        dilewati,
        galat: galatBaris.slice(0, 50),
        total_galat: galatBaris.length,
      },
      siap.length > 0 ? 201 : 200,
    );
  });
}
