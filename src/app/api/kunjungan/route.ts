
import {
  GalatApi,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseServer } from "@/lib/supabase/server";

const BATAS_HARI = 90;
const BATAS_BARIS = 100;
const BATAS_EKSPOR = 1000;
const BATAS_AGGREGAT = 5000;

interface BarisKunjunganRPC {
  status: "baru" | "sudah-tercatat";
  nama: string;
  nomor_anggota: string | null;
  tanggal: string;
  waktu_masuk: string;
}

function hariJakarta(offsetHari = 0): string {
  const d = new Date(Date.now() + offsetHari * 86_400_000);
  return d.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Jakarta",
  });
}

function tanggalISO(v: unknown, nama: string): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new GalatApi(`${nama} harus berformat YYYY-MM-DD.`);
  }

  return s;
}

function bersihkanQ(v: unknown): string {
  const s = typeof v === "string" ? v : "";

  return s
    .replace(/[,%()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// =====================================================================
// POST — check-in anggota dan pengunjung tamu
// =====================================================================

export async function POST(request: Request) {
  return jalankan(async () => {
    const origin = request.headers.get("origin");

    if (origin) {
      let sama = false;

      try {
        sama = new URL(origin).host === new URL(request.url).host;
      } catch {
        sama = false;
      }

      if (!sama) {
        throw new GalatApi("Permintaan ditolak (asal tidak dikenal).", 403);
      }
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!body) {
      throw new GalatApi("Data check-in tidak valid.");
    }

    const jenis =
      typeof body.jenisPengunjung === "string"
        ? body.jenisPengunjung
        : "anggota";

    const supabase = await createSupabaseServer();

    let data: unknown;
    let error: unknown;

    if (jenis === "anggota") {
      const nomor =
        typeof body.nomorAnggota === "string"
          ? body.nomorAnggota.trim()
          : "";

      if (!nomor) {
        throw new GalatApi("Nomor anggota wajib diisi.");
      }

      if (nomor.length > 30 || !/^[A-Za-z0-9 ./_-]+$/.test(nomor)) {
        throw new GalatApi("Format nomor anggota tidak valid.");
      }

      const hasil = await supabase.rpc("catat_kunjungan", {
        p_nomor: nomor,
      });

      data = hasil.data;
      error = hasil.error;
    } else if (jenis === "tamu") {
      const nama =
        typeof body.nama === "string" ? body.nama.trim() : "";

      if (nama.length < 2 || nama.length > 100) {
        throw new GalatApi(
          "Nama pengunjung harus berisi 2 sampai 100 karakter."
        );
      }

      const hasil = await supabase.rpc("catat_kunjungan_tamu", {
        p_nama: nama,
      });

      data = hasil.data;
      error = hasil.error;
    } else {
      throw new GalatApi("Jenis pengunjung tidak dikenal.");
    }

    if (error) {
      throw dariSupabase(error);
    }

    const r = data as BarisKunjunganRPC | null;

    if (!r || typeof r.nama !== "string") {
      throw new GalatApi(
        "Check-in gagal diproses. Silakan coba kembali.",
        500
      );
    }

    return json({
      kunjungan: {
        status: r.status,
        jenisPengunjung: jenis,
        nama: r.nama,
        nomorAnggota: r.nomor_anggota ?? null,
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

// =====================================================================
// GET — rekap kunjungan (khusus pihak berwenang)
// =====================================================================

/** Baris `kunjungan` hasil gabungan tamu & anggota (relasi anggota opsional). */
interface AnggotaKunjungan {
  nama?: string | null;
  nomor_anggota?: string | null;
  jenis?: string | null;
}

interface BarisKunjunganGabungan {
  id: string;
  anggota_id: string | null;
  jenis_pengunjung: string;
  nama_tamu: string | null;
  tanggal_kunjungan: string;
  waktu_masuk: string;
  anggota?: AnggotaKunjungan | AnggotaKunjungan[] | null;
}

export async function GET(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({
      wajibMasuk: true,
      wajibIzin: "laporan.lihat",
    });

    const url = new URL(request.url);

    const sampai =
      tanggalISO(url.searchParams.get("sampai"), "Tanggal sampai") ??
      hariJakarta();

    const dari =
      tanggalISO(url.searchParams.get("dari"), "Tanggal dari") ??
      hariJakarta(-13);

    if (dari > sampai) {
      throw new GalatApi(
        "Tanggal mulai harus sebelum tanggal sampai."
      );
    }

    const rentangHari =
      (Date.parse(sampai + "T00:00:00Z") -
        Date.parse(dari + "T00:00:00Z")) /
        86_400_000 +
      1;

    if (rentangHari > BATAS_HARI) {
      throw new GalatApi(
        `Rentang laporan maksimal ${BATAS_HARI} hari.`
      );
    }

    const q = bersihkanQ(url.searchParams.get("q"));

    const hal = Math.max(
      1,
      Number(url.searchParams.get("hal")) || 1
    );

    const per = Math.min(
      BATAS_BARIS,
      Math.max(1, Number(url.searchParams.get("per")) || 20)
    );

    const semua = url.searchParams.get("semua") === "true";

    const arahParam =
      url.searchParams.get("turon") ??
      url.searchParams.get("arah");

    const turun =
      arahParam !== "false" && arahParam !== "naik";

    const kolomUrut =
      url.searchParams.get("urut") === "tanggal"
        ? "tanggal_kunjungan"
        : "waktu_masuk";

    // Filter nama dan nomor anggota.
    // Nama tamu juga ikut dicari melalui nama_tamu.
    const ekspresiAnggota = q
      ? `nomor_anggota.ilike.*${q}*,nama.ilike.*${q}*`
      : null;

    let kueriBaris = k.supabase
      .from("kunjungan")
      .select(
        `
          id,
          anggota_id,
          jenis_pengunjung,
          nama_tamu,
          tanggal_kunjungan,
          waktu_masuk,
          anggota(nama, nomor_anggota, jenis)
        `,
        { count: "exact" }
      )
      .gte("tanggal_kunjungan", dari)
      .lte("tanggal_kunjungan", sampai);

    if (q) {
      kueriBaris = kueriBaris.or(
        `nama_tamu.ilike.*${q}*`
      );

      // Filter relasi anggota dilakukan terpisah agar hasil
      // anggota dan tamu sama-sama dapat ditemukan.
      // Untuk pencarian gabungan, gunakan dua kueri di bawah.
    }

    const mulai = semua ? 0 : (hal - 1) * per;
    const akhir = semua
      ? mulai + BATAS_EKSPOR - 1
      : mulai + per - 1;

    const [hasilSemua, hasilAnggota] = await Promise.all([
      kueriBaris
        .order(kolomUrut, { ascending: !turun })
        .order("waktu_masuk", { ascending: !turun })
        .range(mulai, akhir),

      q
        ? k.supabase
            .from("kunjungan")
            .select(
              `
                id,
                anggota_id,
                jenis_pengunjung,
                nama_tamu,
                tanggal_kunjungan,
                waktu_masuk,
                anggota!inner(nama, nomor_anggota, jenis)
              `,
              { count: "exact" }
            )
            .gte("tanggal_kunjungan", dari)
            .lte("tanggal_kunjungan", sampai)
            .or(ekspresiAnggota!, { foreignTable: "anggota" })
            .order(kolomUrut, { ascending: !turun })
            .order("waktu_masuk", { ascending: !turun })
            .range(0, BATAS_EKSPOR - 1)
        : Promise.resolve(null),
    ]);

    if (hasilSemua.error) {
      throw dariSupabase(hasilSemua.error);
    }

    if (hasilAnggota?.error) {
      throw dariSupabase(hasilAnggota.error);
    }

    // Gabungkan hasil tamu dan anggota berdasarkan ID.
    const gabungan = new Map<string, BarisKunjunganGabungan>();

    for (const b of hasilSemua.data ?? []) {
      if (b.jenis_pengunjung === "tamu") {
        gabungan.set(b.id, b);
      }
    }

    if (q && hasilAnggota?.data) {
      for (const b of hasilAnggota.data) {
        gabungan.set(b.id, b);
      }
    } else if (!q) {
      for (const b of hasilSemua.data ?? []) {
        gabungan.set(b.id, b);
      }
    }

    let baris = Array.from(gabungan.values());

    // Pencarian diterapkan lagi pada data hasil gabungan.
    if (q) {
      const kata = q.toLocaleLowerCase();

      baris = baris.filter((b) => {
        const anggota = Array.isArray(b.anggota)
          ? b.anggota[0]
          : b.anggota;

        return (
          String(b.nama_tamu ?? "")
            .toLocaleLowerCase()
            .includes(kata) ||
          String(anggota?.nama ?? "")
            .toLocaleLowerCase()
            .includes(kata) ||
          String(anggota?.nomor_anggota ?? "")
            .toLocaleLowerCase()
            .includes(kata)
        );
      });
    }

    baris.sort((a, b) => {
      const nilaiA =
        kolomUrut === "tanggal_kunjungan"
          ? `${a.tanggal_kunjungan} ${a.waktu_masuk}`
          : a.waktu_masuk;

      const nilaiB =
        kolomUrut === "tanggal_kunjungan"
          ? `${b.tanggal_kunjungan} ${b.waktu_masuk}`
          : b.waktu_masuk;

      return nilaiA < nilaiB
        ? turun
          ? 1
          : -1
        : nilaiA > nilaiB
          ? turun
            ? -1
            : 1
          : 0;
    });

    // Ambil seluruh data yang telah digabung untuk paginasi.
    const total = baris.length;
    const halamanTerakhir = Math.max(
      1,
      Math.ceil(total / per)
    );

    const dataHalaman = semua
      ? baris.slice(0, BATAS_EKSPOR)
      : baris.slice(mulai, mulai + per);

    // Agregat statistik.
    const kueriAgregat = k.supabase
      .from("kunjungan")
      .select(
        "tanggal_kunjungan, anggota_id, jenis_pengunjung, nama_tamu"
      )
      .gte("tanggal_kunjungan", dari)
      .lte("tanggal_kunjungan", sampai);

    const { data: agregat, error: errAgregat } =
      await kueriAgregat.limit(BATAS_AGGREGAT);

    if (errAgregat) {
      throw dariSupabase(errAgregat);
    }

    const { count: hariIni, error: errHari } =
      await k.supabase
        .from("kunjungan")
        .select("id", { count: "exact", head: true })
        .eq("tanggal_kunjungan", hariJakarta());

    if (errHari) {
      throw dariSupabase(errHari);
    }

    const perHari = new Map<string, number>();
    const unikAnggota = new Set<string>();
    const unikTamu = new Set<string>();

    for (const a of agregat ?? []) {
      perHari.set(
        a.tanggal_kunjungan,
        (perHari.get(a.tanggal_kunjungan) ?? 0) + 1
      );

      if (a.jenis_pengunjung === "anggota" && a.anggota_id) {
        unikAnggota.add(a.anggota_id);
      }

      if (a.jenis_pengunjung === "tamu" && a.nama_tamu) {
        unikTamu.add(
          a.nama_tamu.trim().toLocaleLowerCase("id-ID")
        );
      }
    }

    const ringkasan = Array.from(perHari.entries())
      .map(([tanggal, jumlah]) => ({ tanggal, jumlah }))
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

    return json({
      dari,
      sampai,
      q,
      hal,
      per,
      semua,
      urut: kolomUrut,
      turon: turun,
      total,
      halTerakhir: halamanTerakhir,
      pengunjungUnik:
        unikAnggota.size + unikTamu.size,
      hariIni: hariIni ?? 0,
      terpotong: (agregat ?? []).length >= BATAS_AGGREGAT,
      ringkasan,
      kunjungan: dataHalaman.map((b) => {
        const anggota = Array.isArray(b.anggota)
          ? b.anggota[0]
          : b.anggota;

        const tamu = b.jenis_pengunjung === "tamu";

        return {
          id: b.id,
          anggotaId: b.anggota_id,
          jenisPengunjung: b.jenis_pengunjung,
          nama: tamu
            ? b.nama_tamu
            : anggota?.nama ?? "-",
          nomorAnggota: tamu
            ? "-"
            : anggota?.nomor_anggota ?? "-",
          kategori: tamu
            ? "Tamu"
            : anggota?.jenis ?? "Anggota",
          tanggal: b.tanggal_kunjungan,
          waktuMasuk: b.waktu_masuk,
        };
      }),
    });
  });
}
