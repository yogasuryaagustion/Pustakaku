"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { catatJejak } from "@/lib/audit";
import { tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";

// Halaman Bantuan — hero, panduan singkat, tiket layanan, & FAQ untuk anggota.
// Konten statis (tidak ada data privat); hanya judul sistem & nilai pengaturan
// (denda, lama pinjam) yang diambil dinamis agar selalu akurat.
// Tiket layanan dicatat ke Jejak Aktivitas (demo tanpa backend) lalu
// dikonfirmasi lewat toast.

const PANDUAN: { langkah: string; judul: string; isi: string; href?: string; labelTautan?: string }[] = [
  {
    langkah: "01",
    judul: "Jelajahi katalog",
    isi: "Buka Katalog Buku untuk mencari judul, memfilter kategori, dan mengecek ketersediaan eksemplar.",
    href: "/katalog",
    labelTautan: "Ke Katalog",
  },
  {
    langkah: "02",
    judul: "Ajukan peminjaman",
    isi: "Pilih buku yang masih tersedia lalu tekan Pinjam. Peminjaman juga bisa diajukan langsung dari halaman Pinjaman Saya.",
    href: "/panel/pinjaman",
    labelTautan: "Ke Pinjaman Saya",
  },
  {
    langkah: "03",
    judul: "Pantau & perpanjang",
    isi: "Lihat status pinjaman, sisa hari, dan denda berjalan di tab Aktif. Bila perlu, tekan Perpanjang sebelum jatuh tempo.",
    href: "/panel/pinjaman",
    labelTautan: "Ke Pinjaman Saya",
  },
  {
    langkah: "04",
    judul: "Kelola akun Anda",
    isi: "Perbarui nama, email, telepon, alamat, foto profil, dan ganti kata sandi di halaman Profil.",
    href: "/panel/profil",
    labelTautan: "Ke Profil",
  },
];

const TOPIK_TIKET = [
  "Peminjaman & Pengembalian",
  "Denda & Keterlambatan",
  "Akun & Kata Sandi",
  "Katalog & Ketersediaan",
  "Lainnya",
];

export default function BantuanPage() {
  const sistem = useSistem();
  const { sedangMasuk } = useAuth();
  const toast = useToast();
  const [buka, setBuka] = useState<number | null>(0);
  const [tiket, setTiket] = useState({ topik: "", pesan: "" });

  function kirimTiket(e: React.FormEvent) {
    e.preventDefault();
    catatJejak({
      aktor: sedangMasuk?.nama ?? "Anggota",
      peran: sedangMasuk?.peran ?? "user",
      jenis: "sistem",
      aksi: "Tiket layanan dibuat",
      objek: tiket.topik,
      detail: tiket.pesan.trim().slice(0, 120),
    });
    setTiket({ topik: "", pesan: "" });
    toast.sukses("Tiket layanan terkirim. Pustakawan akan menindaklanjuti secepatnya.");
  }

  const faq: { t: string; j: string }[] = [
    {
      t: "Bagaimana cara mendaftar sebagai anggota?",
      j: "Buka halaman masuk lalu tekan \"Daftar sebagai anggota\". Isi data diri (dan foto profil bila diinginkan), lalu kartu anggota digital Anda dibuat otomatis.",
    },
    {
      t: `Berapa lama durasi peminjaman?`,
      j: `Setiap peminjaman berlaku ${sistem.lamaPinjam} hari sejak tanggal peminjaman. Jatuh tempo dihitung otomatis dan ditampilkan pada daftar pinjaman Anda.`,
    },
    {
      t: "Bagaimana jika terlambat mengembalikan?",
      j: `Pengembalian diproses di perpustakaan oleh pustakawan. Keterlambatan dikenakan denda ${rupiahSingkat(
        sistem.dendaPerHari
      )} per hari, dihitung otomatis saat buku dikembalikan.`,
    },
    {
      t: "Bagaimana cara memperpanjang pinjaman?",
      j: `Buka tab Aktif di Pinjaman Saya, lalu tekan Perpanjang pada pinjaman yang bersangkutan. Pinjaman diperpanjang ${sistem.lamaPinjam} hari tambahan.`,
    },
    {
      t: "Di mana saya melihat denda yang harus dibayar?",
      j: "Total denda berjalan tampil di kartu \\\"Denda Berjalan\\\" pada halaman Pinjaman Saya, lengkap dengan rincian per judul pada daftar pinjaman.",
    },
    {
      t: "Apakah saya bisa mengubah data profil sendiri?",
      j: "Bisa. Buka halaman Profil, ubah data pada bagian Edit Profil (termasuk ganti atau hapus foto), lalu tekan Simpan Profil. Untuk keamanan, ganti kata sandi dilakukan pada bagian Kata Sandi dengan memasukkan sandi saat ini.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero banner — gaya seperti pusat bantuan pada gambar referensi */}
      <div className="relative overflow-hidden rounded-2xl grad-brand p-7 text-white sm:p-9">
        <div aria-hidden className="pola-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold sm:text-3xl">Pusat Bantuan {sistem.nama}</h1>
            <p className="mt-1 text-sm text-white/80">
              Temukan jawaban untuk masalah umum, atau hubungi layanan dukungan perpustakaan kami.
            </p>
          </div>
        </div>
      </div>

      {/* Dua kolom: tiket + panduan (kiri) / FAQ (kanan) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kolom kiri — Buat Tiket Layanan (tinggi disamakan dengan FAQ) */}
        <div className="card flex flex-col p-6">
          <h2 className="font-bold">Buat Tiket Layanan</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Tidak menemukan jawabannya? Kirim kendala Anda — pustakawan akan menindaklanjuti.
          </p>
          <form onSubmit={kirimTiket} className="mt-4 flex flex-1 flex-col space-y-4">
            <div>
              <label className="label" htmlFor="tiket-topik">Kategori / Subjek</label>
              <select
                id="tiket-topik"
                className="input"
                value={tiket.topik}
                onChange={(e) => setTiket({ ...tiket, topik: e.target.value })}
                required
              >
                <option value="">-- Pilih Topik Masalah --</option>
                {TOPIK_TIKET.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col">
              <label className="label" htmlFor="tiket-pesan">Pesan / Detail Masalah</label>
              <textarea
                id="tiket-pesan"
                className="input min-h-32 flex-1"
                placeholder="Jelaskan kendala Anda secara detail…"
                value={tiket.pesan}
                onChange={(e) => setTiket({ ...tiket, pesan: e.target.value })}
                required
                minLength={10}
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary">Kirim Tiket</button>
            </div>
          </form>
        </div>

        {/* Kolom kanan — FAQ akordeon */}
        <div className="card">
          <div className="px-6 pt-6 pb-2">
            <h2 className="font-bold">Pertanyaan yang Sering Diajukan</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Pertanyaan yang sering diajukan seputar layanan perpustakaan.
            </p>
          </div>
          <div className="px-6 pb-2">
            {faq.map((f, i) => (
              <div key={f.t} className="border-b border-[var(--border)] last:border-0">
                <button
                  className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-semibold"
                  onClick={() => setBuka(buka === i ? null : i)}
                  aria-expanded={buka === i}
                >
                  {f.t}
                  <span
                    aria-hidden
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-transform ${
                      buka === i ? "rotate-45 bg-[var(--brand-soft)] text-[var(--brand)]" : ""
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                {buka === i && <p className="pb-4 -mt-1 text-sm text-[var(--muted)] leading-relaxed">{f.j}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panduan langkah */}
      <div className="card p-6">
        <h2 className="font-bold">Cara Menggunakan Layanan</h2>
        <ol className="mt-4 space-y-4">
          {PANDUAN.map((p) => (
            <li key={p.langkah} className="flex gap-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand)]">
                {p.langkah}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{p.judul}</div>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{p.isi}</p>
                {p.href && (
                  <Link href={p.href} className="mt-1 inline-block text-sm font-semibold text-[var(--brand)] hover:underline">
                    {p.labelTautan} →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Kontak & info layanan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-bold">Hubungi Kami</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-[var(--muted)]">
            <li className="flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0 text-[var(--brand)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Jl. Cihampelas No. 15, Bandung
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0 text-[var(--brand)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              (022) 123-4567
            </li>
            <li className="flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0 text-[var(--brand)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
              info@pustakaku.id
            </li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-bold">Layanan & Ketentuan</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-[var(--muted)]">
            <li>
              Lama pinjam: <span className="font-semibold text-[var(--foreground)]">{sistem.lamaPinjam} hari</span> per judul
            </li>
            <li>
              Denda keterlambatan:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {rupiahSingkat(sistem.dendaPerHari)}/hari
              </span>
            </li>
            <li>
              Batas pinjaman aktif:{" "}
              <span className="font-semibold text-[var(--foreground)]">{sistem.maksPinjaman} buku</span>
            </li>
            <li className="pt-1 text-xs">
              Pengembalian & perpanjangan di luar sistem (mis. lewat telepon) diproses pustakawan dan
              berlaku setelah dikonfirmasi di sistem.
            </li>
          </ul>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Hari ini, {tanggalPanjang(new Date().toISOString().slice(0, 10))}.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Rupiah ringkas tanpa dependensi komponen (dipakai teks FAQ). */
function rupiahSingkat(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}
