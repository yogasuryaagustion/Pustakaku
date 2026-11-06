"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, StatCard } from "@/components/ui";
import {
  KepalaInventaris,
  NavigasiInventaris,
  pesanGalat,
  useMuatApi,
} from "@/components/inventaris-ui";

// Hasil Sinkronisasi — membandingkan stok tercatat (buku.stok) dengan jumlah
// eksemplar fisik. Tombol perbaiki memanggil fungsi database yang menyamakan
// stok; hanya Super Admin yang boleh menjalankannya.

interface BarisSinkron {
  buku_id: string;
  judul: string;
  penulis: string;
  kategori: string;
  rak: string;
  stok: number;
  total_eksemplar: number;
  tersedia: number;
  dipinjam: number;
  rusak: number;
  hilang: number;
  status_sistem: string;
  selisih: number;
  keterangan: string;
}

interface ResponRekonsiliasi {
  ringkasan: BarisSinkron[];
  total_judul: number;
  total_eksemplar: number;
  total_tersedia: number;
  total_dipinjam: number;
  total_rusak: number;
  total_hilang: number;
  perlu_diperbaiki: number;
}

export default function HalamanRekonsiliasi() {
  const toast = useToast();
  const { sedangMasuk } = useAuth();
  const superadmin = sedangMasuk?.peran === "superadmin";

  const [memperbaiki, setMemperbaiki] = useState(false);
  const [hanyaSelisih, setHanyaSelisih] = useState(false);
  const [segar, setSegar] = useState(0);

  const { data: mentah, memuat, galat } = useMuatApi<ResponRekonsiliasi>(
    "/api/eksemplar/rekonsiliasi",
    segar,
  );

  const data = useMemo<ResponRekonsiliasi | null>(() => {
    if (!mentah) return null;
    return { ...mentah, ringkasan: Array.isArray(mentah.ringkasan) ? mentah.ringkasan : [] };
  }, [mentah]);

  const baris = useMemo(() => {
    const daftar = data?.ringkasan ?? [];
    return hanyaSelisih ? daftar.filter((r) => Number(r.selisih) !== 0) : daftar;
  }, [data, hanyaSelisih]);

  const perbaiki = async () => {
    setMemperbaiki(true);
    try {
      const res = await apiFetch<{ diperbaiki: number }>("/api/eksemplar/rekonsiliasi", {
        method: "POST",
      });
      toast.sukses(
        res.diperbaiki > 0
          ? `Stok ${res.diperbaiki} judul disamakan dengan jumlah eksemplar.`
          : "Semua stok sudah sesuai — tidak ada yang perlu diperbaiki.",
      );
      setSegar((s) => s + 1);
    } catch (e) {
      toast.gagal(pesanGalat(e));
    } finally {
      setMemperbaiki(false);
    }
  };

  return (
    <div className="space-y-6">
      <KepalaInventaris
        judul="Hasil Sinkronisasi"
        sub="Selisih dihitung dari stok katalog dikurangi jumlah eksemplar fisik. Nilai positif berarti stok tercatat lebih banyak daripada barang yang ada."
        aksi={
          superadmin ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void perbaiki()}
              disabled={memperbaiki || memuat}
            >
              {memperbaiki ? "Menyinkronkan…" : "Perbaiki Stok"}
            </button>
          ) : null
        }
      />

      <NavigasiInventaris />

      {!superadmin && (
        <p className="text-xs text-[var(--muted)]">
          Perbaikan stok massal hanya tersedia untuk Super Admin. Hubungi petugas
          dengan akses tersebut bila stok perlu disamakan.
        </p>
      )}

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
          label="Eksemplar Fisik"
          value={data ? data.total_eksemplar : "—"}
          sub={`dari ${data ? data.total_judul : "—"} judul`}
          tone="brand"
          ikon="M20 7l-8-4-8 4v10l8 4 8-4V7z"
        />
        <StatCard
          label="Tersedia"
          value={data ? data.total_tersedia : "—"}
          sub={`${data ? data.total_dipinjam : "—"} sedang dipinjam`}
          tone="sky"
          ikon="M20 6L9 17l-5-5"
        />
        <StatCard
          label="Rusak / Hilang"
          value={data ? data.total_rusak + data.total_hilang : "—"}
          sub={`${data ? data.total_rusak : "—"} rusak · ${data ? data.total_hilang : "—"} hilang`}
          tone="amber"
          ikon="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
        />
        <StatCard
          label="Perlu Diperbaiki"
          value={data ? data.perlu_diperbaiki : "—"}
          sub="judul dengan selisih stok"
          tone="rose"
          ikon="M3 12h4l3 8 4-16 3 8h4"
        />
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-bold">Rincian per judul</h2>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--brand)]"
              checked={hanyaSelisih}
              onChange={(e) => setHanyaSelisih(e.target.checked)}
            />
            Tampilkan hanya yang menyimpang
          </label>
        </div>

        {memuat ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Menghitung sinkronisasi…
          </div>
        ) : baris.length === 0 ? (
          <EmptyState
            kartu={false}
            pesan={hanyaSelisih ? "Semua stok sudah sesuai" : "Belum ada data inventaris"}
            sub={
              hanyaSelisih
                ? "Tidak ada judul yang perlu diperbaiki."
                : "Tambahkan eksemplar terlebih dahulu."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th className="text-right">Stok</th>
                  <th className="text-right">Fisik</th>
                  <th className="text-right">Selisih</th>
                  <th>Status</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r) => {
                  const selisih = Number(r.selisih) || 0;
                  return (
                    <tr key={r.buku_id}>
                      <td>
                        <div className="font-semibold text-slate-800">{r.judul}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {r.penulis || "Tanpa penulis"} · {r.rak || "tanpa rak"}
                        </div>
                      </td>
                      <td className="text-right font-semibold">{Number(r.stok) || 0}</td>
                      <td className="text-right font-semibold">{Number(r.total_eksemplar) || 0}</td>
                      <td className="text-right font-semibold">
                        {selisih > 0 ? `+${selisih}` : selisih}
                      </td>
                      <td>
                        {Number(r.total_eksemplar) === 0 ? (
                          <Badge tone="slate">Belum ada eksemplar</Badge>
                        ) : selisih === 0 ? (
                          <Badge tone="green">Sesuai</Badge>
                        ) : selisih > 0 ? (
                          <Badge tone="amber">Stok lebih</Badge>
                        ) : (
                          <Badge tone="rose">Stok kurang</Badge>
                        )}
                      </td>
                      <td className="text-sm text-[var(--muted)]">{r.keterangan}</td>
                    </tr>
                  );
                })}
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
