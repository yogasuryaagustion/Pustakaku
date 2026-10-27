// Reset kata sandi & hapus akun (admin) — keduanya membutuhkan kunci
// service role karena Supabase Auth tidak mengizinkan peran lain
// mengubah/menghapus akun milik pengguna lain.

import {
  bacaBody,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sahkanSandi } from "@/lib/supabase/validasi";
import { catatJejakServer } from "@/lib/supabase/jejak";

interface Params {
  params: Promise<{ id: string }>;
}

function admin() {
  try {
    return createSupabaseAdmin();
  } catch (e) {
    throw new GalatApi(e instanceof Error ? e.message : "Kunci service role belum tersedia.", 503);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });

    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    const sandiBaru = sahkanSandi(body?.sandiBaru, "Kata sandi baru");

    const { data: target, error: errCari } = await k.supabase
      .from("profiles")
      .select("id, nama, email, peran")
      .eq("id", id)
      .maybeSingle();
    if (errCari) throw new GalatApi("Akun tidak ditemukan.", 404);
    if (!target) throw new GalatApi("Akun tidak ditemukan.", 404);

    const a = admin();
    const { error } = await a.auth.admin.updateUserById(id, { password: sandiBaru });
    if (error) throw new GalatApi(error.message || "Kata sandi gagal direset.");

    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Sandi akun direset",
      objek: (target as { nama: string }).nama,
    });
    return json({ ok: true, pesan: `Kata sandi ${(target as { nama: string }).nama} diperbarui.` });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });
    if (k.pengguna?.id === id) {
      throw new GalatApi("Tidak bisa menghapus akun yang sedang masuk.");
    }

    const { data: semua, error: errSemua } = await k.supabase
      .from("profiles")
      .select("id, nama, peran");
    if (errSemua) throw new GalatApi("Daftar akun gagal dibaca.");
    const daftar = (semua ?? []) as { id: string; nama: string; peran: string }[];
    const target = daftar.find((x) => x.id === id);
    if (!target) throw new GalatApi("Akun tidak ditemukan.", 404);
    if (target.peran === "admin" && daftar.filter((x) => x.peran === "admin").length <= 1) {
      throw new GalatApi("Harus ada setidaknya satu akun admin aktif.");
    }

    const a = admin();
    const { error } = await a.auth.admin.deleteUser(id);
    if (error) throw new GalatApi(error.message || "Akun gagal dihapus.");

    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Akun dihapus",
      objek: target.nama,
      detail: `peran ${target.peran}`,
    });
    return json({ ok: true, pesan: "Akun dihapus." });
  });
}
