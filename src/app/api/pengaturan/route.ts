// Pengaturan sistem perpustakaan: dibaca publik, diubah hanya admin.

import {
  bacaBody,
  dariSupabase,
  jalankan,
  json,
  kolomBelumAda,
  konteksPublik,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { sahkanSistem, SISTEM_DEFAULT, type SistemPengaturan } from "@/lib/sistem-nilai";
import { catatJejakServer } from "@/lib/supabase/jejak";

interface BarisSistem {
  nama: string;
  tagline: string;
  lama_pinjam: number;
  denda_per_hari: number;
  denda_hilang: number | null;
  maks_pinjaman: number;
  format_inventaris: string | null;
  format_label: string | null;
  diubah_pada: string | null;
  diubah_oleh: string | null;
}

function keSistem(r: BarisSistem | null): SistemPengaturan {
  if (!r) return SISTEM_DEFAULT;
  return sahkanSistem({
    nama: r.nama,
    tagline: r.tagline,
    lamaPinjam: r.lama_pinjam,
    dendaPerHari: r.denda_per_hari,
    dendaHilang: r.denda_hilang ?? SISTEM_DEFAULT.dendaHilang,
    maksPinjaman: r.maks_pinjaman,
    formatInventaris: r.format_inventaris ?? SISTEM_DEFAULT.formatInventaris,
    // Database yang belum menjalankan migrasi format label jatuh ke QR.
    formatLabel: r.format_label ?? SISTEM_DEFAULT.formatLabel,
  });
}

// Pengaturan dibaca publik oleh SELURUH halaman (nama, denda, lama pinjam)
// dan hanya berubah saat admin menyimpan. Di-cache sebentar di memori proses
// agar membuka halaman tidak menunggu roundtrip Supabase — lihat invalidasi
// di PUT bawah.
const TTL_PENGATURAN_MS = 30_000;
let cachePengaturan: { nilai: SistemPengaturan; kedaluwarsa: number } | null = null;

export async function GET() {
  return jalankan(async () => {
    const kini = Date.now();
    if (cachePengaturan && cachePengaturan.kedaluwarsa > kini) {
      return json({ pengaturan: cachePengaturan.nilai });
    }
    const k = await konteksPublik(); // baca publik tanpa validasi sesi
    const { data, error } = await k.supabase
      .from("pengaturan_sistem")
      // `*` dipakai agar database yang belum menjalankan migrasi denda buku
      // hilang (kolom denda_hilang) tetap bisa dibaca.
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw dariSupabase(error);
    const nilai = keSistem((data as BarisSistem | null) ?? null);
    cachePengaturan = { nilai, kedaluwarsa: kini + TTL_PENGATURAN_MS };
    return json({ pengaturan: nilai });
  });
}

export async function PUT(request: Request) {
  return jalankan(async () => {
    // Gerbang: izin `pengaturan.kelola` — bawaan hanya SUPER ADMIN.
    const k = await konteksRoute({ wajibMasuk: true, wajibIzin: "pengaturan.kelola" });
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    // Validasi identik dengan yang tampil di layar (modul murni sistem-nilai).
    const s = sahkanSistem(body?.pengaturan);

    const dasar = {
      id: true,
      nama: s.nama,
      tagline: s.tagline,
      lama_pinjam: s.lamaPinjam,
      denda_per_hari: s.dendaPerHari,
      maks_pinjaman: s.maksPinjaman,
      format_inventaris: s.formatInventaris,
      diubah_pada: new Date().toISOString(),
      diubah_oleh: k.pengguna?.nama ?? null,
    };

    let { error } = await k.supabase
      .from("pengaturan_sistem")
      .upsert(
        { ...dasar, denda_hilang: s.dendaHilang, format_label: s.formatLabel },
        { onConflict: "id" },
      );

    // Database yang belum menjalankan migrasi 202611100004/202611100006 belum
    // punya kolom denda_hilang/format_label; simpan sisanya agar halaman
    // Pengaturan tidak gagal total.
    if (kolomBelumAda(error)) {
      ({ error } = await k.supabase
        .from("pengaturan_sistem")
        .upsert(dasar, { onConflict: "id" }));
    }

    if (error) throw dariSupabase(error);
    // Nilai tersimpan sudah berhasil ditulis — jadikan nilai segar untuk GET.
    cachePengaturan = { nilai: s, kedaluwarsa: Date.now() + TTL_PENGATURAN_MS };

    await catatJejakServer(k, {
      jenis: "sistem",
      aksi: "Pengaturan disimpan",
      objek: s.nama,
      detail:
        `lama ${s.lamaPinjam} hr · denda Rp${s.dendaPerHari.toLocaleString("id-ID")}/hari · ` +
        `hilang Rp${s.dendaHilang.toLocaleString("id-ID")} · nomor ${s.formatInventaris} · ` +
        `label ${s.formatLabel === "qr" ? "QR" : "Code 128"}`,
    });
    return json({ pengaturan: s });
  });
}
