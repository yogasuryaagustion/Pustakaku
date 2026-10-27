"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useLibrary, useHelper, hariTerlambat, hitungDenda } from "@/lib/library-context";
import { useJejak } from "@/lib/audit";
import { useSistem } from "@/lib/sistem";
import { Avatar, Badge, EmptyState, SampulBuku, rupiah, tanggalPanjang, BadgeTone } from "@/components/ui";
import type { Peminjaman } from "@/lib/types";

// Panel anggota — tata letak mengikuti desain yang dirujuk: sapaan hero,
// empat kartu statistik (ikon kiri + chevron), pinjaman terbaru dengan sampul
// buku, dan aktivitas singkat dari jejak audit milik akun ini sendiri.
// Mutasi (pinjam / kembali / profil) pindah ke halaman masing-masing.

function statusBadge(p: Peminjaman): { label: string; tone: BadgeTone } {
  if (p.status === "Dikembalikan") return { label: "Dikembalikan", tone: "green" };
  const telat = hariTerlambat(p.tanggalKembali);
  if (telat > 0 || p.status === "Terlambat") {
    return { label: telat > 0 ? `Terlambat ${telat} hr` : "Terlambat", tone: "rose" };
  }
  return { label: "Dipinjam", tone: "sky" };
}

function KartuStat({
  label,
  nilai,
  sub,
  nada,
  ikon,
  href,
}: {
  label: string;
  nilai: string | number;
  sub: string;
  nada: string;
  ikon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`card flex items-center gap-4 p-5 transition-shadow ${nada}`}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-current/10 text-current">
        {ikon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </span>
        <span className="block text-2xl font-extrabold tracking-tight text-slate-900">{nilai}</span>
        <span className="block text-xs text-[var(--muted)]">{sub}</span>
      </span>
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300" aria-hidden
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export default function PanelAnggotaPage() {
  const { sedangMasuk } = useAuth();
  const { anggota, peminjaman, siap } = useLibrary();
  const { cariBuku } = useHelper();
  const sistem = useSistem();
  const jejak = useJejak();

  // Kartu anggota: akun punya tautan anggotaId (lihat SEED_PENGGUNA);
  // fallback ke kecocokan email bila tautan tidak ada.
  const kartu = useMemo(() => {
    if (!sedangMasuk) return undefined;
    if (sedangMasuk.anggotaId) return anggota.find((a) => a.id === sedangMasuk.anggotaId);
    return anggota.find((a) => a.email.toLowerCase() === sedangMasuk.email.toLowerCase());
  }, [anggota, sedangMasuk]);
  const pinjamSaya = useMemo(
    () => peminjaman.filter((p) => p.anggotaId === kartu?.id),
    [peminjaman, kartu]
  );

  // Aktivitas: jejak audit yang menyangkut akun ini (kode pinjaman sendiri,
  // akun dibuat, atau pembaruan profil yang menampilkan nama/email sendiri).
  const jejakSaya = useMemo(() => {
    if (!sedangMasuk) return [];
    const kode = new Set(pinjamSaya.map((p) => p.kodePinjam.toLowerCase()));
    // Jejak peminjaman memakai judul buku sebagai objek (lihat pinjamBuku).
    const judul = new Set(
      pinjamSaya.map((p) => (cariBuku(p.bukuId)?.judul ?? "").toLowerCase())
    );
    const email = sedangMasuk.email.toLowerCase();
    const terlihat = new Set<string>();
    return jejak
      .filter((j) => {
        const objek = String(j.objek ?? "").toLowerCase();
        const detail = String(j.detail ?? "");
        // "masuk" (login) dikeluarkan — terlalu sering menutupi aktivitas nyata.
        return (
          j.jenis !== "masuk" &&
          (kode.has(objek) ||
          judul.has(objek) ||
          objek === email ||
          detail.toLowerCase().includes(sedangMasuk.nama.toLowerCase()) ||
          detail.toLowerCase().includes(email))
        );
      })
      // Aksi+objek sama hanya tampil sekali (mis. banyak simpan profil).
      .filter((j) => {
        const kunci = `${j.aksi}|${String(j.objek ?? "").toLowerCase()}`;
        if (terlihat.has(kunci)) return false;
        terlihat.add(kunci);
        return true;
      })
      .slice(0, 4);
  }, [jejak, pinjamSaya, sedangMasuk, cariBuku]);

  if (!siap || !sedangMasuk) {
    return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;
  }

  const nama = kartu?.nama ?? sedangMasuk.nama;
  const dendaHarian = sistem.dendaPerHari;
  const hariIni = new Date().toISOString().slice(0, 10);

  const aktif = pinjamSaya.filter((p) => p.status === "Dipinjam").length;
  const terlambat = pinjamSaya.filter(
    (p) => p.status === "Dipinjam" && hariTerlambat(p.tanggalKembali) > 0
  ).length;
  const totalDenda = pinjamSaya.reduce(
    (n, p) =>
      n +
      (p.status === "Dikembalikan"
        ? p.denda ?? 0
        : hitungDenda(p.tanggalKembali, p.tanggalKembaliAktual ?? hariIni, dendaHarian)),
    0
  );

  const jam = new Date().getHours();
  const sapa = jam < 11 ? "Selamat pagi" : jam < 15 ? "Selamat siang" : jam < 18 ? "Selamat sore" : "Selamat malam";

  const terbaru = [...pinjamSaya]
    .sort((a, b) => (a.tanggalPinjam < b.tanggalPinjam ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Sapaan hero */}
      <section className="relative overflow-hidden rounded-2xl grad-brand p-7 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 opacity-25">
          <svg width="280" height="170" viewBox="0 0 280 170" fill="none">
            <rect x="40" y="112" width="210" height="24" rx="8" fill="white" />
            <rect x="58" y="84" width="180" height="24" rx="8" fill="white" opacity="0.85" />
            <rect x="80" y="56" width="140" height="24" rx="8" fill="white" opacity="0.7" />
            <circle cx="238" cy="44" r="22" fill="white" opacity="0.45" />
            <path d="M238 30c-8 4-12 10-12 18 8 0 14-6 12-18z" fill="white" opacity="0.8" />
          </svg>
        </div>
        <div className="relative flex items-start gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white/85">{sapa},</p>
            <h2 className="mt-0.5 truncate text-3xl font-extrabold tracking-tight">{nama} 👋</h2>
            <p className="mt-1.5 max-w-xl text-sm text-white/85">
              Selamat datang di {sistem.nama}. Semoga hari ini penuh dengan pengetahuan baru!
            </p>
          </div>
        </div>
      </section>

      {/* Ringkasan statistik */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuStat
          label="Pinjaman Aktif"
          nilai={aktif}
          sub="sedang dipinjam"
          nada="text-[var(--brand)]"
          href="/panel/pinjaman"
          ikon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          }
        />
        <KartuStat
          label="Terlambat"
          nilai={terlambat}
          sub={terlambat > 0 ? "melewati jatuh tempo" : "semua tepat waktu"}
          nada={terlambat > 0 ? "text-rose-500" : "text-slate-400"}
          href="/panel/pinjaman"
          ikon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          }
        />
        <KartuStat
          label="Total Transaksi"
          nilai={pinjamSaya.length}
          sub="sepanjang waktu"
          nada="text-sky-500"
          href="/panel/pinjaman"
          ikon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          }
        />
        <KartuStat
          label="Total Denda"
          nilai={rupiah(totalDenda)}
          sub="akumulasi"
          nada="text-amber-500"
          href="/panel/pinjaman"
          ikon={
            <span className="text-sm font-extrabold" aria-hidden>Rp</span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Pinjaman terbaru */}
        <div className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h3 className="font-bold">Pinjaman Terbaru</h3>
            <Link href="/panel/pinjaman" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              Lihat semua →
            </Link>
          </div>
          {terbaru.length === 0 ? (
            <div className="p-5">
              <EmptyState
                pesan="Belum ada pinjaman"
                sub="Ajukan peminjaman pertama Anda dari Katalog Buku."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Buku</th>
                    <th>Jatuh Tempo</th>
                    <th>Denda</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {terbaru.map((p) => {
                    const b = cariBuku(p.bukuId);
                    const s = statusBadge(p);
                    return (
                      <tr key={p.id}>
                        <td className="font-mono text-xs">{p.kodePinjam}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            {b && (
                              <SampulBuku
                                buku={b}
                                className="h-12 w-9 shrink-0 rounded shadow-sm"
                                tampilkanJudul={false}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium">{b?.judul ?? "-"}</div>
                              <div className="truncate text-xs text-[var(--muted)]">{b?.penulis ?? ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-[var(--muted)]">{tanggalPanjang(p.tanggalKembali)}</td>
                        <td>
                          {p.denda ? (
                            <span className="font-semibold text-rose-600">{rupiah(p.denda)}</span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Aktivitas singkat */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold">Aktivitas Singkat</h3>
          {jejakSaya.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Belum ada aktivitas tercatat.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {jejakSaya.map((j, i) => (
                <li key={`${j.waktu}-${i}`} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      j.jenis === "buku" || j.jenis === "pinjam"
                        ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                        : j.jenis === "akun" || j.jenis === "anggota"
                          ? "bg-sky-50 text-sky-500"
                          : j.jenis === "kembali" || j.jenis === "perpanjang"
                            ? "bg-violet-50 text-violet-500"
                            : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {j.jenis === "buku" || j.jenis === "pinjam" ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                    ) : j.jenis === "akun" || j.jenis === "anggota" ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{j.aksi}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{j.objek}</div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] leading-tight text-[var(--muted)]">
                    <div>{tanggalPanjang(j.waktu.slice(0, 10))}</div>
                    <div>{j.waktu.slice(11, 16)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Kartu anggota kecil — identitas akun ini */}
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <Avatar nama={nama} foto={kartu?.foto} className="h-12 w-12 rounded-xl text-lg" />
        <div className="min-w-0">
          <div className="font-bold">{nama}</div>
          <div className="text-xs text-[var(--muted)]">
            {kartu?.nomorAnggota ?? "Tanpa kartu anggota"}
            {kartu ? ` · ${kartu.jenis}` : ""} · {sedangMasuk.email}
          </div>
        </div>
        <Link href="/panel/profil" className="btn btn-ghost ml-auto">
          Profil
        </Link>
      </div>
    </div>
  );
}
