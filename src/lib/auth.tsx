"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { apiFetch } from "./api";
import { ambilKebijakan, cekIzin, peranEfektif, useKebijakan } from "./akses";

// === Autentikasi: Supabase Auth =============================================
// Kata sandi dikelola sepenuhnya oleh Supabase Auth (bcrypt di server mereka).
// Hash SHA-256 buatan aplikasi lama TIDAK dibawa ke database — akun lama
// dibuat ulang lewat halaman /admin/migrasi dengan sandi sementara.
//
// Sesi disimpan sebagai cookie oleh @supabase/ssr; klien di sini hanya membaca
// hasil /api/auth/* sehingga tidak ada token yang disimpan di JavaScript.

export type Peran = "admin" | "user";

export interface Pengguna {
  id: string;
  nama: string;
  email: string;
  /** Selalu kosong — Supabase Auth tidak mengekspos sandi/hash ke aplikasi. */
  sandiHash: string;
  peran: Peran;
  anggotaId?: string;
  dibuatPada: string;
}

export type HasilAuth = { ok: boolean; pesan: string };

export interface InputKartu {
  nama?: string;
  email?: string;
  telepon?: string;
  alamat?: string;
  jenis?: string;
  foto?: string | null;
}

interface Snapshot {
  pengguna: Pengguna | null;
  /** Daftar semua akun — hanya diisi untuk sesi admin (halaman Kelola Akun). */
  daftar: Pengguna[];
  siap: boolean;
}

const SNAPSHOT_SERVER: Snapshot = { pengguna: null, daftar: [], siap: false };

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

async function muatSesi(): Promise<void> {
  try {
    const { pengguna } = await apiFetch<{ pengguna: Pengguna | null }>("/api/auth/sesi");
    snapshot = { ...snapshot, pengguna: pengguna ?? null, siap: true };
    if (pengguna?.peran === "admin") await muatDaftar();
    else snapshot = { ...snapshot, daftar: [] };
  } catch (e) {
    snapshot = { ...snapshot, pengguna: null, siap: true };
    console.warn("[auth] sesi gagal dimuat:", pesanApi(e));
  }
  beritahu();
}

async function muatDaftar(): Promise<void> {
  try {
    const { akun } = await apiFetch<{ akun: Pengguna[] }>("/api/akun");
    snapshot = { ...snapshot, daftar: Array.isArray(akun) ? akun : [] };
  } catch (e) {
    console.warn("[auth] daftar akun gagal dimuat:", pesanApi(e));
  }
  beritahu();
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);
  if (!diminta) {
    diminta = true;
    void muatSesi();
  }
  return () => {
    pendengar.delete(kembali);
  };
}

function ambilSnapshot(): Snapshot {
  return snapshot;
}

function setPengguna(p: Pengguna | null, daftar?: Pengguna[]) {
  snapshot = { pengguna: p, daftar: daftar ?? (p?.peran === "admin" ? snapshot.daftar : []), siap: true };
  beritahu();
}

// Aktor untuk jejak aktivitas: pengguna yang sedang masuk, dibaca langsung dari
// snapshot sesi sehingga bisa dipakai di mana saja tanpa menerima konteks.
export function aktorSesi(): { nama: string; peran: string; anggotaId?: string } {
  const s = snapshot;
  const u = s.pengguna;
  return { nama: u?.nama ?? "Tamu", peran: u?.peran ?? "-", anggotaId: u?.anggotaId };
}

interface AuthState {
  pengguna: Pengguna[];
  sedangMasuk: Pengguna | null;
  siap: boolean;
  daftar: (input: {
    nama: string;
    email: string;
    sandi: string;
    anggota?: InputKartu;
  }) => Promise<HasilAuth & { pengguna?: Pengguna | null }>;
  masuk: (email: string, sandi: string) => Promise<HasilAuth & { pengguna?: Pengguna }>;
  keluar: () => void;
  ubahProfil: (patch: { nama?: string; email?: string }) => Promise<HasilAuth>;
  gantiSandi: (sandiLama: string, sandiBaru: string, ulangiSandi: string) => Promise<HasilAuth>;

  // Manajemen akun — khusus dipanggil dari panel admin.
  buatAkun: (input: {
    nama: string;
    email: string;
    sandi: string;
    peran: Peran;
    anggotaId?: string;
  }) => Promise<HasilAuth>;
  resetSandi: (id: string, sandiBaru: string) => Promise<HasilAuth>;
  hapusAkun: (id: string) => Promise<HasilAuth>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const s = useSyncExternalStore(langganan, ambilSnapshot, () => SNAPSHOT_SERVER);

  const daftar = useCallback<AuthState["daftar"]>(async (input) => {
    try {
      const res = await apiFetch<{ ok: boolean; pesan: string; pengguna?: Pengguna | null }>(
        "/api/auth/daftar",
        { method: "POST", body: input }
      );
      if (res.pengguna) setPengguna(res.pengguna);
      return {
        ok: true,
        pesan: res.pesan || "Pendaftaran berhasil.",
        pengguna: res.pengguna ?? null,
      };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const masuk = useCallback<AuthState["masuk"]>(async (email, sandi) => {
    try {
      const res = await apiFetch<{ pengguna: Pengguna; pesan: string }>("/api/auth/masuk", {
        method: "POST",
        body: { email, sandi },
      });
      setPengguna(res.pengguna);
      if (res.pengguna.peran === "admin") void muatDaftar();
      return {
        ok: true,
        pesan: res.pesan || `Selamat datang, ${res.pengguna.nama}.`,
        pengguna: res.pengguna,
      };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const keluar = useCallback(() => {
    // Bersihkan sesi lokal lebih dulu agar UI langsung berpindah,
    // lalu akhiri sesi cookie di server (bila jaringan putus, sesi kedaluwarsa
    // sendiri lewat cookie).
    setPengguna(null, []);
    void apiFetch("/api/auth/keluar", { method: "POST" }).catch(() => undefined);
  }, []);

  const ubahProfil = useCallback<AuthState["ubahProfil"]>(async (patch) => {
    try {
      const res = await apiFetch<{ pengguna: Pengguna; pesan: string }>("/api/profil", {
        method: "PATCH",
        body: patch,
      });
      setPengguna(res.pengguna, res.pengguna.peran === "admin" ? snapshot.daftar : []);
      return { ok: true, pesan: res.pesan || "Profil diperbarui." };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const gantiSandi = useCallback<AuthState["gantiSandi"]>(async (sandiLama, sandiBaru, ulangiSandi) => {
    try {
      const res = await apiFetch<{ ok: boolean; pesan: string }>("/api/profil/sandi", {
        method: "PATCH",
        body: { sandiLama, sandiBaru, ulangiSandi },
      });
      return { ok: true, pesan: res.pesan || "Kata sandi berhasil diperbarui." };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const buatAkun = useCallback<AuthState["buatAkun"]>(async (input) => {
    try {
      const res = await apiFetch<{ akun: Pengguna; pesan: string }>("/api/akun", {
        method: "POST",
        body: input,
      });
      await muatDaftar();
      return { ok: true, pesan: res.pesan || "Akun dibuat." };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const resetSandi = useCallback<AuthState["resetSandi"]>(async (id, sandiBaru) => {
    try {
      const res = await apiFetch<{ ok: boolean; pesan: string }>(`/api/akun/${id}`, {
        method: "PATCH",
        body: { sandiBaru },
      });
      return { ok: true, pesan: res.pesan || "Kata sandi diperbarui." };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const hapusAkun = useCallback<AuthState["hapusAkun"]>(async (id) => {
    try {
      const res = await apiFetch<{ ok: boolean; pesan: string }>(`/api/akun/${id}`, {
        method: "DELETE",
      });
      snapshot = { ...snapshot, daftar: snapshot.daftar.filter((x) => x.id !== id) };
      beritahu();
      return { ok: true, pesan: res.pesan || "Akun dihapus." };
    } catch (e) {
      return { ok: false, pesan: pesanApi(e) };
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      pengguna: s.daftar,
      sedangMasuk: s.pengguna,
      siap: s.siap,
      daftar,
      masuk,
      keluar,
      ubahProfil,
      gantiSandi,
      buatAkun,
      resetSandi,
      hapusAkun,
    }),
    [s, daftar, masuk, keluar, ubahProfil, gantiSandi, buatAkun, resetSandi, hapusAkun]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

/**
 * Izin untuk peran sesi berjalan (tamu bila tidak ada sesi), mengikuti kebijakan
 * yang disimpan lewat /admin/akses. Dipakai untuk menampilkan/menyembunyikan
 * tombol & fitur; mutasi data tetap dijaga guard di server + RLS.
 */
export function useBoleh(izinId: string): boolean {
  const { sedangMasuk } = useAuth();
  const kebijakan = useKebijakan();
  return cekIzin(kebijakan, peranEfektif(sedangMasuk?.peran), izinId);
}

export { ambilKebijakan };
