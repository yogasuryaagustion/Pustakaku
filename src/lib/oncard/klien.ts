// Klien OnCard — HANYA dipanggil dari server.
//
// Kunci API dibaca dari env (ONCARD_API_KEY) dan tidak pernah dikirim ke
// browser. Bentuk respons vendor belum final, jadi pembacaan halaman dibuat
// toleran (data/anggota/members, meta.has_more/next) dan dipusatkan di satu
// fungsi `bacaHalaman` agar mudah disesuaikan saat dokumentasi asli tersedia.

import { halamanMock } from "./mock";
import type { AnggotaOnCard, HalamanOnCard } from "./tipe";

/** Galat khusus integrasi, dipisahkan agar route bisa membalas 502. */
export class GalatOnCard extends Error {
  status: number;
  constructor(pesan: string, status = 502) {
    super(pesan);
    this.name = "GalatOnCard";
    this.status = status;
  }
}

export interface KonfigurasiOnCard {
  /** Tanpa garis miring di ujung. */
  baseUrl: string;
  kunci: string | null;
  /** true bila memakai data contoh di memori (tanpa jaringan). */
  mock: boolean;
  /** Jumlah baris per halaman. */
  batasHalaman: number;
  /** Pengaman agar satu permintaan tidak menarik data tanpa henti. */
  maksHalaman: number;
  timeoutMs: number;
}

export function konfigurasiOnCard(): KonfigurasiOnCard {
  return {
    baseUrl: (process.env.ONCARD_BASE_URL ?? "").trim().replace(/\/+$/, ""),
    kunci: (process.env.ONCARD_API_KEY ?? "").trim() || null,
    mock: process.env.ONCARD_MOCK === "1",
    batasHalaman: 100,
    maksHalaman: 20,
    timeoutMs: 8000,
  };
}

function teks(nilai: unknown): string {
  return typeof nilai === "string" ? nilai.trim() : "";
}

function angka(nilai: unknown): number | null {
  const n = typeof nilai === "number" ? nilai : Number(nilai);
  return Number.isFinite(n) ? n : null;
}

/** Satu baris vendor → AnggotaOnCard, dengan nama field alternatif. */
function keAnggotaOnCard(mentah: Record<string, unknown>): AnggotaOnCard | null {
  const id = teks(mentah.id) || teks(mentah.oncard_id);
  const nama = teks(mentah.nama) || teks(mentah.name);
  if (!id || !nama) return null;

  return {
    id,
    nis: teks(mentah.nis) || teks(mentah.nomor_induk) || teks(mentah.nomorInduk),
    nama,
    email: teks(mentah.email) || null,
    telepon: teks(mentah.telepon) || teks(mentah.phone) || null,
    alamat: teks(mentah.alamat) || teks(mentah.address) || null,
    kelas: teks(mentah.kelas) || teks(mentah.rombel) || null,
    jenis: teks(mentah.jenis) || teks(mentah.peran) || null,
    foto: teks(mentah.foto) || teks(mentah.foto_url) || null,
    uidKartu: teks(mentah.uid_kartu) || teks(mentah.uidKartu) || teks(mentah.card_uid) || null,
    // Vendor yang tidak punya flag aktif dianggap aktif; status nonaktif harus
    // dikirim eksplisit agar alumni tidak otomatis dicabut kartunya.
    aktif: mentah.aktif !== false && mentah.aktif !== "false" && mentah.aktif !== 0,
    diperbaruiPada: teks(mentah.diperbarui_pada) || teks(mentah.updated_at) || null,
  };
}

/** Bentuk respons yang diterima: array polos atau dibungkus data/anggota/members. */
function bacaHalaman(json: unknown): HalamanOnCard {
  const bungkus = (json ?? {}) as Record<string, unknown>;
  const kandidat = Array.isArray(json)
    ? json
    : Array.isArray(bungkus.data)
      ? bungkus.data
      : Array.isArray(bungkus.anggota)
        ? bungkus.anggota
        : Array.isArray(bungkus.members)
          ? bungkus.members
          : [];

  const anggota = kandidat
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === "object")
    .map(keAnggotaOnCard)
    .filter((b): b is AnggotaOnCard => b !== null);

  const meta = (bungkus.meta ?? {}) as Record<string, unknown>;
  const adaLagiEksplisit =
    meta.has_more === true || meta.hasMore === true || meta.next !== undefined && meta.next !== null;

  return {
    anggota,
    // Tanpa flag eksplisit, satu halaman penuh dianggap mungkin berlanjut.
    adaLagi: adaLagiEksplisit || anggota.length > 0,
    total: angka(meta.total) ?? undefined,
  };
}

function jeda(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

/** GET JSON dengan timeout + retry untuk 429/5xx/galat jaringan saja. */
async function mintaJson(url: string, kunci: string | null, timeoutMs: number): Promise<unknown> {
  const percobaanMaks = 3;
  let galatTerakhir: Error = new GalatOnCard("Gagal menghubungi OnCard.");

  for (let percobaan = 1; percobaan <= percobaanMaks; percobaan++) {
    const pembatal = new AbortController();
    const jam = setTimeout(() => pembatal.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(kunci ? { Authorization: `Bearer ${kunci}` } : {}),
        },
        signal: pembatal.signal,
        cache: "no-store",
      });

      if (res.ok) return (await res.json()) as unknown;

      // 4xx (selain 429) berarti kontrak/kunci salah — mengulang tidak menolong.
      if (res.status !== 429 && res.status < 500) {
        throw new GalatOnCard(
          `OnCard menolak permintaan (${res.status}). Periksa ONCARD_API_KEY dan izin aplikasi.`,
          res.status,
        );
      }
      galatTerakhir = new GalatOnCard(`OnCard membalas ${res.status}.`, 502);
    } catch (e) {
      // GalatOnCard dari cabang di atas tidak perlu diulang.
      if (e instanceof GalatOnCard && e.status < 500 && e.status !== 429) throw e;
      galatTerakhir =
        e instanceof Error ? e : new GalatOnCard("Galat jaringan tidak dikenal.");
    } finally {
      clearTimeout(jam);
    }

    if (percobaan < percobaanMaks) await jeda(250 * 2 ** (percobaan - 1));
  }

  throw galatTerakhir;
}

export interface HasilTarikan {
  anggota: AnggotaOnCard[];
  sumber: "oncard" | "mock";
  halaman: number;
  catatan: string[];
}

/**
 * Tarik seluruh anggota (atau hanya yang berubah sejak `updatedSince`)
 * halaman demi halaman, dengan batas jumlah halaman.
 */
export async function tarikAnggotaOnCard(
  konf: KonfigurasiOnCard,
  opsi: { updatedSince?: string; maksHalaman?: number } = {},
): Promise<HasilTarikan> {
  const batasHalaman = Math.min(opsi.maksHalaman ?? konf.maksHalaman, konf.maksHalaman);
  const catatan: string[] = [];

  if (konf.mock) {
    const kumpulan: AnggotaOnCard[] = [];
    let halaman = 0;
    for (let page = 1; page <= batasHalaman; page++) {
      const h = halamanMock(page, konf.batasHalaman);
      kumpulan.push(...h.anggota);
      halaman = page;
      if (!h.adaLagi) break;
    }
    catatan.push(
      "Mode mock aktif (ONCARD_MOCK=1): data berasal dari src/lib/oncard/mock.ts, bukan dari vendor.",
    );
    return { anggota: kumpulan, sumber: "mock", halaman, catatan };
  }

  if (!konf.baseUrl) {
    throw new GalatOnCard(
      "Integrasi OnCard belum dikonfigurasi: isi ONCARD_BASE_URL dan ONCARD_API_KEY, " +
        "atau setel ONCARD_MOCK=1 untuk mencoba dengan data contoh.",
      503,
    );
  }

  const kumpulan: AnggotaOnCard[] = [];
  let halaman = 0;

  for (let page = 1; page <= batasHalaman; page++) {
    const url = new URL(`${konf.baseUrl}/v1/members`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(konf.batasHalaman));
    if (opsi.updatedSince) url.searchParams.set("updated_since", opsi.updatedSince);

    const hasil = bacaHalaman(await mintaJson(url.toString(), konf.kunci, konf.timeoutMs));
    kumpulan.push(...hasil.anggota);
    halaman = page;

    if (!hasil.adaLagi || hasil.anggota.length < konf.batasHalaman) break;
    if (page === batasHalaman) {
      catatan.push(
        `Berhenti di batas ${batasHalaman} halaman — jalankan ulang dengan updated_since untuk sisanya.`,
      );
    }
  }

  return { anggota: kumpulan, sumber: "oncard", halaman, catatan };
}
