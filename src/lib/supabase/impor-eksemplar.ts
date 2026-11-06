// Parser CSV untuk impor eksemplar massal.
//
// Format (baris pertama = header, urutan bebas, pemisah koma atau titik koma):
//   buku_id,judul,isbn,nomor_inventaris,status,kondisi_fisik,tanggal_pengadaan,keterangan
//
// Setiap baris mewakili SATU salinan fisik. Judul cukup dikenali lewat salah
// satu dari buku_id / isbn / judul; kolom lain opsional (status bawaan
// "tersedia", kondisi bawaan "layak").

export interface BarisImporEksemplar {
  /** Nomor baris di berkas (1 = header) untuk pesan galat. */
  baris: number;
  buku_id: string;
  nomor_inventaris: string;
  status: string;
  kondisi_fisik: string;
  tanggal_pengadaan: string | null;
  keterangan: string | null;
}

export interface BarisBermasalah {
  baris: number;
  pesan: string;
}

export const KOLOM_WAJIB = ["nomor_inventaris"] as const;
export const KOLOM_DIKENAL = [
  "buku_id",
  "judul",
  "isbn",
  "nomor_inventaris",
  "status",
  "kondisi_fisik",
  "tanggal_pengadaan",
  "keterangan",
] as const;

/** Samakan judul kolom: huruf kecil, spasi/strip → garis bawah. */
function normalKolom(nilai: string): string {
  return nilai
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Tebak pemisah dari baris header (koma vs titik koma). */
function deteksiPemisah(header: string): string {
  const koma = (header.match(/,/g) ?? []).length;
  const titikKoma = (header.match(/;/g) ?? []).length;
  return titikKoma > koma ? ";" : ",";
}

/** Pecah CSV sederhana dengan dukungan tanda kutip ganda. */
function pecahCsv(teks: string, pemisah: string): string[][] {
  const hasil: string[][] = [];
  let baris: string[] = [];
  let sel = "";
  let dalamKutip = false;

  for (let i = 0; i < teks.length; i += 1) {
    const huruf = teks[i];
    if (dalamKutip) {
      if (huruf === '"') {
        if (teks[i + 1] === '"') {
          sel += '"';
          i += 1;
        } else {
          dalamKutip = false;
        }
      } else {
        sel += huruf;
      }
      continue;
    }
    if (huruf === '"') {
      dalamKutip = true;
    } else if (huruf === pemisah) {
      baris.push(sel);
      sel = "";
    } else if (huruf === "\n") {
      baris.push(sel);
      hasil.push(baris);
      baris = [];
      sel = "";
    } else if (huruf !== "\r") {
      sel += huruf;
    }
  }

  if (sel !== "" || baris.length > 0) {
    baris.push(sel);
    hasil.push(baris);
  }
  return hasil;
}

/** Ubah teks CSV menjadi baris siap validasi (belum dicocokkan ke buku). */
export function bacaCsvEksemplar(teks: string): {
  baris: Array<Omit<BarisImporEksemplar, "buku_id"> & { buku_id?: string; judul?: string; isbn?: string }>;
  galat: BarisBermasalah[];
} {
  const bersih = teks.replace(/^\uFEFF/, "");
  if (!bersih.trim()) {
    return { baris: [], galat: [{ baris: 0, pesan: "Berkas CSV kosong." }] };
  }

  const pemisah = deteksiPemisah(bersih.split(/\r?\n/, 1)[0] ?? "");
  const mentah = pecahCsv(bersih, pemisah).filter((r) => r.some((s) => s.trim() !== ""));
  if (mentah.length === 0) {
    return { baris: [], galat: [{ baris: 0, pesan: "Berkas CSV kosong." }] };
  }

  const header = mentah[0].map(normalKolom);
  const galat: BarisBermasalah[] = [];
  const indeks: Record<string, number> = {};
  header.forEach((kolom, i) => {
    if (kolom) indeks[kolom] = i;
  });

  for (const wajib of KOLOM_WAJIB) {
    if (indeks[wajib] === undefined) {
      return {
        baris: [],
        galat: [{ baris: 1, pesan: `Kolom wajib "${wajib}" tidak ditemukan di header.` }],
      };
    }
  }
  if (indeks.buku_id === undefined && indeks.judul === undefined && indeks.isbn === undefined) {
    return {
      baris: [],
      galat: [
        {
          baris: 1,
          pesan: "Sertakan salah satu kolom pengenal buku: buku_id, isbn, atau judul.",
        },
      ],
    };
  }

  const ambil = (sel: string[], kolom: string): string => {
    const i = indeks[kolom];
    return i === undefined ? "" : (sel[i] ?? "").trim();
  };

  const baris: Array<
    Omit<BarisImporEksemplar, "buku_id"> & { buku_id?: string; judul?: string; isbn?: string }
  > = [];

  for (let i = 1; i < mentah.length; i += 1) {
    const sel = mentah[i];
    const nomorBaris = i + 1;
    const nomor = ambil(sel, "nomor_inventaris");
    if (!nomor) {
      galat.push({ baris: nomorBaris, pesan: "Nomor inventaris kosong." });
      continue;
    }

    baris.push({
      baris: nomorBaris,
      buku_id: ambil(sel, "buku_id") || undefined,
      judul: ambil(sel, "judul") || undefined,
      isbn: ambil(sel, "isbn") || undefined,
      nomor_inventaris: nomor,
      status: ambil(sel, "status") || "tersedia",
      kondisi_fisik: ambil(sel, "kondisi_fisik") || "layak",
      tanggal_pengadaan: ambil(sel, "tanggal_pengadaan") || null,
      keterangan: ambil(sel, "keterangan") || null,
    });
  }

  return { baris, galat };
}

/** Bungkus nilai menjadi sel CSV yang aman. */
export function selCsv(nilai: string | number | null | undefined): string {
  const teks = nilai === null || nilai === undefined ? "" : String(nilai);
  return /[",;\n]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}
