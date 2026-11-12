// Sinkronisasi anggota dari OnCard — TAHAP PRATINJAU (belum menulis apa pun).
//
// Route ini hanya MEMBACA: data OnCard (atau data contoh saat ONCARD_MOCK=1)
// dan daftar anggota lokal. Hasilnya rencana perubahan per baris, bukan mutasi.
// Penulisan sengaja ditunda sampai tabel pemetaan `anggota_oncard` ada, karena
// email saja bukan kunci yang aman: pelajar tanpa email tidak akan pernah
// cocok, dan email yang kebetulan sama dengan akun petugas bisa salah sambung.
//
// Gerbang akses: Super Admin. Izin khusus `integrasi.kelola` baru bisa dipakai
// setelah migrasi Fase 1 menambahkannya ke matriks kebijakan_akses.

import {
  GalatApi,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import {
  GalatOnCard,
  konfigurasiOnCard,
  tarikAnggotaOnCard,
} from "@/lib/oncard/klien";
import {
  bandingkan,
  keCalonAnggota,
  normalisasiEmail,
  normalisasiTeks,
} from "@/lib/oncard/peta";
import type { AnggotaOnCard, BarisPratinjau, RingkasanSinkron, StatusSinkron } from "@/lib/oncard/tipe";
import type { Anggota } from "@/lib/types";

/** Batas baris pada respons: pratinjau harus ringan dibuka dari browser. */
const BATAS_BARIS = 200;

/** Urutan tampil: yang butuh keputusan petugas lebih dulu. */
const URUTAN: Record<StatusSinkron, number> = {
  baru: 0,
  bentrok: 1,
  gagal: 2,
  diperbarui: 3,
  sama: 4,
};

interface BarisAnggotaLokal {
  id: string;
  nomor_anggota: string;
  nama: string;
  email: string;
  telepon: string;
  alamat: string;
  jenis: string;
  aktif: boolean;
  foto: string | null;
}

function keAnggota(b: BarisAnggotaLokal): Anggota {
  return {
    id: b.id,
    nomorAnggota: b.nomor_anggota,
    nama: b.nama,
    email: b.email,
    telepon: b.telepon,
    alamat: b.alamat,
    jenis: b.jenis as Anggota["jenis"],
    bergabungPada: "",
    aktif: b.aktif,
    foto: b.foto,
  };
}

/** GET — status konfigurasi saja; tidak memanggil OnCard. */
export async function GET() {
  return jalankan(async () => {
    await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });
    const konf = konfigurasiOnCard();

    return json({
      integrasi: {
        mock: konf.mock,
        siap: konf.mock || Boolean(konf.baseUrl && konf.kunci),
        baseUrl: konf.baseUrl || null,
        punyaKunci: Boolean(konf.kunci),
        batasHalaman: konf.batasHalaman,
        maksHalaman: konf.maksHalaman,
        // Penulisan masih ditutup di semua kondisi pada tahap ini.
        bolehMenulis: false,
      },
    });
  });
}

/** POST — ambil data OnCard lalu bandingkan dengan anggota lokal (pratinjau). */
export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibSuperAdmin: true });
    const konf = konfigurasiOnCard();

    const isi = (await request.json().catch(() => ({}))) as {
      maksHalaman?: unknown;
      updatedSince?: unknown;
    };

    const diminta = Number(isi.maksHalaman);
    const maksHalaman = Number.isFinite(diminta) && diminta > 0
      ? Math.min(Math.trunc(diminta), konf.maksHalaman)
      : undefined;
    const updatedSince =
      typeof isi.updatedSince === "string" && isi.updatedSince.trim()
        ? isi.updatedSince.trim()
        : undefined;

    const { data, error } = await k.supabase
      .from("anggota")
      .select("id, nomor_anggota, nama, email, telepon, alamat, jenis, aktif, foto");
    if (error) throw dariSupabase(error);
    const lokal = (data ?? []) as BarisAnggotaLokal[];

    // Pencocokan sementara HANYA lewat email; tabel anggota_oncard nanti
    // menambahkan kunci NIS/UID yang lebih kuat.
    const indeksEmail = new Map<string, BarisAnggotaLokal>();
    for (const b of lokal) {
      const email = normalisasiEmail(b.email);
      if (email && !indeksEmail.has(email)) indeksEmail.set(email, b);
    }

    let tarikan;
    try {
      tarikan = await tarikAnggotaOnCard(konf, { maksHalaman, updatedSince });
    } catch (e) {
      if (e instanceof GalatOnCard) throw new GalatApi(e.message, e.status);
      throw e;
    }

    // NIS ganda di sisi OnCard: dua kartu untuk satu nomor induk. Tidak boleh
    // dipilih otomatis — petugas yang memutuskan kartu mana yang berlaku.
    const hitungNis = new Map<string, number>();
    for (const a of tarikan.anggota) {
      const nis = normalisasiTeks(a.nis);
      if (nis) hitungNis.set(nis, (hitungNis.get(nis) ?? 0) + 1);
    }

    const ringkasan: Record<StatusSinkron, number> = {
      baru: 0,
      diperbarui: 0,
      sama: 0,
      bentrok: 0,
      gagal: 0,
    };
    const baris: BarisPratinjau[] = [];
    const catatan = [...tarikan.catatan];

    const periksa = (a: AnggotaOnCard): void => {
      const calon = keCalonAnggota(a);
      const nis = normalisasiTeks(a.nis);
      const email = normalisasiEmail(a.email);

      const tambah = (
        status: StatusSinkron,
        alasan?: string,
        cocok?: BarisAnggotaLokal,
        ubah?: string[],
      ): void => {
        ringkasan[status] += 1;
        baris.push({
          oncardId: a.id,
          nis,
          nama: calon.nama || normalisasiTeks(a.nama),
          status,
          anggotaId: cocok?.id ?? null,
          nomorAnggota: cocok?.nomor_anggota ?? null,
          ubah,
          alasan,
        });
      };

      if (!normalisasiTeks(a.id)) {
        tambah("gagal", "ID OnCard kosong; pemetaan tidak punya kunci.");
        return;
      }
      if (calon.nama.length < 3) {
        tambah("gagal", "Nama kurang dari 3 karakter — ditolak skema anggota.");
        return;
      }
      if (!nis) {
        tambah("gagal", "NIS kosong; NIS akan dipakai sebagai kunci pencocokan.");
        return;
      }
      if ((hitungNis.get(nis) ?? 0) > 1) {
        tambah("bentrok", `NIS ${nis} muncul lebih dari sekali di data OnCard.`);
        return;
      }
      if (!email) {
        tambah(
          "bentrok",
          "Email kosong — pencocokan menunggu tabel anggota_oncard (NIS/UID kartu).",
        );
        return;
      }

      const cocok = indeksEmail.get(email);
      if (!cocok) {
        tambah("baru");
        return;
      }

      const ubah = bandingkan(keAnggota(cocok), a);
      if (ubah.length === 0) {
        tambah("sama", undefined, cocok);
        return;
      }
      tambah("diperbarui", undefined, cocok, ubah);
    };

    for (const a of tarikan.anggota) periksa(a);

    baris.sort(
      (x, y) => URUTAN[x.status] - URUTAN[y.status] || x.nama.localeCompare(y.nama),
    );

    const terpotong = baris.length > BATAS_BARIS;
    if (terpotong) {
      catatan.push(
        `Respons dipotong ke ${BATAS_BARIS} baris pertama dari total ${baris.length}.`,
      );
    }
    if (konf.mock) {
      catatan.push("Tidak ada penulisan: pratinjau ini hanya menghitung rencana perubahan.");
    }

    const hasil: RingkasanSinkron = {
      pratinjau: true,
      sumber: tarikan.sumber,
      diambilPada: new Date().toISOString(),
      total: tarikan.anggota.length,
      terpotong,
      ringkasan,
      baris: baris.slice(0, BATAS_BARIS),
      catatan,
    };

    return json(hasil);
  });
}
