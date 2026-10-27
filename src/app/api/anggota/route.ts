// Data anggota: daftar (sesuai izin) & penambahan kartu baru.

import {
  bacaBody,
  dariSupabase,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { catatJejakServer } from "@/lib/supabase/jejak";
import { dariAnggota, keAnggota, type BarisAnggota } from "@/lib/supabase/peta";
import { sahkanAnggotaBody } from "@/lib/supabase/validasi";

export async function GET() {
  return jalankan(async () => {
    // RLS: admin melihat semua kartu; anggota biasa hanya kartu miliknya
    // (dibutuhkan panel & halaman profil); tamu tidak melihat apa pun.
    const k = await konteksRoute();
    const { data, error } = await k.supabase
      .from("anggota")
      .select("*")
      .order("created_at", { ascending: false })
      .order("bergabung_pada", { ascending: true })
      .order("nomor_anggota", { ascending: true });
    if (error) throw dariSupabase(error);
    return json({ anggota: ((data ?? []) as BarisAnggota[]).map(keAnggota) });
  });
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "anggota.kelola" });
    const isi = sahkanAnggotaBody(await bacaBody(request), { wajibSemua: true });

    // Nomor kartu otomatis bila tidak dikirim.
    let nomor = isi.nomorAnggota;
    if (!nomor) {
      const { data, error } = await k.supabase.rpc("nomor_anggota_baru");
      if (error) throw dariSupabase(error);
      nomor = data as string;
    }

    const { data, error } = await k.supabase
      .from("anggota")
      .insert({ ...dariAnggota(isi), nomor_anggota: nomor })
      .select("*")
      .single();
    if (error) throw dariSupabase(error);

    const anggota = keAnggota(data as BarisAnggota);
    await catatJejakServer(k, {
      jenis: "anggota",
      aksi: "Anggota ditambahkan",
      objek: anggota.nama,
      detail: anggota.nomorAnggota,
      anggotaId: anggota.id,
    });
    return json({ anggota }, 201);
  });
}
