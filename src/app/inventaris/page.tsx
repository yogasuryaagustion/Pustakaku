"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, StatCard } from "@/components/ui";
import {
  KepalaInventaris,
  NavigasiInventaris,
  pesanGalat,
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
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterSinkron>("semua");
  const [segar, setSegar] = useState(0);

  // Filter cepat untuk memusatkan pengisian rak pada judul yang belum punya.
  const [hanyaTanpaRak, setHanyaTanpaRak] = useState(false);

  // Kode rak untuk judul yang belum punya rak, diisi langsung dari tabel.
  const [rakDraft, setRakDraft] = useState<Record<string, string>>({});
  const [menyimpanRak, setMenyimpanRak] = useState<string | null>(null);

  // Pengisian beberapa kode rak sekaligus dari panel peringatan.
  const [massalTerbuka, setMassalTerbuka] = useState(false);
  const [massalDraft, setMassalDraft] = useState<Record<string, string>>({});
  const [menyimpanMassal, setMenyimpanMassal] = useState(false);
  // Satu kode rak yang bisa diterapkan ke semua judul di panel isian.
  const [rakSemua, setRakSemua] = useState("");

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
        if (hanyaTanpaRak && (r.rak ?? "").trim()) return false;
        if (filter === "sesuai") return r.total > 0 && r.selisih === 0;
        if (filter === "menyimpang") return r.total > 0 && r.selisih !== 0;
        if (filter === "kosong") return r.total === 0;
        return true;
      });
  }, [data, q, filter, hanyaTanpaRak]);

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

  // Berapa kode rak yang sudah diisi di panel isian sekaligus.
  const terisiMassal = tanpaRak.filter((r) => (massalDraft[r.buku_id] ?? "").trim()).length;

  // Judul yang berbagi kode rak bisa menandakan salah isi atau penataan fisik
  // yang perlu dicek, jadi pemakaian tiap rak dihitung sekali di sini.
  const pemakaianRak = useMemo(() => {
    const peta = new Map<string, BarisRingkas[]>();
    for (const r of data?.ringkasan ?? []) {
      const kunci = (r.rak ?? "").trim().toLowerCase();
      if (!kunci) continue;
      peta.set(kunci, [...(peta.get(kunci) ?? []), r]);
    }
    return peta;
  }, [data]);

  /** Judul lain yang memakai kode rak yang sama dengan baris ini. */
  const rakSerupa = (r: BarisRingkas) => {
    const sama = pemakaianRak.get((r.rak ?? "").trim().toLowerCase()) ?? [];
    return sama.length > 1 ? sama.filter((x) => x.buku_id !== r.buku_id) : [];
  };

  /** Simpan kode rak satu judul tanpa meninggalkan halaman Inventaris. */
  const simpanRak = async (bukuId: string, judul: string, rak: string) => {
    const nilai = rak.trim();
    if (!nilai) return;

    setMenyimpanRak(bukuId);
    try {
      await apiFetch(`/api/buku/${bukuId}`, { method: "PUT", body: { rak: nilai } });
      setRakDraft((d) => {
        const salinan = { ...d };
        delete salinan[bukuId];
        return salinan;
      });
      toast.sukses(`Rak “${judul}” disimpan: ${nilai}`);
      setSegar((s) => s + 1);
    } catch (e) {
      toast.gagal(pesanGalat(e));
    } finally {
      setMenyimpanRak(null);
    }
  };

  /** Buka panel isian sekaligus dengan draf kosong. */
  const bukaMassal = () => {
    setMassalTerbuka(true);
    setMassalDraft(Object.fromEntries(tanpaRak.map((r) => [r.buku_id, ""])));
    setRakSemua("");
  };

  /** Tutup panel dan buang draf yang belum disimpan. */
  const tutupMassal = () => {
    setMassalTerbuka(false);
    setMassalDraft({});
    setRakSemua("");
  };

  /** Terapkan satu kode rak yang sama ke seluruh judul di panel isian. */
  const terapkanRakSemua = () => {
    const nilai = rakSemua.trim();
    if (!nilai) return;
    setMassalDraft(Object.fromEntries(tanpaRak.map((r) => [r.buku_id, nilai])));
  };

  /** Simpan semua kode rak yang diisi di panel peringatan sekaligus. */
  const simpanMassal = async (daftar: BarisRingkas[]) => {
    const isian = daftar
      .map((r) => ({ r, rak: (massalDraft[r.buku_id] ?? "").trim() }))
      .filter((x) => x.rak);
    if (isian.length === 0) return;

    setMenyimpanMassal(true);
    const hasil = await Promise.allSettled(
      isian.map((x) =>
        apiFetch(`/api/buku/${x.r.buku_id}`, { method: "PUT", body: { rak: x.rak } }),
      ),
    );
    setMenyimpanMassal(false);

    const gagal = hasil.flatMap((h, i) =>
      h.status === "rejected" ? [{ id: isian[i].r.buku_id, alasan: h.reason }] : [],
    );
    const sukses = hasil.length - gagal.length;

    if (sukses > 0) {
      toast.sukses(
        `${sukses} kode rak tersimpan${gagal.length ? `, ${gagal.length} gagal` : ""}`,
      );
      setSegar((s) => s + 1);
    } else {
      toast.gagal(`Kode rak gagal disimpan. ${pesanGalat(gagal[0].alasan)}`);
    }

    if (gagal.length === 0) {
      tutupMassal();
    } else {
      // Sisakan isian yang gagal supaya bisa dicoba lagi.
      const sisa = new Set(gagal.map((g) => g.id));
      setMassalDraft((d) =>
        Object.fromEntries(Object.entries(d).filter(([id]) => sisa.has(id))),
      );
    }
  };

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
              keterangan rak. Isi kode di kolom Rak tabel, atau sekaligus lewat
              tombol di samping.
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-amber-800/80">
              {tanpaRak.map((r) => r.judul).join(" · ")}
            </p>
          </div>

          <button
            type="button"
            className={
              massalTerbuka
                ? "shrink-0 rounded-lg border border-amber-400 bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-900 transition"
                : "shrink-0 rounded-lg border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:border-amber-500"
            }
            aria-expanded={massalTerbuka}
            onClick={() => (massalTerbuka ? tutupMassal() : bukaMassal())}
          >
            {massalTerbuka ? "Tutup isian" : "Isi sekaligus"}
          </button>

          <Link
            href="/katalog"
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:border-amber-400"
          >
            Buka Katalog
          </Link>
        </section>
      )}

      {massalTerbuka && tanpaRak.length > 0 && (
        <section
          className="card overflow-hidden"
          aria-label="Isi kode rak sekaligus"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">
                Isi kode rak sekaligus
              </p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
                {tanpaRak.length} judul menunggu kode rak. Isi satu per satu, atau
                pakai kode yang sama untuk semuanya.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                className="input h-9 w-36 text-xs"
                placeholder="Rak yang sama…"
                maxLength={20}
                value={rakSemua}
                onChange={(e) => setRakSemua(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    terapkanRakSemua();
                  }
                }}
                aria-label="Kode rak untuk semua judul"
                disabled={menyimpanMassal}
              />
              <button
                type="button"
                className="btn btn-ghost h-9 whitespace-nowrap"
                onClick={terapkanRakSemua}
                disabled={menyimpanMassal || !rakSemua.trim()}
              >
                Terapkan ke semua
              </button>
            </div>
          </div>

          <ul className="divide-y divide-[var(--border)]">
            {tanpaRak.map((r) => (
              <li
                key={r.buku_id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {r.judul}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {r.penulis || "Tanpa penulis"}
                  </p>
                </div>
                <input
                  className="input h-9 w-32 px-2 text-xs"
                  placeholder="Kode rak…"
                  maxLength={20}
                  value={massalDraft[r.buku_id] ?? ""}
                  onChange={(e) =>
                    setMassalDraft((d) => ({ ...d, [r.buku_id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void simpanMassal(tanpaRak);
                    }
                  }}
                  aria-label={`Kode rak untuk ${r.judul}`}
                  disabled={menyimpanMassal}
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={tutupMassal}
              disabled={menyimpanMassal}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void simpanMassal(tanpaRak)}
              disabled={menyimpanMassal || terisiMassal === 0}
            >
              {menyimpanMassal ? "Menyimpan…" : `Simpan ${terisiMassal} rak`}
            </button>
          </div>
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
          <button
            type="button"
            className={
              hanyaTanpaRak
                ? "shrink-0 rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition"
                : "shrink-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300"
            }
            aria-pressed={hanyaTanpaRak}
            aria-label="Tampilkan hanya judul yang belum punya rak"
            onClick={() => setHanyaTanpaRak((v) => !v)}
          >
            Tanpa rak{data ? ` (${tanpaRak.length})` : ""}
          </button>
        </div>

        {memuat ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Memuat inventaris…
          </div>
        ) : baris.length === 0 ? (
          hanyaTanpaRak && tanpaRak.length === 0 ? (
            <EmptyState
              kartu={false}
              pesan="Semua judul sudah punya kode rak"
              sub="Tidak ada yang perlu dilengkapi. Matikan filter untuk melihat seluruh inventaris."
            />
          ) : (
            <EmptyState
              kartu={false}
              pesan="Tidak ada judul yang cocok"
              sub="Ubah kata kunci atau filter, lalu coba lagi."
            />
          )
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
                      {r.rak ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {r.rak}
                          {rakSerupa(r).length > 0 && (
                            <span
                              className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800"
                              title={`Rak ini juga dipakai: ${rakSerupa(r)
                                .map((x) => x.judul)
                                .join(", ")}`}
                            >
                              ×{rakSerupa(r).length + 1}
                            </span>
                          )}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            className="input h-8 w-24 border-amber-300 bg-amber-50/50 px-2 text-xs"
                            placeholder="Kode rak…"
                            maxLength={20}
                            value={rakDraft[r.buku_id] ?? ""}
                            onChange={(e) =>
                              setRakDraft((d) => ({ ...d, [r.buku_id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void simpanRak(
                                  r.buku_id,
                                  r.judul,
                                  rakDraft[r.buku_id] ?? "",
                                );
                              }
                            }}
                            aria-label={`Kode rak untuk ${r.judul}`}
                            disabled={menyimpanRak === r.buku_id}
                          />
                          <button
                            type="button"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-300 bg-white text-amber-900 transition hover:border-amber-400 disabled:opacity-50"
                            onClick={() =>
                              void simpanRak(r.buku_id, r.judul, rakDraft[r.buku_id] ?? "")
                            }
                            disabled={
                              menyimpanRak === r.buku_id ||
                              !(rakDraft[r.buku_id] ?? "").trim()
                            }
                            aria-label={`Simpan kode rak ${r.judul}`}
                            title="Simpan kode rak"
                          >
                            {menyimpanRak === r.buku_id ? (
                              <span className="text-xs">…</span>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="text-right font-semibold">{r.stok}</td>
                    <td className="text-right font-semibold">{r.total}</td>
                    <td className="text-right">{Number(r.tersedia) || 0}</td>
                    <td className="text-right">{Number(r.dipinjam) || 0}</td>
                    <td className="text-right">
                      {Number(r.rusak) ? (
                        <Link
                          href={`/inventaris/eksemplar?buku=${r.buku_id}&status=rusak`}
                          className="font-semibold text-amber-700 hover:underline"
                          title="Lihat eksemplar rusak judul ini"
                        >
                          {Number(r.rusak)}
                        </Link>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="text-right">
                      {Number(r.hilang) ? (
                        <Link
                          href={`/inventaris/eksemplar?buku=${r.buku_id}&status=hilang`}
                          className="font-semibold text-rose-600 hover:underline"
                          title="Lihat eksemplar hilang judul ini"
                        >
                          {Number(r.hilang)}
                        </Link>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
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
