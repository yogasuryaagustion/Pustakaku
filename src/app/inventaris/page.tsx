"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, EmptyState, StatCard } from "@/components/ui";
import {
  KepalaInventaris,
  NavigasiInventaris,
  useMuatApi,
} from "@/components/inventaris-ui";

// Inventaris Buku — satu baris per judul: stok tercatat dibandingkan jumlah
// eksemplar fisik (view v_inventaris_per_buku), sehingga selisih langsung
// terlihat tanpa membuka data eksemplar satu per satu.

export interface BarisEksemplar {
  id: string;
  buku_id: string;
  nomor_inventaris: string;
  status: string;
  kondisi_fisik: string;
  tanggal_pengadaan: string;
  keterangan: string | null;
  dibuat_pada: string;
  diedit_pada: string;
}

export interface BarisRingkas {
  buku_id: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: number;
  isbn: string;
  kategori: string;
  rak: string;
  stok: number;
  total_eksemplar: number;
  tersedia: number;
  dipinjam: number;
  rusak: number;
  hilang: number;
}

interface ResponInventaris {
  eksemplar: BarisEksemplar[];
  ringkasan: BarisRingkas[];
}

type FilterSinkron = "semua" | "sesuai" | "menyimpang" | "kosong";

export default function HalamanInventaris() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterSinkron>("semua");
  const [segar, setSegar] = useState(0);

  const { data: mentah, memuat, galat } = useMuatApi<ResponInventaris>(
    "/api/eksemplar",
    segar,
  );

  const data = useMemo<ResponInventaris | null>(() => {
    if (!mentah) return null;
    return {
      eksemplar: Array.isArray(mentah.eksemplar) ? mentah.eksemplar : [],
      ringkasan: Array.isArray(mentah.ringkasan) ? mentah.ringkasan : [],
    };
  }, [mentah]);

  const baris = useMemo(() => {
    const cari = q.trim().toLowerCase();
    return (data?.ringkasan ?? [])
      .map((r) => {
        const total = Number(r.total_eksemplar) || 0;
        const stok = Number(r.stok) || 0;
        return { ...r, total, stok, selisih: stok - total };
      })
      .filter((r) => {
        if (!cari) return true;
        return (
          r.judul.toLowerCase().includes(cari) ||
          (r.penulis ?? "").toLowerCase().includes(cari) ||
          (r.isbn ?? "").toLowerCase().includes(cari) ||
          (r.rak ?? "").toLowerCase().includes(cari)
        );
      })
      .filter((r) => {
        if (filter === "sesuai") return r.total > 0 && r.selisih === 0;
        if (filter === "menyimpang") return r.total > 0 && r.selisih !== 0;
        if (filter === "kosong") return r.total === 0;
        return true;
      });
  }, [data, q, filter]);

  // Judul tanpa rak menyulitkan penelusuran fisik dan pelabelan, jadi
  // ditampilkan sebagai peringatan — dihitung dari seluruh katalog, bukan
  // hanya baris yang lolos filter.
  const tanpaRak = useMemo(
    () => (data?.ringkasan ?? []).filter((r) => !(r.rak ?? "").trim()),
    [data],
  );

  const statistik = useMemo(() => {
    const daftar = data?.ringkasan ?? [];
    const totalEksemplar = daftar.reduce((a, r) => a + (Number(r.total_eksemplar) || 0), 0);
    const tersedia = daftar.reduce((a, r) => a + (Number(r.tersedia) || 0), 0);
    const menyimpang = daftar.filter((r) => {
      const total = Number(r.total_eksemplar) || 0;
      return total > 0 && (Number(r.stok) || 0) !== total;
    }).length;
    return { judul: daftar.length, totalEksemplar, tersedia, menyimpang };
  }, [data]);

  return (
    <div className="space-y-6">
      <KepalaInventaris
        judul="Inventaris Buku"
        sub="Pantau jumlah eksemplar fisik tiap judul dan bandingkan dengan stok tercatat di katalog. Selisih berarti stok perlu direkonsiliasi."
        aksi={
          <Link href="/inventaris/opname" className="btn btn-primary">
            Mulai Stock Opname
          </Link>
        }
      />

      <NavigasiInventaris />

      {galat && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center"
        >
          <span>{galat}</span>
          <button
            type="button"
            className="shrink-0 font-semibold underline"
            onClick={() => setSegar((s) => s + 1)}
          >
            Coba muat ulang
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Judul Terdata"
          value={data ? statistik.judul : "—"}
          sub="judul di katalog"
          tone="brand"
          ikon="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V5a2 2 0 012-2h12a2 2 0 012 2v14"
        />
        <StatCard
          label="Eksemplar Fisik"
          value={data ? statistik.totalEksemplar : "—"}
          sub="salinan tercatat di sistem"
          tone="sky"
          ikon="M20 7l-8-4-8 4v10l8 4 8-4V7z"
        />
        <StatCard
          label="Siap Dipinjam"
          value={data ? statistik.tersedia : "—"}
          sub="berstatus tersedia"
          tone="amber"
          ikon="M20 6L9 17l-5-5"
        />
        <StatCard
          label="Stok Menyimpang"
          value={data ? statistik.menyimpang : "—"}
          sub="judul perlu direkonsiliasi"
          tone="rose"
          ikon="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
        />
      </section>

      {!memuat && tanpaRak.length > 0 && (
        <section
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <svg
            className="mt-0.5 shrink-0"
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
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {tanpaRak.length} judul belum punya kode rak
            </p>
            <p className="mt-0.5 leading-6 text-amber-800/90">
              Eksemplarnya sulit dicari di rak dan label QR tercetak tanpa
              keterangan rak. Lengkapi lewat halaman Katalog.
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-amber-800/80">
              {tanpaRak.map((r) => r.judul).join(" · ")}
            </p>
          </div>

          <Link
            href="/katalog"
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:border-amber-400"
          >
            Buka Katalog
          </Link>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-[220px] flex-1">
            <label className="sr-only" htmlFor="cari-inventaris">
              Cari judul
            </label>
            <input
              id="cari-inventaris"
              className="input"
              placeholder="Cari judul, penulis, ISBN, atau rak…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            aria-label="Filter sinkronisasi"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterSinkron)}
          >
            <option value="semua">Semua judul</option>
            <option value="sesuai">Stok sesuai</option>
            <option value="menyimpang">Stok menyimpang</option>
            <option value="kosong">Belum ada eksemplar</option>
          </select>
        </div>

        {memuat ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Memuat inventaris…
          </div>
        ) : baris.length === 0 ? (
          <EmptyState
            kartu={false}
            pesan="Tidak ada judul yang cocok"
            sub="Ubah kata kunci atau filter, lalu coba lagi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Kategori</th>
                  <th>Rak</th>
                  <th className="text-right">Stok</th>
                  <th className="text-right">Fisik</th>
                  <th className="text-right">Tersedia</th>
                  <th className="text-right">Dipinjam</th>
                  <th className="text-right">Rusak</th>
                  <th className="text-right">Hilang</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r) => (
                  <tr key={r.buku_id}>
                    <td>
                      <div className="font-semibold text-slate-800">{r.judul}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {r.penulis || "Tanpa penulis"} · {r.tahun || "—"}
                      </div>
                    </td>
                    <td>{r.kategori || "—"}</td>
                    <td>
                      {r.rak || (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Tanpa rak
                        </span>
                      )}
                    </td>
                    <td className="text-right font-semibold">{r.stok}</td>
                    <td className="text-right font-semibold">{r.total}</td>
                    <td className="text-right">{Number(r.tersedia) || 0}</td>
                    <td className="text-right">{Number(r.dipinjam) || 0}</td>
                    <td
                      className={`text-right ${
                        Number(r.rusak) ? "font-semibold text-amber-700" : "text-slate-400"
                      }`}
                    >
                      {Number(r.rusak) || 0}
                    </td>
                    <td
                      className={`text-right ${
                        Number(r.hilang) ? "font-semibold text-rose-600" : "text-slate-400"
                      }`}
                    >
                      {Number(r.hilang) || 0}
                    </td>
                    <td>
                      {r.total === 0 ? (
                        <Badge tone="slate">Belum ada eksemplar</Badge>
                      ) : r.selisih === 0 ? (
                        <Badge tone="green">Sesuai</Badge>
                      ) : r.selisih > 0 ? (
                        <Badge tone="amber">Stok lebih {r.selisih}</Badge>
                      ) : (
                        <Badge tone="rose">Stok kurang {Math.abs(r.selisih)}</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/inventaris/eksemplar?buku=${r.buku_id}`}
                          className="text-sm font-semibold text-[var(--brand)] hover:underline"
                        >
                          Eksemplar
                        </Link>
                        <Link
                          href={`/inventaris/opname?buku=${r.buku_id}`}
                          className="text-sm font-semibold text-slate-600 hover:underline"
                        >
                          Periksa
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!memuat && baris.length > 0 && (
          <div className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
            Menampilkan {baris.length} dari {data?.ringkasan.length ?? 0} judul
          </div>
        )}
      </section>
    </div>
  );
}
