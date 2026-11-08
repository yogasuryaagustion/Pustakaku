"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useBoleh } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { Badge, ConfirmDialog, EmptyState, Modal } from "@/components/ui";
import { KepalaHalaman } from "@/components/kepala-halaman";
import {
  NavigasiInventaris,
  pesanGalat,
  waktuSingkat,
  useMuatApi,
} from "@/components/inventaris-ui";

// Riwayat Stock Opname — daftar sesi opname yang pernah disimpan beserta
// rincian per eksemplar, sehingga hasil pemeriksaan bisa ditinjau ulang.

interface SesiOpname {
  id: string;
  judul: string;
  komentar: string | null;
  jumlah_dibandingkan: number;
  jumlah_ditemukan: number;
  jumlah_tidak_ditemukan: number;
  selisih: number;
  dikerjakan_bynama: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

interface BarisOpname {
  id: string;
  nomor_inventaris: string;
  judul: string;
  status_sistem: string;
  kondisi_sistem: string;
  ditemukan: boolean;
  jumlah_fisik: number;
  status_fisik: string | null;
  kondisi_fisik: string | null;
  keterangan: string | null;
}

export default function HalamanRiwayatOpname() {
  const toast = useToast();
  const bolehKelola = useBoleh("katalog.kelola");

  const [segar, setSegar] = useState(0);

  const { data, memuat, galat } = useMuatApi<{ opname: SesiOpname[] }>(
    "/api/opname",
    segar,
  );

  const daftar = useMemo(
    () => (Array.isArray(data?.opname) ? data.opname : []),
    [data],
  );

  const [detail, setDetail] = useState<SesiOpname | null>(null);
  const [barisDetail, setBarisDetail] = useState<BarisOpname[]>([]);
  const [memuatDetail, setMemuatDetail] = useState(false);
  const [hapus, setHapus] = useState<SesiOpname | null>(null);

  const bukaDetail = async (sesi: SesiOpname) => {
    setDetail(sesi);
    setBarisDetail([]);
    setMemuatDetail(true);
    try {
      const res = await apiFetch<{ baris: BarisOpname[] }>(`/api/opname/${sesi.id}`);
      setBarisDetail(Array.isArray(res.baris) ? res.baris : []);
    } catch (e) {
      toast.gagal(pesanGalat(e));
    } finally {
      setMemuatDetail(false);
    }
  };

  const konfirmasiHapus = async () => {
    if (!hapus) return;
    try {
      await apiFetch(`/api/opname/${hapus.id}`, { method: "DELETE" });
      toast.sukses("Riwayat hitung fisik dihapus.");
      setSegar((s) => s + 1);
    } catch (e) {
      toast.gagal(pesanGalat(e));
    }
  };

  return (
    <div className="space-y-6">
      <KepalaHalaman
        deskripsi="Setiap penyimpanan hasil hitung fisik tercatat sebagai satu sesi, lengkap dengan jumlah barang yang diperiksa dan yang tidak ditemukan."
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

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-bold">Sesi opname</h2>
          <p className="text-xs text-[var(--muted)]">Terbaru di urutan teratas.</p>
        </div>

        {memuat ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Memuat riwayat…
          </div>
        ) : daftar.length === 0 ? (
          <EmptyState
            kartu={false}
            pesan="Belum ada riwayat hitung fisik"
            sub="Mulai dari halaman Hitung Fisik Buku setelah memilih judul."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Sesi</th>
                  <th>Petugas</th>
                  <th className="text-right">Diperiksa</th>
                  <th className="text-right">Ditemukan</th>
                  <th className="text-right">Tidak</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap text-sm">{waktuSingkat(s.dibuat_pada)}</td>
                    <td>
                      <div className="font-semibold text-slate-800">{s.judul || "Hitung Fisik"}</div>
                      {s.komentar && (
                        <div className="max-w-[260px] truncate text-xs text-[var(--muted)]">
                          {s.komentar}
                        </div>
                      )}
                    </td>
                    <td>{s.dikerjakan_bynama || "—"}</td>
                    <td className="text-right font-semibold">{Number(s.jumlah_dibandingkan) || 0}</td>
                    <td className="text-right text-emerald-700">
                      {Number(s.jumlah_ditemukan) || 0}
                    </td>
                    <td className="text-right">
                      {Number(s.jumlah_tidak_ditemukan) > 0 ? (
                        <Badge tone="rose">{Number(s.jumlah_tidak_ditemukan)}</Badge>
                      ) : (
                        <span className="text-[var(--muted)]">0</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--brand)] hover:underline"
                          onClick={() => void bukaDetail(s)}
                        >
                          Detail
                        </button>
                        {bolehKelola && (
                          <button
                            type="button"
                            className="text-sm font-semibold text-rose-600 hover:underline"
                            onClick={() => setHapus(s)}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.judul || "Detail Hitung Fisik"}
        width="max-w-3xl"
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-[var(--muted)]">Diperiksa</div>
                <div className="font-bold">{Number(detail.jumlah_dibandingkan) || 0}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="text-xs text-emerald-700">Ditemukan</div>
                <div className="font-bold text-emerald-700">{Number(detail.jumlah_ditemukan) || 0}</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-3">
                <div className="text-xs text-rose-700">Tidak ditemukan</div>
                <div className="font-bold text-rose-700">{Number(detail.jumlah_tidak_ditemukan) || 0}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-[var(--muted)]">Petugas</div>
                <div className="font-bold">{detail.dikerjakan_bynama || "—"}</div>
              </div>
            </div>

            {detail.komentar && (
              <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-slate-600">
                {detail.komentar}
              </p>
            )}

            {memuatDetail ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">Memuat baris…</p>
            ) : barisDetail.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">
                Tidak ada baris tersimpan pada sesi ini.
              </p>
            ) : (
              <div className="max-h-[320px] overflow-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Nomor Inventaris</th>
                      <th>Sistem</th>
                      <th>Fisik</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barisDetail.map((b) => (
                      <tr key={b.id}>
                        <td className="font-mono text-xs">{b.nomor_inventaris}</td>
                        <td className="text-xs">
                          {b.status_sistem || "—"} / {b.kondisi_sistem || "—"}
                        </td>
                        <td className="text-xs">
                          {b.ditemukan ? (
                            <Badge tone="green">Ditemukan</Badge>
                          ) : (
                            <Badge tone="rose">Tidak ditemukan</Badge>
                          )}
                          <div className="mt-1 text-[var(--muted)]">
                            {b.status_fisik || "—"} / {b.kondisi_fisik || "—"}
                          </div>
                        </td>
                        <td className="text-xs text-[var(--muted)]">{b.keterangan || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={hapus !== null}
        onClose={() => setHapus(null)}
        onConfirm={() => void konfirmasiHapus()}
        title="Hapus riwayat hitung fisik?"
        message={`Riwayat "${hapus?.judul ?? ""}" beserta rincian pemeriksaannya akan dihapus permanen.`}
      />
    </div>
  );
}
