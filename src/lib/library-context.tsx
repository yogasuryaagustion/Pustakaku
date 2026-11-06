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
import type { Anggota, Buku, Peminjaman } from "./types";
import { DENDA_PER_HARI } from "./types";
import { apiFetch } from "./api";
import { useToast } from "@/components/toast";

export type Hasil = { ok: boolean; pesan: string };

export type KunciData = "buku" | "anggota" | "peminjaman";

/** Kondisi fisik yang boleh dicatat petugas saat menerima pengembalian. */
export type KondisiKembali = "layak" | "rusak_ringan";

const SEMUA_KUNCI: KunciData[] = ["buku", "anggota", "peminjaman"];

// Halaman yang tidak perlu memuat semua data perpustakaan secara otomatis.
// Landing page akan meminta data buku secara khusus melalui muatKatalogPublik.
const RUTE_TANPA_DATA = ["/", "/login", "/register"];

interface Snapshot {
  buku: Buku[];
  anggota: Anggota[];
  peminjaman: Peminjaman[];
  dipinjam: Record<string, number>;
  siap: boolean;
  galat: string | null;
}

const SNAPSHOT_SERVER: Snapshot = {
  buku: [],
  anggota: [],
  peminjaman: [],
  dipinjam: {},
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

function pesanApi(e: unknown): string {
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as Error).message === "string"
  ) {
    return (e as Error).message;
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
async function muatSatuData(kunci: KunciData): Promise<void> {
  if (dataTersedia.has(kunci)) return;

  const requestBerjalan = dataSedangDimuat.get(kunci);
  if (requestBerjalan) return requestBerjalan;

  const request = (async () => {
    try {
      if (kunci === "buku") {
        const res = await apiFetch<{
          buku: Buku[];
          dipinjam?: Record<string, number>;
        }>("/api/buku");

        if (!Array.isArray(res.buku)) {
          throw new Error("Format data buku dari server tidak valid.");
        }

        snapshot = {
          ...snapshot,
          buku: res.buku,
          dipinjam: res.dipinjam ?? snapshot.dipinjam,
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
        const res = await apiFetch<{
          peminjaman: Peminjaman[];
        }>("/api/peminjaman");

        if (!Array.isArray(res.peminjaman)) {
          throw new Error("Format data peminjaman dari server tidak valid.");
        }

        snapshot = {
          ...snapshot,
          peminjaman: res.peminjaman,
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
  dipinjam: Record<string, number>;
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
  ) => Promise<Hasil>;

  kembalikanBuku: (
    peminjamanId: string,
    /** Kondisi salinan saat diterima; kosong = kondisi lama dipertahankan. */
    kondisi?: KondisiKembali,
  ) => Promise<Hasil>;

  perpanjangPinjam: (
    peminjamanId: string,
    tambahHari?: number,
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
    (bukuId: string, anggotaId: string, tanggalPinjam?: string) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>("/api/peminjaman", {
            method: "POST",
            body: {
              bukuId,
              anggotaId,
              tanggalPinjam,
            },
          }),
        "Peminjaman dicatat.",
        ["buku", "peminjaman"],
      ),
    [],
  );

  const kembalikanBuku = useCallback(
    (peminjamanId: string, kondisi?: KondisiKembali) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(
            `/api/peminjaman/${peminjamanId}/kembali`,
            {
              method: "POST",
              body: kondisi ? { kondisi_fisik: kondisi } : undefined,
            },
          ),
        "Pengembalian dicatat.",
        ["buku", "peminjaman"],
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
      dipinjam: s.dipinjam,
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
      perpanjangPinjam,
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
      perpanjangPinjam,
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
  const { buku, anggota, peminjaman, dipinjam } = useLibrary();

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

  const stokTersedia = useCallback(
    (bukuId: string) => {
      const item = buku.find((b) => b.id === bukuId);

      if (!item) return 0;

      return Math.max(0, item.stok - jumlahDipinjam(bukuId));
    },
    [buku, jumlahDipinjam],
  );

  const pinjamanAnggota = useCallback(
    (anggotaId: string) => peminjaman.filter((p) => p.anggotaId === anggotaId),
    [peminjaman],
  );

  return {
    cariBuku,
    cariAnggota,
    jumlahDipinjam,
    stokTersedia,
    pinjamanAnggota,
  };
}
