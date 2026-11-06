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
  petugas,
  RUTE_TERBUKA,
  tujuanRumah,
  type PeranAkses,
} from "@/lib/akses";
import { useSistem } from "@/lib/sistem";
import { ToastProvider } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { PanelLeftClose } from "@/components/animate-ui/icons/panel-left-close";
import { useKebijakan } from "@/lib/kebijakan";
// Pemetaan rute → izin, matriks peran, dan tujuan rumah semuanya mengikuti
// kebijakan di src/lib/akses.ts — mengubahnya lewat /admin/akses langsung
// menutup/membuka halaman, tombol, dan mutasi tanpa menyentuh kode.

// Judul sub-halaman yang tidak punya entri menu sendiri (menu menunjuk induk).
// Tanpa peta ini, header & judul tab jatuh ke tagline perpustakaan.
const JUDUL_SUB: Record<string, string> = {
  "/inventaris/eksemplar": "Data Eksemplar",
  "/inventaris/opname": "Stock Opname",
  "/inventaris/rekonsiliasi": "Hasil Sinkronisasi",
  "/inventaris/riwayat": "Riwayat Opname",
  "/inventaris/label": "Label QR Inventaris",
};

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
    label: "Peminjaman Saya",
    icon: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
    izin: "panel.pinjaman",
  },
  // Riwayat peminjaman anggota — tab "Riwayat" dari halaman pinjaman yang
  // dijadikan halaman sendiri sesuai menu panel anggota.

  {
    grup: "MENU UTAMA",
    href: "/anggota/kartu",
    label: "Kartu Anggota",
    icon: "M2 7h20M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z M6 15h4",
    izin: "kartu.lihat",
    hanyaPeran: ["user"],
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
    href: "/inventaris",
    label: "Inventaris Buku",
    icon: "M20 7l-8-4-8 4v10l8 4 8-4V7z M4 7l8 4 8-4 M12 21V11",
    izin: "katalog.kelola",
    hanyaPeran: ["admin", "superadmin"],
  },
  {
    grup: "Utama",
    href: "/anggota",
    label: "Manajemen Pengguna",
    icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M22 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
    izin: "anggota.lihat",
  },
  // Analitik: statistik kunjungan (halaman sendiri) & laporan — keduanya
  // membaca sumber data kunjungan yang sama lewat /api/kunjungan.
  {
    grup: "Analitik",
    href: "/kunjungan",
    label: "Statistik Kunjungan",
    icon: "M22 11v1a10 10 0 11-20 0v-1M1 11h20M9 8l-1 4-2-3-4-1",
    izin: "laporan.lihat",
  },
  {
    grup: "Analitik",
    href: "/laporan",
    label: "Laporan",
    icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    izin: "laporan.lihat",
  },
  // Kontrol Akses: dijaga gerbang peran Super Admin (RUTE_PERAN di lib/akses.ts),
  // bukan izin matriks — karena itu tanpa prop `izin`, cukup hanyaPeran.
  {
    grup: "Sistem",
    href: "/admin/akses",
    label: "Kelola Akses",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    hanyaPeran: ["superadmin"],
  },
  {
    grup: "Sistem",
    href: "/admin/pengaturan",
    label: "Pengaturan",
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
    izin: "pengaturan.kelola",
  },
  // CATATAN: "Migrasi Data" (/admin/migrasi) sengaja TIDAK dimasukkan ke NAV —
  // disembunyikan dari sidebar & navigasi mobile, tetapi tetap bisa dibuka lewat URL:
  //   * /admin/migrasi dijaga gerbang peran Super Admin (RUTE_PERAN);
  //
  // Monitoring Kunjungan (/kunjungan) ikut NAV di atas sebagai halaman panel:
  // rutenya dijaga izin laporan.lihat (RUTE_IZIN di src/lib/akses.ts) dan tampil
  // dengan sidebar yang sama seperti halaman admin lainnya.
  {
    grup: "MENU UTAMA",
    href: "/panel/profil",
    label: "Profil Saya",
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
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#087F72] shadow-sm">
        <svg
          width="29"
          height="29"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Bentuk buku */}
          <path
            d="M4 8.5C8.5 7 12.5 8 16 11V26C12.5 23 8.5 22 4 23.5V8.5Z"
            fill="white"
            fillOpacity="0.96"
          />
          <path
            d="M28 8.5C23.5 7 19.5 8 16 11V26C19.5 23 23.5 22 28 23.5V8.5Z"
            fill="#D7F3EC"
          />

          {/* Simbol P */}
          <path
            d="M11 20V12.5H17.5C20 12.5 21.5 14 21.5 16C21.5 18 20 19.5 17.5 19.5H13"
            stroke="#087F72"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Garis tengah buku */}
          <path
            d="M16 11V26"
            stroke="#087F72"
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />
        </svg>
      </div>

      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-bold text-[var(--navy)]">
          {sistem.nama}
        </div>
        <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">
          {sistem.tagline}
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  active,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`
        group relative flex min-h-[46px] items-center rounded-xl
        transition-all duration-200 ease-out
        ${collapsed ? "justify-center px-2" : "gap-3 px-3"}
        ${
          active
            ? "bg-[#E7F5F2] text-[#087F72]"
            : "text-slate-500 hover:bg-slate-50 hover:text-[#087F72]"
        }
      `}
    >
      {/* Indikator menu aktif */}
      {active && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#087F72]" />
      )}

      {/* Area ikon */}
      <span
        className={`
          grid h-9 w-9 shrink-0 place-items-center rounded-lg
          transition-all duration-200
          ${
            active
              ? "bg-white text-[#087F72] shadow-sm"
              : "text-current group-hover:bg-white"
          }
        `}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={icon} />
        </svg>
      </span>

      {/* Label menu */}
      {!collapsed && (
        <span className="min-w-0 truncate text-[13px] font-semibold">
          {label}
        </span>
      )}

      {/* Penanda menu aktif */}
      {!collapsed && active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#087F72]" />
      )}
    </Link>
  );
}

function Sidebar({
  peran,
  collapsed,
  onToggle,
}: {
  peran: PeranAkses;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const kebijakan = useKebijakan();
  const { sedangMasuk } = useAuth();
  const { anggota } = useLibrary();

  const kartu = sedangMasuk
    ? (anggota.find((a) => a.id === sedangMasuk.anggotaId) ??
      anggota.find(
        (a) => a.email.toLowerCase() === sedangMasuk.email.toLowerCase(),
      ))
    : undefined;

  const items = NAV.filter(
    (n) =>
      (!n.izin || cekIzin(kebijakan, peran, n.izin)) &&
      (!n.hanyaPeran || n.hanyaPeran.includes(peran)),
  );
  console.log("[DEBUG SIDEBAR]", {
    peran,
    izinAnggota: cekIzin(kebijakan, peran, "anggota.lihat"),
    nilaiMatriks: kebijakan.izin?.[peran]?.["anggota.lihat"],
    menuManajemenPengguna: NAV.some(
      (n) => n.href === "/anggota" && n.izin === "anggota.lihat",
    ),
    hasilFilter: items.map((n) => ({
      href: n.href,
      label: n.label,
    })),
  });

  const labelGrup = (n: (typeof NAV)[number]) =>
    peran === "user" && n.grupUser ? n.grupUser : n.grup;

  const grupTampil = Array.from(new Set(items.map(labelGrup)));

  return (
    <aside
      className={`sticky top-4 flex h-[calc(100vh-2rem)] shrink-0 flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh-3)] transition-[width] duration-300 ${
        collapsed ? "w-[88px]" : "w-[260px]"
      }`}
    >
      {/* HEADER LOGO DAN TOGGLE SIDEBAR */}
      <div
        className={`flex h-[84px] shrink-0 items-center border-b border-[var(--border)] ${
          collapsed ? "justify-center gap-1 px-2" : "justify-between gap-2 px-5"
        }`}
      >
        <div className="min-w-0 flex-1">
          <Logo />
        </div>

        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[#087F72]"
        >
          <PanelLeftClose
            size={21}
            className={`transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* MENU NAVIGASI */}
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {grupTampil.map((g) => (
          <div key={g}>
            {!collapsed && (
              <div className="px-3 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {g}
              </div>
            )}

            <nav aria-label={g} className="space-y-1">
              {items
                .filter((n) => labelGrup(n) === g)
                .map((n) => (
                  <div key={n.href} title={collapsed ? n.label : undefined}>
                    <NavItem
                      href={n.href}
                      label={n.label}
                      icon={n.icon}
                      collapsed={collapsed}
                      active={
                        pathname === n.href ||
                        (n.href !== "/panel" &&
                          n.href !== "/dashboard" &&
                          pathname.startsWith(n.href + "/"))
                      }
                    />
                  </div>
                ))}
            </nav>
          </div>
        ))}

        {items.length === 0 && !collapsed && (
          <p className="px-3 py-2 text-xs text-[var(--text-secondary)]">
            Tidak ada menu yang diizinkan untuk peran Anda.
          </p>
        )}
      </div>

      {/* FOOTER SIDEBAR */}
      {peran === "user" ? (
        <div
          className={`m-3 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--brand-soft)] p-3 ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? (sedangMasuk?.nama ?? "Anggota") : undefined}
        >
          <Avatar
            nama={sedangMasuk?.nama ?? "Anggota"}
            foto={kartu?.foto}
            className="h-10 w-10 shrink-0 rounded-xl text-sm"
          />

          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] text-[var(--text-secondary)]">
                Selamat datang,
              </div>
              <div className="truncate text-sm font-bold text-[var(--navy)]">
                {sedangMasuk?.nama ?? "Anggota"}
              </div>
              <div className="mt-1 text-[10px] font-medium text-[var(--brand-dark)]">
                Anggota
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`m-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5 ${
            collapsed ? "flex justify-center" : ""
          }`}
          title={collapsed ? "Basis Data" : undefined}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--navy)]">
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>

            {!collapsed && "Basis Data"}
          </div>

          {!collapsed && (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
              Katalog dan transaksi dikelola melalui database aplikasi.
            </p>
          )}
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
          className={`h-8 w-8 rounded-lg grid place-items-center text-sm font-bold text-white grad-brand`}
        >
          {inisial}
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">{sedangMasuk.nama}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
            {peran === "superadmin"
              ? "Super Admin"
              : peran === "admin"
                ? "Admin"
                : "Anggota"}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Peran efektif — tidak ada sesi berarti tamu; semua pengecekan izin di
  // bawah mengikuti kebijakan, bukan daftar rute statis.
  const peran: PeranAkses = peranEfektif(sedangMasuk?.peran);
  const izinRute = cariIzinRute(pathname);
  const ruteSelaluBuka = RUTE_TERBUKA.includes(pathname);
  // Pintasan peran di luar matriks izin: /admin/akses khusus Super Admin.
  // (Permintaan: hapus kendali "Kontrol akses" dari matriks — halaman jadi
  // gerbang peran; salah peran dialihkan, tanpa layar "Akses Ditolak".)
  const peranWajib = cariPeranRute(pathname);

  const peranCocok = peranWajib === undefined || peran === peranWajib;
  const diizinkan =
    (izinRute === undefined || cekIzin(kebijakan, peran, izinRute)) &&
    peranCocok;
  const judul =
    NAV.find((n) => n.href === pathname)?.label ??
    JUDUL_SUB[pathname] ??
    sistem.tagline;
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
    // Halaman check-in merupakan halaman publik.
    // Tidak memerlukan sesi login atau izin panel admin.
    if (pathname === "/kunjungan/checkin") return;

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
        JUDUL_SUB[pathname] ??
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

  // Halaman landing / masuk / daftar tampil polos (tanpa sidebar & menu admin).
  // Daftar yang sama dipakai halaman publik hasil tautan landing (kontak,
  // kebijakan privasi, syarat-ketentuan) — lihat src/app/(publik)/layout.tsx.
  const RUTE_POLOS = [
    "/",
    "/login",
    "/register",
    "/kontak",
    "/kebijakan-privasi",
    "/syarat-ketentuan",

    // Halaman check-in publik, tanpa sidebar dan header admin.
    "/kunjungan/checkin",

    // Lembar label QR inventaris: halaman cetak, tanpa sidebar agar hasil
    // cetaknya bersih. Tetap dijaga izin katalog.kelola lewat efek di atas.
    "/inventaris/label",
  ];
  if (RUTE_POLOS.includes(pathname)) {
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
      <div
        className={`hidden shrink-0 p-4 transition-[width] duration-300 md:block ${
          sidebarCollapsed ? "w-[120px]" : "w-[292px]"
        }`}
      >
        <Sidebar
          peran={peran}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 shrink-0 px-4 pt-4 sm:px-6">
          <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-white px-4 shadow-[var(--sh-2)] sm:px-6">
            {/* Judul halaman */}
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-lg font-bold tracking-tight">
                {judul}
              </h1>

              <span
                aria-hidden
                className="hidden h-4 w-px bg-[var(--border)] sm:block"
              />

              <span className="hidden truncate text-xs text-[var(--muted)] sm:block">
                {petugas(peran) ? "Operasional perpustakaan" : "Panel Anggota"}
              </span>
            </div>

            {/* Informasi dan akun */}
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              {petugas(peran) ? (
                <div className="hidden lg:block">
                  <StatusPill />
                </div>
              ) : (
                <span className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--muted)] md:flex">
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
          </div>
        </header>
        {/* Navigasi versi mobile */}
        <div className="md:hidden sticky top-16 z-20 bg-[var(--card)]/95 backdrop-blur-md border-b border-[var(--border)] px-3 py-2 flex gap-1.5 overflow-x-auto tanpa-scrollbar">
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
        <main
          key={pathname}
          className="anim-halaman w-full flex-1 p-4 sm:p-6 lg:p-7"
        >
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
