"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import type { AjuanKembali, Anggota, Buku, Peminjaman } from "./types";
import { DENDA_PER_HARI } from "./types";
import { apiFetch } from "./api";
import { useToast } from "@/components/toast";

export type Hasil = { ok: boolean; pesan: string };

export type KunciData = "buku" | "anggota" | "peminjaman";

/** Kondisi fisik yang boleh dicatat petugas saat menerima pengembalian. */
export type KondisiKembali = "layak" | "rusak_ringan" | "rusak_beda" | "hilang";

/** Ringkasan efek tiap kondisi pengembalian, dipakai untuk pesan ke petugas. */
export const PESAN_KONDISI_KEMBALI: Record<KondisiKembali, string> = {
  layak: "buku kembali ke rak dan bisa dipinjam lagi",
  rusak_ringan: "salinan ditandai rusak ringan dan tidak ditawarkan lagi",
  rusak_beda: "salinan ditandai rusak berbeda dan tidak ditawarkan lagi",
  hilang: "salinan ditandai hilang; stok menyusut saat Perbaiki Selisih dijalankan",
};

const SEMUA_KUNCI: KunciData[] = ["buku", "anggota", "peminjaman"];

// Halaman yang tidak perlu memuat semua data perpustakaan secara otomatis.
// Landing page akan meminta data buku secara khusus melalui muatKatalogPublik.
const RUTE_TANPA_DATA = ["/", "/login", "/register"];

interface Snapshot {
  buku: Buku[];
  anggota: Anggota[];
  peminjaman: Peminjaman[];
  pengembalian: AjuanKembali[];
  dipinjam: Record<string, number>;
  tersedia: Record<string, number>;
  siap: boolean;
  galat: string | null;
}

const SNAPSHOT_SERVER: Snapshot = {
  buku: [],
  anggota: [],
  peminjaman: [],
  pengembalian: [],
  dipinjam: {},
  tersedia: {},
  siap: false,
  galat: null,
};

let snapshot: Snapshot = SNAPSHOT_SERVER;

const pendengar = new Set<() => void>();
const dataTersedia = new Set<KunciData>();
const dataSedangDimuat = new Map<KunciData, Promise<void>>();

function beritahu() {
  pendengar.forEach((fn) => fn());
}

// Pesan dari fungsi database kadang berulang atau terlalu teknis, mis.
// "Anggota Anggota Demo tidak aktif." karena nama anggota sudah mengandung
// kata "Anggota". Di sini pesan dikenal itu ditulis ulang menjadi kalimat
// yang wajar; pesan lain dibiarkan apa adanya.
function pesanRamah(pesan: string): string {
  const tidakAktif = pesan.match(/^Anggota (.+) tidak aktif\.$/i);
  if (tidakAktif) {
    return `Kartu ${tidakAktif[1]} sedang tidak aktif, jadi peminjaman belum bisa diproses. Hubungi petugas untuk mengaktifkannya kembali.`;
  }

  const kartuTidakAktif = pesan.match(
    /^Kartu anggota (.+) berstatus tidak aktif\./i,
  );
  if (kartuTidakAktif) {
    return `Kartu ${kartuTidakAktif[1]} berstatus tidak aktif. Hubungi petugas untuk mengaktifkannya kembali.`;
  }

  return pesan;
}

function pesanApi(e: unknown): string {
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as Error).message === "string"
  ) {
    return pesanRamah((e as Error).message);
  }

  return "Tidak bisa terhubung ke server. Periksa koneksi Anda.";
}

function perbaruiStatusSiap() {
  snapshot = {
    ...snapshot,
    siap: SEMUA_KUNCI.every((key) => dataTersedia.has(key)),
  };
}

/**
 * Memuat satu entitas dari API.
 * Request yang sedang berjalan digunakan kembali untuk mencegah fetch ganda.
 */
async function muatSatuData(
  kunci: KunciData,
  /** Abaikan cache — dipakai penyegaran latar tanpa memunculkan status memuat. */
  paksa = false,
): Promise<void> {
  if (!paksa && dataTersedia.has(kunci)) return;

  const requestBerjalan = dataSedangDimuat.get(kunci);
  if (requestBerjalan) return requestBerjalan;

  const request = (async () => {
    try {
      if (kunci === "buku") {
        const res = await apiFetch<{
          buku: Buku[];
          dipinjam?: Record<string, number>;
          tersedia?: Record<string, number>;
        }>("/api/buku");

        if (!Array.isArray(res.buku)) {
          throw new Error("Format data buku dari server tidak valid.");
        }

        snapshot = {
          ...snapshot,
          buku: res.buku,
          dipinjam: res.dipinjam ?? snapshot.dipinjam,
          tersedia: res.tersedia ?? snapshot.tersedia,
          galat: null,
        };
      } else if (kunci === "anggota") {
        const res = await apiFetch<{ anggota: Anggota[] }>("/api/anggota");

        if (!Array.isArray(res.anggota)) {
          throw new Error("Format data anggota dari server tidak valid.");
        }

        snapshot = {
          ...snapshot,
          anggota: res.anggota,
          galat: null,
        };
      } else if (kunci === "peminjaman") {
        // Pengajuan pengembalian dimuat bersama pinjaman: satu kali muat untuk
        // panel anggota (mengajukan) dan /sirkulasi (memvalidasi).
        const [res, resAjuan] = await Promise.all([
          apiFetch<{ peminjaman: Peminjaman[] }>("/api/peminjaman"),
          apiFetch<{ pengembalian: AjuanKembali[] }>("/api/pengembalian"),
        ]);

        if (!Array.isArray(res.peminjaman)) {
          throw new Error("Format data peminjaman dari server tidak valid.");
        }

        snapshot = {
          ...snapshot,
          peminjaman: res.peminjaman,
          pengembalian: Array.isArray(resAjuan.pengembalian)
            ? resAjuan.pengembalian
            : snapshot.pengembalian,
          galat: null,
        };
      }

      dataTersedia.add(kunci);
    } catch (e) {
      snapshot = {
        ...snapshot,
        galat: pesanApi(e),
      };
    } finally {
      dataSedangDimuat.delete(kunci);
      perbaruiStatusSiap();
      beritahu();
    }
  })();

  dataSedangDimuat.set(kunci, request);
  return request;
}

async function muatData(kunci: KunciData[] = SEMUA_KUNCI): Promise<void> {
  await Promise.all(kunci.map((key) => muatSatuData(key)));
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);
  void muatData();

  return () => {
    pendengar.delete(kembali);
  };
}

function langgananDiam(kembali: () => void): () => void {
  pendengar.add(kembali);

  return () => {
    pendengar.delete(kembali);
  };
}

function ambilSnapshot(): Snapshot {
  return snapshot;
}

/**
 * Memuat ulang satu atau beberapa entitas.
 * Status siap dipertahankan jika sebelumnya semua data sudah tersedia.
 */
function muatUlang(kunci?: KunciData[]) {
  const target = kunci ?? SEMUA_KUNCI;

  target.forEach((key) => {
    dataTersedia.delete(key);
  });

  perbaruiStatusSiap();
  beritahu();

  void muatData(target);
}

/**
 * Segarkan data di latar belakang tanpa mengosongkan cache lebih dulu.
 * Status `siap` tetap true, jadi daftar tidak berkedip ke layar memuat saat
 * pengguna berpindah halaman.
 */
function segarkanData(kunci: KunciData[]) {
  void Promise.all(kunci.map((key) => muatSatuData(key, true)));
}

/** Khusus katalog publik di landing page. */
async function muatKatalogPublik(): Promise<void> {
  await muatSatuData("buku");
}

async function jalankan<T>(
  fn: () => Promise<T>,
  pesanSukses: string,
  kunci?: KunciData[],
): Promise<Hasil & { data?: T }> {
  try {
    const data = await fn();
    muatUlang(kunci);

    return {
      ok: true,
      pesan: pesanSukses,
      data,
    };
  } catch (e) {
    return {
      ok: false,
      pesan: pesanApi(e),
    };
  }
}

// ---- Perhitungan -----------------------------------------------------------

export function hitungDenda(
  tanggalKembaliTarget: string,
  aktual: string,
  perHari: number = DENDA_PER_HARI,
): number {
  const target = new Date(tanggalKembaliTarget).getTime();
  const real = new Date(aktual).getTime();

  const telatHari = Math.floor((real - target) / (1000 * 60 * 60 * 24));

  if (telatHari <= 0) return 0;

  return telatHari * perHari;
}

export function hariTerlambat(tanggalKembaliTarget: string): number {
  const target = new Date(tanggalKembaliTarget).getTime();

  const telatHari = Math.floor((Date.now() - target) / (1000 * 60 * 60 * 24));

  return telatHari > 0 ? telatHari : 0;
}

// ---- Konteks React ---------------------------------------------------------

interface LibraryState {
  buku: Buku[];
  anggota: Anggota[];
  peminjaman: Peminjaman[];
  pengembalian: AjuanKembali[];
  dipinjam: Record<string, number>;
  tersedia: Record<string, number>;
  siap: boolean;
  galat: string | null;

  muatUlang: (kunci?: KunciData[]) => void;
  muatKatalogPublik: () => Promise<void>;

  tambahBuku: (b: Omit<Buku, "id" | "ditambahkanPada">) => Promise<Hasil>;

  ubahBuku: (id: string, patch: Partial<Buku>) => Promise<Hasil>;

  hapusBuku: (id: string) => Promise<Hasil>;

  tambahAnggota: (
    a: Omit<Anggota, "id" | "nomorAnggota" | "bergabungPada">,
  ) => Promise<Hasil & { anggota?: Anggota }>;

  ubahAnggota: (id: string, patch: Partial<Anggota>) => Promise<Hasil>;

  hapusAnggota: (id: string) => Promise<Hasil>;

  pinjamBuku: (
    bukuId: string,
    anggotaId: string,
    tanggalPinjam?: string,
    /** Lama pinjam khusus transaksi ini; kosong = standar dari Pengaturan. */
    lamaHari?: number,
  ) => Promise<Hasil>;

  kembalikanBuku: (
    peminjamanId: string,
    /** Kondisi salinan saat diterima; kosong = kondisi lama dipertahankan. */
    kondisi?: KondisiKembali,
    /** Salinan yang diterima; menautkan pinjaman lama yang belum punya eksemplar. */
    eksemplarId?: string,
  ) => Promise<Hasil>;

  /** Anggota mengajukan pengembalian; menunggu validasi petugas. */
  ajukanKembali: (peminjamanId: string, catatan?: string) => Promise<Hasil>;

  /** Petugas memvalidasi kondisi buku lalu menutup pinjaman. */
  verifikasiKembali: (
    peminjamanId: string,
    kondisi: KondisiKembali,
  ) => Promise<Hasil>;

  /** Petugas menolak pengajuan; pinjaman tetap aktif. */
  tolakKembali: (peminjamanId: string, alasan?: string) => Promise<Hasil>;

  perpanjangPinjam: (
    peminjamanId: string,
    tambahHari?: number,
  ) => Promise<Hasil>;

  /** Petugas menerima pembayaran denda penuh (pelunasan sisa sekaligus). */
  lunasiDenda: (peminjamanId: string) => Promise<Hasil>;

  /** Petugas menerima pembayaran denda sebagian (cicilan). */
  bayarDenda: (
    peminjamanId: string,
    nominal: number,
    catatan?: string,
  ) => Promise<Hasil>;
}

const LibraryContext = createContext<LibraryState | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const langgananRute = RUTE_TANPA_DATA.includes(pathname)
    ? langgananDiam
    : langganan;

  const s = useSyncExternalStore(
    langgananRute,
    ambilSnapshot,
    () => SNAPSHOT_SERVER,
  );

  const toast = useToast();
  const terlihat = useRef<string | null>(null);

  // Data pinjaman bisa berubah dari luar panel (petugas, anggota lain). Karena
  // provider hidup di seluruh aplikasi, cache sempat basi; segarkan tiap kali
  // pengguna berpindah halaman di dalam panel.
  const rutePanelSebelumnya = useRef(pathname);
  useEffect(() => {
    if (rutePanelSebelumnya.current === pathname) return;
    rutePanelSebelumnya.current = pathname;

    if (pathname.startsWith("/panel")) segarkanData(["peminjaman"]);
  }, [pathname]);

  useEffect(() => {
    if (s.galat && terlihat.current !== s.galat) {
      terlihat.current = s.galat;
      toast.gagal(s.galat);
    }

    if (!s.galat) {
      terlihat.current = null;
    }
  }, [s.galat, toast]);

  const tambahBuku = useCallback(
    (b: Omit<Buku, "id" | "ditambahkanPada">) =>
      jalankan(
        () =>
          apiFetch<{ buku: Buku }>("/api/buku", {
            method: "POST",
            body: b,
          }),
        `Buku "${b.judul}" ditambahkan.`,
        ["buku"],
      ),
    [],
  );

  const ubahBuku = useCallback(
    (id: string, patch: Partial<Buku>) =>
      jalankan(
        () =>
          apiFetch<{ buku: Buku }>(`/api/buku/${id}`, {
            method: "PUT",
            body: patch,
          }),
        "Buku diperbarui.",
        ["buku"],
      ),
    [],
  );

  const hapusBuku = useCallback(
    (id: string) =>
      jalankan(
        () =>
          apiFetch(`/api/buku/${id}`, {
            method: "DELETE",
          }),
        "Buku dihapus.",
        ["buku"],
      ),
    [],
  );

  const tambahAnggota = useCallback(
    async (
      a: Omit<Anggota, "id" | "nomorAnggota" | "bergabungPada">,
    ): Promise<Hasil & { anggota?: Anggota }> => {
      try {
        const r = await apiFetch<{ anggota: Anggota }>("/api/anggota", {
          method: "POST",
          body: a,
        });

        muatUlang(["anggota"]);

        return {
          ok: true,
          pesan: `Anggota "${a.nama}" ditambahkan.`,
          anggota: r.anggota,
        };
      } catch (e) {
        return {
          ok: false,
          pesan: pesanApi(e),
        };
      }
    },
    [],
  );

  const ubahAnggota = useCallback(
    (id: string, patch: Partial<Anggota>) =>
      jalankan(
        () =>
          apiFetch<{ anggota: Anggota }>(`/api/anggota/${id}`, {
            method: "PUT",
            body: patch,
          }),
        "Data anggota diperbarui.",
        ["anggota"],
      ),
    [],
  );

  const hapusAnggota = useCallback(
    (id: string) =>
      jalankan(
        () =>
          apiFetch(`/api/anggota/${id}`, {
            method: "DELETE",
          }),
        "Anggota dihapus.",
        ["anggota"],
      ),
    [],
  );

  const pinjamBuku = useCallback(
    (
      bukuId: string,
      anggotaId: string,
      tanggalPinjam?: string,
      lamaHari?: number,
    ) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>("/api/peminjaman", {
            method: "POST",
            body: {
              bukuId,
              anggotaId,
              tanggalPinjam,
              lamaHari,
            },
          }),
        "Peminjaman dicatat.",
        ["buku", "peminjaman"],
      ),
    [],
  );

  const kembalikanBuku = useCallback(
    (peminjamanId: string, kondisi?: KondisiKembali, eksemplarId?: string) => {
      const body: Record<string, string> = {};
      if (kondisi) body.kondisi_fisik = kondisi;
      if (eksemplarId) body.eksemplar_id = eksemplarId;

      return jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(
            `/api/peminjaman/${peminjamanId}/kembali`,
            {
              method: "POST",
              body: Object.keys(body).length > 0 ? body : undefined,
            },
          ),
        "Pengembalian dicatat.",
        ["buku", "peminjaman"],
      );
    },
    [],
  );

  const ajukanKembali = useCallback(
    (peminjamanId: string, catatan?: string) =>
      jalankan(
        () =>
          apiFetch<{ pengajuan: unknown }>(
            `/api/peminjaman/${peminjamanId}/ajukan-kembali`,
            {
              method: "POST",
              body: catatan ? { catatan } : undefined,
            },
          ),
        "Pengembalian diajukan. Serahkan buku ke petugas untuk diperiksa.",
        ["peminjaman"],
      ),
    [],
  );

  const verifikasiKembali = useCallback(
    (peminjamanId: string, kondisi: KondisiKembali) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(
            `/api/peminjaman/${peminjamanId}/verifikasi-kembali`,
            {
              method: "POST",
              body: { kondisi_fisik: kondisi },
            },
          ),
        `Pengembalian divalidasi: ${PESAN_KONDISI_KEMBALI[kondisi]}.`,
        ["buku", "peminjaman"],
      ),
    [],
  );

  const tolakKembali = useCallback(
    (peminjamanId: string, alasan?: string) =>
      jalankan(
        () =>
          apiFetch<{ ok: boolean }>(
            `/api/peminjaman/${peminjamanId}/tolak-kembali`,
            {
              method: "POST",
              body: alasan ? { alasan } : undefined,
            },
          ),
        "Pengajuan pengembalian ditolak. Pinjaman tetap aktif.",
        ["peminjaman"],
      ),
    [],
  );

  const lunasiDenda = useCallback(
    (peminjamanId: string) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(
            `/api/peminjaman/${peminjamanId}/lunasi-denda`,
            { method: "POST" },
          ),
        "Denda dilunasi.",
        ["peminjaman"],
      ),
    [],
  );

  const bayarDenda = useCallback(
    (peminjamanId: string, nominal: number, catatan?: string) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(
            `/api/peminjaman/${peminjamanId}/bayar-denda`,
            {
              method: "POST",
              body: { nominal, catatan: catatan ?? null },
            },
          ),
        "Pembayaran denda dicatat.",
        ["peminjaman"],
      ),
    [],
  );

  const perpanjangPinjam = useCallback(
    (peminjamanId: string, tambahHari?: number) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(
            `/api/peminjaman/${peminjamanId}/perpanjang`,
            {
              method: "POST",
              body: {
                hari: tambahHari ?? null,
              },
            },
          ),
        "Pinjaman diperpanjang.",
        ["peminjaman"],
      ),
    [],
  );

  const muatKatalogPublik = useCallback(() => muatSatuData("buku"), []);

  const value = useMemo<LibraryState>(
    () => ({
      buku: s.buku,
      anggota: s.anggota,
      peminjaman: s.peminjaman,
      pengembalian: s.pengembalian,
      dipinjam: s.dipinjam,
      tersedia: s.tersedia,
      siap: s.siap,
      galat: s.galat,

      muatUlang,
      muatKatalogPublik,

      tambahBuku,
      ubahBuku,
      hapusBuku,

      tambahAnggota,
      ubahAnggota,
      hapusAnggota,

      pinjamBuku,
      kembalikanBuku,
      ajukanKembali,
      verifikasiKembali,
      tolakKembali,
      perpanjangPinjam,
      lunasiDenda,
      bayarDenda,
    }),
    [
      s,
      muatKatalogPublik,
      tambahBuku,
      ubahBuku,
      hapusBuku,
      tambahAnggota,
      ubahAnggota,
      hapusAnggota,
      pinjamBuku,
      kembalikanBuku,
      ajukanKembali,
      verifikasiKembali,
      tolakKembali,
      perpanjangPinjam,
      lunasiDenda,
      bayarDenda,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryState {
  const ctx = useContext(LibraryContext);

  if (!ctx) {
    throw new Error("useLibrary harus dipakai di dalam LibraryProvider");
  }

  return ctx;
}

// ---- Helper ----------------------------------------------------------------

export function useHelper() {
  const { buku, anggota, peminjaman, pengembalian, dipinjam, tersedia } =
    useLibrary();

  const cariBuku = useCallback(
    (id: string) => buku.find((b) => b.id === id),
    [buku],
  );

  const cariAnggota = useCallback(
    (id: string) => anggota.find((a) => a.id === id),
    [anggota],
  );

  const jumlahDipinjam = useCallback(
    (bukuId: string) =>
      dipinjam[bukuId] ??
      peminjaman.filter((p) => p.bukuId === bukuId && p.status === "Dipinjam")
        .length,
    [dipinjam, peminjaman],
  );

  // Ketersediaan mengikuti aturan server (pinjam_buku): hitung salinan yang
  // berstatus tersedia dan bukan hilang. Salinan rusak/hilang tidak boleh
  // ditawarkan. Untuk judul lama tanpa data salinan, pakai `stok - dipinjam`.
  const stokTersedia = useCallback(
    (bukuId: string) => {
      const item = buku.find((b) => b.id === bukuId);

      if (!item) return 0;

      const dariSalinan = tersedia[bukuId];

      if (typeof dariSalinan === "number") {
        return Math.max(0, dariSalinan);
      }

      return Math.max(0, item.stok - jumlahDipinjam(bukuId));
    },
    [buku, tersedia, jumlahDipinjam],
  );

  const pinjamanAnggota = useCallback(
    (anggotaId: string) => peminjaman.filter((p) => p.anggotaId === anggotaId),
    [peminjaman],
  );

  /** Pengajuan pengembalian yang masih menunggu validasi petugas. */
  const ajuanMenunggu = useCallback(
    (peminjamanId: string) =>
      pengembalian.find(
        (a) => a.peminjamanId === peminjamanId && a.status === "menunggu",
      ) ?? null,
    [pengembalian],
  );

  return {
    cariBuku,
    cariAnggota,
    jumlahDipinjam,
    stokTersedia,
    pinjamanAnggota,
    ajuanMenunggu,
  };
}
