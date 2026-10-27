// Klien Supabase di sisi SERVER (Route Handler / Server Function).
//
// Dua klien, dua kegunaan:
//   1. createSupabaseServer() — klien berbasis COOKIE sesi pengguna.
//      RLS aktif: semua aturan di supabase/migrations/* ikut ditegakkan.
//      Dipakai untuk hampir seluruh operasi baca/tulis.
//   2. createSupabaseAdmin()  — kunci service role, HANYA di server, HANYA
//      untuk operasi yang tidak bisa dilakukan lewat sesi pengguna:
//      membuat/menghapus akun Supabase Auth (admin), dan impor data lama.
//      Kunci ini TIDAK PERNAH dikirim ke browser (tidak memakai NEXT_PUBLIC_).
//
// Pola cookie mengikuti dokumentasi Supabase untuk Next.js App Router
// (@supabase/ssr): cookies dibaca/ditulis lewat next/headers.

import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { envSupabase } from "./config";

/** Klien dengan sesi pengguna (RLS aktif). Panggil di dalam route handler. */
export async function createSupabaseServer(): Promise<SupabaseClient> {
  const { url, anonKey } = envSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component yang tak boleh menulis cookie —
          // abaikan; refresh token akan dicoba lagi pada request berikutnya.
        }
      },
    },
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/**
 * Klien TANPA sesi (peran `anon`) — dipakai untuk signUp/pendaftaran agar
 * cookie sesi admin tidak tertimpa oleh sesi pengguna baru.
 */
export function createSupabaseAnon(): SupabaseClient {
  const { url, anonKey } = envSupabase();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Klien service role (tanpa RLS). Bila kunci tidak tersedia, melempar Error
 * dengan pesan jelas — route handler mengubahnya menjadi 503, bukan 500.
 */
export function createSupabaseAdmin(): SupabaseClient {
  const { url, serviceKey } = envSupabase();
  if (!serviceKey) {
    throw new Error(
      "Operasi ini membutuhkan kunci service role. Isi SUPABASE_SERVICE_ROLE_KEY " +
        "di .env.local (Project Settings → API → service_role) — hanya dibaca di server."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "pustakaku-server" } },
  });
}
