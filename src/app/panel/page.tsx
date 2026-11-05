
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  BookOpen,
  BookMarked,
  Clock,
  CheckCircle2,
  ArrowRight,
  Library,
} from "lucide-react";
import { useLibrary, useHelper } from "@/lib/library-context";
import { tanggalPanjang } from "@/components/ui";

export default function PanelPage() {
  const { peminjaman, siap } = useLibrary();
  const { cariBuku } = useHelper();

  // Data ringkasan
  const totalPeminjaman = peminjaman?.length ?? 0;

  // Status mengikuti type Peminjaman (src/lib/types.ts): "Dipinjam" /
  // "Dikembalikan" / "Terlambat" — tanpa pembanding longgar.
  const peminjamanAktif = (peminjaman ?? []).filter(
    (item) => item.status === "Dipinjam"
  );

  const selesai = (peminjaman ?? []).filter(
    (item) => item.status === "Dikembalikan"
  );

  const stats = [
    {
      title: "Total Peminjaman",
      value: totalPeminjaman,
      icon: BookOpen,
    },
    {
      title: "Sedang Dipinjam",
      value: peminjamanAktif.length,
      icon: Clock,
    },
    {
      title: "Buku Dikembalikan",
      value: selesai.length,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">
              Beranda
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Selamat datang di panel anggota PustakaKu.
            </p>
          </div>

          <Link
            href="/katalog"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <BookOpen size={17} />
            Jelajahi Buku
          </Link>
        </motion.div>

        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-800 to-teal-500 p-6 text-white sm:p-8"
        >
          <div className="relative z-10 max-w-xl">
            <p className="text-sm font-medium text-teal-100">
              DIGITAL LIBRARY
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Selamat Datang di PustakaKu
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-teal-50">
              Temukan pengetahuan baru, jelajahi koleksi buku, dan kelola
              aktivitas peminjaman buku dengan mudah.
            </p>

            <Link
              href="/katalog"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
            >
              Lihat Katalog
              <ArrowRight size={16} />
            </Link>
          </div>

          <Library
            className="absolute -bottom-8 -right-4 h-48 w-48 text-white/10 sm:h-56 sm:w-56"
            strokeWidth={1}
          />
        </motion.div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      {stat.title}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-800">
                      {siap ? stat.value : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-teal-50 p-3 text-teal-600">
                    <Icon size={23} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Loan List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">
                  Aktivitas Peminjaman
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Ringkasan aktivitas peminjaman buku.
                </p>
              </div>

              <BookMarked className="text-teal-600" size={22} />
            </div>

            {!siap ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Memuat data...
              </p>
            ) : peminjamanAktif.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen
                  size={35}
                  className="mx-auto text-slate-300"
                />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Belum ada peminjaman aktif.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Buku yang sedang dipinjam akan muncul di sini.
                </p>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-slate-100">
                {peminjamanAktif.slice(0, 5).map((item, index) => (
                  <div
                    key={item.id ?? index}
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-xl bg-teal-50 p-3 text-teal-600">
                        <BookOpen size={19} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {cariBuku(item.bukuId)?.judul ?? "Buku"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {tanggalPanjang(item.tanggalPinjam)}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Dipinjam
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/panel/pinjaman"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
            >
              Lihat Semua Peminjaman
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Quick Access */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-800">
              Akses Cepat
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Akses menu anggota dengan mudah.
            </p>

            <div className="mt-5 space-y-3">
              <Link
                href="/katalog"
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-teal-200 hover:bg-teal-50"
              >
                <div className="rounded-lg bg-teal-50 p-2.5 text-teal-600">
                  <BookOpen size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Katalog Buku
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Jelajahi koleksi buku
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </Link>

              <Link
                href="/panel/pinjaman"
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-teal-200 hover:bg-teal-50"
              >
                <div className="rounded-lg bg-teal-50 p-2.5 text-teal-600">
                  <BookMarked size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Peminjaman Saya
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Periksa status peminjaman
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </Link>

              <Link
                href="/panel/profil"
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-teal-200 hover:bg-teal-50"
              >
                <div className="rounded-lg bg-teal-50 p-2.5 text-teal-600">
                  <CheckCircle2 size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Profil Anggota
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Kelola informasi akun
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </Link>
            </div>
          </div>
        </div>

        <p className="pb-3 text-center text-xs text-slate-400">
          PustakaKu · Sistem Informasi Perpustakaan Digital
        </p>
      </div>
    </div>
  );
}
