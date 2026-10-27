"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LibraryProvider, useLibrary } from "@/lib/library-context";
import { AuthProvider, useAuth, type Peran } from "@/lib/auth";
import {
  DAFTAR_IZIN,
  INFO_PERAN,
  cekIzin,
  cariIzinRute,
  cariPeranRute,
  peranEfektif,
  RUTE_TERBUKA,
  tujuanRumah,
  useKebijakan,
  type PeranAkses,
} from "@/lib/akses";
import { useSistem } from "@/lib/sistem";
import { ToastProvider } from "@/components/toast";
import { Avatar } from "@/components/ui";

// Pemetaan rute → izin, matriks peran, dan tujuan rumah semuanya mengikuti
// kebijakan di src/lib/akses.ts — mengubahnya lewat /admin/akses langsung
// menutup/membuka halaman, tombol, dan mutasi tanpa menyentuh kode.

const NAV: {
  href: string;
  label: string;
  icon: string;
  izin?: string;
  /** Label grup khusus tampilan anggota (default: grup). */
  grupUser?: string;
  /** Filter menu per peran — di luar matriks izin (mis. item panel anggota). */
  hanyaPeran?: PeranAkses[];
  grup: string;
}[] = [
  // Grup tampil berurutan; grup tanpa izin terpenuhi otomatis disembunyikan.
  {
    grup: "MENU UTAMA",
    href: "/panel",
    label: "Beranda",
    icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    izin: "panel.lihat",
  },
  {
    grup: "Utama",
    href: "/dashboard",
    label: "Dashboard",
    icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    izin: "dashboard.lihat",
  },
  {
    grup: "Utama",
    grupUser: "MENU UTAMA",
    href: "/katalog",
    label: "Katalog Buku",
    icon: "M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z M14 3v5h5",
    izin: "katalog.lihat",
  },
  {
    grup: "MENU UTAMA",
    href: "/panel/pinjaman",
    label: "Pinjaman Saya",
    icon: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
    izin: "panel.pinjaman",
  },
  {
    grup: "Utama",
    href: "/sirkulasi",
    label: "Sirkulasi",
    icon: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
    izin: "sirkulasi.lihat",
  },
  {
    grup: "Utama",
    href: "/anggota",
    label: "Data Anggota",
    icon: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 10a4 4 0 100-8 4 4 0 000 8 M22 20v-2a4 4 0 00-3-3.87",
    izin: "anggota.lihat",
  },
  // Analitik: statistik kunjungan (halaman sendiri) & laporan — keduanya
  // membaca sumber data kunjungan yang sama lewat /api/kunjungan.
  {
    grup: "Analitik",
    href: "/laporan",
    label: "Laporan",
    icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    izin: "laporan.lihat",
  },
  {
    grup: "Sistem",
    href: "/admin/akun",
    label: "Kelola Akun",
    icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M19 16m-2 0a2 2 0 104 0a2 2 0 10-4 0 M19 12.5v1 M19 18.5v1 M15.5 16h1 M21.5 16h1",
    izin: "akun.kelola",
  },
  // Kontrol Akses: dijaga gerbang peran admin (RUTE_PERAN di lib/akses.ts),
  // bukan izin matriks — karena itu tanpa prop `izin`, cukup hanyaPeran.
  {
    grup: "Sistem",
    href: "/admin/akses",
    label: "Kelola Akses",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    hanyaPeran: ["admin"],
  },
  {
    grup: "Sistem",
    href: "/admin/pengaturan",
    label: "Pengaturan",
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
    izin: "pengaturan.kelola",
  },
  // CATATAN: "Migrasi Data" (/admin/migrasi) dan "Kios Kunjungan" (/kunjungan)
  // sengaja TIDAK dimasukkan ke NAV — disembunyikan dari sidebar & navigasi
  // mobile atas permintaan, tetapi keduanya tetap bisa dibuka lewat URL:
  //   * /admin/migrasi dijaga gerbang peran admin (RUTE_PERAN);
  //   * /kunjungan tetap rute terbuka (RUTE_TERBUKA) dan tampil POLOS
  //     (lihat daftar pathname di bawah) sehingga layar kios tidak membuka
  //     sidebar/menu admin.
  {
    grup: "MENU UTAMA",
    href: "/panel/profil",
    label: "Profil",
    icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M19 16m-2 0a2 2 0 104 0a2 2 0 10-4 0 M19 12.5v1 M19 18.5v1 M15.5 16h1 M21.5 16h1",
    izin: "panel.profil",
    hanyaPeran: ["user"],
  },
  {
    grup: "LAYANAN",
    href: "/panel/bantuan",
    label: "Bantuan",
    icon: "M12 22a10 10 0 100-20 10 10 0 000 20z M12 16v-4 M12 8h.01",
    izin: "panel.bantuan",
    hanyaPeran: ["user"],
  },
];

function Logo() {
  const sistem = useSistem();
  return (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[var(--border)]">
      <div className="h-10 w-10 rounded-xl grad-brand text-white grid place-items-center shadow-[var(--sh-2)]">
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
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="font-bold text-[15px]">{sistem.nama}</div>
        <div className="text-[11px] text-[var(--muted)]">{sistem.tagline}</div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand)] shadow-[inset_3px_0_0_0_var(--brand)]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
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
      >
        <path d={icon} />
      </svg>
      {label}
    </Link>
  );
}

function Sidebar({ peran }: { peran: Peran }) {
  const pathname = usePathname();
  const kebijakan = useKebijakan();
  const { sedangMasuk } = useAuth();
  const { anggota } = useLibrary();
  // Kartu anggota sesi ini (untuk foto profil pada kartu sapaan).
  const kartu = sedangMasuk
    ? (anggota.find((a) => a.id === sedangMasuk.anggotaId) ??
      anggota.find(
        (a) => a.email.toLowerCase() === sedangMasuk.email.toLowerCase(),
      ))
    : undefined;
  // Menu mengikuti kebijakan izin — bukan daftar peran statis.
  const items = NAV.filter(
    (n) =>
      (!n.izin || cekIzin(kebijakan, peran, n.izin)) &&
      (!n.hanyaPeran || n.hanyaPeran.includes(peran)),
  );
  // Label grup mengikuti peran: anggota memakai struktur MENU UTAMA / LAYANAN.
  const labelGrup = (n: (typeof NAV)[number]) =>
    peran === "user" && n.grupUser ? n.grupUser : n.grup;
  const grupTampil = Array.from(new Set(items.map(labelGrup)));
  return (
    <aside className="w-64 shrink-0 bg-[var(--card)] border-r border-[var(--border)] flex flex-col">
      <Logo />
      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-2 space-y-5">
        {grupTampil.map((g) => (
          <div key={g}>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              {g}
            </div>
            <nav className="space-y-1">
              {items
                .filter((n) => labelGrup(n) === g)
                .map((n) => (
                  <NavItem
                    key={n.href}
                    href={n.href}
                    label={n.label}
                    icon={n.icon}
                    active={pathname === n.href}
                  />
                ))}
            </nav>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-3 py-2 text-xs text-[var(--muted)]">
            Tidak ada menu yang diizinkan untuk peran Anda.
          </p>
        )}
      </div>
      {peran === "user" ? (
        <div className="m-3 flex items-center gap-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] p-3.5">
          <Avatar
            nama={sedangMasuk?.nama ?? "Anggota"}
            foto={kartu?.foto}
            className="h-9 w-9 rounded-full text-sm"
          />
          <div className="min-w-0 leading-tight">
            <div className="text-[11px] text-[var(--muted)]">
              Selamat datang,
            </div>
            <div className="truncate text-sm font-bold">
              {sedangMasuk?.nama ?? "Anggota"}
            </div>
            <div className="text-[11px] text-[var(--muted)]">Anggota</div>
          </div>
        </div>
      ) : (
        <div className="m-3 rounded-xl border border-[var(--border)] bg-slate-50 p-3.5 text-[11px] leading-relaxed text-[var(--muted)]">
          <div className="flex items-center gap-1.5 font-semibold text-slate-600">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Basis data
          </div>
          <p className="mt-1">
            Katalog & transaksi dibaca langsung dari Supabase (PostgreSQL) —
            bukan dari browser ini.
          </p>
        </div>
      )}
    </aside>
  );
}

function StatusPill() {
  const { buku, anggota, peminjaman } = useLibrary();
  const aktif = peminjaman.filter((p) => p.status === "Dipinjam").length;
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
      <span className="hidden sm:inline">{buku.length} buku</span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">{anggota.length} anggota</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] px-2.5 py-1 font-semibold">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
        {aktif} dipinjam
      </span>
    </div>
  );
}

function AkunMenu({ peran }: { peran: Peran }) {
  const { sedangMasuk, keluar } = useAuth();
  const { anggota } = useLibrary();
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  if (!sedangMasuk) return null;
  const inisial = sedangMasuk.nama.trim().charAt(0).toUpperCase();
  // Kartu anggota sesi ini — foto profil tampil di chip akun anggota.
  const kartu =
    anggota.find((a) => a.id === sedangMasuk.anggotaId) ??
    anggota.find(
      (a) => a.email.toLowerCase() === sedangMasuk.email.toLowerCase(),
    );

  // Anggota: chip nama dengan dropdown (Profil + Keluar) —
  // sesuai desain panel anggota yang dirujuk.
  if (peran === "user") {
    const keprofil = () => {
      setBuka(false);
      router.push("/panel/profil");
    };
    const keluarsekarang = () => {
      setBuka(false);
      keluar();
      router.replace("/");
    };
    return (
      <div className="relative">
        <button
          className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] py-1.5 pl-1.5 pr-3 transition-shadow hover:shadow-[var(--sh-1)]"
          onClick={() => setBuka((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={buka}
        >
          <Avatar
            nama={sedangMasuk.nama}
            foto={kartu?.foto}
            className="h-8 w-8 rounded-lg text-sm"
          />
          <span className="hidden sm:block leading-tight text-left">
            <span className="block text-[13px] font-semibold">
              {sedangMasuk.nama}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Anggota
            </span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-[var(--muted)] transition-transform ${buka ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {buka && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] py-1 shadow-[var(--sh-3)]"
          >
            <button
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-slate-100"
              onClick={keprofil}
            >
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Profil
            </button>
            <div className="my-1 h-px bg-[var(--border)]" />
            <button
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
              onClick={keluarsekarang}
            >
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
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Keluar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] py-1.5 pl-1.5 pr-3 transition-shadow hover:shadow-[var(--sh-1)]">
        <div
          className={`h-8 w-8 rounded-lg grid place-items-center text-sm font-bold text-white ${
            peran === "admin"
              ? "bg-gradient-to-br from-amber-400 to-orange-500"
              : "grad-brand"
          }`}
        >
          {inisial}
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">{sedangMasuk.nama}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
            {peran === "admin" ? "Pustakawan" : "Anggota"}
          </div>
        </div>
      </div>
      <button
        className="btn btn-ghost !py-1.5 !px-2.5"
        onClick={() => {
          keluar();
          router.replace("/");
        }}
        title="Keluar dari akun"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Keluar
      </button>
    </div>
  );
}

// Langganan tanpa efek — dipakai useSyncExternalStore sebagai penanda
// "sudah di klien" (nilai snapshot klien tidak pernah berubah lagi).
function langgananKosong() {
  return () => {};
}

// Layar "akses ditolak": peran ini tidak memiliki izin untuk rute tersebut.
// Menolak secara eksplisit (tanpa redirect) membuat kebijakan terlihat jelas.
function TolakAkses({ peran, izin }: { peran: PeranAkses; izin: string }) {
  const kebijakan = useKebijakan();
  const daftar = DAFTAR_IZIN.find((z) => z.id === izin);
  const rumah = tujuanRumah(kebijakan, peran);
  const labelRumah =
    rumah === "/dashboard"
      ? "Dashboard"
      : rumah === "/panel"
        ? "Panel Saya"
        : "Katalog";
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 text-rose-500 grid place-items-center">
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 9v3M12 15h.01" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Peran <b className="text-slate-700">{INFO_PERAN[peran].label}</b>{" "}
          tidak memiliki izin{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            {izin}
          </code>
          {daftar ? (
            <>
              {" "}
              — {daftar.label} ({daftar.grup})
            </>
          ) : null}{" "}
          untuk halaman ini.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Kebijakan akses diatur di Kelola Akses — perubahan berlaku seketika
          tanpa menyentuh kode.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href={rumah} className="btn btn-primary">
            Ke {labelRumah}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sedangMasuk } = useAuth();
  const sistem = useSistem();
  const kebijakan = useKebijakan();
  // Peran efektif — tidak ada sesi berarti tamu; semua pengecekan izin di
  // bawah mengikuti kebijakan, bukan daftar rute statis.
  const peran: PeranAkses = peranEfektif(sedangMasuk?.peran);
  const izinRute = cariIzinRute(pathname);
  const ruteSelaluBuka = RUTE_TERBUKA.includes(pathname);
  // Pintasan peran di luar matriks izin: /admin/akses khusus admin.
  // (Permintaan: hapus kendali "Kontrol akses" dari matriks — halaman jadi
  // gerbang peran; salah peran dialihkan, tanpa layar "Akses Ditolak".)
  const peranWajib = cariPeranRute(pathname);
  const peranCocok = peranWajib === undefined || peran === peranWajib;
  const diizinkan =
    (izinRute === undefined || cekIzin(kebijakan, peran, izinRute)) &&
    peranCocok;
  const judul = NAV.find((n) => n.href === pathname)?.label ?? sistem.tagline;
  const hariIni = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Tahan semua redirect sampai hydration selesai (sesi dari localStorage
  // sempat dibaca). Tanpa ini, setiap muat ulang rute privat melewati /login
  // dulu (efek jalan saat snapshot sesi masih kosong), sehingga deep-link
  // seperti /sirkulasi terlempar ke /dashboard oleh fallback login.
  // Pola useSyncExternalStore: snapshot server = false, snapshot klien = true
  // — konsisten dengan store lain, tanpa setState di dalam effect.
  const sesiSiap = useSyncExternalStore(
    langgananKosong,
    () => true,
    () => false,
  );

  useEffect(() => {
    // Tunggu sesi terbaca dulu supaya tidak ada redirect yang salah sasaran.
    if (!sesiSiap) return;
    // Tamu di rute yang butuh izin (katalog dsb.): ke halaman masuk dulu —
    // setelah masuk, izin perannya yang menentukan.
    if (!sedangMasuk && !ruteSelaluBuka && !diizinkan) {
      router.replace("/login?dari=" + encodeURIComponent(pathname));
      return;
    }
    if (!sedangMasuk) return;
    // Salah peran pada rute khusus peran (mis. anggota membuka /admin/akses):
    // kembali ke rumah peran — tanpa layar tolak, karena ini di luar matriks.
    if (peranWajib !== undefined && peran !== peranWajib) {
      router.replace(tujuanRumah(kebijakan, peran));
      return;
    }
    // Sudah masuk, membuka /login atau /register: langsung ke tujuan.
    // Hormati deep-link ?dari= bila nilainya aman (path internal, bukan /login).
    if (pathname === "/login" || pathname === "/register") {
      const dari = new URLSearchParams(window.location.search).get("dari");
      const aman =
        dari &&
        dari.startsWith("/") &&
        !dari.startsWith("//") &&
        dari !== "/login" &&
        dari !== "/register";
      // tujuanRumah selalu memilih halaman yang masih diizinkan kebijakan.
      router.replace(aman && dari ? dari : tujuanRumah(kebijakan, peran));
    }
  }, [
    sesiSiap,
    sedangMasuk,
    ruteSelaluBuka,
    diizinkan,
    kebijakan,
    peran,
    pathname,
    router,
    peranWajib,
  ]);

  // Judul tab selalu mengikuti nama perpustakaan + halaman yang dibuka.
  // metadata di layout.tsx tetap menjadi default saat render server/pertama;
  // karena React/Next menulis <title> dari metadata ±15ms SETELAH efek ini
  // (terbukti lewat probe observer), nilai dinamis ditegakkan lewat observer
  // — begitu judul sesuai tujuan, observer berhenti menulis (tanpa loop).
  useEffect(() => {
    const hitung = () => {
      const halaman =
        NAV.find((n) => n.href === pathname)?.label ??
        (pathname === "/katalog"
          ? "Katalog Buku"
          : pathname.startsWith("/katalog/")
            ? "Detail Buku"
            : pathname === "/login"
              ? "Masuk"
              : pathname === "/register"
                ? "Daftar"
                : null);
      return halaman
        ? `${halaman} — ${sistem.nama}`
        : `${sistem.nama} — ${sistem.tagline}`;
    };
    const terapkan = () => {
      const j = hitung();
      if (document.title !== j) document.title = j;
    };
    terapkan();
    const obs = new MutationObserver(terapkan);
    obs.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => obs.disconnect();
  }, [pathname, sistem.nama, sistem.tagline]);

  // Halaman landing / masuk / daftar / kios kunjungan: tampil polos (tanpa
  // sidebar & menu admin — kios check-in di komputer perpustakaan sengaja
  // terpisah dari panel agar tidak membuka akses ke dashboard admin).
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/kunjungan"
  ) {
    return <>{children}</>;
  }

  // Belum masuk tapi membuka rute yang masih diizinkan untuk tamu (katalog):
  // navbar publik, konten read-only.
  if (!sedangMasuk && diizinkan) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-[var(--border)] bg-white/90 backdrop-blur sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-[var(--brand)] text-white grid place-items-center">
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
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="font-bold text-[15px]">{sistem.nama}</div>
                <div className="text-[11px] text-[var(--muted)]">
                  {sistem.tagline}
                </div>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-[var(--brand)]">
                Beranda
              </Link>
              <Link href="/katalog" className="hover:text-[var(--brand)]">
                Katalog Buku
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn btn-ghost">
                Masuk
              </Link>
              {cekIzin(kebijakan, "tamu", "akun.daftar") && (
                <Link href="/register" className="btn btn-primary">
                  Daftar
                </Link>
              )}
            </div>
          </div>
        </header>
        {/* key pathname: animasi masuk berjalan ulang tiap rute berganti. */}
        <main
          key={pathname}
          className="anim-halaman flex-1 p-6 max-w-6xl mx-auto w-full"
        >
          {children}
        </main>
      </div>
    );
  }

  // Proteksi: jangan render konten privat sebelum keputusan masuk.
  if (!sedangMasuk) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--muted)] text-sm">
        Mengalihkan ke halaman masuk…
      </div>
    );
  }
  // Rute khusus peran dengan sesi salah peran: efek di atas sedang
  // mengalihkan — tampilkan penanda singkat, tanpa layar "Akses Ditolak".
  if (!peranCocok) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--muted)] text-sm">
        Mengalihkan…
      </div>
    );
  }
  // Izin rute dicabut oleh kebijakan: tampilkan layar tolak (bukan redirect
  // silang) agar peran & izin yang hilang jelas bagi pengguna.
  if (!diizinkan) {
    return <TolakAkses peran={peran} izin={izinRute ?? "-"} />;
  }

  const nav = NAV.filter(
    (n) =>
      (!n.izin || cekIzin(kebijakan, peran, n.izin)) &&
      (!n.hanyaPeran || n.hanyaPeran.includes(peran)),
  );

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex">
        <Sidebar peran={sedangMasuk.peran} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 shrink-0 bg-[var(--card)]/90 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold truncate tracking-tight">
              {judul}
            </h1>
            <span
              aria-hidden
              className="hidden sm:block h-4 w-px bg-[var(--border)]"
            />
            <span className="hidden sm:block text-xs text-[var(--muted)] truncate">
              {peran === "admin" ? "Operasional perpustakaan" : "Panel Anggota"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {peran === "admin" ? (
              <div className="hidden lg:block">
                <StatusPill />
              </div>
            ) : (
              <span className="hidden md:flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--muted)]">
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
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {hariIni}
              </span>
            )}
            <AkunMenu peran={sedangMasuk.peran} />
          </div>
        </header>{" "}
        {/* Navigasi versi mobile */}
        <div className="md:hidden sticky top-16 z-20 bg-[var(--card)]/95 backdrop-blur-md border-b border-[var(--border)] px-3 py-2 flex gap-1.5 overflow-x-auto">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pathname === n.href
                  ? "bg-[var(--brand)] text-white shadow-[var(--sh-1)]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
        <main key={pathname} className="anim-halaman flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <LibraryProvider>
          <Shell>{children}</Shell>
        </LibraryProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
