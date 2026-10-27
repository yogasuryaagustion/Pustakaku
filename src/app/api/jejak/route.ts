// Jejak aktivitas (audit log): dibaca sesuai RLS, ditulis oleh sesi login.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { keJejak, type BarisJejak } from "@/lib/supabase/peta";
import type { JenisJejak } from "@/lib/audit";

const JENIS: JenisJejak[] = [
  "masuk",
  "pinjam",
  "kembali",
  "perpanjang",
  "buku",
  "anggota",
  "akun",
  "sistem",
];

export async function GET() {
  return jalankan(async () => {
    // RLS: admin melihat semua; anggota hanya jejak miliknya / kartunya.
    const k = await konteksRoute();
    const { data, error } = await k.supabase
      .from("log_aktivitas")
      .select("id, waktu, aktor, peran, jenis, aksi, objek, detail")
      .order("waktu", { ascending: false })
      .limit(300);
    if (error) throw dariSupabase(error);
    return json({ jejak: ((data ?? []) as BarisJejak[]).map(keJejak) });
  });
}

export async function POST(request: Request) {
  return jalankan(async () => {
    // aktor/peran/waktu diambil dari SESI di server — tidak dipercaya dari klien
    // (lihat pemicu jaga_log di migrasi 0003).
    const k = await konteksRoute({ wajibMasuk: true });
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const jenisMentah = typeof body?.jenis === "string" ? body.jenis : "";
    const jenis = jenisMentah as JenisJejak;
    const aksi = typeof body?.aksi === "string" ? body.aksi.trim().slice(0, 200) : "";
    const objek = typeof body?.objek === "string" ? body.objek.trim().slice(0, 300) : "";
    const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 500) : null;
    if (!JENIS.includes(jenis)) throw new GalatApi("Jenis jejak tidak dikenal.");
    if (!aksi) throw new GalatApi("Aksi jejak wajib diisi.");

    const { data, error } = await k.supabase
      .from("log_aktivitas")
      .insert({
        jenis,
        aksi,
        objek,
        detail,
        aktor_id: k.pengguna?.id ?? null,
        anggota_id: k.pengguna?.anggotaId ?? null,
        aktor: k.pengguna?.nama ?? "Tamu",
        peran: k.peran === "tamu" ? "-" : k.peran,
      })
      .select("id, waktu, aktor, peran, jenis, aksi, objek, detail")
      .single();
    if (error) throw dariSupabase(error);

    return json({ jejak: keJejak(data as BarisJejak) }, 201);
  });
}

export async function DELETE() {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });
    const { error } = await k.supabase.from("log_aktivitas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw dariSupabase(error);
    await catatJejakAwal(k);
    return json({ ok: true });
  });
}

// Mencatat bahwa log dibersihkan — setelah penghapusan agar tidak ikut terhapus.
async function catatJejakAwal(k: Awaited<ReturnType<typeof konteksRoute>>) {
  const { error } = await k.supabase.from("log_aktivitas").insert({
    jenis: "sistem",
    aksi: "Jejak aktivitas dibersihkan",
    objek: "Log aktivitas",
    detail: "seluruh riwayat dihapus oleh admin",
    aktor_id: k.pengguna?.id ?? null,
    aktor: k.pengguna?.nama ?? "Admin",
    peran: k.peran,
  });
  if (error) console.warn("[jejak] gagal mencatat:", error.message);
}
