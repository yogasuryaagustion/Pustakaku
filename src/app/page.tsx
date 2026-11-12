"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Reveal, Angka, SampulBuku } from "@/components/ui";
import { Naik, NaikBertahap } from "@/components/gerak";
import { useBoleh } from "@/lib/auth";
import { useLibrary } from "@/lib/library-context";
import type { Buku } from "@/lib/types";
import { useSistem, type SistemPengaturan } from "@/lib/sistem";
import KoleksiPopuler from "@/components/landing/KoleksiPopuler";
import PillNav from "@/components/PillNav";

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
  { href: "/#layanan", label: "Jam Layanan" },
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

// Glyph media sosial footer — satu path stroke per ikon, senada ikon lain.
// Isi `href` untuk menampilkannya sebagai tautan aktif. Baris ber-`href: null`
// disimpan di sini tetapi TIDAK dirender (tombol yang tidak melakukan apa-apa
// hanya menyesatkan) — begitu URL diisi, ikonnya otomatis muncul.
const SOSIAL: { label: string; d: string; href: string | null }[] = [
  {
    label: "WhatsApp",
    href: "https://wa.me/62221234567",
    d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  },
  {
    label: "Email",
    href: "mailto:info@pustakaku.id",
    d: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 6.5 12 13l8.5-6.5",
  },
  {
    label: "Facebook",
    href: null,
    d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  },
  {
    label: "Instagram",
    href: null,
    d: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z M17.5 6.5h.01",
  },
  { label: "X (Twitter)", href: null, d: "M4 4l16 16M20 4L4 20" },
];

const rupiahRb = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

// Buku untuk komposisi sampul hero: jumlah peminjaman aktif ikut disimpan agar
// urutan sampul mengikuti buku yang paling sering dipinjam.
type BukuPilihan = Buku & { pinjam: number };

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
  // Katalog publik: angka dan sampul di hero memakai koleksi sungguhan dari
  // database, bukan data contoh — statistik yang tampil harus bisa dicek ke
  // katalog. `muatKatalogPublik` di-dedupe oleh context, jadi aman dipanggil
  // bersamaan dengan section "Koleksi Populer" di bawah.
  const { buku: bukuKatalog, dipinjam: dipinjamBuku, muatKatalogPublik } =
    useLibrary();
  useEffect(() => {
    void muatKatalogPublik();
  }, [muatKatalogPublik]);
  // RBAC visual: izin akun.daftar mengatur apakah tombol & ajakan pendaftaran
  // tampil; /register sendiri ikut menutup lewat guard rute AppShell.
  const bolehDaftar = useBoleh("akun.daftar");

  // Navbar "melayang" + scroll-spy: state `turun` menguatkan latar setelah
  // scroll; `aktifSection` menyorot link nav mengikuti section yang sedang
  // terbaca (section terakhir yang melewati garis 40% viewport atas).
  const [turun, setTurun] = useState(false);
  const [aktifSection, setAktifSection] = useState<string | null>(null);
  const [menuTerbuka, setMenuTerbuka] = useState(false);
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
    const SECTIONS = [
      "beranda",
      "fitur",
      "koleksi",
      "tentang",
      "layanan",
      "testimoni",
      "faq",
    ];
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

  // Statistik & sampul hero dihitung dari katalog yang benar-benar termuat.
  // Selama data belum tiba, angka ditampilkan sebagai "—" agar tidak ada
  // angka contoh yang sempat tampil lalu berubah.
  const totalJudul = bukuKatalog.length;
  const totalEksemplar = bukuKatalog.reduce((s, b) => s + b.stok, 0);
  const jumlahKategori = new Set(
    bukuKatalog.map((b) => b.kategori).filter(Boolean),
  ).size;

  // Enam judul untuk komposisi sampul & chip kategori — urut berdasarkan
  // jumlah peminjaman aktif (agregat dari API, tanpa identitas peminjam).
  const bukuPilihan = useMemo<BukuPilihan[]>(() => {
    return bukuKatalog
      .slice()
      .map((b) => ({ ...b, pinjam: dipinjamBuku[b.id] ?? 0 }))
      .sort((a, b) => b.pinjam - a.pinjam || a.judul.localeCompare(b.judul))
      .slice(0, 6);
  }, [bukuKatalog, dipinjamBuku]);

  // Kelas cupertino memberi lapisan gaya Apple (latar #f5f5f7, kartu blur,
  // sudut besar, tombol pil) tanpa mengubah kelas tiap elemen di dalamnya.
  return (
    <div className="landing-page cupertino min-h-screen bg-[var(--background)]">
      {/* Navbar publik */}
      <header
        className={`fixed top-3 inset-x-0 z-50 px-3 sm:px-5 transition-all duration-300 ${
          turun ? "translate-y-0" : "translate-y-1"
        }`}
      >
        {/* Kaca navbar: latar/border/blur diatur .kaca-nav, status gulir ditandai
            lewat data-turun agar CSS bisa memekatkan kaca tanpa dua kelas Tailwind. */}
        <div
          data-turun={turun ? "" : undefined}
          className="kaca-nav relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-full px-4 transition-all duration-300 sm:px-6"
        >
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl grad-brand text-white shadow-sm">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={IKON_BUKU} />
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight">
              {sistem.nama}
            </span>
          </Link>

          {/* Navigasi desktop: Pill Nav (react-bits) */}
          <div className="hidden lg:flex">
            <PillNav
              items={NAVLINK.map((n) => ({ label: n.label, href: n.href }))}
              activeHref={aktifSection ? `/#${aktifSection}` : undefined}
              defaultActiveIndex={0}
              theme="light"
              size="md"
              /* Wadah di atasnya sudah hidden lg:flex, jadi PillNav tidak perlu
                 menyusut sendiri. Tanpa collapse="never" komponen mengukur
                 lebar induk saat masih display:none lalu mengunci diri dalam
                 mode hamburger — hasilnya tombol menu ganda di header desktop. */
              collapse="never"
              surface="glass"
              layout="joined"
              itemStyle="plain"
              hoverEffect="fill"
              indicator="dot"
              highlightColor="var(--brand-solid)"
              highlightTextColor="#ffffff"
              textColor="var(--brand-ink)"
              linkComponent={Link}
              onItemClick={(item) => {
                const id = item.href?.split("#")[1];
                if (id) {
                  const el = document.getElementById(id);
                  if (el) {
                    el.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                        .matches
                        ? "auto"
                        : "smooth",
                      block: "center",
                    });
                    window.history.replaceState(null, "", `/#${id}`);
                  }
                }
              }}
              ariaLabel="Navigasi utama"
            />
          </div>

          {/* Tombol kanan */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/katalog"
              aria-label="Cari di katalog"
              className="hidden h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-white/80 text-slate-600 transition-all duration-200 hover:border-[var(--brand)]/40 hover:bg-teal-50 hover:text-[var(--brand-ink)] sm:grid"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </Link>

            <Link
              href="/login"
              className="btn btn-primary !rounded-full !px-4 sm:!px-5"
            >
              <span className="hidden sm:inline">
                {bolehDaftar ? "Masuk / Daftar" : "Masuk"}
              </span>
              <span className="sm:hidden">Masuk</span>
            </Link>

            {/* Tombol hamburger hanya untuk tablet dan mobile */}
            <button
              type="button"
              onClick={() => setMenuTerbuka((terbuka) => !terbuka)}
              aria-label={
                menuTerbuka ? "Tutup menu navigasi" : "Buka menu navigasi"
              }
              aria-expanded={menuTerbuka}
              aria-controls="menu-mobile-pustakaku"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-teal-900/10 bg-teal-50 text-teal-800 transition hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 lg:hidden"
            >
              {menuTerbuka ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Panel menu responsif — mengikuti referensi yang dikirim */}
        <div
          id="menu-mobile-pustakaku"
          className={`kaca absolute left-3 right-3 top-[calc(100%+0.65rem)] mx-auto max-w-6xl origin-top overflow-hidden rounded-3xl border p-4 transition-all duration-200 lg:hidden ${
            menuTerbuka
              ? "visible translate-y-0 scale-100 opacity-100"
              : "invisible -translate-y-2 scale-[0.98] opacity-0 pointer-events-none"
          }`}
          aria-hidden={!menuTerbuka}
        >
          <form
            action="/katalog"
            method="get"
            className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4"
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
              className="shrink-0 text-teal-800"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <label htmlFor="mobile-search" className="sr-only">
              Cari buku
            </label>
            <input
              id="mobile-search"
              type="search"
              name="q"
              placeholder="Cari judul atau pengarang..."
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
            />
            <button
              type="submit"
              aria-label="Cari buku"
              className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
            >
              Cari
            </button>
          </form>

          <nav aria-label="Navigasi mobile" className="space-y-1">
            {NAVLINK.map((n) => {
              const id = n.href.split("#")[1] ?? null;
              const aktif = id !== null && id === aktifSection;

              return (
                <Link
                  key={n.label}
                  href={n.href}
                  aria-current={aktif ? "location" : undefined}
                  onClick={(e) => {
                    // Tutup panel lebih dulu supaya gulir ke section tidak
                    // dibatalkan oleh animasi penutupan.
                    setMenuTerbuka(false);
                    if (id) keSection(e, id);
                  }}
                  className={`flex min-h-11 items-center rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
                    aktif
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-700 hover:bg-slate-50 hover:text-teal-800"
                  }`}
                >
                  {n.label === "Fitur"
                    ? "Fitur Unggulan"
                    : n.label === "Koleksi"
                      ? "Koleksi Buku"
                      : n.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <Link
              href="/katalog"
              onClick={() => setMenuTerbuka(false)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" />
                <path d="M4 6h16M8 3v17" />
              </svg>
              Koleksi Buku
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuTerbuka(false)}
              className="flex min-h-11 items-center justify-center rounded-xl bg-[var(--brand-solid)] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
            >
              {bolehDaftar ? "Masuk / Daftar" : "Masuk"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero - OSS style */}

      {/* Hero — desain Modern Digital Library */}
      <section
        id="beranda"
        className="landing-hero relative isolate overflow-hidden bg-white"
      >
        <div aria-hidden="true" className="landing-hero-glow" />

        <div className="landing-hero-inner relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-24 sm:px-8 sm:pt-32 lg:min-h-[690px] lg:grid-cols-[1.08fr_.92fr] lg:gap-8 lg:px-10 lg:pb-20 lg:pt-36">
          {/* Kolom kiri — masuk berurutan agar mata mengikuti alur baca. */}
          <NaikBertahap className="landing-hero-copy min-w-0" jeda={0.08}>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-[var(--sh-1)]">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-50 text-amber-500">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22c4.5-2 7-5.2 7-9a7 7 0 0 0-7-7c.5 3-1 4.5-3 6-1.5 1.2-2 2.7-2 4a5 5 0 0 0 5 6Z" />
                  <path d="M10 17c0-2 1.2-3.2 3-4" />
                </svg>
              </span>
              <span>Perpustakaan Digital Modern</span>
            </div>

            {/* Efek judul: teks berdimensi (depth text) — isi huruf putih dengan
                bayangan bertumpuk sebagai sisi tebalnya. Frasa "Tanpa Batas"
                tetap diisi gradien merek lewat landing-gradient-text. Tanpa
                piringan gelap, huruf putih ini nyaris menyatu dengan latar
                putih section beranda — hanya sisi hijaunya yang terlihat. */}
            <h1 className="teks-kedalaman mt-7 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[66px]">
              Akses Pengetahuan{" "}
              <span className="landing-gradient-text judul-editorial italic">
                Tanpa Batas
              </span>{" "}
              di Era Digital.
            </h1>

            {/* text-pretty: mencegah kata terakhir paragraf menggantung sendirian
                di baris baru pada layar lebar. */}
            <p className="mt-6 max-w-2xl text-pretty text-base leading-8 text-slate-600 sm:text-lg">
              Jelajahi koleksi buku {sistem.nama}, temukan bacaan yang sesuai
              minatmu, dan kelola peminjaman dengan lebih mudah dari mana saja.
            </p>

            {/* Pencarian */}
            <form
              action="/katalog"
              method="get"
              className="landing-search mt-8 flex w-full max-w-2xl items-center gap-3 rounded-[1rem] border border-teal-900/10 bg-white p-2 shadow-[0_12px_40px_color-mix(in_srgb,var(--brand)_8%,transparent)] transition-all focus-within:border-teal-600/50 focus-within:shadow-[0_12px_40px_color-mix(in_srgb,var(--brand)_14%,transparent)]"
            >
              <svg
                className="ml-2 shrink-0 text-teal-800"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>

              <label htmlFor="hero-search" className="sr-only">
                Cari buku
              </label>
              <input
                id="hero-search"
                type="search"
                name="q"
                placeholder="Cari judul buku atau nama pengarang..."
                className="min-w-0 flex-1 border-0 bg-transparent px-1 py-3 text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 sm:text-base"
              />

              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand-solid)] px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:brightness-110 sm:px-5"
              >
                <span>Eksplorasi</span>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </form>

            {/* Topik populer berdasarkan kategori buku yang tersedia */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-slate-600">
                Jelajahi:
              </span>
              {Array.from(
                new Set(bukuPilihan.map((b) => b.kategori).filter(Boolean)),
              )
                .slice(0, 4)
                .map((kategori) => (
                  <Link
                    key={kategori}
                    href={`/katalog?kategori=${encodeURIComponent(kategori)}`}
                    className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                  >
                    {kategori}
                  </Link>
                ))}
            </div>

            {/* Statistik nyata dari katalog publik — angka bulat tanpa "+". */}
            <div className="mt-9 grid max-w-2xl grid-cols-3 gap-3 border-t border-slate-200/80 pt-6 sm:gap-6">
              {[
                { v: totalJudul, l: "Judul Buku" },
                { v: totalEksemplar, l: "Eksemplar" },
                { v: jumlahKategori, l: "Kategori" },
              ].map((stat) => (
                <div key={stat.l} className="min-w-0">
                  <div className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                    {stat.v > 0 ? (
                      <Angka nilai={stat.v} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 sm:text-sm">
                    {stat.l}
                  </div>
                </div>
              ))}
            </div>
          </NaikBertahap>

          {/* Kolom kanan — komposisi sampul buku */}
          <Naik className="landing-hero-art relative mx-auto w-full max-w-[530px]" delay={0.18}>
            <div aria-hidden="true" className="landing-art-halo" />

            {/* Label tren dekoratif */}
            <div className="landing-trending kaca absolute -top-3 left-0 z-20 flex items-center gap-3 rounded-2xl border px-4 py-3 sm:-left-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-500">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8.5 14.5A4.5 4.5 0 0 0 13 19c2.5 0 4-2 4-4.5 0-1.7-.8-3.2-2.5-4.5-.3 2-1.5 2.5-2.5 3-.5-2.5-2-4-4-5C8 11 6 12.5 6 15a6 6 0 0 0 6 6" />
                  <path d="M12 22a9 9 0 1 0 0-18 9 9 0 0 0-9 9" />
                </svg>
              </span>
              <span>
                <span className="block text-xs font-bold text-slate-800">
                  Koleksi Pilihan
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  Temukan bacaan favoritmu
                </span>
              </span>
            </div>

            {/* Sampul samping kiri */}
            <div className="landing-book landing-book-left absolute left-[1%] top-[15%] z-0 w-[43%] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
              {bukuPilihan[1] ? (
                <SampulBuku
                  buku={bukuPilihan[1]}
                  className="h-64 w-full sm:h-80"
                  rounded=""
                />
              ) : (
                <div className="landing-book-fallback h-64 sm:h-80">
                  <span>BACA</span>
                  <strong>Jelajahi Pengetahuan</strong>
                </div>
              )}
            </div>

            {/* Sampul samping kanan */}
            <div className="landing-book landing-book-right absolute right-[1%] top-[13%] z-0 w-[43%] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
              {bukuPilihan[2] ? (
                <SampulBuku
                  buku={bukuPilihan[2]}
                  className="h-64 w-full sm:h-80"
                  rounded=""
                />
              ) : (
                <div className="landing-book-fallback landing-book-fallback-dark h-64 sm:h-80">
                  <span>ILMU</span>
                  <strong>Ruang untuk Bertumbuh</strong>
                </div>
              )}
            </div>

            {/* Kartu buku utama */}
            <div className="landing-reading-card kaca relative z-10 mx-auto w-[58%] max-w-[300px] overflow-hidden rounded-[25px] border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-teal-800 sm:text-xs">
                  Pilihan untukmu
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>

              {bukuPilihan[0] ? (
                <div className="overflow-hidden rounded-2xl">
                  <SampulBuku
                    buku={bukuPilihan[0]}
                    className="h-48 w-full sm:h-60"
                    rounded=""
                  />
                </div>
              ) : (
                <div className="landing-book-fallback landing-book-featured h-48 sm:h-60">
                  <span>PUSTAKAKU</span>
                  <strong>Pengetahuan Dimulai dari Membaca</strong>
                </div>
              )}

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  Koleksi perpustakaan
                </div>
                <h2 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-slate-900 sm:text-base">
                  {bukuPilihan[0]?.judul ?? "Temukan Buku Favoritmu"}
                </h2>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {bukuPilihan[0]?.penulis ?? sistem.nama}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
                  <span className="text-slate-500">Ketersediaan</span>
                  <span className="font-bold text-teal-800">
                    {bukuPilihan[0]?.stok > 0
                      ? `${bukuPilihan[0].stok} eksemplar`
                      : "Cek katalog"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400"
                    style={{
                      width: `${
                        bukuPilihan[0]?.stok > 0
                          ? Math.min(100, bukuPilihan[0].stok * 10)
                          : 12
                      }%`,
                    }}
                  />
                </div>
                <Link
                  href={
                    bukuPilihan[0]
                      ? `/katalog/${bukuPilihan[0].id}`
                      : "/katalog"
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-xs font-bold text-teal-800 transition-colors hover:bg-teal-100"
                >
                  Lihat detail buku
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* Label ketersediaan */}
            <div className="landing-sync-badge absolute -bottom-5 right-0 z-20 flex items-center gap-3 rounded-2xl border border-teal-900/10 bg-slate-950 px-4 py-3 text-white shadow-[var(--sh-3)] sm:-right-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 7v5h-5M4 17v-5h5" />
                  <path d="M5.6 9A7 7 0 0 1 17.5 6L20 12M4 12l2.5 6A7 7 0 0 0 18.4 15" />
                </svg>
              </span>
              <span>
                <span className="block text-xs font-bold">
                  Katalog Terorganisir
                </span>
                <span className="mt-0.5 block text-[10px] text-emerald-300">
                  Buku mudah ditemukan
                </span>
              </span>
            </div>
          </Naik>


        </div>
      </section>

      {/* Fitur — setinggi layar laptop */}
      <section
        id="fitur"
        className="relative max-w-6xl mx-auto px-5 py-20 min-h-[100svh] flex flex-col justify-center"
      >
        <Reveal className="relative z-10 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-ink)]">
            Fitur Unggulan
          </span>
          {/* Judul section fitur memakai efek yang sama dengan judul hero:
              isi huruf putih, sisi kedalaman bertangga, dan nama sistem di
              frasa bertanda gradien merek. */}
          <h2 className="teks-kedalaman judul-editorial mt-2 text-balance text-3xl tracking-tight lg:text-4xl">
            Kenapa memilih{" "}
            <span className="landing-gradient-text italic">{sistem.nama}?</span>
          </h2>
          <p className="mt-3 text-slate-600">
            Dari penataan koleksi sampai penagihan denda — {sistem.nama} menutup
            seluruh alur kerja sirkulasi.
          </p>
        </Reveal>
        <div className="relative z-10 mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {fiturRincian(sistem).map((f, i) => (
            <Reveal key={f.judul} delay={(i % 3) * 0.08}>
              {/* Flex kolom + tinggi teks yang dikunci: tanpa itu kartu dengan
                  penjelasan dua baris menyisakan ruang bawah lebih lega
                  daripada kartu tiga baris, sehingga barisannya terlihat
                  pincang meski tinggi kartunya sama. */}
              <div className="group card card-raised flex h-full flex-col p-6">
                <div
                  className="h-11 w-11 shrink-0 rounded-xl text-white grid place-items-center shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3"
                  style={grad(i)}
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
                    <path d={f.ikon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-base font-bold leading-6">
                  {f.judul}
                </h3>
                {/* min-h-15 = tiga baris teks 20 px; kartu yang teksnya hanya
                    dua baris tetap memakai tinggi yang sama. */}
                <p className="mt-1.5 line-clamp-3 min-h-15 text-pretty text-sm text-slate-600">
                  {f.teks}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Koleksi populer — setinggi layar laptop, tint memudar ke latar */}

      {/* Koleksi Buku Terpopuler */}
      <KoleksiPopuler />

      {/* Cara kerja — setinggi layar laptop */}
      <section
        id="tentang"
        className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <Reveal className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-800">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v6" />
                <path d="m8 5 4 4 4-4" />
                <path d="M12 9 6 15" />
                <path d="m4 13 2 2-2 2" />
                <path d="M12 9l6 6" />
                <path d="m20 13-2 2 2 2" />
                <path d="M12 15v6" />
              </svg>
              Alur Praktis 3 Menit
            </span>

            {/* Judul section cara kerja: efek depth text yang sama dengan judul
                hero/fitur/testimoni, dengan frasa penutup bergradien merek. */}
            <h2 className="teks-kedalaman judul-editorial mt-4 text-balance text-3xl leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
              3 Langkah Mudah{" "}
              <span className="landing-gradient-text italic">Memulai Baca</span>
            </h2>

            <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Seluruh proses registrasi dan peminjaman dilakukan secara digital
              tanpa berkas fisik.
            </p>
          </Reveal>

          {/* Kartu langkah */}
          <div className="relative mt-12 grid grid-cols-1 gap-5 md:mt-16 md:grid-cols-3 md:gap-6">
            {/* Garis penghubung nomor */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[16%] right-[16%] top-14 hidden h-[3px] bg-gradient-to-r from-teal-800 via-teal-600 to-emerald-400 md:block"
            />

            {[
              {
                no: "01",
                judul: "Registrasi Akun Instan",
                teks: "Cukup daftar dengan alamat email aktif atau hubungkan identitas pelajar/civitas untuk aktivasi akun.",
                tombol: "Daftar Sekarang",
                href: "/register",
              },
              {
                no: "02",
                judul: "Temukan Judul Impian",
                teks: "Manfaatkan kurasi AI atau filter kategori. Baca sinopsis serta cuplikan bab sebelum menekan tombol Pinjam Cepat.",
                tombol: "Jelajahi Katalog",
                href: "/katalog",
              },
              {
                no: "03",
                judul: "Pinjam dan Kembalikan",
                teks: "Pantau peminjaman melalui akun anggota dan kembalikan buku sesuai tanggal yang telah ditentukan.",
                tombol: "Lihat Peminjaman",
                href: "/anggota/peminjaman",
              },
            ].map((langkah, i) => (
              <Reveal key={langkah.no} delay={i * 0.12} className="h-full">
                <article className="group relative flex h-full min-h-[320px] flex-col items-center rounded-[28px] border border-slate-200/90 bg-[#f7f9f9] px-6 py-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-[0_15px_35px_rgba(15,23,42,0.08)] sm:px-7 sm:py-9">
                  {/* Nomor langkah */}
                  <div
                    className={`relative z-10 grid h-[78px] w-[78px] shrink-0 place-items-center rounded-[20px] text-2xl font-extrabold text-white shadow-[0_10px_18px_rgba(0,105,92,0.18)] transition-transform duration-300 group-hover:-translate-y-1 ${
                      i === 0
                        ? "bg-teal-800"
                        : i === 1
                          ? "bg-teal-700"
                          : "bg-emerald-500"
                    }`}
                  >
                    {langkah.no}
                  </div>

                  {/* Judul */}
                  <h3 className="mt-7 text-lg font-bold leading-snug tracking-tight text-slate-950 sm:text-xl">
                    {langkah.judul}
                  </h3>

                  {/* Deskripsi */}
                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                    {langkah.teks}
                  </p>

                  {/* Tombol */}
                  <Link
                    href={langkah.href}
                    className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-teal-800 transition-colors hover:text-emerald-500"
                  >
                    {langkah.tombol}
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* JAM LAYANAN & ATURAN PEMINJAMAN */}
      <section
        id="layanan"
        className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 lg:px-10 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          {/* Header section */}
          <Reveal className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-800">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Informasi Perpustakaan
            </span>

            {/* Efek depth text yang sama; isi huruf putih diatur kelas
                teks-kedalaman sehingga warna gelap lama tidak dipakai lagi. */}
            <h2 className="teks-kedalaman judul-editorial mt-7 text-balance text-3xl leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
              <span className="landing-gradient-text italic">Jam Layanan</span>{" "}
              &amp; Aturan Peminjaman
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              Ketahui jadwal operasional dan ketentuan peminjaman agar
              pengalaman menggunakan layanan perpustakaan menjadi lebih mudah
              dan nyaman.
            </p>
          </Reveal>

          {/* Konten dua kolom */}
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* Jam layanan */}
            <Reveal delay={0.1} className="h-full">
              <article className="h-full rounded-[28px] border border-slate-200/90 bg-[#f7faf9] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-[0_15px_35px_rgba(15,23,42,0.07)] sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-800 text-white shadow-[0_8px_18px_rgba(0,105,92,0.16)]">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      Jam Operasional
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Jadwal layanan perpustakaan
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {[
                    { hari: "Senin – Jumat", waktu: "08.00 – 16.00 WIB" },
                    { hari: "Sabtu", waktu: "08.00 – 12.00 WIB" },
                    { hari: "Minggu", waktu: "Tutup" },
                  ].map((jadwal) => (
                    <div
                      key={jadwal.hari}
                      className="kaca flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
                    >
                      <span className="text-sm font-semibold text-slate-700">
                        {jadwal.hari}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          jadwal.waktu === "Tutup"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-emerald-50 text-teal-800"
                        }`}
                      >
                        {jadwal.waktu}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="kaca mt-6 flex items-start gap-3 rounded-2xl border p-4">
                  <svg
                    className="mt-0.5 shrink-0 text-teal-800"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>

                  <p className="text-xs leading-6 text-slate-600">
                    Jadwal dapat berubah mengikuti kebijakan dan kegiatan
                    operasional perpustakaan.
                  </p>
                </div>
              </article>
            </Reveal>

            {/* Aturan peminjaman */}
            <Reveal delay={0.2} className="h-full">
              <article className="h-full rounded-[28px] border border-slate-200/90 bg-[#f7faf9] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:bg-white hover:shadow-[0_15px_35px_rgba(15,23,42,0.07)] sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-800 text-white shadow-[0_8px_18px_rgba(0,105,92,0.16)]">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      Aturan Peminjaman
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Ketentuan penggunaan koleksi
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-5">
                  {[
                    {
                      nomor: "01",
                      judul: "Terdaftar sebagai anggota",
                      deskripsi:
                        "Pengguna harus memiliki akun anggota yang aktif untuk mengajukan peminjaman.",
                    },
                    {
                      nomor: "02",
                      judul: "Durasi peminjaman",
                      deskripsi: `Masa peminjaman buku berlaku selama ${sistem.lamaPinjam} hari.`,
                    },
                    {
                      nomor: "03",
                      judul: "Pengembalian buku",
                      deskripsi:
                        "Buku harus dikembalikan sesuai tanggal jatuh tempo yang tercantum pada akun anggota.",
                    },
                    {
                      nomor: "04",
                      judul: "Denda keterlambatan",
                      deskripsi: `${rupiahRb(sistem.dendaPerHari)} per hari untuk setiap keterlambatan pengembalian buku.`,
                    },
                  ].map((aturan) => (
                    <div key={aturan.nomor} className="flex items-start gap-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xs font-extrabold text-teal-800">
                        {aturan.nomor}
                      </div>

                      <div className="min-w-0 flex-1 border-b border-slate-200/80 pb-4">
                        <h4 className="text-sm font-bold text-slate-900">
                          {aturan.judul}
                        </h4>
                        <p className="mt-1.5 text-sm leading-6 text-slate-600">
                          {aturan.deskripsi}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/login"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-lg"
                >
                  Mulai Peminjaman
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Testimoni — setinggi layar laptop, tint memudar ke latar */}
      <section id="testimoni" className="relative bg-white">
        <div className="min-h-[100svh] w-full max-w-6xl mx-auto px-5 py-20 flex flex-col justify-center">
          <Reveal className="relative z-10 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-ink)]">
              Testimoni
            </span>
            {/* Sama seperti judul hero dan fitur: isi huruf putih dengan sisi
                kedalaman bertangga, frasa penutup memakai gradien merek. */}
            <h2 className="teks-kedalaman judul-editorial mt-2 text-balance text-3xl tracking-tight lg:text-4xl">
              Kata mereka yang{" "}
              <span className="landing-gradient-text italic">sudah memakai</span>
            </h2>
          </Reveal>
          {/* Deret ulasan; key + anim-naik membuat kartu fade-up ulang
              setiap grup berganti (rotasi berkala — lihat state halTestimoni). */}
          <div
            key={halTestimoni}
            className="mt-10 grid md:grid-cols-3 gap-5"
            onMouseEnter={() => (testimoniDijeda.current = true)}
            onMouseLeave={() => (testimoniDijeda.current = false)}
          >
            {TESTIMONI.slice(halTestimoni * 3, halTestimoni * 3 + 3).map(
              (t, i) => (
                <Reveal key={t.nama} delay={i * 0.1}>
                  <figure
                    className={`card card-raised relative z-10 h-full p-6 pt-9 anim-naik anim-naik-${i + 1}`}
                  >
                    <svg
                      aria-hidden
                      className="absolute -top-3 left-6 h-10 w-10 rotate-6 text-[var(--brand-ink)]/15"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M7.5 5C5 5 3 7 3 9.5S5 14 7.5 14c.4 0 .8 0 1.1-.1-.6 2-2.3 3.6-4.4 4.1l.7 1.5c3.9-1 6.6-4.6 6.6-9V9.5C11.5 7 9.5 5 7.5 5zm11 0C16 5 14 7 14 9.5s2 4.5 4.5 4.5c.4 0 .8 0 1.1-.1-.6 2-2.3 3.6-4.4 4.1l.7 1.5c3.9-1 6.6-4.6 6.6-9V9.5C22.5 7 20.5 5 18.5 5z" />
                    </svg>
                    <div className="flex gap-0.5 text-amber-400">
                      {[0, 1, 2, 3, 4].map((s) => (
                        <svg
                          key={s}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 17.8 5.4 21.2 6.7 14.2 1.7 9.4l7-.9L12 2z" />
                        </svg>
                      ))}
                    </div>
                    <blockquote className="mt-3 text-sm text-slate-600">
                      “{t.isi}”
                    </blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full text-white grid place-items-center font-bold"
                        style={grad(i)}
                      >
                        {t.nama.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{t.nama}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {t.peran}
                        </div>
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              ),
            )}
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

      {/* FAQ — Redesign dua kolom */}
      <section
        id="faq"
        className="relative overflow-hidden landing-faq-section px-5 py-16 sm:px-8 lg:px-10 lg:py-20"
      >
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] lg:gap-14">
          {/* Kolom kiri: informasi FAQ */}
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-800">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              Tanya Jawab
            </span>

            {/* Efek depth text yang sama; warna teks gelap lama dilepas karena
                isi huruf kini diatur putih oleh kelas teks-kedalaman. */}
            <h2 className="teks-kedalaman judul-editorial mt-7 max-w-lg text-balance text-3xl leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
              Pertanyaan yang{" "}
              <span className="landing-gradient-text italic">Sering Diajukan</span>
            </h2>

            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
              Temukan jawaban cepat seputar durasi pinjam, hak akses anggota,
              serta petunjuk membaca buku secara offline tanpa koneksi internet.
            </p>

            {/* Kartu bantuan */}
            <div className="mt-7 rounded-[28px] border border-teal-800/20 bg-[#f7faf9] p-5 sm:p-7">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-800 text-white shadow-sm">
                  <svg
                    width="25"
                    height="25"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 13v-2a9 9 0 0 1 18 0v2" />
                    <path d="M5 12H3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v-7H5z" />
                    <path d="M19 12h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3v-7h1z" />
                    <path d="M9 19h6" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Butuh Bantuan Lain?
                  </h3>
                  <p className="mt-0.5 text-sm leading-6 text-slate-500">
                    Tim pustakawan kami siap membantu Anda.
                  </p>
                </div>
              </div>

              <Link
                href="/kontak"
                className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:border-teal-700/30 hover:bg-emerald-50 hover:text-teal-800"
              >
                Hubungi Tim Layanan
              </Link>
            </div>
          </Reveal>

          {/* Kolom kanan: daftar pertanyaan */}
          <Reveal delay={0.1} className="w-full space-y-3">
            {faqRincian(sistem).map((f, i) => (
              <details
                key={f.q}
                open={i === 0}
                className="group overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 open:bg-[#fcfdfd] hover:border-slate-300 hover:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1 text-sm font-bold leading-6 text-slate-900 sm:text-base">
                    {f.q}
                  </span>

                  <span className="grid h-7 w-7 shrink-0 place-items-center text-teal-800 transition-transform duration-300 group-open:rotate-180">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m7 10 5 5 5-5" />
                    </svg>
                  </span>
                </summary>

                <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                  <p className="text-sm leading-7 text-slate-600">{f.a}</p>
                </div>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Footer — hijau tua (grad-footer, turunan cta-1/cta-2) sesuai rancangan:
          brand, kolom Navigasi, Hubungi Kami, Newsletter + baris legal. */}

      {/* FOOTER PUSTAKAKU */}
      <footer className="relative overflow-hidden bg-emerald-950 text-white">
        {/* Dekorasi latar */}
        <div
          aria-hidden="true"
          className="pola-grid pointer-events-none absolute inset-0 opacity-20"
        />

        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-14">
          {/* Konten utama */}
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {/* Brand */}
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-3"
                aria-label="PustakaKu - Beranda"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-emerald-100 shadow-lg backdrop-blur">
                  <svg
                    width="25"
                    height="25"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={IKON_BUKU} />
                  </svg>
                </div>

                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {sistem.nama}
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-100/70">
                    {sistem.tagline}
                  </div>
                </div>
              </Link>

              <p className="mt-5 max-w-xs text-sm leading-7 text-emerald-50/70">
                Temukan, jelajahi, dan nikmati berbagai koleksi bacaan dalam
                satu tempat. Mulai perjalanan literasi kamu bersama PustakaKu.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-white/5 px-3 py-2 text-xs text-emerald-100/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Teman membaca setiap hari
              </div>
            </div>

            {/* Navigasi */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200">
                Navigasi
              </h3>

              <ul className="mt-5 space-y-3">
                {NAVLINK.map((n) => {
                  const id = n.href.split("#")[1] ?? null;

                  return (
                    <li key={n.label}>
                      <Link
                        href={n.href}
                        onClick={id ? (e) => keSection(e, id) : undefined}
                        className="group inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/50 transition-colors group-hover:bg-emerald-300" />
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Hubungi Kami */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200">
                Hubungi Kami
              </h3>

              <ul className="mt-5 space-y-4 text-sm text-white/70">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">Alamat</p>
                    <p className="mt-1 leading-6">
                      Jl. Cihampelas No. 15, Bandung
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 8.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2.1Z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">Telepon</p>
                    <a
                      href="tel:+62221234567"
                      className="mt-1 block transition-colors hover:text-emerald-300"
                    >
                      (022) 123-4567
                    </a>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-emerald-200">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">Email</p>
                    <a
                      href="mailto:info@pustakaku.id"
                      className="mt-1 block break-all transition-colors hover:text-emerald-300"
                    >
                      info@pustakaku.id
                    </a>
                  </div>
                </li>
              </ul>
            </div>

            {/* Newsletter dan media sosial */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-200">
                Newsletter
              </h3>

              <p className="mt-5 text-sm leading-6 text-white/70">
                Dapatkan informasi terbaru seputar koleksi buku dan aktivitas
                literasi PustakaKu.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  if (!emailLangganan.includes("@")) return;

                  setLanggananTerkirim(true);
                  setEmailLangganan("");
                }}
                className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white p-1.5 shadow-lg"
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
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />

                <button
                  type="submit"
                  aria-label="Daftar newsletter"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-700 text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </button>
              </form>

              {langgananTerkirim && (
                <p
                  role="status"
                  className="mt-3 text-xs leading-5 text-emerald-200"
                >
                  Terima kasih! Formulir newsletter berhasil dikirim.
                </p>
              )}

              <h4 className="mt-6 text-xs font-semibold uppercase tracking-wider text-white/60">
                Ikuti Kami
              </h4>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {SOSIAL.filter((s) => s.href).map((s) => {
                  // Tautan eksternal dibuka di tab baru; mailto/tel tetap di tab yang sama.
                  const eksternal = s.href!.startsWith("http");
                  return (
                    <a
                      key={s.label}
                      href={s.href!}
                      {...(eksternal
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                      aria-label={s.label}
                      title={s.label}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/75 transition-all hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-500/15 hover:text-white"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d={s.d} />
                      </svg>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 border-t border-white/10 pt-6">
            <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
              <p className="text-xs leading-5 text-white/55">
                © {new Date().getFullYear()} {sistem.nama}. Seluruh hak cipta
                dilindungi.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
                <Link
                  href="/kebijakan-privasi"
                  className="transition-colors hover:text-emerald-200"
                >
                  Kebijakan Privasi
                </Link>

                <span aria-hidden="true" className="text-white/25">
                  •
                </span>

                <Link
                  href="/syarat-ketentuan"
                  className="transition-colors hover:text-emerald-200"
                >
                  Syarat &amp; Ketentuan
                </Link>
              </div>
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
              document.documentElement.scrollTo({
                top: 0,
                behavior: "instant",
              });
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
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
