// Pencatatan jejak aktivitas dari sisi server. Dipakai setiap endpoint yang
// mengubah data; aktor/peran diambil dari SESI, bukan dari body klien.

import type { Konteks } from "./konteks";
import type { JenisJejak } from "../audit";

export interface InputJejak {
  jenis: JenisJejak;
  aksi: string;
  objek: string;
  detail?: string;
  /** Kartu anggota yang terdampak (untuk feed panel anggota). */
  anggotaId?: string | null;
}

/**
 * Simpan satu baris jejak. Kegagalan mencatat jejak TIDAK membatalkan aksi
 * utama (jejak non-kritis) — sama seperti perilaku lama di src/lib/audit.ts.
 */
export async function catatJejakServer(k: Konteks, input: InputJejak): Promise<void> {
  const { error } = await k.supabase.from("log_aktivitas").insert({
    aktor_id: k.pengguna?.id ?? null,
    anggota_id: input.anggotaId ?? k.pengguna?.anggotaId ?? null,
    aktor: k.pengguna?.nama ?? "Tamu",
    peran: k.peran === "tamu" ? "-" : k.peran,
    jenis: input.jenis,
    aksi: input.aksi,
    objek: input.objek,
    detail: input.detail ?? null,
  });
  if (error) console.warn("[jejak] gagal mencatat:", error.message);
}

/** Tidak pernah melempar — untuk jalur yang tidak boleh gagal karena jejak. */
export async function catatJejakAman(k: Konteks, input: InputJejak): Promise<void> {
  try {
    await catatJejakServer(k, input);
  } catch (e) {
    console.warn("[jejak] gagal mencatat:", e instanceof Error ? e.message : e);
  }
}
