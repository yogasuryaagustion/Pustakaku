// Check-in kunjungan (kios perpustakaan) & rekap kunjungan (admin).
//
// Dua endpoint dengan model akses berbeda, keduanya mengikuti pola proyek:
//
//   POST /api/kunjungan  — KIOS PUBLIK (tanpa sesi login, keputusan desain).
//       Menerima nomor anggota, memvalidasinya di route DAN di fungsi
//       database, lalu mencatat kunjungan lewat RPC SECURITY DEFINER
//       `catat_kunjungan` (migrasi 0009). Tabel tidak bisa dibaca maupun
//       ditulis langsung: RLS default-deny + tanpa GRANT untuk anon.
//
//   GET  /api/kunjungan  — REKAP/LAPORAN, khusus pihak berwenang
//       (izin laporan.lihat). Mendukung filter tanggal, pencarian nomor/nama
//       anggota, pengurutan tanggal+waktu, dan paginasi server-side agar
//       halaman tetap cepat saat data bertambah. Kebijakan `kunjungan_lihat`
//       (is_admin, migrasi 0009) tetap menegakkan batas walau route dilewati.
//
// Kunci service role TIDAK dipakai di berkas ini sama sekali.

import {
  GalatApi,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseServer } from "@/lib/supabase/server";

const BATAS_HARI = 90; // rentang rekap maksimal
const BATAS_BARIS = 100; // baris per halaman (pagination)
const BATAS_EKSPOR = 1000; // baris untuk ekspor (semua=true)
const BATAS_AGGREGAT = 5000; // baris yang dijadikan dasar grafik & jumlah unik

interface BarisKunjunganRPC {
  status: "baru" | "sudah-tercatat";
  nama: string;
  nomor_anggota: string;
  tanggal: string;
  waktu_masuk: string;
}

/** Tanggal hari ini menurut zona Asia/Jakarta, format YYYY-MM-DD. */
function hariJakarta(offsetHari = 0): string {
  const d = new Date(Date.now() + offsetHari * 86_400_000);
  // Locale "sv-SE" menghasilkan pola ISO (YYYY-MM-DD).
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

function tanggalISO(v: unknown, nama: string): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new GalatApi(`${nama} harus berformat YYYY-MM-DD.`);
  }
  return s;
}

/**
 * Kata kunci pencarian: bersih dari karakter sintaks PostgREST (koma,
 * kurung) supaya tidak merusak ekspresi `or` pada filter tabel tertaut.
 */
function bersihkanQ(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s
    .replace(/[,%()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// ===========================================================================
// POST — check-in kunjungan (kios, tanpa sesi)
// ===========================================================================
export async function POST(request: Request) {
  return jalankan(async () => {
    // Penjaga ringan: tolak permintaan lintas asal (Origin berbeda). Kios
    // selalu same-origin; permintaan tanpa header Origin (curl, PostgREST
    // internal) tetap diterima.
    const origin = request.headers.get("origin");
    if (origin) {
      let sama = false;
      try {
        sama = new URL(origin).host === new URL(request.url).host;
      } catch {
        sama = false;
      }
      if (!sama) throw new GalatApi("Permintaan ditolak (asal tidak dikenal).", 403);
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const nomor = typeof body?.nomorAnggota === "string" ? body.nomorAnggota.trim() : "";
    if (!nomor) throw new GalatApi("Nomor anggota wajib diisi.");
    if (nomor.length > 30 || !/^[A-Za-z0-9 ./_-]+$/.test(nomor)) {
      throw new GalatApi("Format nomor anggota tidak valid.");
    }

    // Klien sesi: tanpa cookie → peran `anon` (memiliki hak eksekusi fungsi
    // sejak migrasi 0009); dengan cookie staf → `authenticated`. Keduanya
    // hanya bisa MENULIS lewat fungsi, tidak membaca tabel.
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.rpc("catat_kunjungan", { p_nomor: nomor });
    if (error) throw dariSupabase(error);

    const r = data as unknown as BarisKunjunganRPC;
    if (!r || typeof r.nama !== "string") {
      throw new GalatApi("Check-in gagal diproses. Coba lagi atau hubungi petugas.", 500);
    }

    return json({
      kunjungan: {
        status: r.status,
        nama: r.nama,
        nomorAnggota: r.nomor_anggota,
        tanggal: r.tanggal,
        waktuMasuk: r.waktu_masuk,
      },
      pesan:
        r.status === "baru"
          ? `Selamat datang, ${r.nama}.`
          : `${r.nama} sudah tercatat hari ini.`,
    });
  });
}

// ===========================================================================
// GET — rekap/laporan kunjungan (admin, izin laporan.lihat)
// ===========================================================================
export async function GET(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "laporan.lihat" });
    const url = new URL(request.url);

    const sampai =
      tanggalISO(url.searchParams.get("sampai"), "Tanggal sampai") ?? hariJakarta();
    const dari =
      tanggalISO(url.searchParams.get("dari"), "Tanggal dari") ?? hariJakarta(-13);
    if (dari > sampai) throw new GalatApi("Tanggal mulai harus sebelum tanggal sampai.");
    const rentangHari =
      (Date.parse(sampai + "T00:00:00Z") - Date.parse(dari + "T00:00:00Z")) / 86_400_000 + 1;
    if (rentangHari > BATAS_HARI) {
      throw new GalatApi(`Rentang laporan maksimal ${BATAS_HARI} hari.`);
    }

    const q = bersihkanQ(url.searchParams.get("q"));
    const hal = Math.max(1, Number(url.searchParams.get("hal")) || 1);
    const per = Math.min(BATAS_BARIS, Math.max(1, Number(url.searchParams.get("per")) || 20));
    const semua = url.searchParams.get("semua") === "true"; // untuk ekspor
    const turun = url.searchParams.get("arah") !== "naik"; // default: terbaru dulu
    const kolomUrut =
      url.searchParams.get("urut") === "tanggal" ? "tanggal_kunjungan" : "waktu_masuk";

    // Ekspresi filter tabel tertaut (PostgREST memakai `*` sebagai wildcard).
    const ekspresiQ = q ? `nomor_anggota.ilike.*${q}*,nama.ilike.*${q}*` : null;

    // ---- 1) Halaman tabel (dengan jumlah total untuk paginasi) ------------
    let kueriBaris = k.supabase
      .from("kunjungan")
      .select("id, anggota_id, tanggal_kunjungan, waktu_masuk, anggota(nama, nomor_anggota)", {
        count: "exact",
      })
      .gte("tanggal_kunjungan", dari)
      .lte("tanggal_kunjungan", sampai);
    if (ekspresiQ) {
      kueriBaris = kueriBaris.or(ekspresiQ, { foreignTable: "anggota" });
    }
    const mulai = semua ? 0 : (hal - 1) * per;
    const akhir = semua ? mulai + BATAS_EKSPOR - 1 : mulai + per - 1;
    const { data, error, count } = await kueriBaris
      .order(kolomUrut, { ascending: !turun })
      .order("waktu_masuk", { ascending: !turun })
      .range(mulai, akhir);
    if (error) throw dariSupabase(error);

    // ---- 2) Agregat seluruh baris terfilter (grafik + jumlah unik) --------
    // Dipisah dari halaman tabel agar grafik/grup tetap utuh walau tabel
    // dipaginasi — angka ringkasan selalu konsisten dengan filter aktif.
    let kueriAgregat = k.supabase
      .from("kunjungan")
      .select("tanggal_kunjungan, anggota_id")
      .gte("tanggal_kunjungan", dari)
      .lte("tanggal_kunjungan", sampai);
    if (ekspresiQ) {
      kueriAgregat = kueriAgregat.or(ekspresiQ, { foreignTable: "anggota" });
    }
    const { data: agregat, error: errAgregat } = await kueriAgregat.limit(BATAS_AGGREGAT);
    if (errAgregat) throw dariSupabase(errAgregat);

    // ---- 3) Hitung kunjungan hari ini (tanpa filter, selalu tampil) -------
    const { count: hariIni, error: errHari } = await k.supabase
      .from("kunjungan")
      .select("id", { count: "exact", head: true })
      .eq("tanggal_kunjungan", hariJakarta());
    if (errHari) throw dariSupabase(errHari);

    // ---- Susun respons ----------------------------------------------------
    interface Baris {
      id: string;
      anggota_id: string;
      tanggal_kunjungan: string;
      waktu_masuk: string;
      // Relasi many-to-one bisa dipetakan sebagai objek ATAU larik satu elemen
      // tergantung versi supabase-js — dinormalisasi di bawah.
      anggota: { nama: string; nomor_anggota: string }[] | { nama: string; nomor_anggota: string } | null;
    }
    const baris = (data ?? []) as Baris[];
    const kartu = (b: Baris) => (Array.isArray(b.anggota) ? b.anggota[0] : b.anggota);

    const perHari = new Map<string, number>();
    const unik = new Set<string>();
    for (const a of (agregat ?? []) as { tanggal_kunjungan: string; anggota_id: string }[]) {
      perHari.set(a.tanggal_kunjungan, (perHari.get(a.tanggal_kunjungan) ?? 0) + 1);
      unik.add(a.anggota_id);
    }
    const ringkasan = Array.from(perHari.entries())
      .map(([tanggal, jumlah]) => ({ tanggal, jumlah }))
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

    const total = count ?? 0;
    return json({
      dari,
      sampai,
      q,
      hal,
      per,
      semua,
      urut: kolomUrut,
      arah: turun ? "turun" : "naik",
      total,
      halTerakhir: Math.max(1, Math.ceil(total / per)),
      pengunjungUnik: unik.size,
      hariIni: hariIni ?? 0,
      terpotong: (agregat ?? []).length >= BATAS_AGGREGAT,
      ringkasan,
      kunjungan: baris.map((b) => ({
        id: b.id,
        anggotaId: b.anggota_id,
        nama: kartu(b)?.nama ?? "-",
        nomorAnggota: kartu(b)?.nomor_anggota ?? "-",
        tanggal: b.tanggal_kunjungan,
        waktuMasuk: b.waktu_masuk,
      })),
    });
  });
}