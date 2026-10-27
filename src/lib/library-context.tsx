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
import type { Anggota, Buku, Peminjaman } from "./types";
import { DENDA_PER_HARI } from "./types";
import { apiFetch } from "./api";
import { useToast } from "@/components/toast";

// === Sumber data utama: Supabase (lewat /api/*) ==============================
// Sebelumnya seluruh data disimpan di localStorage browser. Kini snapshot hanya
// CACHE di memori: dibaca dari server lewat useSyncExternalStore, ditulis lewat
// endpoint API yang menegakkan RLS + matriks izin di sisi server.
// localStorage TIDAK lagi dipakai untuk buku/anggota/peminjaman — hanya
// preferensi tema (lihat src/lib/theme.ts).

export type Hasil = { ok: boolean; pesan: string };

interface Snapshot {
  buku: Buku[];
  anggota: Anggota[];
  peminjaman: Peminjaman[];
  /** Jumlah peminjaman aktif per buku (agregat dari database). */
  dipinjam: Record<string, number>;
  /** Selesai memuat (berhasil maupun gagal) — dipakai status loading layar. */
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
let diminta = false;
const pendengar = new Set<() => void>();

function beritahu() {
  pendengar.forEach((fn) => fn());
}

function pesanApi(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
    return (e as Error).message;
  }
  return "Tidak bisa terhubung ke server. Periksa koneksi Anda.";
}

/** Muat seluruh data dari database (dipanggil saat mount & setelah mutasi). */
async function muatData(): Promise<void> {
  try {
    const [bukuRes, anggotaRes, pinjamRes] = await Promise.all([
      apiFetch<{ buku: Buku[]; dipinjam?: Record<string, number> }>("/api/buku"),
      apiFetch<{ anggota: Anggota[] }>("/api/anggota"),
      apiFetch<{ peminjaman: Peminjaman[] }>("/api/peminjaman"),
    ]);
    snapshot = {
      buku: Array.isArray(bukuRes?.buku) ? bukuRes.buku : [],
      anggota: Array.isArray(anggotaRes?.anggota) ? anggotaRes.anggota : [],
      peminjaman: Array.isArray(pinjamRes?.peminjaman) ? pinjamRes.peminjaman : [],
      dipinjam: bukuRes?.dipinjam ?? {},
      siap: true,
      galat: null,
    };
  } catch (e) {
    diminta = false; // izinkan percobaan ulang pada langganan berikutnya
    snapshot = { ...snapshot, siap: true, galat: pesanApi(e) };
  }
  beritahu();
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);
  if (!diminta) {
    diminta = true;
    void muatData();
  }
  return () => {
    pendengar.delete(kembali);
  };
}

function ambilSnapshot(): Snapshot {
  return snapshot;
}

function muatUlang() {
  diminta = true;
  void muatData();
}

async function jalankan<T>(
  fn: () => Promise<T>,
  pesanSukses: string
): Promise<Hasil & { data?: T }> {
  try {
    const data = await fn();
    muatUlang();
    return { ok: true, pesan: pesanSukses, data };
  } catch (e) {
    return { ok: false, pesan: pesanApi(e) };
  }
}

// ---- Perhitungan (murni, tanpa data) ---------------------------------------
export function hitungDenda(
  tanggalKembaliTarget: string,
  aktual: string,
  perHari: number = DENDA_PER_HARI
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
  /** Agregat ketersediaan: jumlah peminjaman aktif per id buku. */
  dipinjam: Record<string, number>;
  siap: boolean;
  /** Pesan galat koneksi/pemuatan data (null bila lancar). */
  galat: string | null;
  muatUlang: () => void;

  tambahBuku: (b: Omit<Buku, "id" | "ditambahkanPada">) => Promise<Hasil>;
  ubahBuku: (id: string, patch: Partial<Buku>) => Promise<Hasil>;
  hapusBuku: (id: string) => Promise<Hasil>;

  tambahAnggota: (
    a: Omit<Anggota, "id" | "nomorAnggota" | "bergabungPada">
  ) => Promise<Hasil & { anggota?: Anggota }>;
  ubahAnggota: (id: string, patch: Partial<Anggota>) => Promise<Hasil>;
  hapusAnggota: (id: string) => Promise<Hasil>;

  pinjamBuku: (
    bukuId: string,
    anggotaId: string,
    tanggalPinjam?: string
  ) => Promise<Hasil>;
  kembalikanBuku: (peminjamanId: string) => Promise<Hasil>;
  perpanjangPinjam: (peminjamanId: string, tambahHari?: number) => Promise<Hasil>;
}

const LibraryContext = createContext<LibraryState | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const s = useSyncExternalStore(langganan, ambilSnapshot, () => SNAPSHOT_SERVER);
  const toast = useToast();

  // Pesan galat koneksi ditampilkan sebagai toast (sekali per pesan).
  const terlihat = useRef<string | null>(null);
  useEffect(() => {
    if (s.galat && terlihat.current !== s.galat) {
      terlihat.current = s.galat;
      toast.gagal(s.galat);
    }
  }, [s.galat, toast]);

  const tambahBuku = useCallback(
    (b: Omit<Buku, "id" | "ditambahkanPada">) =>
      jalankan(
        () => apiFetch<{ buku: Buku }>("/api/buku", { method: "POST", body: b }),
        `Buku "${b.judul}" ditambahkan.`
      ),
    []
  );

  const ubahBuku = useCallback(
    (id: string, patch: Partial<Buku>) =>
      jalankan(
        () => apiFetch<{ buku: Buku }>(`/api/buku/${id}`, { method: "PUT", body: patch }),
        "Buku diperbarui."
      ),
    []
  );

  const hapusBuku = useCallback(
    (id: string) =>
      jalankan(
        () => apiFetch(`/api/buku/${id}`, { method: "DELETE" }),
        "Buku dihapus."
      ),
    []
  );

  const tambahAnggota = useCallback(
    async (a: Omit<Anggota, "id" | "nomorAnggota" | "bergabungPada">): Promise<
      Hasil & { anggota?: Anggota }
    > => {
      try {
        const r = await apiFetch<{ anggota: Anggota }>("/api/anggota", {
          method: "POST",
          body: a,
        });
        muatUlang();
        return { ok: true, pesan: `Anggota "${a.nama}" ditambahkan.`, anggota: r.anggota };
      } catch (e) {
        return { ok: false, pesan: pesanApi(e) };
      }
    },
    []
  );

  const ubahAnggota = useCallback(
    (id: string, patch: Partial<Anggota>) =>
      jalankan(
        () => apiFetch<{ anggota: Anggota }>(`/api/anggota/${id}`, { method: "PUT", body: patch }),
        "Data anggota diperbarui."
      ),
    []
  );

  const hapusAnggota = useCallback(
    (id: string) =>
      jalankan(
        () => apiFetch(`/api/anggota/${id}`, { method: "DELETE" }),
        "Anggota dihapus."
      ),
    []
  );

  const pinjamBuku = useCallback(
    (bukuId: string, anggotaId: string, tanggalPinjam?: string) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>("/api/peminjaman", {
            method: "POST",
            body: { bukuId, anggotaId, tanggalPinjam },
          }),
        "Peminjaman dicatat."
      ),
    []
  );

  const kembalikanBuku = useCallback(
    (peminjamanId: string) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(`/api/peminjaman/${peminjamanId}/kembali`, {
            method: "POST",
          }),
        "Pengembalian dicatat."
      ),
    []
  );

  const perpanjangPinjam = useCallback(
    (peminjamanId: string, tambahHari?: number) =>
      jalankan(
        () =>
          apiFetch<{ peminjaman: Peminjaman }>(`/api/peminjaman/${peminjamanId}/perpanjang`, {
            method: "POST",
            body: { hari: tambahHari ?? null },
          }),
        "Pinjaman diperpanjang."
      ),
    []
  );

  const value = useMemo<LibraryState>(
    () => ({
      buku: s.buku,
      anggota: s.anggota,
      peminjaman: s.peminjaman,
      dipinjam: s.dipinjam,
      siap: s.siap,
      galat: s.galat,
      muatUlang,
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
      tambahBuku,
      ubahBuku,
      hapusBuku,
      tambahAnggota,
      ubahAnggota,
      hapusAnggota,
      pinjamBuku,
      kembalikanBuku,
      perpanjangPinjam,
    ]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryState {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary harus dipakai di dalam LibraryProvider");
  return ctx;
}

// Helper untuk menyelesaikan entitas terkait di tampilan.
export function useHelper() {
  const { buku, anggota, peminjaman, dipinjam } = useLibrary();

  const cariBuku = useCallback((id: string) => buku.find((b) => b.id === id), [buku]);
  const cariAnggota = useCallback((id: string) => anggota.find((a) => a.id === id), [anggota]);

  // Utamakan agregat dari database (benar untuk semua peran); bila tidak ada,
  // hitung dari daftar peminjaman yang terlihat oleh sesi ini.
  const jumlahDipinjam = useCallback(
    (bukuId: string) =>
      dipinjam[bukuId] ??
      peminjaman.filter((p) => p.bukuId === bukuId && p.status === "Dipinjam").length,
    [dipinjam, peminjaman]
  );

  const stokTersedia = useCallback(
    (bukuId: string) => {
      const b = buku.find((x) => x.id === bukuId);
      if (!b) return 0;
      return Math.max(0, b.stok - jumlahDipinjam(bukuId));
    },
    [buku, jumlahDipinjam]
  );

  const pinjamanAnggota = useCallback(
    (anggotaId: string) => peminjaman.filter((p) => p.anggotaId === anggotaId),
    [peminjaman]
  );

  return { cariBuku, cariAnggota, jumlahDipinjam, stokTersedia, pinjamanAnggota };
}
