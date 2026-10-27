"use client";

import Link from "next/link";
import { useLibrary, useHelper, hariTerlambat } from "@/lib/library-context";
import { useSistem } from "@/lib/sistem";
import { StatCard, Badge, EmptyState, rupiah, tanggalPanjang, BadgeTone } from "@/components/ui";
import { useJejak, type JenisJejak } from "@/lib/audit";

function statusBadge(status: string, telat: number): { label: string; tone: BadgeTone } {
  if (status === "Dikembalikan") return { label: "Dikembalikan", tone: "green" };
  if (status === "Terlambat" || telat > 0)
    return { label: telat > 0 ? `Terlambat ${telat} hr` : "Terlambat", tone: "rose" };
  return { label: "Dipinjam", tone: "sky" };
}

// Ikon jejak aktivitas (path stroke viewBox 24) untuk feed "Aktivitas Terkini".
const IKON_JEJAK: Record<JenisJejak, string> = {
  masuk: "M12 11a4 4 0 100-8 4 4 0 000 8z M5 20v-1a5 5 0 015-5h4a5 5 0 015 5v1",
  pinjam: "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  kembali: "M9 14l-4-4 4-4 M5 10h9a5 5 0 010 10h-3",
  perpanjang: "M12 6v6l4 2 M3 12a9 9 0 109-9 8.9 8.9 0 00-6.4 2.6L3 8",
  buku: "M4 6h16M4 12h16M4 18h10",
  anggota: "M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 10a4 4 0 100-8 4 4 0 000 8 M22 20v-2a4 4 0 00-3-3.87",
  akun: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  sistem: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
};

// Warna segmen donat distribusi kategori (fallback bila vari tema kurang).
const WARNA_KATEGORI = ["var(--brand)", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#f43f5e"];

// Waktu relatif singkat untuk feed aktivitas ("baru saja", "3 jam lalu", …).
function relatif(iso: string): string {
  const dtk = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (dtk < 60) return "baru saja";
  if (dtk < 3600) return `${Math.floor(dtk / 60)} mnt lalu`;
  if (dtk < 86400) return `${Math.floor(dtk / 3600)} jam lalu`;
  if (dtk < 604800) return `${Math.floor(dtk / 86400)} hari lalu`;
  return tanggalPanjang(iso.slice(0, 10));
}

export default function DashboardAdminPage() {
  const { buku, anggota, peminjaman, siap } = useLibrary();
  const { cariBuku, cariAnggota } = useHelper();
  const sistem = useSistem();
  // useSyncExternalStore: aman dipanggil sebelum early return (server selalu []).
  const jejak = useJejak();

  if (!siap) {
    return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;
  }

  const dipinjam = peminjaman.filter((p) => p.status === "Dipinjam");
  const terlambat = dipinjam.filter((p) => hariTerlambat(p.tanggalKembali) > 0);
  const totalStok = buku.reduce((s, b) => s + b.stok, 0);
  const totalDendaBelum = terlambat.reduce(
    (s, p) => s + hariTerlambat(p.tanggalKembali) * sistem.dendaPerHari,
    0
  );

  // Buku paling sering dipinjam.
  const hitung: Record<string, number> = {};
  peminjaman.forEach((p) => {
    hitung[p.bukuId] = (hitung[p.bukuId] || 0) + 1;
  });
  const populer = Object.entries(hitung)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ buku: cariBuku(id), n }))
    .filter((x) => x.buku);

  const maxPopuler = populer[0]?.n ?? 1;

  const pinjamanTerbaru = peminjaman
    .slice()
    .sort((a, b) => (a.tanggalPinjam < b.tanggalPinjam ? 1 : -1))
    .slice(0, 6);

  // Tren peminjaman 6 bulan terakhir (dihitung dari tanggal pinjam).
  const tren: { label: string; jumlah: number; kini: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const kunci = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    tren.push({
      label: d.toLocaleDateString("id-ID", { month: "short" }),
      jumlah: peminjaman.filter((p) => p.tanggalPinjam.slice(0, 7) === kunci).length,
      kini: i === 0,
    });
  }
  const maksTren = Math.max(1, ...tren.map((t) => t.jumlah));

  // Distribusi judul per kategori (donat).
  const perKategori = Object.entries(
    buku.reduce<Record<string, number>>((acc, b) => {
      acc[b.kategori] = (acc[b.kategori] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const totalJudul = buku.length || 1;
  const KELILING = 2 * Math.PI * 42; // keliling lingkaran donat (r = 42)
  // Offset tiap segmen = akumulasi panjang segmen sebelumnya (tanpa mutable).
  const segmen = perKategori.map(([, n], i) => ({
    panjang: (n / totalJudul) * KELILING,
    offset: perKategori
      .slice(0, i)
      .reduce((acc, [, m]) => acc + (m / totalJudul) * KELILING, 0),
  }));

  const jejakTerkini = jejak.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Sapaan + konteks waktu — pembuka ala dashboard profesional. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Ringkasan Operasional
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Pantau sirkulasi, tunggakan, dan aktivitas {sistem.nama} hari ini.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
          {new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {/* Peringatan jatuh tempo — muncul hanya bila ada tunggakan. */}
      {terlambat.length > 0 && (
        <div className="card flex flex-wrap items-center gap-4 border-rose-200 bg-rose-50 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
          </span>
          <div className="flex-1 min-w-[14rem]">
            <div className="text-sm font-bold text-rose-800">
              {terlambat.length} peminjaman melewati jatuh tempo
            </div>
            <div className="text-xs text-rose-700">
              Potensi denda {rupiah(totalDendaBelum)} — tagih saat pengembalian lewat Sirkulasi.
            </div>
          </div>
          <Link href="/sirkulasi" className="btn btn-danger shrink-0">
            Buka Sirkulasi
          </Link>
        </div>
      )}

      {/* Kartu statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Judul Buku" value={buku.length} sub={`${totalStok} eksemplar`} tone="brand" ikon="M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <StatCard label="Anggota Terdaftar" value={anggota.length} sub={`${anggota.filter((a) => a.aktif).length} aktif`} tone="sky" ikon="M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 10a4 4 0 100-8 4 4 0 000 8 M22 20v-2a4 4 0 00-3-3.87" />
        <StatCard label="Sedang Dipinjam" value={dipinjam.length} sub="belum kembali" tone="amber" ikon="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        <StatCard label="Terlambat" value={terlambat.length} sub={rupiah(totalDendaBelum)} tone="rose" ikon="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      </div>

      {/* Tren peminjaman + aktivitas terkini */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 20h16M7 16V9M12 16V5M17 16v-4" />
                </svg>
              </span>
              <h2 className="font-bold">Tren Peminjaman</h2>
            </div>
            <span className="text-xs text-[var(--muted)]">6 bulan terakhir</span>
          </div>
          <div className="p-5">
            {tren.every((t) => t.jumlah === 0) ? (
              <p className="text-sm text-[var(--muted)]">Belum ada peminjaman pada periode ini.</p>
            ) : (
              <svg
                viewBox="0 0 340 150"
                className="w-full h-auto"
                role="img"
                aria-label="Grafik batang tren peminjaman enam bulan terakhir"
              >
                <line x1="8" y1="112" x2="332" y2="112" stroke="var(--border)" strokeWidth="1" />
                {tren.map((t, i) => {
                  const x = 22 + i * 52;
                  const h = t.jumlah === 0 ? 0 : Math.max(6, (t.jumlah / maksTren) * 96);
                  return (
                    <g key={i}>
                      {t.jumlah > 0 && (
                        <rect
                          x={x}
                          y={112 - h}
                          width="34"
                          height={h}
                          rx="5"
                          fill="var(--brand)"
                          opacity={t.kini ? 1 : 0.45}
                        />
                      )}
                      <text
                        x={x + 17}
                        y={t.jumlah > 0 ? 112 - h - 6 : 104}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="var(--foreground)"
                      >
                        {t.jumlah > 0 ? t.jumlah : "0"}
                      </text>
                      <text x={x + 17} y="132" textAnchor="middle" fontSize="10" fill="var(--muted)">
                        {t.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-bold">Aktivitas Terkini</h2>
            <span className="text-xs text-[var(--muted)]">{jejak.length} jejak</span>
          </div>
          <div className="p-5 space-y-4">
            {jejakTerkini.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Belum ada aktivitas. Aksi seperti pinjam, kembali, atau simpan pengaturan akan
                tercatat di sini.
              </p>
            ) : (
              jejakTerkini.map((j) => (
                <div key={j.id} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={IKON_JEJAK[j.jenis]} />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-snug">
                      <span className="font-semibold">{j.aksi}</span>
                      <span className="text-[var(--muted)]"> — {j.objek}</span>
                    </div>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {j.aktor} ({j.peran}) · {relatif(j.waktu)}
                    </div>
                    {j.detail && <div className="truncate text-xs text-[var(--muted)]">{j.detail}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Peminjaman terbaru */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-bold">Peminjaman Terbaru</h2>
            <Link href="/sirkulasi" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              Lihat semua →
            </Link>
          </div>
          {pinjamanTerbaru.length === 0 ? (
            <div className="p-5">
              <EmptyState pesan="Belum ada peminjaman" sub="Mulai dari halaman Sirkulasi." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Buku</th>
                    <th>Anggota</th>
                    <th>Jatuh Tempo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pinjamanTerbaru.map((p) => {
                    const b = cariBuku(p.bukuId);
                    const a = cariAnggota(p.anggotaId);
                    const telat = hariTerlambat(p.tanggalKembali);
                    const sb = statusBadge(p.status, telat);
                    return (
                      <tr key={p.id}>
                        <td className="font-medium">{b?.judul ?? "-"}</td>
                        <td>{a?.nama ?? "-"}</td>
                        <td className="text-[var(--muted)]">{tanggalPanjang(p.tanggalKembali)}</td>
                        <td>
                          <Badge tone={sb.tone}>{sb.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kolom kanan: buku populer + distribusi kategori */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-bold">Buku Populer</h2>
              <Link href="/katalog" className="text-sm font-semibold text-[var(--brand)] hover:underline">
                Katalog →
              </Link>
            </div>
            <div className="p-5 space-y-4">
              {populer.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Belum ada data peminjaman.</p>
              ) : (
                populer.map(({ buku: b, n }) => (
                  <div key={b!.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate pr-2">{b!.judul}</span>
                      <span className="text-[var(--muted)] shrink-0">{n}x</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-[var(--brand)]"
                        style={{ width: `${Math.max(8, (n / maxPopuler) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Distribusi kategori (donat) */}
          <div className="card">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-bold">Distribusi Kategori</h2>
            </div>
            <div className="p-5 flex flex-col items-center gap-5 sm:flex-row">
              {perKategori.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Belum ada buku di katalog.</p>
              ) : (
                <>
                  <div className="relative shrink-0">
                    <svg viewBox="0 0 110 110" className="h-32 w-32 -rotate-90" aria-hidden>
                      <circle cx="55" cy="55" r="42" fill="none" stroke="var(--border)" strokeWidth="14" />
                      {segmen.map((s, i) => (
                        <circle
                          key={i}
                          cx="55"
                          cy="55"
                          r="42"
                          fill="none"
                          stroke={WARNA_KATEGORI[i % WARNA_KATEGORI.length]}
                          strokeWidth="14"
                          strokeDasharray={`${s.panjang} ${KELILING - s.panjang}`}
                          strokeDashoffset={-s.offset}
                        />
                      ))}
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-center">
                      <div>
                        <div className="text-xl font-bold leading-none">{totalJudul}</div>
                        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">judul</div>
                      </div>
                    </div>
                  </div>
                  <ul className="w-full flex-1 space-y-2 text-sm">
                    {perKategori.map(([nama, n], i) => (
                      <li key={nama} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: WARNA_KATEGORI[i % WARNA_KATEGORI.length] }}
                        />
                        <span className="flex-1 truncate">{nama}</span>
                        <span className="text-[var(--muted)]">{n}</span>
                        <span className="w-10 text-right text-xs text-[var(--muted)]">
                          {Math.round((n / totalJudul) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
