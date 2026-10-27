"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Reveal, Angka, SampulBuku } from "@/components/ui";
import { useBoleh } from "@/lib/auth";
import { SEED_BUKU, SEED_ANGGOTA, SEED_PEMINJAMAN } from "@/lib/seed";
import { useSistem, type SistemPengaturan } from "@/lib/sistem";

// Halaman publik — tampil tanpa sidebar (lihat PUBLIK di AppShell).
// Konten "real": diambil langsung dari data seed (buku, anggota, peminjaman).
// Setiap section berukuran minimal setinggi layar (min-h-[100svh]) dengan
// konten di tengah, latar gradien multi-stop halus, dan scroll anchor yang
// halus diatur di globals.css (scroll-behavior: smooth).

const NAVLINK = [
  { href: "/#beranda", label: "Beranda" },
  { href: "/#fitur", label: "Fitur" },
  { href: "/#koleksi", label: "Koleksi" },
  { href: "/#tentang", label: "Cara Kerja" },
  { href: "/#testimoni", label: "Testimoni" },
  { href: "/#faq", label: "FAQ" },
];

// Gradien kartu/sampul/ikon/avatar diambil dari CSS variable --g1..--g6
// (dihasilkan sistem tema di src/lib/theme.ts) — otomatis mengikuti warna
// dasar yang dipilih admin di /admin/pengaturan.
const grad = (i: number) => ({
  backgroundImage: `var(--g${(i % 6) + 1})`,
});

const IKON_BUKU =
  "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z M14 3v5h5";

// Daun dekoratif footer — seragam dengan panel branding halaman masuk.
const IKON_DAUN =
  "M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6";

// Glyph media sosial footer — satu path stroke per ikon, senada ikon lain.
const SOSIAL = [
  { label: "Facebook", d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" },
  {
    label: "Instagram",
    d: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z M17.5 6.5h.01",
  },
  {
    label: "WhatsApp",
    d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  },
  { label: "X (Twitter)", d: "M4 4l16 16M20 4L4 20" },
];

const rupiahRb = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

// Kartu buku deret "Koleksi Populer" — dipakai di marquee horizontal
// (deret diduplikasi di markup agar putaran loop mulus, lihat .marquee-*).
type BukuPilihan = (typeof SEED_BUKU)[number] & { pinjam: number };
function KartuKoleksi({ b }: { b: BukuPilihan }) {
  return (
    // Margin kanan seragam di SEMUA kartu (termasuk terakhir salinan):
    // lebar track = 2 × N × (190+16) sehingga translateX(-50%) = tepat
    // satu salinan penuh → putaran loop mulus, tanpa jeda maupun lompat.
    <div className="card card-raised w-[190px] shrink-0 overflow-hidden" style={{ marginRight: "1rem" }}>
      <SampulBuku buku={b} className="h-32 w-full" rounded="" />
      <div className="p-3">
        <div className="font-semibold text-sm leading-tight line-clamp-2">{b.judul}</div>
        <div className="text-xs text-[var(--muted)] truncate">{b.penulis}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[var(--muted)]">{b.kategori}</span>
          <span className="text-[11px] font-semibold rounded-full bg-[var(--brand-soft)] text-[var(--brand)] px-2 py-0.5">
            {b.pinjam > 0 ? `${b.pinjam}x dipinjam` : "Baru"}
          </span>
        </div>
      </div>
    </div>
  );
}

const fiturRincian = (s: SistemPengaturan) => [
  {
    judul: "Katalog Digital",
    teks: "Jelajahi seluruh koleksi dengan pencarian cerdas, filter kategori, dan cek ketersediaan eksemplar secara langsung.",
    ikon: "M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z M14 3v5h5",
  },
  {
    judul: "Peminjaman Online",
    teks: `Ajukan peminjaman kapan saja dengan memilih tanggal pinjam. Jatuh tempo dihitung otomatis ${s.lamaPinjam} hari.`,
    ikon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    judul: "Perpanjangan & Denda",
    teks: `Perpanjang pinjaman dari panel Anda. Denda keterlambatan ${rupiahRb(s.dendaPerHari)}/hari dihitung otomatis bila terlambat.`,
    ikon: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
  },
  {
    judul: "Panel Anggota Pribadi",
    teks: "Pantau pinjaman aktif, riwayat, denda, dan kelola profil serta kata sandi Anda dalam satu portal.",
    ikon: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 10a4 4 0 100-8 4 4 0 000 8",
  },
  {
    judul: "Panel Pustakawan",
    teks: "Kelola buku, anggota, sirkulasi, akun admin, dan reset sandi — terpisah rapi dari portal anggota.",
    ikon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  },
  {
    judul: "Laporan Fleksibel",
    teks: "Statistik pengunjung dan export CSV harian, mingguan, bulanan, maupun tahunan — siap dibuka di Excel.",
    ikon: "M4 20h16M7 16V9M12 16V5M17 16v-4",
  },
];

const TESTIMONI = [
  {
    nama: "Budi Santoso",
    peran: "Anggota · Pelajar",
    isi: "Portal anggota memudahkan saya memantau pinjaman tanpa harus datang ke perpustakaan. Jatuh tempo selalu jelas.",
  },
  {
    nama: "Siti Aminah",
    peran: "Anggota · Umum",
    isi: "Fitur perpanjangan sangat praktis. Denda dihitung otomatis jadi tidak ada lagi perhitungan manual yang bikin bingung.",
  },
  {
    nama: "Agus Wijaya",
    peran: "Pustakawan",
    isi: "Panel admin membuat sirkulasi buku tercatat rapi. Laporan bulanan tinggal unduh, hemat waktu sekali.",
  },
  {
    nama: "Rina Kartika",
    peran: "Anggota · Mahasiswa",
    isi: "Cari judul di katalog cepat dan langsung kelihatan stoknya. Tidak perlu antre bertanya di meja pustaka lagi.",
  },
  {
    nama: "Dedi Prasetyo",
    peran: "Guru",
    isi: "Denda otomatis membuat siswa lebih disiplin mengembalikan buku. Rekap peminjaman kelas juga rapi.",
  },
  {
    nama: "Nurhayati",
    peran: "Anggota · Umum",
    isi: "Bisa memperpanjang pinjaman dari HP tanpa harus ke perpustakaan. Praktis sekali untuk ibu bekerja.",
  },
  {
    nama: "Dr. Ratna Sari",
    peran: "Dosen",
    isi: "Koleksi lengkap dan pencarian berdasarkan kategori sangat membantu riset serta kebutuhan pengajaran saya.",
  },
  {
    nama: "Fajar Nugroho",
    peran: "Anggota · Karyawan",
    isi: "Panel anggota sederhana tapi lengkap: riwayat, jatuh tempo, dan denda jelas dalam satu layar.",
  },
  {
    nama: "Maya Puspita",
    peran: "Pustakawan",
    isi: "Migrasi dari catatan manual ke sistem ini mulus. Statistik kunjungan bulanan kini tinggal sekali klik.",
  },
];

// Grup testimoni ditampilkan 3 kartu per halaman; halaman berganti berkala.
const JUMLAH_HAL_TESTIMONI = Math.ceil(TESTIMONI.length / 3);

const faqRincian = (s: SistemPengaturan) => [
  {
    q: "Bagaimana cara mendaftar sebagai anggota?",
    a: "Klik tombol Daftar, isi nama, email, dan sandi. Kartu anggota digital dibuat otomatis dan Anda langsung bisa meminjam buku.",
  },
  {
    q: "Berapa lama durasi peminjaman buku?",
    a: `Setiap peminjaman berlaku ${s.lamaPinjam} hari sejak tanggal pinjam. Anda dapat memilih tanggal peminjaman saat mengajukan.`,
  },
  {
    q: "Bagaimana jika terlambat mengembalikan?",
    a: `Denda keterlambatan dihitung otomatis ${rupiahRb(s.dendaPerHari)} per hari dan tampil di panel Anda. Kembalikan buku ke pustakawan untuk menyelesaikan.`,
  },
  {
    q: "Apakah data saya aman?",
    a: "Seluruh data perpustakaan tersimpan di database Supabase (PostgreSQL) milik perpustakaan — bukan di browser ini. Kata sandi dienkripsi oleh Supabase Auth dan tidak pernah disimpan dalam bentuk teks biasa.",
  },
];

// Pindah ke section dengan konten TEPAT di pusat layar: scrollIntoView
// block:"center" mendaratkan tengah section (== tengah konten, karena semua
// section justify-center) di tengah viewport — pas untuk section setinggi
// viewport maupun yang lebih tinggi. Menggantikan lompatan anchor default
// yang hanya mendaratkan ujung section di ujung layar.
function keSection(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return; // biarkan alur normal (mis. belum di landing page)
  e.preventDefault();
  el.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  });
  // Sinkronkan URL tanpa memicu scroll kedua.
  window.history.replaceState(null, "", `/#${id}`);
}

export default function LandingPage() {
  const sistem = useSistem();
  // RBAC visual: izin akun.daftar mengatur apakah tombol & ajakan pendaftaran
  // tampil; /register sendiri ikut menutup lewat guard rute AppShell.
  const bolehDaftar = useBoleh("akun.daftar");

  // Navbar "melayang" + scroll-spy: state `turun` menguatkan latar setelah
  // scroll; `aktifSection` menyorot link nav mengikuti section yang sedang
  // terbaca (section terakhir yang melewati garis 40% viewport atas).
  const [turun, setTurun] = useState(false);
  const [aktifSection, setAktifSection] = useState<string | null>(null);
  // Newsletter footer (demo tanpa backend) + tombol kembali ke atas
  // yang muncul setelah digulir — lihat pratinjau footer di rancangan.
  const [emailLangganan, setEmailLangganan] = useState("");
  const [langgananTerkirim, setLanggananTerkirim] = useState(false);
  const [tampilKeAtas, setTampilKeAtas] = useState(false);

  // Testimoni berganti berkala: tiap 6 detik pindah ke grup berikutnya.
  // Hover pada deretan kartu menahan rotasi agar sempat dibaca;
  // prefers-reduced-motion mematikan rotasi (dots manual tetap tersedia).
  const [halTestimoni, setHalTestimoni] = useState(0);
  const testimoniDijeda = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!testimoniDijeda.current) {
        setHalTestimoni((h) => (h + 1) % JUMLAH_HAL_TESTIMONI);
      }
    }, 6000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    // Urutan section mengikuti urutan nav; id "tentang" = "Cara Kerja".
    const SECTIONS = ["beranda", "fitur", "koleksi", "tentang", "testimoni", "faq"];
    const onScroll = () => {
      setTurun(window.scrollY > 8);
      setTampilKeAtas(window.scrollY > 480);
      const garis = window.innerHeight * 0.4;
      let kini: string | null = null;
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= garis) kini = id;
      }
      setAktifSection(kini);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Angka "real" dari data seed.
  const totalJudul = SEED_BUKU.length;
  const totalEksemplar = SEED_BUKU.reduce((s, b) => s + b.stok, 0);
  const anggotaAktif = SEED_ANGGOTA.filter((a) => a.aktif).length;

  // Buku populer berdasarkan jumlah peminjaman seed, diambil 6 teratas.
  const hitungPinjam: Record<string, number> = {};
  SEED_PEMINJAMAN.forEach((p) => {
    hitungPinjam[p.bukuId] = (hitungPinjam[p.bukuId] || 0) + 1;
  });
  const bukuPilihan = SEED_BUKU.slice()
    .map((b) => ({ ...b, pinjam: hitungPinjam[b.id] || 0 }))
    .sort((a, b) => b.pinjam - a.pinjam || a.judul.localeCompare(b.judul))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Navbar publik */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 border-b ${
          turun
            ? "border-[var(--border)] bg-white/85 backdrop-blur-xl shadow-[var(--sh-2)]"
            : "border-transparent bg-white/70 backdrop-blur-md"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg grad-brand text-white grid place-items-center shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={IKON_BUKU} />
              </svg>
            </div>
            <span className="font-bold text-[15px]">{sistem.nama}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
            {NAVLINK.map((n) => {
              // Link section (/#fitur, dst.) ikut scroll-spy; link rute
              // (/katalog) tidak punya section — hanya hover biasa.
              const id = n.href.split("#")[1] ?? null;
              const aktif = id !== null && id === aktifSection;
              return (
                <Link
                  key={n.label}
                  href={n.href}
                  aria-current={aktif ? "location" : undefined}
                  onClick={id ? (e) => keSection(e, id) : undefined}
                  className={`relative rounded-lg px-3 py-1.5 transition-colors ${
                    aktif ? "text-[var(--brand)]" : "hover:text-[var(--brand)]"
                  }`}
                >
                  {n.label}
                  {/* Garis penunjuk section aktif — melar halus saat berpindah. */}
                  <span
                    aria-hidden
                    className={`absolute inset-x-2.5 -bottom-1.5 h-0.5 rounded-full bg-[var(--brand)] transition-transform duration-300 ${
                      aktif ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {/* Pencarian katalog — ikon bundar, sesuai rancangan. */}
            <Link
              href="/katalog"
              aria-label="Cari di katalog"
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-white text-slate-600 transition-colors hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </Link>
            <Link href="/login" className="btn btn-primary !rounded-full !px-5">
              {bolehDaftar ? "Masuk / Daftar" : "Masuk"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — setinggi layar laptop; blob lembut + komposisi "membaca"
          (tumpukan sampul mengapung) menggantikan kartu preview lama. */}
      <section id="beranda" className="relative overflow-hidden min-h-[100svh] flex flex-col justify-center grad-hero">
        <div aria-hidden className="pointer-events-none absolute -top-32 right-[-12%] h-[36rem] w-[36rem] rounded-full grad-soft opacity-70 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-[-10%] h-96 w-96 rounded-full bg-[var(--brand-soft)] opacity-60 blur-3xl" />
        <div aria-hidden className="pola-kisi pointer-events-none absolute left-3 bottom-8 h-40 w-36 opacity-60" />
        <svg aria-hidden className="pointer-events-none absolute -top-8 right-1/3 h-36 w-36 rotate-12 text-[var(--brand)]/[0.07]" viewBox="0 0 24 24" fill="currentColor">
          <path d={IKON_DAUN} />
        </svg>
        <div className="relative max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center">
          {/* Kolom kiri: sapaan, ajakan, statistik */}
          <div>
            <span className="anim-naik inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/25 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[var(--sh-1)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--brand)" aria-hidden>
                <path d="M13 2L4.09 12.97c-.4.5-.16.05.4 1.05H11l-1 7.98 8.91-10.97c.4-.5.16-1.05-.4-1.05H13l1-7.98z" />
              </svg>
              Perpustakaan Digital Modern
            </span>
            <h1 className="anim-naik anim-naik-1 mt-5 text-4xl lg:text-[3.4rem] font-extrabold leading-[1.08] tracking-tight">
              Selamat Datang di
              <br />
              <span className="text-[var(--brand)]">{sistem.nama}</span>
            </h1>
            <p className="anim-naik anim-naik-2 mt-5 text-lg text-slate-600 max-w-xl leading-relaxed">
              Akses ribuan buku digital, kelola peminjaman, dan temukan
              pengetahuan baru kapan saja, di mana saja.
            </p>

            <div className="anim-naik anim-naik-3 mt-8 flex flex-wrap gap-3">
              <Link href="/katalog" className="btn btn-primary !rounded-xl !px-6 !py-3 gap-2 shadow-lg shadow-[var(--brand)]/25">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={IKON_BUKU} />
                </svg>
                Mulai Membaca
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/katalog"
                className="btn !rounded-xl !px-6 !py-3 gap-2 border border-[var(--brand)]/30 bg-white text-[var(--brand)] hover:bg-[var(--brand-soft)]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
                Pelajari Lebih Lanjut
              </Link>
            </div>

            {/* Statistik — angka nyata dari data seed, gaya ikon seperti rancangan. */}
            <div className="anim-naik anim-naik-3 mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              {[
                { v: totalJudul, l: "Koleksi Buku", ikon: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" },
                { v: anggotaAktif, l: "Anggota Aktif", ikon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 3a4 4 0 100 8 4 4 0 000-8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" },
                { v: totalEksemplar, l: "Eksemplar", ikon: "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5" },
              ].map((s) => (
                <div key={s.l} className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={s.ikon} />
                    </svg>
                  </span>
                  <div className="leading-tight">
                    <div className="text-xl font-extrabold">
                      <Angka nilai={s.v} />
                    </div>
                    <div className="text-xs text-[var(--muted)]">{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kolom kanan: tumpukan sampul + ubin ikon mengapung */}
          <div className="relative anim-naik anim-naik-2 min-h-[26rem]">
            {/* Lataran blob gradien; di atasnya tumpukan tiga sampul nyata. */}
            <div aria-hidden className="absolute inset-x-10 inset-y-6 rounded-[3rem] grad-soft opacity-70 blur-[2px]" />
            <div className="relative ml-auto mr-6 mt-14 flex w-fit items-end gap-4">
              <div className="-rotate-6 rounded-2xl shadow-[var(--sh-3)] ring-1 ring-black/5">
                <SampulBuku buku={bukuPilihan[0]} className="h-40 w-28" rounded="rounded-2xl" />
              </div>
              <div className="translate-y-5 rotate-2 rounded-2xl shadow-[var(--sh-4)] ring-1 ring-black/5">
                <SampulBuku buku={bukuPilihan[1]} className="h-48 w-32" rounded="rounded-2xl" />
              </div>
              <div className="rotate-6 rounded-2xl shadow-[var(--sh-3)] ring-1 ring-black/5">
                <SampulBuku buku={bukuPilihan[2]} className="h-40 w-28" rounded="rounded-2xl" />
              </div>

              {/* Ubin ikon mengapung (animasi .apung di globals.css). */}
              <span className="apung absolute -left-8 -top-10 grid h-14 w-14 place-items-center rounded-2xl bg-white text-[var(--brand)] shadow-[var(--sh-3)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
              </span>
              <span className="apung apung-1 absolute -right-10 top-8 grid h-14 w-14 place-items-center rounded-2xl bg-white text-[var(--brand)] shadow-[var(--sh-3)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 10L12 5 2 10l10 5 10-5z M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
                </svg>
              </span>
              <span className="apung apung-2 absolute -right-6 bottom-2 grid h-14 w-14 place-items-center rounded-2xl bg-white text-[var(--brand)] shadow-[var(--sh-3)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z M8 11h8 M8 15h5" />
                </svg>
              </span>
            </div>

            {/* Kalimat gaya tangan di jalur kiri, mengikuti rancangan. */}
            <div className="pointer-events-none absolute left-0 top-24 hidden w-28 -rotate-6 text-sm italic font-semibold leading-snug text-[var(--brand)] xl:block">
              Membaca adalah
              <br />
              investasi terbaik
            </div>
          </div>
        </div>
      </section>

      {/* Fitur — setinggi layar laptop */}
      <section id="fitur" className="max-w-6xl mx-auto px-5 py-20 min-h-[100svh] flex flex-col justify-center">
        <Reveal className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">Fitur Unggulan</span>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">Kenapa memilih {sistem.nama}?</h2>
          <p className="mt-3 text-slate-600">
            Dari penataan koleksi sampai penagihan denda — {sistem.nama} menutup seluruh alur kerja sirkulasi.
          </p>
        </Reveal>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {fiturRincian(sistem).map((f, i) => (
            <Reveal key={f.judul} delay={(i % 3) * 0.08}>
              <div className="group card card-raised h-full p-6">
                <div className="h-11 w-11 rounded-xl text-white grid place-items-center shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3" style={grad(i)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.ikon} />
                  </svg>
                </div>
                <h3 className="mt-4 font-bold">{f.judul}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{f.teks}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Koleksi populer — setinggi layar laptop, tint memudar ke latar */}
      <section id="koleksi" className="grad-koleksi">
        <div className="min-h-[100svh] w-full max-w-6xl mx-auto px-5 py-20 flex flex-col justify-center">
          <Reveal className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">Koleksi Populer</span>
              <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">Buku paling banyak dipinjam</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Berdasarkan aktivitas peminjaman terkini.</p>
            </div>
            <Link href="/katalog" className="group/link inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)] hover:gap-2 transition-all whitespace-nowrap">
              Lihat Semua <span className="transition-transform group-hover/link:translate-x-0.5">→</span>
            </Link>
          </Reveal>
          {/* Deret kartu bergerak horizontal terus-menerus (marquee). Daftar
              diduplikasi persis dua kali; jarak antarkartu ikut terhitung
              dalam lebar track sehingga translateX(-50%) mulus tanpa lompat. */}
          <div className="marquee-koleksi mt-8">
            <div className="marquee-track">
              {[0, 1].map((salinan) =>
                bukuPilihan.map((b) => (
                  <KartuKoleksi key={`${salinan}-${b.id}`} b={b} />
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Cara kerja — setinggi layar laptop */}
      <section id="tentang" className="max-w-6xl mx-auto px-5 py-20 min-h-[100svh] flex flex-col justify-center">
        <Reveal className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">Cara Kerja</span>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">Tiga langkah untuk mulai</h2>
        </Reveal>
        <div className="mt-10 grid md:grid-cols-3 gap-6 relative">
          {/* Garis penghubung antar langkah (desktop). */}
          <div aria-hidden className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-[var(--brand)]/30 to-transparent" />
          {[
            { no: "01", judul: "Daftar sebagai anggota", teks: "Kartu anggota digital terbuat otomatis dalam hitungan detik." },
            { no: "02", judul: "Jelajahi katalog", teks: "Cari judul, filter kategori, dan lihat ketersediaan eksemplar." },
            { no: "03", judul: "Ajukan peminjaman", teks: "Pilih tanggal pinjam, pantau jatuh tempo, dan perpanjang bila perlu." },
          ].map((l, i) => (
            <Reveal key={l.no} delay={i * 0.12}>
              <div className="relative h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-6 card-raised">
                <div className="absolute -right-4 -top-6 h-24 w-24 rounded-full opacity-10" style={grad(i)} />
                <div className="relative h-12 w-12 rounded-full grad-brand text-white grid place-items-center font-extrabold text-sm shadow-[var(--sh-2)]">
                  {l.no}
                </div>
                <h3 className="mt-3 font-bold">{l.judul}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{l.teks}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10">
          {/* Panel demo akun — latar tinted + kartu putih agar terbaca jelas
              di latar terang (gaya kartu kaca lama hanya cocok di latar berwarna). */}
          <div className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-soft)]/60 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl grad-brand text-white shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </span>
              <div>
                <div className="font-bold leading-tight">Coba langsung dengan akun demo</div>
                <div className="text-xs text-[var(--muted)]">
                  Tekan “Masuk Demo” untuk langsung masuk dengan salah satu akun di bawah.
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  peran: "Admin (Pustakawan)",
                  email: "admin@perpus.id",
                  sandi: "admin123",
                  ikon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 100 8 4 4 0 000-8",
                },
                {
                  peran: "Anggota",
                  email: "user@perpus.id",
                  sandi: "user123",
                  ikon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                },
              ].map((a) => (
                <div
                  key={a.email}
                  className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--sh-1)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                        style={grad(a.peran === "Anggota" ? 3 : 0)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d={a.ikon} />
                        </svg>
                      </span>
                      <span className="truncate text-sm font-semibold">{a.peran}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
                      Demo
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--muted)]">Email</dt>
                      <dd className="font-mono font-semibold">{a.email}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--muted)]">Kata sandi</dt>
                      <dd className="font-mono font-semibold">{a.sandi}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/login" className="btn btn-primary">
                Masuk Demo
              </Link>
              {bolehDaftar && (
                <Link
                  href="/register"
                  className="btn border border-[var(--brand)]/40 text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]"
                >
                  Daftar Baru
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Testimoni — setinggi layar laptop, tint memudar ke latar */}
      <section id="testimoni" className="grad-testimoni">
        <div className="min-h-[100svh] w-full max-w-6xl mx-auto px-5 py-20 flex flex-col justify-center">
          <Reveal className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">Testimoni</span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">Kata mereka yang sudah memakai</h2>
          </Reveal>
          {/* Deret ulasan; key + anim-naik membuat kartu fade-up ulang
              setiap grup berganti (rotasi berkala — lihat state halTestimoni). */}
          <div
            key={halTestimoni}
            className="mt-10 grid md:grid-cols-3 gap-5"
            onMouseEnter={() => (testimoniDijeda.current = true)}
            onMouseLeave={() => (testimoniDijeda.current = false)}
          >
            {TESTIMONI.slice(halTestimoni * 3, halTestimoni * 3 + 3).map((t, i) => (
              <Reveal key={t.nama} delay={i * 0.1}>
                <figure className={`card card-raised relative h-full p-6 pt-9 anim-naik anim-naik-${i + 1}`}>
                  <svg aria-hidden className="absolute -top-3 left-6 h-10 w-10 rotate-6 text-[var(--brand)]/15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 5C5 5 3 7 3 9.5S5 14 7.5 14c.4 0 .8 0 1.1-.1-.6 2-2.3 3.6-4.4 4.1l.7 1.5c3.9-1 6.6-4.6 6.6-9V9.5C11.5 7 9.5 5 7.5 5zm11 0C16 5 14 7 14 9.5s2 4.5 4.5 4.5c.4 0 .8 0 1.1-.1-.6 2-2.3 3.6-4.4 4.1l.7 1.5c3.9-1 6.6-4.6 6.6-9V9.5C22.5 7 20.5 5 18.5 5z" />
                  </svg>
                  <div className="flex gap-0.5 text-amber-400">
                    {[0, 1, 2, 3, 4].map((s) => (
                      <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.4 21.2 6.7 14.2 1.7 9.4l7-.9L12 2z" /></svg>
                    ))}
                  </div>
                  <blockquote className="mt-3 text-sm text-slate-600">“{t.isi}”</blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full text-white grid place-items-center font-bold" style={grad(i)}>
                      {t.nama.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.nama}</div>
                      <div className="text-xs text-[var(--muted)]">{t.peran}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          {/* Titik penunjuk grup testimoni — klik untuk memilih langsung. */}
          <div className="mt-7 flex items-center justify-center gap-2">
            {Array.from({ length: JUMLAH_HAL_TESTIMONI }, (_, h) => (
              <button
                key={h}
                type="button"
                aria-current={h === halTestimoni ? "true" : undefined}
                aria-label={`Tampilkan testimoni kelompok ${h + 1}`}
                onClick={() => setHalTestimoni(h)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  h === halTestimoni
                    ? "w-6 bg-[var(--brand)]"
                    : "w-2 bg-[var(--brand)]/30 hover:bg-[var(--brand)]/60"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — dua kolom: intro + akordeon bernomor (setinggi layar laptop) */}
      <section id="faq" className="relative max-w-6xl mx-auto px-5 py-20 min-h-[100svh] flex flex-col justify-center">
        {/* Lataran blob gradien lembut di belakang kolom intro. */}
        <div aria-hidden className="pointer-events-none absolute -left-28 top-10 h-72 w-72 rounded-full grad-soft opacity-50 blur-2xl" />
        <div className="relative grid items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <Reveal>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand)]">FAQ</span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
              Pertanyaan yang <span className="text-[var(--brand)]">sering diajukan</span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
              Jawaban paling umum sudah kami rangkum di sini. Masih ada yang ingin
              ditanyakan? Langsung sapa pustakawan di meja layanan saat jam kerja.
            </p>
            {/* Ubin ikon mengapung — mengikuti gaya ubin di section Tentang. */}
            <div className="relative mt-9 hidden h-24 w-40 lg:block">
              <span className="apung grid h-14 w-14 place-items-center rounded-2xl bg-white text-[var(--brand)] shadow-[var(--sh-3)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </span>
              <span className="apung apung-1 absolute left-14 top-9 grid h-12 w-12 place-items-center rounded-2xl grad-brand text-white shadow-[var(--sh-3)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="space-y-3">
            {faqRincian(sistem).map((f, i) => (
              <details
                key={f.q}
                className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--sh-1)] transition-shadow hover:shadow-[var(--sh-2)]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand)] transition-colors group-open:bg-[var(--brand)] group-open:text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-semibold">{f.q}</span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-all group-open:rotate-45 group-open:bg-[var(--brand-soft)] group-open:text-[var(--brand)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="border-t border-[var(--border)] px-5 py-4 pl-[4.25rem] text-sm leading-relaxed text-slate-600">
                  {f.a}
                </p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Footer — hijau tua (grad-footer, turunan cta-1/cta-2) sesuai rancangan:
          brand, kolom Navigasi, Hubungi Kami, Newsletter + baris legal. */}
      <footer className="relative overflow-hidden grad-footer text-white">
        <div aria-hidden className="pola-grid pointer-events-none absolute inset-0 opacity-40" />
        {/* Daun dekoratif di tepi kiri — senada panel halaman masuk. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -top-8 -left-12 h-44 w-44 rotate-12 text-white/[0.07]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={IKON_DAUN} />
        </svg>
        <svg
          aria-hidden
          className="pointer-events-none absolute -bottom-10 left-8 h-40 w-40 -rotate-6 text-white/[0.06]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d={IKON_DAUN} />
        </svg>

        <div className="relative max-w-6xl mx-auto px-5 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur text-white grid place-items-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={IKON_BUKU} />
                  </svg>
                </div>
                <div className="leading-tight">
                  <div className="font-bold text-white">{sistem.nama}</div>
                  <div className="text-xs text-white/70">{sistem.tagline}</div>
                </div>
              </div>
            </div>

            {/* Navigasi */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">Navigasi</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {NAVLINK.map((n) => {
                  const id = n.href.split("#")[1] ?? null;
                  return (
                    <li key={n.label}>
                      <Link
                        href={n.href}
                        onClick={id ? (e) => keSection(e, id) : undefined}
                        className="text-white/75 hover:text-white transition-colors"
                      >
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Hubungi Kami */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">Hubungi Kami</div>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li className="flex items-start gap-2.5">
                  <svg aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Jl. Cihampelas No. 15, Bandung
                </li>
                <li className="flex items-start gap-2.5">
                  <svg aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Telepon: (022) 123-4567
                </li>
                <li className="flex items-start gap-2.5">
                  <svg aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email: info@pustakaku.id
                </li>
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">Berlangganan Newsletter</div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!emailLangganan.includes("@")) return;
                  setLanggananTerkirim(true);
                  setEmailLangganan("");
                }}
                className="mt-4 flex items-center gap-2 rounded-xl bg-white p-1.5 shadow-[var(--sh-2)]"
              >
                <label htmlFor="email-langganan" className="sr-only">
                  Alamat email
                </label>
                <input
                  id="email-langganan"
                  type="email"
                  required
                  placeholder="Alamat email Anda"
                  value={emailLangganan}
                  onChange={(e) => {
                    setEmailLangganan(e.target.value);
                    setLanggananTerkirim(false);
                  }}
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  aria-label="Berlangganan"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </form>
              {langgananTerkirim && (
                <p className="mt-2 text-xs text-emerald-200">
                  Terima kasih! Email Anda berhasil didaftarkan.
                </p>
              )}

              {/* Media sosial */}
              <div className="mt-4 flex items-center gap-2">
                {SOSIAL.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={s.d} />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Baris legal */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-white/70">
            <div>© 2026 {sistem.nama}. Seluruh hak cipta dilindungi.</div>
            <div className="flex items-center gap-3">
              <span>Kebijakan Privasi</span>
              <span aria-hidden>·</span>
              <span>Syarat &amp; Ketentuan</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Tombol kembali ke atas — muncul setelah digulir (lihat rancangan). */}
      {tampilKeAtas && (
        <button
          type="button"
          onClick={() => {
            // Animasi gulir manual (rAF): behavior:"smooth" bawaan browser
            // tidak selalu andal di semua webview — ini bekerja di mana pun
            // dan tetap melompat langsung bila pengguna meminta kurang gerak.
            const total = document.documentElement.scrollTop;
            if (
              total <= 0 ||
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ) {
              document.documentElement.scrollTo({ top: 0, behavior: "instant" });
              return;
            }
            const mulai = performance.now();
            const durasi = 600;
            const gerak = (kini: number) => {
              const t = Math.min(1, (kini - mulai) / durasi);
              const easing = 1 - Math.pow(1 - t, 3); // easeOutCubic
              document.documentElement.scrollTo({
                top: Math.round(total * (1 - easing)),
                behavior: "instant",
              });
              if (t < 1) requestAnimationFrame(gerak);
            };
            requestAnimationFrame(gerak);
          }}
          aria-label="Kembali ke atas"
          className="fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_10px_30px_rgba(2,6,23,0.35)] ring-4 ring-white/60 transition-transform hover:scale-105"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
