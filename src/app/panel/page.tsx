"use client";

import Link from "next/link";
import { ArrowRight, BookMarked, BookOpen, Library } from "lucide-react";
import { useLibrary, useHelper } from "@/lib/library-context";
import { Badge, EmptyState, StatCard, tanggalPanjang } from "@/components/ui";
import { Naik, NaikBertahap } from "@/components/gerak";
import { useSistem } from "@/lib/sistem";

// Beranda panel anggota. Disusun dengan komponen bersama (.card, StatCard,
// Badge) supaya terasa satu aplikasi dengan halaman petugas — bukan halaman
// terpisah dengan kanvas dan judulnya sendiri. Judul halaman sudah tampil di
// header AppShell ("Beranda"), jadi tidak diulang di sini.

export default function PanelPage() {
  const { peminjaman, siap } = useLibrary();
  const { cariBuku } = useHelper();
  const sistem = useSistem();

  // Ringkasan aktivitas anggota.
  const totalPeminjaman = peminjaman?.length ?? 0;

  const peminjamanAktif = (peminjaman ?? []).filter(
    (item) => item.status === "Dipinjam",
  );

  const selesai = (peminjaman ?? []).filter(
    (item) => item.status === "Dikembalikan",
  );

  return (
    <div className="space-y-6">
      {/* Sambutan + jalan pintas ke katalog */}
      <Naik>
        <section className="relative isolate overflow-hidden rounded-2xl grad-brand p-6 text-white sm:p-8">
          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
              Perpustakaan digital
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Selamat datang di {sistem.nama}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Temukan bacaan baru, pantau pinjaman, dan kelola keanggotaan Anda
              dari satu tempat.
            </p>

            <Link
              href="/katalog"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] transition hover:bg-[var(--brand-soft)]"
            >
              Jelajahi katalog
              <ArrowRight size={16} />
            </Link>
          </div>

          <Library
            className="absolute -bottom-8 -right-4 h-48 w-48 text-white/10 sm:h-56 sm:w-56"
            strokeWidth={1}
            aria-hidden
          />
        </section>
      </Naik>

      {/* Ringkasan angka */}
      <NaikBertahap className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Peminjaman"
          value={siap ? totalPeminjaman : "—"}
          sub="sepanjang riwayat"
          tone="brand"
          ikon="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
        />
        <StatCard
          label="Sedang Dipinjam"
          value={siap ? peminjamanAktif.length : "—"}
          sub="belum dikembalikan"
          tone="sky"
          ikon="M12 6v6l4 2 M3 12a9 9 0 109-9 8.9 8.9 0 00-6.4 2.6L3 8"
        />
        <StatCard
          label="Buku Dikembalikan"
          value={siap ? selesai.length : "—"}
          sub="selesai dipinjam"
          tone="slate"
          ikon="M20 6L9 17l-5-5"
        />
      </NaikBertahap>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Peminjaman aktif terbaru */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand-ink)]">
                <BookMarked size={15} />
              </span>
              <h2 className="font-bold">Aktivitas Peminjaman</h2>
            </div>
            <Link
              href="/panel/pinjaman"
              className="text-sm font-semibold text-[var(--brand-ink)] hover:underline"
            >
              Lihat semua →
            </Link>
          </div>

          {!siap ? (
            <p className="p-6 text-sm text-[var(--muted)]">Memuat data…</p>
          ) : peminjamanAktif.length === 0 ? (
            <EmptyState
              kartu={false}
              pesan="Belum ada peminjaman aktif"
              sub="Buku yang sedang dipinjam akan muncul di sini."
            />
          ) : (
            <div className="px-5">
              <div className="divide-y divide-[var(--border)]">
                {peminjamanAktif.slice(0, 5).map((item, index) => (
                  <div
                    key={item.id ?? index}
                    className="flex items-center justify-between gap-3 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-ink)]">
                        <BookOpen size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {cariBuku(item.bukuId)?.judul ?? "Buku"}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          Dipinjam {tanggalPanjang(item.tanggalPinjam)}
                        </p>
                      </div>
                    </div>

                    <Badge tone="sky">Dipinjam</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Jalan pintas menu anggota */}
        <div className="card">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-bold">Akses Cepat</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Menu yang paling sering dibuka anggota.
            </p>
          </div>

          <div className="space-y-1 p-3">
            {[
              {
                href: "/katalog",
                label: "Katalog Buku",
                sub: "Jelajahi koleksi",
                ikon: <BookOpen size={18} />,
              },
              {
                href: "/panel/pinjaman",
                label: "Peminjaman Saya",
                sub: "Periksa status pinjaman",
                ikon: <BookMarked size={18} />,
              },
              {
                href: "/panel/profil",
                label: "Profil Anggota",
                sub: "Kelola informasi akun",
                ikon: (
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
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                    <path d="M9 11a4 4 0 100-8 4 4 0 000 8" />
                  </svg>
                ),
              },
            ].map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-[var(--brand-soft)]/50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-ink)]">
                  {menu.ikon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {menu.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {menu.sub}
                  </span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-[var(--muted)]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
