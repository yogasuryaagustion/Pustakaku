"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { ambilKebijakan, tujuanRumah } from "@/lib/akses";
import { useSistem } from "@/lib/sistem";
import { InputIkon, InputSandi } from "@/components/ui";
import { keThumbnailFoto } from "@/lib/foto";

// Ikon (path SVG) untuk panel branding & form.
const IKON = {
  buku: "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  orang: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  perisai: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  stopwatch: "M12 22a8 8 0 100-16 8 8 0 000 16z M12 10v4l2.5 2 M9 2h6",
  perangkat: "M5 2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2z M12 18h.01",
  panah: "M5 12h14 M12 5l7 7-7 7",
  daun: "M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6",
};

export default function RegisterPage() {
  const router = useRouter();
  const { daftar } = useAuth();
  const sistem = useSistem();
  // Kebijakan akses bisa menutup pendaftaran publik (izin akun.daftar).
  const bolehDaftar = useBoleh("akun.daftar");

  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  // Foto profil: divalidasi & di-resize ke thumbnail 256px (JPEG) oleh helper
  // bersama — data URL asli bisa ber-megabyte dan membuat penyimpanan penuh.
  // Bila berkas gagal diproses, cukup tampilkan pesan; pendaftaran tetap
  // bisa lanjut tanpa foto.
  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan memilih berkas yang sama lagi
    if (!file) return;
    const hasil = await keThumbnailFoto(file);
    if (!hasil.ok || !hasil.dataUrl) {
      setPesan(hasil.pesan ?? "Foto tidak bisa dibaca — coba berkas lain.");
      return;
    }
    setFoto(hasil.dataUrl);
    setPesan(null);
  }

  // Keunggulan yang ditampilkan di panel branding kiri.
  const keunggulan = [
    { ikon: IKON.buku, judul: "Koleksi buku lengkap", sub: "Ribuan judul buku dari berbagai kategori" },
    { ikon: IKON.stopwatch, judul: "Peminjaman mudah", sub: "Kelola pinjaman buku secara online" },
    { ikon: IKON.perangkat, judul: "Akses kapan saja", sub: "Bisa diakses dari mana saja, kapan saja" },
    { ikon: IKON.perisai, judul: "Aman dan terpercaya", sub: "Data Anda selalu terlindungi" },
  ];

  if (!bolehDaftar) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[var(--background)] p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-50 text-amber-500 grid place-items-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold">Pendaftaran Ditutup</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Pendaftaran anggota baru sedang ditutup oleh kebijakan akses perpustakaan.
            Silakan hubungi pustakawan untuk membuat akun.
          </p>
          <Link href="/login" className="btn btn-primary mt-6">Ke Halaman Masuk</Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);
    if (sandi !== ulangi) {
      setPesan("Konfirmasi sandi tidak sama.");
      return;
    }
    setProses(true);

    // Pendaftaran selalu untuk anggota; kartu anggota dibuat di server oleh
    // fungsi daftar_kartu() (tamu tidak punya hak tulis ke tabel anggota).
    const res = await daftar({
      nama: nama.trim(),
      email: email.trim().toLowerCase(),
      sandi,
      anggota: {
        nama: nama.trim(),
        email: email.trim().toLowerCase(),
        telepon: "",
        alamat: "",
        jenis: "Umum",
        foto,
      },
    });
    setProses(false);
    if (!res.ok || !res.pengguna) {
      setPesan(res.pesan);
      return;
    }
    // Tujuan mengikuti kebijakan (mis. panel.lihat dicabut → katalog).
    router.replace(tujuanRumah(ambilKebijakan(), "user"));
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Panel kiri: branding */}
      <div className="relative overflow-hidden hidden lg:flex flex-col grad-cta text-white p-12">
        <div aria-hidden className="pola-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-slate-900/25 blur-3xl" />
        {/* Daun dekoratif kiri-bawah. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -left-12 h-64 w-64 rotate-12 text-white/10"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={IKON.daun} />
        </svg>
        {/* Tumpukan buku dekoratif (seragam dengan halaman masuk). */}
        <div aria-hidden className="pointer-events-none absolute right-0 top-28 opacity-25">
          <svg width="300" height="190" viewBox="0 0 280 170" fill="none">
            <rect x="40" y="112" width="210" height="24" rx="8" fill="white" />
            <rect x="58" y="84" width="180" height="24" rx="8" fill="white" opacity="0.85" />
            <rect x="80" y="56" width="140" height="24" rx="8" fill="white" opacity="0.7" />
            <circle cx="238" cy="44" r="22" fill="white" opacity="0.45" />
            <path d="M238 30c-8 4-12 10-12 18 8 0 14-6 12-18z" fill="white" opacity="0.8" />
          </svg>
        </div>

        <Link href="/" className="relative flex items-center gap-2.5 w-fit group">
          <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center transition-transform duration-200 group-hover:scale-105">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={IKON.buku} />
            </svg>
          </div>
          <div className="leading-tight">
            <span className="block font-bold text-lg">{sistem.nama}</span>
            <span className="block text-xs text-white/70">Kembali ke beranda →</span>
          </div>
        </Link>

        <div className="relative mt-10">
          <span className="anim-naik inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold w-fit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={IKON.orang} />
            </svg>
            Pendaftaran Anggota
          </span>
          <h2 className="anim-naik anim-naik-1 mt-5 text-3xl xl:text-4xl font-bold leading-snug tracking-tight">
            Bergabung dengan{" "}
            <span className="text-emerald-200">perpustakaan digital</span> kami
          </h2>
          <p className="anim-naik anim-naik-2 mt-4 text-white/80 max-w-md leading-relaxed">
            Nikmati kemudahan akses buku, pinjaman, dan berbagai fasilitas lainnya
            dengan menjadi anggota {sistem.nama}.
          </p>

          <ul className="anim-naik anim-naik-2 mt-7 space-y-4">
            {keunggulan.map((k) => (
              <li key={k.judul} className="flex items-start gap-3.5">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={k.ikon} />
                  </svg>
                </span>
                <div className="leading-tight">
                  <div className="font-semibold">{k.judul}</div>
                  <div className="mt-1 text-xs text-white/70">{k.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md p-4 text-sm">
          <span className="mt-0.5 shrink-0 text-emerald-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={IKON.daun} />
            </svg>
          </span>
          <p className="italic leading-relaxed text-white/85">
            “Buku adalah jendela dunia, dan keanggotaan ini adalah langkah pertama
            menuju dunia yang lebih luas.”
          </p>
        </div>
      </div>

      {/* Panel kanan: form — overflow-hidden mengklip blob dekoratif yang
          menjorok keluar viewport (penyebab scrollbar horizontal & vertikal). */}
      <div className="relative flex items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-10 pendek:py-6">
        <div aria-hidden className="pola-kisi pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[var(--brand-soft)]/70 blur-2xl" />
        <div className="relative w-full max-w-md anim-naik">
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-6">
            <div className="h-10 w-10 rounded-xl grad-brand text-white grid place-items-center shadow-[var(--sh-2)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={IKON.buku} />
              </svg>
            </div>
            <span className="font-bold text-lg">{sistem.nama}</span>
          </div>

          <div className="card p-7 shadow-[var(--sh-3)] sm:p-8 pendek:p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full grad-brand text-white shadow-[var(--sh-2)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={IKON.orang} />
                </svg>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">
                Daftar Anggota
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Daftar Akun Anggota</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Isi data diri Anda untuk membuat akun {sistem.nama}.
            </p>

            {pesan && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 py-2.5 text-sm font-medium" role="alert">
                <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {pesan}
              </div>
            )}

            <form onSubmit={submit} className="mt-4 space-y-4 pendek:space-y-3">
              {/* Foto profil — opsional, bisa dilewati. */}
              <div>
                <span className="label">Foto Profil <span className="font-normal text-[var(--muted)]">(opsional)</span></span>
                <div className="mt-1 flex items-center gap-4">
                  <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)] pendek:h-14 pendek:w-14">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL kecil hasil resize lokal
                      <img src={foto} alt="Pratinjau foto profil" className="h-full w-full object-cover" />
                    ) : (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={IKON.orang} />
                      </svg>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <label className="btn btn-ghost !py-1.5 cursor-pointer">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      {foto ? "Ganti Foto" : "Pilih Foto"}
                      <input type="file" accept="image/*" className="sr-only" onChange={pilihFoto} />
                    </label>
                    {foto && (
                      <button type="button" className="btn btn-ghost !py-1.5 text-rose-600" onClick={() => setFoto(null)}>
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">JPG/PNG maks 5 MB — otomatis dikecilkan.</p>
              </div>
              <div>
                <label className="label" htmlFor="nama">Nama Lengkap</label>
                <InputIkon
                  id="nama"
                  ikon={IKON.orang}
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <InputIkon
                  id="email"
                  ikon={IKON.mail}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh@email.com"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="sandi">Sandi</label>
                  <InputSandi
                    id="sandi"
                    value={sandi}
                    onChange={(e) => setSandi(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ulangi">Ulangi Sandi</label>
                  <InputSandi
                    id="ulangi"
                    value={ulangi}
                    onChange={(e) => setUlangi(e.target.value)}
                    placeholder="Konfirmasi sandi"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={proses}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={IKON.orang} />
                </svg>
                {proses ? "Mendaftarkan…" : "Daftar Sekarang"}
                {!proses && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={IKON.panah} />
                  </svg>
                )}
              </button>
            </form>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)]/50 p-4 pendek:mt-3 pendek:p-3">
              <span className="mt-0.5 shrink-0 text-[var(--brand)]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={IKON.perisai} />
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-[var(--brand)]">Untuk pustakawan</div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Akun admin tidak dibuat lewat pendaftaran publik — disediakan langsung
                  oleh pustakawan. Contoh akun admin:{" "}
                  <span className="font-mono">admin@perpus.id</span> /{" "}
                  <span className="font-mono">admin123</span>.
                </p>
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-[var(--muted)] pendek:mt-3">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
