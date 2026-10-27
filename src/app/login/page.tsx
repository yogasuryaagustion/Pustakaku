"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { bolehRute, peranEfektif, tujuanRumah, useKebijakan } from "@/lib/akses";
import { useSistem } from "@/lib/sistem";
import { InputIkon, InputSandi } from "@/components/ui";

// Ikon (path SVG) untuk panel branding & form.
const IKON = {
  buku: "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  masuk: "M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4 M10 17l5-5-5-5 M15 12H3",
  orang: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  perisai: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  daun: "M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { masuk } = useAuth();
  const kebijakan = useKebijakan();
  // Tautan "Daftar" hanya tampil bila pendaftaran publik masih dibuka.
  const bolehDaftar = useBoleh("akun.daftar");

  const sistem = useSistem();

  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  const dari = params.get("dari") || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProses(true);
    setPesan(null);
    const res = await masuk(email, sandi);

    setProses(false);
    if (!res.ok) {
      setPesan(res.pesan);
      return;
    }
    const peran = peranEfektif(res.pengguna?.peran);
    // Tautan "dari" dihormati hanya bila masih diizinkan kebijakan untuk
    // peran ini — kalau tidak, langsung ke rumah peran (tanpa "Akses Ditolak").
    const tujuan = dari && bolehRute(kebijakan, peran, dari) ? dari : tujuanRumah(kebijakan, peran);
    router.replace(tujuan);
  }

  function isiDemo(a: string, b: string) {
    setEmail(a);
    setSandi(b);
    setPesan(null);
  }

  // Statistik ringkas di panel branding (angka statis — bukan data live).
  const statistik = [
    { ikon: IKON.buku, v: "4", l: "Modul inti" },
    { ikon: IKON.orang, v: "24/7", l: "Akses online" },
    { ikon: IKON.perisai, v: "100%", l: "Data terjaga" },
  ];

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
        {/* Tumpukan buku dekoratif (seragam dengan hero panel anggota). */}
        <div aria-hidden className="pointer-events-none absolute right-0 top-24 opacity-25">
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

        <div className="relative flex-1 flex flex-col justify-center">
          <span className="anim-naik inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-semibold w-fit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={IKON.daun} />
            </svg>
            Sistem perpustakaan terpadu
          </span>
          <h2 className="anim-naik anim-naik-1 mt-5 text-3xl xl:text-4xl font-bold leading-snug tracking-tight">
            Selamat datang kembali di sistem{" "}
            <span className="text-emerald-200">perpustakaan</span>
          </h2>
          <p className="anim-naik anim-naik-2 mt-4 text-white/80 max-w-md leading-relaxed">
            Masuk untuk mengelola katalog, sirkulasi, dan laporan — atau pantau
            pinjaman pribadi sebagai anggota.
          </p>
          <div className="anim-naik anim-naik-3 mt-8 flex flex-wrap gap-x-9 gap-y-4">
            {statistik.map((s) => (
              <div key={s.l} className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={s.ikon} />
                  </svg>
                </span>
                <div className="leading-tight">
                  <div className="text-xl font-extrabold">{s.v}</div>
                  <div className="text-xs text-white/70">{s.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-4 text-sm text-white/75">
          <span aria-hidden className="h-px w-12 bg-white/40" />
          Membaca hari ini, membangun masa depan
        </div>
      </div>

      {/* Panel kanan: form — overflow-hidden mengklip blob dekoratif yang
          menjorok keluar viewport (penyebab scrollbar horizontal & vertikal). */}
      <div className="relative flex items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-10 pendek:py-8">
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

          <div className="card p-7 shadow-[var(--sh-3)] sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl grad-brand text-white shadow-[var(--sh-2)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={IKON.buku} />
                </svg>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">
                Portal {sistem.nama}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Masuk</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Gunakan akun anggota atau admin Anda.
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

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <InputIkon
                  id="email"
                  ikon={IKON.mail}
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="sandi">Sandi</label>
                <InputSandi
                  id="sandi"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={proses}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={IKON.masuk} />
                </svg>
                {proses ? "Memeriksa…" : "Masuk"}
              </button>
            </form>

            <div className="my-5 h-px bg-[var(--border)]" />

            {bolehDaftar ? (
              <p className="text-center text-sm text-[var(--muted)]">
                Belum punya akun?{" "}
                <Link href="/register" className="font-semibold text-[var(--brand)] hover:underline">
                  Daftar sebagai anggota
                </Link>
              </p>
            ) : (
              <p className="text-center text-sm text-[var(--muted)]">
                Pendaftaran anggota sedang ditutup.
              </p>
            )}
          </div>

          {/* Akun demo — akses cepat untuk uji coba. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <span>Akun demo:</span>
            <button
              type="button"
              className="btn btn-ghost !py-1 !px-2.5 !text-xs font-mono"
              onClick={() => isiDemo("admin@perpus.id", "admin123")}
            >
              admin@perpus.id
            </button>
            <button
              type="button"
              className="btn btn-ghost !py-1 !px-2.5 !text-xs font-mono"
              onClick={() => isiDemo("user@perpus.id", "user123")}
            >
              user@perpus.id
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
