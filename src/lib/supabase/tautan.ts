// Tautan kartu anggota ↔ akun login.
// Aturan: hanya dilakukan bila profil belum tertaut DAN email kartu sama
// dengan email akun — diverifikasi ulang oleh pemicu jaga_profil() di database,
// sehingga pengguna tidak bisa menautkan kartu milik orang lain.

import type { Konteks } from "./konteks";
import { keAnggota, type BarisAnggota } from "./peta";
import type { Anggota } from "../types";

export interface HasilTautan {
  anggotaId: string | null;
  kartu: Anggota | null;
}

/** Cari kartu anggota beremail sama (persis, tanpa wildcard). */
async function cariKartu(
  k: Konteks,
  email: string
): Promise<BarisAnggota | null> {
  const kandidat = Array.from(new Set([email.trim(), email.trim().toLowerCase()]));
  for (const e of kandidat) {
    if (!e) continue;
    const { data, error } = await k.supabase
      .from("anggota")
      .select("*")
      .eq("email", e)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[tautan] gagal mencari kartu:", error.message);
      return null;
    }
    if (data) return data as BarisAnggota;
  }
  return null;
}

export async function tautkanKartuSaya(k: Konteks): Promise<HasilTautan> {
  if (!k.pengguna) return { anggotaId: null, kartu: null };

  const baris = await cariKartu(k, k.pengguna.email);
  if (!baris) return { anggotaId: null, kartu: null };

  const kartu = keAnggota(baris);
  if (k.pengguna.anggotaId) {
    // Sudah tertaut — pastikan kartu yang ditemukan memang milik akun ini.
    return k.pengguna.anggotaId === kartu.id
      ? { anggotaId: kartu.id, kartu }
      : { anggotaId: k.pengguna.anggotaId, kartu: null };
  }

  const { error } = await k.supabase
    .from("profiles")
    .update({ anggota_id: kartu.id })
    .eq("id", k.pengguna.id)
    .is("anggota_id", null);
  if (error) {
    // Bukan fatal — pemicu jaga_profil menolak bila email tidak cocok.
    console.warn("[tautan] gagal menautkan kartu:", error.message);
    return { anggotaId: null, kartu: null };
  }

  k.pengguna.anggotaId = kartu.id;
  return { anggotaId: kartu.id, kartu };
}
