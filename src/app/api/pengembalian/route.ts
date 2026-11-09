// Pengajuan pengembalian anggota. GET dipakai bersama oleh panel anggota
// (melihat pengajuannya sendiri) dan /sirkulasi (antrean validasi petugas);
// RLS yang menentukan baris mana yang terlihat tiap peran.

import { dariSupabase, jalankan, json, konteksPublik } from "@/lib/supabase/konteks";
import { keAjuanKembali, type BarisAjuanKembali } from "@/lib/supabase/peta";

export async function GET() {
  return jalankan(async () => {
    const k = await konteksPublik();
    const { data, error } = await k.supabase
      .from("pengembalian_ajuan")
      .select("id,peminjaman_id,anggota_id,status,kondisi_divalidasi,catatan,dibuat_pada,diproses_pada")
      .order("dibuat_pada", { ascending: false });
    if (error) throw dariSupabase(error);

    return json({
      pengembalian: ((data ?? []) as BarisAjuanKembali[]).map(keAjuanKembali),
    });
  });
}
