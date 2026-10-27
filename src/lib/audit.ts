"use client";

import { useSyncExternalStore } from "react";
import { apiFetch } from "./api";

// Jejak Aktivitas (audit log): setiap aksi operasional tercatat — siapa,
// apa, kapan. Disimpan PERMANEN di tabel `jejak` (database D1, lewat API
// /api/jejak) — bukan localStorage. Dibaca lewat useSyncExternalStore agar
// aman hydration (render server selalu mengembalikan referensi kosong yang
// sama).

export type JenisJejak =
  | "masuk"
  | "pinjam"
  | "kembali"
  | "perpanjang"
  | "buku"
  | "anggota"
  | "akun"
  | "sistem";

export interface JejakAksi {
  id: string;
  waktu: string; // ISO datetime
  aktor: string; // nama pengguna yang melakukan aksi
  peran: string; // admin | user | -
  jenis: JenisJejak;
  aksi: string; // "Peminjaman dicatat"
  objek: string; // judul buku / nama anggota / email
  detail?: string;
}

const SNAPSHOT_SERVER: JejakAksi[] = [];
let snapshot: JejakAksi[] = SNAPSHOT_SERVER;
let diminta = false;
const pendengar = new Set<() => void>();

function beritahu() {
  pendengar.forEach((fn) => fn());
}

async function muatJejak() {
  if (diminta || typeof window === "undefined") return;
  diminta = true;
  try {
    const { jejak } = await apiFetch<{ jejak: JejakAksi[] }>("/api/jejak");
    snapshot = Array.isArray(jejak) ? jejak : [];
    beritahu();
  } catch (e) {
    diminta = false;
    console.warn("Gagal memuat jejak aktivitas:", e);
  }
}

function langganan(kembali: () => void): () => void {
  pendengar.add(kembali);
  void muatJejak();
  return () => {
    pendengar.delete(kembali);
  };
}

function ambil(): JejakAksi[] {
  return snapshot;
}

/**
 * Catat jejak lewat server: aktor/peran/waktu ditentukan SESI di server
 * (bukan dikirim klien), sehingga tidak bisa dipalsukan. Entri baru
 * ditambahkan ke snapshot setelah server mengonfirmasi.
 */
export function catatJejak(input: {
  aktor?: string;
  peran?: string;
  jenis: JenisJejak;
  aksi: string;
  objek: string;
  detail?: string;
}): void {
  if (typeof window === "undefined") return;
  void apiFetch<{ jejak: JejakAksi }>("/api/jejak", {
    method: "POST",
    body: {
      jenis: input.jenis,
      aksi: input.aksi,
      objek: input.objek,
      detail: input.detail,
    },
  })
    .then((res) => {
      if (res?.jejak) {
        snapshot = [res.jejak, ...snapshot].slice(0, 300);
        beritahu();
      }
    })
    .catch(() => {
      // Belum masuk / jaringan gagal — jejak non-kritis, abaikan diam-diam
      // (aksi utamanya tetap diproses endpoint masing-masing).
    });
}

export function hapusJejak(): void {
  if (typeof window === "undefined") return;
  void apiFetch("/api/jejak", { method: "DELETE" })
    .then(() => {
      snapshot = [];
      beritahu();
    })
    .catch((e) => console.warn("Gagal menghapus jejak:", e));
}

export function useJejak(): JejakAksi[] {
  return useSyncExternalStore(langganan, ambil, () => SNAPSHOT_SERVER);
}
