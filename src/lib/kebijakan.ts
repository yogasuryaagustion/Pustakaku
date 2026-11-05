
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "./api";
import {
  KEBIJAKAN_BAWAAN,
  normalisasiKebijakan,
  salinKebijakan,
  type Kebijakan,
} from "./izin";

interface ResponsKebijakan {
  kebijakan: unknown;
}

// Satu snapshot untuk seluruh komponen client.
let snapshot: Kebijakan = salinKebijakan(KEBIJAKAN_BAWAAN);

const pendengar = new Set<() => void>();
let permintaanMuat: Promise<Kebijakan> | null = null;

function berlangganan(callback: () => void): () => void {
  pendengar.add(callback);
  return () => pendengar.delete(callback);
}

function bacaSnapshot(): Kebijakan {
  return snapshot;
}

function bacaSnapshotServer(): Kebijakan {
  return KEBIJAKAN_BAWAAN;
}

function perbaruiSnapshot(nilai: Kebijakan): void {
  snapshot = salinKebijakan(nilai);
  pendengar.forEach((callback) => callback());
}

/**
 * Mengambil salinan snapshot yang sedang aktif di client.
 * Fungsi ini sinkron dan tidak melakukan request API.
 */
export function ambilKebijakan(): Kebijakan {
  return salinKebijakan(snapshot);
}

/**
 * Mengambil kebijakan terbaru dari GET /api/kebijakan.
 * Request yang berjalan bersamaan akan menggunakan Promise yang sama.
 */
export function muatKebijakan(): Promise<Kebijakan> {
  if (permintaanMuat) return permintaanMuat;

  permintaanMuat = apiFetch<ResponsKebijakan>("/api/kebijakan")
    .then((hasil) => {
      if (
        !hasil ||
        typeof hasil !== "object" ||
        !hasil.kebijakan ||
        typeof hasil.kebijakan !== "object"
      ) {
        throw new Error("Respons kebijakan dari server tidak valid.");
      }

      const nilai = normalisasiKebijakan(hasil.kebijakan);
      perbaruiSnapshot(nilai);

      return salinKebijakan(nilai);
    })
    .finally(() => {
      permintaanMuat = null;
    });

  return permintaanMuat;
}

/**
 * Hook untuk membaca kebijakan global.
 * Secara otomatis memuat data server ketika komponen dipasang.
 */
export function useKebijakan(): Kebijakan {
  const nilai = useSyncExternalStore(
    berlangganan,
    bacaSnapshot,
    bacaSnapshotServer
  );

  useEffect(() => {
    void muatKebijakan().catch((error: unknown) => {
      console.error("[kebijakan] Gagal memuat:", error);
    });
  }, []);

  return nilai;
}

/**
 * Menyimpan kebijakan melalui PUT /api/kebijakan.
 * Identitas pelaku ditentukan server berdasarkan sesi login.
 */
export async function simpanKebijakan(
  kebijakan: Kebijakan,
  _aktor?: string
): Promise<Kebijakan> {
  const hasil = await apiFetch<ResponsKebijakan>("/api/kebijakan", {
    method: "PUT",
    body: { kebijakan },
  });

  if (
    !hasil ||
    typeof hasil !== "object" ||
    !hasil.kebijakan ||
    typeof hasil.kebijakan !== "object"
  ) {
    throw new Error("Server tidak mengembalikan kebijakan yang tersimpan.");
  }

  const nilai = normalisasiKebijakan(hasil.kebijakan);
  perbaruiSnapshot(nilai);

  return salinKebijakan(nilai);
}
