"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ambilKebijakan, peranEfektif, tujuanRumah } from "@/lib/akses";
import { useSistem } from "@/lib/sistem";

// Kerangka halaman publik yang ditautkan dari landing page: /kontak,
// /kebijakan-privasi, dan /syarat-ketentuan. Ketiganya tampil POLOS (tanpa
// sidebar) untuk semua sesi — lihat daftar rute polos di AppShell — sehingga
// pengunjung maupun anggota yang sedang masuk melihat halaman yang sama.

const IKON_BUKU =
  "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z M14 3v5h5";

export default function PublikLayout({ children }: { children: React.ReactNode }) {
  const sistem = useSistem();
  const { sedangMasuk } = useAuth();
  // Halaman tujuan mengikuti peran: petugas → dashboard, anggota → panel,
  // tamu → halaman masuk. tujuanRumah selalu memilih halaman yang masih
  // diizinkan kebijakan akses, sehingga tautan tak pernah mendarat di layar tolak.
  const hrefPanel = sedangMasuk
    ? tujuanRumah(ambilKebijakan(), peranEfektif(sedangMasuk.peran))
    : "/login";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl grad-brand text-white shadow-sm">
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
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight">
                {sistem.nama}
              </span>
              <span className="block text-[11px] text-[var(--muted)]">
                {sistem.tagline}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/"
              className="rounded-full px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--brand-ink)]"
            >
              Beranda
            </Link>
            <Link
              href="/katalog"
              className="hidden rounded-full px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[var(--brand-ink)] sm:block"
            >
              Katalog
            </Link>
            <Link href={hrefPanel} className="btn btn-primary !rounded-full !px-4">
              {sedangMasuk ? "Panel Saya" : "Masuk"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-[var(--muted)] sm:flex-row">
          <span>
            © {new Date().getFullYear()} {sistem.nama}. Seluruh hak cipta
            dilindungi.
          </span>
          <span className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/kebijakan-privasi" className="transition-colors hover:text-[var(--brand-ink)]">
              Kebijakan Privasi
            </Link>
            <Link href="/syarat-ketentuan" className="transition-colors hover:text-[var(--brand-ink)]">
              Syarat &amp; Ketentuan
            </Link>
            <Link href="/kontak" className="transition-colors hover:text-[var(--brand-ink)]">
              Kontak
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
