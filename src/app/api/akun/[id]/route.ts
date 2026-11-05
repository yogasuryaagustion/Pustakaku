// Reset kata sandi & hapus akun (Super Admin) — keduanya membutuhkan kunci
// service role karena Supabase Auth tidak mengizinkan peran lain
// mengubah/menghapus akun milik pengguna lain.
// Gerbang: izin `akun.kelola` (bawaan hanya Super Admin).

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sahkanSandi } from "@/lib/supabase/validasi";
import { INFO_PERAN } from "@/lib/izin";
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
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "akun.kelola" });
      if (k.peran !== "superadmin") {
        throw new GalatApi(
          "Hanya Super Admin yang dapat mengubah peran atau mereset kata sandi akun.",
          403
        );
      }

    const body = (await bacaBody(request)) as Record<string, unknown> | null;

    // Periksa apakah request memang meminta perubahan peran.
    const memilikiPermintaanPeran =
      body !== null &&
      Object.prototype.hasOwnProperty.call(body, "peran");

    // Validasi peran yang diperbolehkan.
    const peranBaru =
      body?.peran === "superadmin"
        ? "superadmin"
        : body?.peran === "admin"
          ? "admin"
          : body?.peran === "user"
            ? "user"
            : null;

    // Tolak peran yang tidak dikenal.
    if (memilikiPermintaanPeran && !peranBaru) {
      throw new GalatApi("Peran yang diminta tidak valid.", 400);
    }

    const { data: target, error: errCari } = await k.supabase
      .from("profiles")
      .select("id, nama, email, peran")
      .eq("id", id)
      .maybeSingle();
    if (errCari) throw dariSupabase(errCari);
    if (!target) throw new GalatApi("Akun tidak ditemukan.", 404);
    const t = target as { id: string; nama: string; email: string; peran: string };

    // === A) Ubah peran (Super Admin / Admin / Anggota) ==================
    if (peranBaru) {
      if (t.peran === peranBaru) {
        return json({
          ok: true,
          pesan: `Peran ${t.nama} tetap ${INFO_PERAN[peranBaru].label}.`,
        });
      }

      // Kunci anti-lockout: sistem tidak boleh kehilangan Super Admin terakhir
      // (berlaku untuk perubahan peran, sama seperti saat menghapus akun).
      if (t.peran === "superadmin" && peranBaru !== "superadmin") {
        const { data: semua, error: errSemua } = await k.supabase
          .from("profiles")
          .select("peran");
        if (errSemua) throw dariSupabase(errSemua);
        const jumlah = (semua ?? []).filter(
          (x) => (x as { peran: string }).peran === "superadmin"
        ).length;
        if (jumlah <= 1) {
          throw new GalatApi("Harus ada setidaknya satu akun Super Admin aktif.", 409);
        }
      }

      const { data: ubah, error: errUbah } = await k.supabase
        .from("profiles")
        .update({ peran: peranBaru })
        .eq("id", id)
        .select("id, peran")
        .maybeSingle();
      if (errUbah) throw dariSupabase(errUbah);

      // Pemicu jaga_profil menegakkan aturan yang SAMA di database: hanya Super
      // Admin yang boleh mengubah peran. Bila nilai kembali seperti semula,
      // berarti migrasi belum dijalankan — laporkan jujur, jangan berpura-pura
      // berhasil.
      if (!ubah || (ubah as { peran: string }).peran !== peranBaru) {
        throw new GalatApi(
          "Perubahan peran ditolak oleh database. Periksa fungsi dan trigger jaga_profil() serta hak akses Super Admin.",
          409
        );
      }

      await catatJejakServer(k, {
        jenis: "akun",
        aksi: "Peran akun diubah",
        objek: t.email,
        detail: `${t.peran} → ${peranBaru}`,
      });
      return json({
        ok: true,
        pesan: `Peran ${t.nama} kini ${INFO_PERAN[peranBaru].label}.`,
      });
    }

    // === B) Reset kata sandi ============================================
    const sandiBaru = sahkanSandi(body?.sandiBaru, "Kata sandi baru");

    const a = admin();
    const { error } = await a.auth.admin.updateUserById(id, { password: sandiBaru });
    if (error) throw new GalatApi(error.message || "Kata sandi gagal direset.");

    await catatJejakServer(k, {
      jenis: "akun",
      aksi: "Sandi akun direset",
      objek: t.nama,
    });
    return json({ ok: true, pesan: `Kata sandi ${t.nama} diperbarui.` });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "akun.kelola" });
      if (k.peran !== "superadmin") {
        throw new GalatApi(
          "Hanya Super Admin yang dapat menghapus akun.",
          403
        );
      }
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
    // Kunci anti-lockout: sistem tak boleh kehilangan seluruh Super Admin-nya.
    if (
      target.peran === "superadmin" &&
      daftar.filter((x) => x.peran === "superadmin").length <= 1
    ) {
      throw new GalatApi("Harus ada setidaknya satu akun Super Admin aktif.");
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
