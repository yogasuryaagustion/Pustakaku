
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { bolehRute, peranEfektif, tujuanRumah, useKebijakan } from "@/lib/akses";
import { useSistem } from "@/lib/sistem";
import { InputIkon, InputSandi } from "@/components/ui";

const IKON = {
  buku: "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  masuk: "M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4 M10 17l5-5-5-5 M15 12H3",
  orang: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  perisai: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  daun: "M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6",
};

function Ikon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { masuk } = useAuth();
  const kebijakan = useKebijakan();
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

    try {
      const res = await masuk(email, sandi);

      if (!res.ok) {
        setPesan(res.pesan);
        return;
      }

      const peran = peranEfektif(res.pengguna?.peran);
      const tujuan =
        dari && bolehRute(kebijakan, peran, dari)
          ? dari
          : tujuanRumah(kebijakan, peran);

      router.replace(tujuan);
    } catch {
      setPesan("Terjadi kesalahan saat masuk. Silakan coba lagi.");
    } finally {
      setProses(false);
    }
  }

  function isiDemo(a: string, b: string) {
    setEmail(a);
    setSandi(b);
    setPesan(null);
  }

  const statistik = [
    { ikon: IKON.buku, angka: "4", label: "Modul inti" },
    { ikon: IKON.orang, angka: "24/7", label: "Akses online" },
    { ikon: IKON.perisai, angka: "100%", label: "Data terjaga" },
  ];

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white px-3 py-4 sm:px-6 sm:py-6">
      {/* Dekorasi latar putih dengan aksen teal */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-teal-100/60 blur-3xl"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-100/60 blur-3xl"
      />

      {/* Card utama */}
      <section className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-300 bg-white shadow-[0_25px_70px_-20px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/70 lg:min-h-[700px] lg:grid-cols-2">

        {/* Panel informasi kiri */}
        <aside className="relative flex min-h-[300px] flex-col overflow-hidden bg-gradient-to-br from-[#00463d] via-[#00574d] to-[#006b5c] p-6 text-white sm:p-9 lg:min-h-0 lg:p-11">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-slate-900/20 blur-3xl"
          />

          <svg
            aria-hidden
            className="pointer-events-none absolute -bottom-12 -left-10 h-56 w-56 rotate-12 text-white/10"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d={IKON.daun} />
          </svg>

          <Link
            href="/"
            className="relative flex w-fit items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Ikon path={IKON.buku} size={25} />
            </span>

            <span className="leading-tight">
              <span className="block text-lg font-extrabold">
                {sistem.nama}
              </span>
              <span className="mt-1 block text-xs text-white/75">
                Kembali ke beranda →
              </span>
            </span>
          </Link>

          {/* Ilustrasi buku */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-2 top-20 hidden opacity-20 sm:block lg:right-5 lg:top-24"
          >
            <svg width="220" height="150" viewBox="0 0 280 170" fill="none">
              <rect x="40" y="112" width="210" height="24" rx="8" fill="white" />
              <rect x="58" y="84" width="180" height="24" rx="8" fill="white" opacity=".85" />
              <rect x="80" y="56" width="140" height="24" rx="8" fill="white" opacity=".7" />
              <circle cx="238" cy="44" r="22" fill="white" opacity=".45" />
              <path d="M238 30c-8 4-12 10-12 18 8 0 14-6 12-18z" fill="white" opacity=".8" />
            </svg>
          </div>

          <div className="relative my-8 flex-1 sm:my-10 lg:my-0 lg:flex lg:flex-col lg:justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur">
              <Ikon path={IKON.daun} size={14} />
              Sistem perpustakaan terpadu
            </span>

            <h1 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Selamat datang kembali di sistem{" "}
              <span className="text-emerald-200">perpustakaan</span>
            </h1>

            <p className="mt-4 max-w-md text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
              Masuk untuk mengelola katalog, sirkulasi, dan laporan — atau
              pantau pinjaman pribadi sebagai anggota.
            </p>

            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-4 sm:mt-9">
              {statistik.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
                    <Ikon path={item.ikon} size={19} />
                  </span>

                  <span className="leading-tight">
                    <span className="block text-xl font-extrabold">
                      {item.angka}
                    </span>
                    <span className="block text-xs text-white/75">
                      {item.label}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-3 text-xs text-white/75 sm:text-sm">
            <span aria-hidden className="h-px w-10 bg-white/50" />
            Membaca hari ini, membangun masa depan
          </div>
        </aside>

        {/* Panel form kanan */}
        <section className="relative flex items-center justify-center overflow-hidden border-l border-slate-200 bg-white px-5 py-8 sm:px-9 sm:py-10 lg:px-11">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-teal-50 blur-3xl"
          />

          <div className="relative w-full max-w-md animate-[authEnter_.45s_ease-out_both]">
            <div className="mb-7 flex items-center gap-3">
              <span className="grad-brand grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-[var(--sh-2)]">
                <Ikon path={IKON.buku} size={24} />
              </span>

              <span className="text-xs font-bold uppercase tracking-[.14em] text-teal-800">
                Portal {sistem.nama}
              </span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
              Masuk ke Akun Anda
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Masuk untuk melanjutkan ke portal perpustakaan digital.
            </p>

            {pesan && (
              <div
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700"
                role="alert"
              >
                <span className="mt-0.5 shrink-0">
                  <Ikon
                    path="M12 8v4m0 4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z"
                    size={17}
                  />
                </span>
                <span>{pesan}</span>
              </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>

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
                <label className="label" htmlFor="sandi">
                  Sandi
                </label>

                <InputSandi
                  id="sandi"
                  autoComplete="current-password"
                  placeholder="Masukkan sandi"
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary flex w-full items-center justify-center gap-2 !py-3"
                disabled={proses}
              >
                {proses ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Memeriksa…
                  </>
                ) : (
                  <>
                    <Ikon path={IKON.masuk} size={17} />
                    Masuk
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
              <input
                id="ingat-login"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 accent-teal-700"
              />

              <label htmlFor="ingat-login">
                Ingat saya di perangkat ini
              </label>
            </div>

            <div className="my-5 h-px bg-slate-200" />

            {bolehDaftar ? (
              <p className="text-center text-sm text-slate-600">
                Belum memiliki akun?{" "}
                <Link
                  href="/register"
                  className="font-bold text-teal-800 transition-colors hover:underline"
                >
                  Daftar sebagai anggota
                </Link>
              </p>
            ) : (
              <p className="text-center text-sm text-slate-600">
                Pendaftaran anggota sedang ditutup.
              </p>
            )}

            <div className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 p-3.5 shadow-sm">
              <p className="mb-2 text-center text-xs font-semibold text-slate-600">
                Akun demo untuk uji coba
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-1.5 !text-xs font-mono"
                  onClick={() => isiDemo("admin@perpus.id", "Latansa2717")}
                >
                  admin@perpus.id
                </button>

                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-1.5 !text-xs font-mono"
                  onClick={() => isiDemo("user@perpus.id", "user123")}
                >
                  user@perpus.id
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>

      <style jsx global>{`
        @keyframes authEnter {
          from {
            opacity: 0;
            transform: translateX(18px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-\\[authEnter_\\.45s_ease-out_both\\] {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <LoginForm />
    </Suspense>
  );
}
