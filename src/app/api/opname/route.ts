// Stock opname — riwayat sesi & pencatatan sesi baru.
//
// Satu sesi opname menyimpan ringkasan (jumlah dibandingkan/ditemukan/tidak
// ditemukan) beserta baris per eksemplar yang diperiksa (tabel opname_baris).
// Baris yang menyertakan status/kondisi baru sekaligus memperbarui eksemplar.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { sahkanOpnameBody } from "@/lib/supabase/validasi";
import {
  kondisiDikenal,
  hitungOpname,
  KOLOM_OPNAME,
  KOLOM_OPNAME_BARIS,
  statusDikenal,
  type BarisOpname,
} from "@/lib/supabase/inventaris";
import type { BarisEksemplar } from "@/lib/supabase/peta";

/** Angka aman dari body (bisa string/undefined). */
function angka(v: unknown, bawaan = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : bawaan;
}

/**
 * Jumlah fisik sebuah baris opname. Bila `jumlah_fisik` tidak dikirim, baris
 * dianggap satu eksemplar yang ditemukan — kecuali ditandai tidak ditemukan.
 */
function jumlahFisikBaris(b: { jumlah_fisik?: unknown; tidak_ditemukan?: unknown }): number {
  if (b.jumlah_fisik !== undefined) return angka(b.jumlah_fisik, 0);
  return angka(b.tidak_ditemukan, 0) > 0 ? 0 : 1;
}

/** GET /api/opname — riwayat sesi stock opname. */
export async function GET() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const { data, error } = await k.supabase
      .from("opname")
      .select(KOLOM_OPNAME)
      .order("dibuat_pada", { ascending: false });
    if (error) throw dariSupabase(error);

    return json({ opname: (data ?? []) as BarisOpname[] });
  });
}

/** POST /api/opname — catat satu sesi stock opname. */
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true, wajibIzin: "katalog.kelola" });
    const isi = sahkanOpnameBody(await bacaBody(request));
    const baris = isi.baris ?? [];
    if (baris.length === 0) {
      throw new GalatApi("Minimal satu baris opname harus dikirim.", 400);
    }

    const idEksemplar: string[] = [];
    for (const b of baris) {
      if (!b.id) throw new GalatApi("Setiap baris opname harus memuat id eksemplar.", 400);
      if (!b.nomor_inventaris) {
        throw new GalatApi("Setiap baris opname harus memuat nomor inventaris.", 400);
      }
      const statusBaris = typeof b.status === "string" ? b.status : "";
      const kondisiBaris = typeof b.kondisi_fisik === "string" ? b.kondisi_fisik : "";
      if (statusBaris && !statusDikenal(statusBaris)) {
        throw new GalatApi(`Status '${statusBaris}' tidak dikenal.`, 400);
      }
      if (kondisiBaris && !kondisiDikenal(kondisiBaris)) {
        throw new GalatApi(`Kondisi '${kondisiBaris}' tidak dikenal.`, 400);
      }
      idEksemplar.push(String(b.id));
    }

    // Data sistem untuk dibandingkan: status/kondisi saat opname dilakukan.
    const { data: sistem, error: errSistem } = await k.supabase
      .from("eksemplar_buku")
      .select("id,buku_id,nomor_inventaris,status,kondisi_fisik")
      .in("id", idEksemplar);
    if (errSistem) throw dariSupabase(errSistem);
    const petaSistem = new Map<string, BarisEksemplar>();
    for (const e of (sistem ?? []) as BarisEksemplar[]) petaSistem.set(e.id, e);

    const idBuku = Array.from(new Set(baris.map((b) => b.buku_id).filter(Boolean)));
    const judulBuku = new Map<string, string>();
    if (idBuku.length > 0) {
      const { data: daftarBuku, error: errBuku } = await k.supabase
        .from("buku")
        .select("id,judul")
        .in("id", idBuku as string[]);
      if (errBuku) throw dariSupabase(errBuku);
      for (const b of (daftarBuku ?? []) as { id: string; judul: string }[]) {
        judulBuku.set(b.id, b.judul);
      }
    }

    const ringkas = hitungOpname(
      baris.map((b) => ({
        ditemukan: jumlahFisikBaris(b),
        tidak_ditemukan: angka(b.tidak_ditemukan, 0),
      })),
    );

    const nama = k.pengguna?.nama ?? "";
    const { data: sesi, error: errSesi } = await k.supabase
      .from("opname")
      .insert({
        judul: `Opname ${new Date().toLocaleDateString("id-ID")}`,
        komentar: isi.komentar ?? null,
        ...ringkas,
        dikerjakan_bynama: nama,
        dikerjakan_oleh: k.pengguna?.id ?? null,
      })
      .select(KOLOM_OPNAME)
      .single();
    if (errSesi) throw dariSupabase(errSesi);

    const opname = sesi as BarisOpname;

    const { data: tersimpan, error: errBaris } = await k.supabase
      .from("opname_baris")
      .insert(
        baris.map((b) => {
          const e = petaSistem.get(String(b.id));
          const jumlah = jumlahFisikBaris(b);
          const ditemukan = jumlah > 0;
          return {
            opname_id: opname.id,
            eksemplar_id: e?.id ?? null,
            buku_id: b.buku_id ?? e?.buku_id ?? null,
            nomor_inventaris: b.nomor_inventaris,
            judul: (b.buku_id && judulBuku.get(String(b.buku_id))) || "",
            status_sistem: e?.status ?? "",
            kondisi_sistem: e?.kondisi_fisik ?? "",
            ditemukan,
            jumlah_fisik: jumlah,
            status_fisik: b.status ?? null,
            kondisi_fisik: b.kondisi_fisik ?? null,
            keterangan: b.keterangan ?? null,
          };
        }),
      )
      .select(KOLOM_OPNAME_BARIS);
    if (errBaris) throw dariSupabase(errBaris);

    // Terapkan hasil pemeriksaan bila baris membawa status/kondisi baru.
    for (const b of baris) {
      const patch: Record<string, unknown> = {};
      if (b.status) patch.status = b.status;
      if (b.kondisi_fisik) patch.kondisi_fisik = b.kondisi_fisik;
      if (b.keterangan !== undefined) patch.keterangan = b.keterangan ?? null;
      if (Object.keys(patch).length === 0) continue;

      const { error } = await k.supabase
        .from("eksemplar_buku")
        .update({ ...patch, diedit_pada: new Date().toISOString() })
        .eq("id", String(b.id));
      if (error) throw dariSupabase(error);
    }

    await catatJejakServer(k, {
      jenis: "sistem",
      aksi: "Stock opname dicatat",
      objek: `${ringkas.jumlah_dibandingkan} eksemplar`,
      detail: `${ringkas.jumlah_ditemukan} ditemukan · ${ringkas.jumlah_tidak_ditemukan} tidak ditemukan`,
    });

    return json({ opname, baris: tersimpan ?? [] }, 201);
  });
}
