"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useBoleh } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Modal, StatCard } from "@/components/ui";
import {
  BadgeKondisi,
  BadgeStatus,
  KepalaInventaris,
  NavigasiInventaris,
  pesanGalat,
  tanggalSingkat,
  useMuatApi,
} from "@/components/inventaris-ui";
import { KONDISI_EKSEMPLAR, STATUS_EKSEMPLAR } from "@/lib/supabase/inventaris";

// Data Eksemplar — daftar seluruh buku fisik dengan nomor inventarisnya.
// Petugas dapat menambah, mengubah, dan menghapus eksemplar; perubahan stok
// judul mengikuti otomatis lewat trigger di database.

interface BarisEksemplar {
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

interface BarisRingkas {
  buku_id: string;
  judul: string;
  penulis: string;
  stok: number;
  total_eksemplar: number;
  tersedia: number;
}

interface ResponInventaris {
  eksemplar: BarisEksemplar[];
  ringkasan: BarisRingkas[];
}

interface FormEksemplar {
  id?: string;
  buku_id: string;
  nomor_inventaris: string;
  status: string;
  kondisi_fisik: string;
  tanggal_pengadaan: string;
  keterangan: string;
}

const FORM_KOSONG: FormEksemplar = {
  buku_id: "",
  nomor_inventaris: "",
  status: "tersedia",
  kondisi_fisik: "layak",
  tanggal_pengadaan: new Date().toISOString().slice(0, 10),
  keterangan: "",
};

export default function HalamanDataEksemplar() {
  const toast = useToast();
  const bolehKelola = useBoleh("katalog.kelola");
  const params = useSearchParams();
  const bukuAwal = params.get("buku") ?? "";

  const [q, setQ] = useState("");
  const [buku, setBuku] = useState(bukuAwal);
  const [status, setStatus] = useState("");
  const [segar, setSegar] = useState(0);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormEksemplar>(FORM_KOSONG);
  const [simpan, setSimpan] = useState(false);
  const [galatForm, setGalatForm] = useState("");
  const [hapus, setHapus] = useState<BarisEksemplar | null>(null);

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

  const judulBuku = useMemo(() => {
    const peta = new Map<string, string>();
    for (const b of data?.ringkasan ?? []) peta.set(b.buku_id, b.judul);
    return peta;
  }, [data]);

  const baris = useMemo(() => {
    const cari = q.trim().toLowerCase();
    return (data?.eksemplar ?? []).filter((e) => {
      if (buku && e.buku_id !== buku) return false;
      if (status && e.status !== status) return false;
      if (!cari) return true;
      return (
        e.nomor_inventaris.toLowerCase().includes(cari) ||
        (judulBuku.get(e.buku_id) ?? "").toLowerCase().includes(cari)
      );
    });
  }, [data, q, buku, status, judulBuku]);

  const jumlah = useMemo(() => {
    const daftar = data?.eksemplar ?? [];
    const hitung = (s: string) => daftar.filter((e) => e.status === s).length;
    return {
      total: daftar.length,
      tersedia: hitung("tersedia"),
      dipinjam: hitung("dipinjam"),
      bermasalah: hitung("rusak") + hitung("hilang"),
    };
  }, [data]);

  const bukaTambah = () => {
    setForm({ ...FORM_KOSONG, buku_id: buku || "" });
    setGalatForm("");
    setModal(true);
  };

  const bukaUbah = (e: BarisEksemplar) => {
    setForm({
      id: e.id,
      buku_id: e.buku_id,
      nomor_inventaris: e.nomor_inventaris,
      status: e.status,
      kondisi_fisik: e.kondisi_fisik,
      tanggal_pengadaan: e.tanggal_pengadaan?.slice(0, 10) ?? "",
      keterangan: e.keterangan ?? "",
    });
    setGalatForm("");
    setModal(true);
  };

  const kirim = async () => {
    if (!form.buku_id) return setGalatForm("Pilih judul buku terlebih dahulu.");
    if (!form.nomor_inventaris.trim()) return setGalatForm("Nomor inventaris wajib diisi.");

    const isi = {
      buku_id: form.buku_id,
      nomor_inventaris: form.nomor_inventaris.trim(),
      status: form.status,
      kondisi_fisik: form.kondisi_fisik,
      tanggal_pengadaan: form.tanggal_pengadaan || undefined,
      keterangan: form.keterangan.trim() || null,
    };

    setSimpan(true);
    setGalatForm("");
    try {
      if (form.id) {
        await apiFetch(`/api/eksemplar/${form.id}`, { method: "PUT", body: isi });
        toast.sukses("Data eksemplar diperbarui.");
      } else {
        await apiFetch("/api/eksemplar", { method: "POST", body: isi });
        toast.sukses("Eksemplar baru ditambahkan.");
      }
      setModal(false);
      setSegar((s) => s + 1);
    } catch (e) {
      setGalatForm(pesanGalat(e));
    } finally {
      setSimpan(false);
    }
  };

  const konfirmasiHapus = async () => {
    if (!hapus) return;
    try {
      await apiFetch(`/api/eksemplar/${hapus.id}`, { method: "DELETE" });
      toast.sukses(`Eksemplar ${hapus.nomor_inventaris} dihapus.`);
      setSegar((s) => s + 1);
    } catch (e) {
      toast.gagal(pesanGalat(e));
    }
  };

  return (
    <div className="space-y-6">
      <KepalaInventaris
        judul="Data Eksemplar"
        sub="Setiap buku fisik punya satu nomor inventaris unik. Status dan kondisi di sini menjadi acuan ketersediaan di katalog."
        aksi={
          bolehKelola ? (
            <button type="button" className="btn btn-primary" onClick={bukaTambah}>
              Tambah Eksemplar
            </button>
          ) : null
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
        <StatCard label="Total Eksemplar" value={data ? jumlah.total : "—"} sub="baris inventaris" tone="brand" ikon="M20 7l-8-4-8 4v10l8 4 8-4V7z" />
        <StatCard label="Tersedia" value={data ? jumlah.tersedia : "—"} sub="siap dipinjam" tone="amber" ikon="M20 6L9 17l-5-5" />
        <StatCard label="Dipinjam" value={data ? jumlah.dipinjam : "—"} sub="sedang di luar" tone="sky" ikon="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
        <StatCard label="Rusak / Hilang" value={data ? jumlah.bermasalah : "—"} sub="perlu tindak lanjut" tone="rose" ikon="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-[200px] flex-1">
            <label className="sr-only" htmlFor="cari-eksemplar">
              Cari eksemplar
            </label>
            <input
              id="cari-eksemplar"
              className="input"
              placeholder="Cari nomor inventaris atau judul…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            aria-label="Filter judul"
            value={buku}
            onChange={(e) => setBuku(e.target.value)}
          >
            <option value="">Semua judul</option>
            {(data?.ringkasan ?? []).map((b) => (
              <option key={b.buku_id} value={b.buku_id}>
                {b.judul}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            {STATUS_EKSEMPLAR.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {memuat ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Memuat data eksemplar…
          </div>
        ) : baris.length === 0 ? (
          <div className="p-6">
            <EmptyState
              pesan="Belum ada eksemplar yang cocok"
              sub="Tambahkan eksemplar baru atau ubah filter pencarian."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nomor Inventaris</th>
                  <th>Judul</th>
                  <th>Status</th>
                  <th>Kondisi</th>
                  <th>Pengadaan</th>
                  <th>Keterangan</th>
                  {bolehKelola && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {baris.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs font-semibold text-slate-700">
                      {e.nomor_inventaris}
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800">
                        {judulBuku.get(e.buku_id) ?? "Judul tidak ditemukan"}
                      </div>
                    </td>
                    <td>
                      <BadgeStatus status={e.status} />
                    </td>
                    <td>
                      <BadgeKondisi kondisi={e.kondisi_fisik} />
                    </td>
                    <td className="whitespace-nowrap">{tanggalSingkat(e.tanggal_pengadaan)}</td>
                    <td className="max-w-[220px] truncate text-sm text-[var(--muted)]">
                      {e.keterangan || "—"}
                    </td>
                    {bolehKelola && (
                      <td>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--brand)] hover:underline"
                            onClick={() => bukaUbah(e)}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="text-sm font-semibold text-rose-600 hover:underline"
                            onClick={() => setHapus(e)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!memuat && baris.length > 0 && (
          <div className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
            Menampilkan {baris.length} dari {data?.eksemplar.length ?? 0} eksemplar
          </div>
        )}
      </section>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Ubah Eksemplar" : "Tambah Eksemplar"}
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="f-buku">
              Judul buku
            </label>
            <select
              id="f-buku"
              className="input"
              value={form.buku_id}
              onChange={(e) => setForm((f) => ({ ...f, buku_id: e.target.value }))}
            >
              <option value="">Pilih judul…</option>
              {(data?.ringkasan ?? []).map((b) => (
                <option key={b.buku_id} value={b.buku_id}>
                  {b.judul}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="f-nomor">
              Nomor inventaris
            </label>
            <input
              id="f-nomor"
              className="input"
              placeholder="mis. INV-2026-0001"
              value={form.nomor_inventaris}
              onChange={(e) => setForm((f) => ({ ...f, nomor_inventaris: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="f-status">
                Status
              </label>
              <select
                id="f-status"
                className="input"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_EKSEMPLAR.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-kondisi">
                Kondisi fisik
              </label>
              <select
                id="f-kondisi"
                className="input"
                value={form.kondisi_fisik}
                onChange={(e) => setForm((f) => ({ ...f, kondisi_fisik: e.target.value }))}
              >
                {KONDISI_EKSEMPLAR.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="f-tanggal">
              Tanggal pengadaan
            </label>
            <input
              id="f-tanggal"
              type="date"
              className="input"
              value={form.tanggal_pengadaan}
              onChange={(e) => setForm((f) => ({ ...f, tanggal_pengadaan: e.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-keterangan">
              Keterangan (opsional)
            </label>
            <textarea
              id="f-keterangan"
              className="input min-h-[80px]"
              placeholder="Catatan kondisi, sumber pengadaan, dsb."
              value={form.keterangan}
              onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
            />
          </div>

          {galatForm && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {galatForm}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void kirim()} disabled={simpan}>
              {simpan ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={hapus !== null}
        onClose={() => setHapus(null)}
        onConfirm={() => void konfirmasiHapus()}
        title="Hapus eksemplar?"
        message={`Eksemplar ${hapus?.nomor_inventaris ?? ""} akan dihapus dan stok judul ikut berkurang. Tindakan ini tidak bisa dibatalkan.`}
      />
    </div>
  );
}
