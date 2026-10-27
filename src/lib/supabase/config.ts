// Konfigurasi koneksi Supabase — HANYA variabel lingkungan (tanpa kredensial
// di dalam kode). Salin .env.example menjadi .env.local lalu isi nilai asli.
//
//   NEXT_PUBLIC_SUPABASE_URL          → Project Settings → API → Project URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY     → Project Settings → API → anon public
//                                       (publishable key `sb_publishable_…`
//                                       juga diterima sebagai nama alternatif)
//   SUPABASE_SERVICE_ROLE_KEY         → Kunci secret/service role. HANYA dibaca
//                                       di sisi server; jangan pernah memakai
//                                       prefiks NEXT_PUBLIC_ untuk kunci ini.

export interface EnvSupabase {
  url: string;
  anonKey: string;
  serviceKey: string | null;
}

/** Env yang sudah dibaca — `NEXT_PUBLIC_` ikut ter-compile ke browser. */
function baca(): EnvSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? null;
  return { url: url.trim(), anonKey: anonKey.trim(), serviceKey: serviceKey?.trim() || null };
}

/** Apakah proyek sudah dikonfigurasi (URL + kunci publik terisi)? */
export function supabaseSiap(): boolean {
  const e = baca();
  return Boolean(e.url && e.anonKey);
}

/** Pesan galat ramah bila konfigurasi belum lengkap. */
export const PESAN_BELUM_SIAP =
  "Koneksi Supabase belum dikonfigurasi. Salin .env.example menjadi .env.local, " +
  "isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu jalankan " +
  "ulang `npm run dev`. Lihat SUPABASE.md untuk langkah selengkapnya.";

export function envSupabase(): EnvSupabase {
  const e = baca();
  if (!e.url || !e.anonKey) {
    throw new Error(PESAN_BELUM_SIAP);
  }
  return e;
}
