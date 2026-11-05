"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { ambilKebijakan, tujuanRumah } from "@/lib/akses";
import { useSistem } from "@/lib/sistem";
import { InputIkon, InputSandi } from "@/components/ui";
import { keThumbnailFoto } from "@/lib/foto";

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
  const bolehDaftar = useBoleh("akun.daftar");

  const [step, setStep] = useState<1 | 2>(1);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [telepon, setTelepon] = useState("");
  const [jenis, setJenis] = useState<"Pelajar" | "Mahasiswa" | "Umum">("Umum");
  const [alamat, setAlamat] = useState("");
  const [sandi, setSandi] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pendaftaranBerhasil, setPendaftaranBerhasil] = useState(false);
  const [proses, setProses] = useState(false);

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    const hasil = await keThumbnailFoto(file);

    if (!hasil.ok || !hasil.dataUrl) {
      setPesan(hasil.pesan ?? "Foto tidak bisa dibaca — coba berkas lain.");
      return;
    }

    setFoto(hasil.dataUrl);
    setPesan(null);
  }

  const keunggulan = [
    {
      ikon: IKON.buku,
      judul: "Koleksi buku lengkap",
      sub: "Ribuan judul buku dari berbagai kategori",
    },
    {
      ikon: IKON.stopwatch,
      judul: "Peminjaman mudah",
      sub: "Kelola pinjaman buku secara online",
    },
    {
      ikon: IKON.perangkat,
      judul: "Akses kapan saja",
      sub: "Bisa diakses dari mana saja, kapan saja",
    },
    {
      ikon: IKON.perisai,
      judul: "Aman dan terpercaya",
      sub: "Data Anda selalu terlindungi",
    },
  ];

  if (!bolehDaftar) {
    return (
      <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-white p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-teal-100/50 blur-3xl"
        />
        <div className="card relative z-10 w-full max-w-md border border-slate-300 bg-white p-8 text-center shadow-xl ring-1 ring-slate-200/70">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-500">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h1 className="mt-4 text-xl font-bold">Pendaftaran Ditutup</h1>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Pendaftaran anggota baru sedang ditutup oleh kebijakan akses
            perpustakaan. Silakan hubungi pustakawan untuk membuat akun.
          </p>

          <Link href="/login" className="btn btn-primary mt-6">
            Ke Halaman Masuk
          </Link>
        </div>
      </div>
    );
  }

  function lanjutKeSandi() {
    setPesan(null);
    setPendaftaranBerhasil(false);

    if (nama.trim().length < 3) {
      setPesan("Nama minimal 3 karakter.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setPesan("Format email tidak valid.");
      return;
    }

    if (!telepon.trim() || telepon.trim().length > 40) {
      setPesan("Nomor telepon wajib diisi (maksimal 40 karakter).");
      return;
    }

    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPesan(null);
    setPendaftaranBerhasil(false);

    if (nama.trim().length < 3) {
      setPesan("Nama minimal 3 karakter.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setPesan("Format email tidak valid.");
      return;
    }

    if (sandi.length < 6) {
      setPesan("Kata sandi minimal 6 karakter.");
      return;
    }

    if (sandi !== ulangi) {
      setPesan("Konfirmasi kata sandi tidak sama.");
      return;
    }

    if (!setuju) {
      setPesan(
        "Anda harus menyetujui syarat keanggotaan dan kebijakan privasi."
      );
      return;
    }

    if (!telepon.trim() || telepon.trim().length > 40) {
      setPesan("Nomor telepon wajib diisi (maksimal 40 karakter).");
      return;
    }

    setProses(true);

    let res: Awaited<ReturnType<typeof daftar>>;

    try {
      res = await daftar({
        nama: nama.trim(),
        email: email.trim().toLowerCase(),
        sandi,
        setuju: true,
        anggota: {
          nama: nama.trim(),
          email: email.trim().toLowerCase(),
          telepon: telepon.trim(),
          alamat: alamat.trim(),
          jenis,
          foto,
        },
      });
    } catch {
      setPesan(
        "Pendaftaran gagal karena gangguan jaringan. Periksa koneksi lalu coba kembali."
      );
      setProses(false);
      return;
    }

    setProses(false);

    if (!res.ok) {
      setPesan(res.pesan);
      return;
    }

    if (!res.pengguna) {
      setPendaftaranBerhasil(true);
      setPesan(res.pesan);
      return;
    }

    router.replace(tujuanRumah(ambilKebijakan(), "user"));
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white px-3 py-4 sm:px-6 sm:py-6">
      {/* Background putih seperti halaman login */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white"
      />

      {/* Dekorasi gradasi lembut */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-teal-100/50 blur-3xl"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-100/40 blur-3xl"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute right-1/3 top-1/3 h-64 w-64 rounded-full bg-cyan-50/70 blur-3xl"
      />

      {/* Card utama */}
      <section className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-300 bg-white shadow-[0_25px_70px_-20px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/70 lg:min-h-[820px] lg:grid-cols-[1.04fr_0.96fr] lg:grid-rows-1">
        {/* Tombol tutup */}
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Tutup pendaftaran dan kembali ke beranda"
          className="absolute right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Panel branding */}
        <div className="order-2 relative flex min-h-[420px] flex-col overflow-hidden bg-gradient-to-br from-[#004b41] via-[#003f37] to-[#002d28] p-6 text-white sm:p-9 lg:min-h-0 lg:p-10 xl:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:22px_22px]"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-slate-900/25 blur-3xl"
          />

          <svg
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-12 h-64 w-64 rotate-12 text-white/10"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d={IKON.daun} />
          </svg>

          {/* Ilustrasi buku */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-28 opacity-25"
          >
            <svg width="300" height="190" viewBox="0 0 280 170" fill="none">
              <rect x="40" y="112" width="210" height="24" rx="8" fill="white" />
              <rect
                x="58"
                y="84"
                width="180"
                height="24"
                rx="8"
                fill="white"
                opacity="0.85"
              />
              <rect
                x="80"
                y="56"
                width="140"
                height="24"
                rx="8"
                fill="white"
                opacity="0.7"
              />
              <circle cx="238" cy="44" r="22" fill="white" opacity="0.45" />
              <path
                d="M238 30c-8 4-12 10-12 18 8 0 14-6 12-18z"
                fill="white"
                opacity="0.8"
              />
            </svg>
          </div>

          <Link href="/" className="group relative flex w-fit items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur transition-transform duration-200 group-hover:scale-105">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={IKON.buku} />
              </svg>
            </div>

            <div className="leading-tight">
              <span className="block text-lg font-bold">{sistem.nama}</span>
              <span className="block text-xs text-white/70">
                Kembali ke beranda →
              </span>
            </div>
          </Link>

          <div className="relative my-8 flex-1 lg:my-0 lg:flex lg:flex-col lg:justify-center">
            <span className="anim-naik inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={IKON.orang} />
              </svg>
              Pendaftaran Anggota
            </span>

            <h2 className="anim-naik anim-naik-1 mt-5 text-3xl font-bold leading-snug tracking-tight xl:text-4xl">
              Bergabung dengan{" "}
              <span className="text-emerald-200">
                perpustakaan digital
              </span>{" "}
              kami
            </h2>

            <p className="anim-naik anim-naik-2 mt-4 max-w-md leading-relaxed text-white/80">
              Nikmati kemudahan akses buku, pinjaman, dan berbagai fasilitas
              lainnya dengan menjadi anggota {sistem.nama}.
            </p>

            <ul className="anim-naik anim-naik-2 mt-7 space-y-4">
              {keunggulan.map((k) => (
                <li key={k.judul} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
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

          <div className="relative mt-2 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur-md lg:mt-8">
            <span className="mt-0.5 shrink-0 text-emerald-200">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={IKON.daun} />
              </svg>
            </span>

            <p className="italic leading-relaxed text-white/85">
              “Buku adalah jendela dunia, dan keanggotaan ini adalah langkah
              pertama menuju dunia yang lebih luas.”
            </p>
          </div>
        </div>

        {/* Panel form */}
        <div className="order-1 relative flex items-center justify-center overflow-hidden border-b border-slate-200 bg-white px-5 py-7 sm:px-9 sm:py-9 lg:border-b-0 lg:border-l lg:border-slate-200 lg:px-10 lg:py-8 xl:px-11">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[var(--brand-soft)]/60 blur-2xl"
          />

          <div className="anim-naik relative w-full max-w-xl">
            {/* Logo mobile */}
            <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
              <div className="grad-brand grid h-10 w-10 place-items-center rounded-xl text-white shadow-[var(--sh-2)]">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={IKON.buku} />
                </svg>
              </div>

              <span className="text-lg font-bold">{sistem.nama}</span>
            </div>

            <div className="w-full">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00665c] text-white">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d={IKON.orang} />
                    </svg>
                  </span>

                  <span className="text-xs font-bold uppercase tracking-wider text-[#00665c]">
                    Daftar Anggota
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>
                    Langkah <span className="text-[#00665c]">{step}</span> dari
                    2
                  </span>

                  <span className="flex gap-1.5" aria-hidden="true">
                    <span
                      className={`h-2 w-6 rounded-full ${
                        step === 1 ? "bg-[#00665c]" : "bg-emerald-200"
                      }`}
                    />
                    <span
                      className={`h-2 w-6 rounded-full ${
                        step === 2 ? "bg-[#00665c]" : "bg-slate-200"
                      }`}
                    />
                  </span>
                </div>
              </div>

              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950">
                Daftar Akun Anggota
              </h1>

              <p className="mt-1 text-sm text-[var(--muted)]">
                Isi data diri Anda untuk membuat akun {sistem.nama}.
              </p>

              {pesan && (
                <div
                  className={`mt-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium ${
                    pendaftaranBerhasil
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role={pendaftaranBerhasil ? "status" : "alert"}
                >
                  <svg
                    className="mt-0.5 shrink-0"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {pendaftaranBerhasil ? (
                      <path d="m5 12 4 4L19 6" />
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4M12 16h.01" />
                      </>
                    )}
                  </svg>

                  {pesan}
                </div>
              )}

              {/* Navigasi dua langkah */}
              <div className="mb-5 mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    if (step === 2) {
                      setPesan(null);
                      setStep(1);
                    }
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    step === 1
                      ? "bg-white text-[#00665c] shadow-sm"
                      : "text-slate-400"
                  }`}
                  aria-current={step === 1 ? "step" : undefined}
                >
                  1. Data Diri
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (step === 2) setPesan(null);
                  }}
                  disabled={step === 1}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    step === 2
                      ? "bg-white text-[#00665c] shadow-sm"
                      : "text-slate-400"
                  }`}
                  aria-current={step === 2 ? "step" : undefined}
                >
                  2. Kata Sandi
                </button>
              </div>

              <form onSubmit={submit} className="mt-4 space-y-4 pendek:space-y-3">
                {step === 1 ? (
                  <div className="space-y-4 pendek:space-y-3" key="data-diri">
                    {/* Foto profil */}
                    <div>
                      <span className="label">
                        Foto Profil{" "}
                        <span className="font-normal text-[var(--muted)]">
                          (opsional)
                        </span>
                      </span>

                      <div className="mt-1 flex items-center gap-4">
                        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand)] pendek:h-14 pendek:w-14">
                          {foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={foto}
                              alt="Pratinjau foto profil"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <svg
                              width="26"
                              height="26"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d={IKON.orang} />
                            </svg>
                          )}
                        </span>

                        <div className="flex flex-wrap gap-2">
                          <label className="btn btn-ghost !py-1.5 cursor-pointer">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>

                            {foto ? "Ganti Foto" : "Pilih Foto"}

                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={pilihFoto}
                            />
                          </label>

                          {foto && (
                            <button
                              type="button"
                              className="btn btn-ghost !py-1.5 text-rose-600"
                              onClick={() => setFoto(null)}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-[var(--muted)]">
                        JPG/PNG maks 5 MB — otomatis dikecilkan.
                      </p>
                    </div>

                    <div>
                      <label className="label" htmlFor="nama">
                        Nama Lengkap
                      </label>
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
                      <label className="label" htmlFor="email">
                        Email
                      </label>
                      <InputIkon
                        id="email"
                        ikon={IKON.mail}
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contoh@email.com"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <label className="label" htmlFor="telepon">
                          Nomor Telepon
                        </label>
                        <InputIkon
                          id="telepon"
                          ikon={IKON.stopwatch}
                          type="tel"
                          autoComplete="tel"
                          maxLength={40}
                          value={telepon}
                          onChange={(e) => setTelepon(e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          required
                        />
                      </div>

                      <div className="min-w-0">
                        <label className="label" htmlFor="jenis">
                          Jenis Anggota
                        </label>
                        <select
                          id="jenis"
                          className="input"
                          value={jenis}
                          onChange={(e) =>
                            setJenis(e.target.value as typeof jenis)
                          }
                        >
                          <option value="Pelajar">Pelajar</option>
                          <option value="Mahasiswa">Mahasiswa</option>
                          <option value="Umum">Umum</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label" htmlFor="alamat">
                        Alamat{" "}
                        <span className="font-normal text-[var(--muted)]">
                          (opsional)
                        </span>
                      </label>
                      <textarea
                        id="alamat"
                        className="input"
                        rows={2}
                        maxLength={500}
                        autoComplete="street-address"
                        value={alamat}
                        onChange={(e) => setAlamat(e.target.value)}
                        placeholder="Alamat tempat tinggal"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={lanjutKeSandi}
                      className="btn btn-primary flex w-full items-center justify-center gap-2 !py-2.5"
                    >
                      Lanjut ke Sandi
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d={IKON.panah} />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 pendek:space-y-3" key="buat-sandi">
                    <div className="rounded-xl border border-[var(--border)] bg-slate-50/80 p-3 text-sm">
                      <p className="font-semibold text-[var(--foreground)]">
                        Data anggota
                      </p>

                      <p className="mt-1 text-[var(--muted)]">
                        {nama} · {email}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setPesan(null);
                          setStep(1);
                        }}
                        className="mt-1 font-semibold text-[var(--brand)] hover:underline"
                      >
                        Ubah data diri
                      </button>
                    </div>

                    <div>
                      <label className="label" htmlFor="sandi">
                        Buat Sandi
                      </label>
                      <InputSandi
                        id="sandi"
                        value={sandi}
                        onChange={(e) => setSandi(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        maxLength={200}
                        placeholder="Minimal 6 karakter"
                        required
                      />
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Gunakan minimal 6 karakter.
                      </p>
                    </div>

                    <div>
                      <label className="label" htmlFor="ulangi">
                        Ulangi Sandi
                      </label>
                      <InputSandi
                        id="ulangi"
                        value={ulangi}
                        onChange={(e) => setUlangi(e.target.value)}
                        autoComplete="new-password"
                        minLength={6}
                        maxLength={200}
                        placeholder="Ketik ulang sandi"
                        required
                      />
                    </div>

                    <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[var(--brand)]"
                        checked={setuju}
                        onChange={(e) => setSetuju(e.target.checked)}
                        required
                      />
                      <span>
                        Saya menyetujui syarat keanggotaan dan kebijakan privasi,
                        serta pemrosesan data untuk keperluan layanan perpustakaan.
                      </span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPesan(null);
                          setStep(1);
                        }}
                        className="btn btn-ghost w-full !py-2.5"
                      >
                        Kembali
                      </button>

                      <button
                        type="submit"
                        className="btn btn-primary flex w-full items-center justify-center gap-2 !py-2.5"
                        disabled={proses}
                      >
                        {proses ? "Mendaftarkan…" : "Daftar Sekarang"}

                        {!proses && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d={IKON.panah} />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>

              <p className="mt-4 text-center text-sm text-[var(--muted)] pendek:mt-3">
                Sudah punya akun?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--brand)] hover:underline"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes registerPopupEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: no-preference) {
          main > section {
            animation: registerPopupEnter 0.38s ease-out both;
          }
        }
      `}</style>
    </main>
  );
}
