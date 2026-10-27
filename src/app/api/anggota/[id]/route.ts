// Ubah / hapus satu kartu anggota.

import {
  bacaBody,
  dariSupabase,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { dariAnggota, keAnggota, type BarisAnggota } from "@/lib/supabase/peta";
import { sahkanAnggotaBody } from "@/lib/supabase/validasi";

interface Params {
  params: Promise<{ id: string }>;
}

const BOLEH_UBAH_SENDIRI = ["nama", "email", "telepon", "alamat", "foto"];

export async function PUT(request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true });

    const punyaIzinKartu = k.izin("anggota.kelola");
    const kartuSendiri = k.pengguna?.anggotaId === id;
    if (!punyaIzinKartu && !(kartuSendiri && k.izin("panel.profil"))) {
      throw new GalatApi("Anda tidak memiliki izin untuk mengubah data anggota ini.", 403);
    }

    const patch = sahkanAnggotaBody(await bacaBody(request));
    if (!punyaIzinKartu) {
      // Anggota biasa hanya boleh menyentuh data kontak & fotonya sendiri.
      for (const kunci of Object.keys(patch)) {
        if (!BOLEH_UBAH_SENDIRI.includes(kunci)) delete patch[kunci as keyof typeof patch];
      }
    }
    if (Object.keys(patch).length === 0) throw new GalatApi("Tidak ada perubahan yang dikirim.");

    const { data: sebelum, error: errSebelum } = await k.supabase
      .from("anggota")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errSebelum) throw dariSupabase(errSebelum);
    if (!sebelum) throw new GalatApi("Anggota tidak ditemukan.", 404);

    const { data, error } = await k.supabase
      .from("anggota")
      .update(dariAnggota(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw dariSupabase(error);

    const anggota = keAnggota(data as BarisAnggota);
    await catatJejakServer(k, {
      jenis: "anggota",
      aksi: "Anggota diubah",
      objek: patch.nama ?? (sebelum as BarisAnggota).nama,
      detail:
        patch.aktif !== undefined
          ? `status → ${anggota.aktif ? "Aktif" : "Nonaktif"}`
          : "data diperbarui",
      anggotaId: anggota.id,
    });
    return json({ anggota });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return jalankan(async () => {
    const { id } = await params;
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "anggota.kelola" });

    const { data: sebelum, error: errSebelum } = await k.supabase
      .from("anggota")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errSebelum) throw dariSupabase(errSebelum);
    if (!sebelum) throw new GalatApi("Anggota tidak ditemukan.", 404);

    const { error } = await k.supabase.from("anggota").delete().eq("id", id);
    if (error) throw dariSupabase(error);

    await catatJejakServer(k, {
      jenis: "anggota",
      aksi: "Anggota dihapus",
      objek: (sebelum as BarisAnggota).nama,
      detail: (sebelum as BarisAnggota).nomor_anggota,
    });
    return json({ ok: true });
  });
}
