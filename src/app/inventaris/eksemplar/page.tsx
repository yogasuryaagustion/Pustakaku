"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useBoleh } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { ConfirmDialog, EmptyState, Modal, StatCard } from "@/components/ui";
import { KepalaHalaman } from "@/components/kepala-halaman";
import {
  BadgeKondisi,
  BadgeStatus,
  NavigasiInventaris,
  pesanGalat,
  tanggalSingkat,
  useMuatApi,
} from "@/components/inventaris-ui";
import {
  KONDISI_EKSEMPLAR,
  LABEL_STATUS,
  STATUS_EKSEMPLAR,
  statusDikenal,
} from "@/lib/supabase/inventaris";
import { useSistem } from "@/lib/sistem";
import { nomorInventarisContoh } from "@/lib/sistem-nilai";

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

interface HasilImpor {
  ditambahkan: number;
  dilewati: number;
  galat: Array<{ baris: number; pesan: string }>;
  total_galat: number;
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
  const sistem = useSistem();
  const bolehKelola = useBoleh("katalog.kelola");
  const params = useSearchParams();
  const bukuAwal = params.get("buku") ?? "";
  // ?status=rusak/hilang dipakai tautan dari halaman Inventaris agar daftar
  // langsung tersaring pada salinan bermasalah.
  const statusAwal = params.get("status") ?? "";

  const [q, setQ] = useState("");
  const [buku, setBuku] = useState(bukuAwal);
  const [status, setStatus] = useState(statusDikenal(statusAwal) ? statusAwal : "");
  const [segar, setSegar] = useState(0);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormEksemplar>(FORM_KOSONG);

  // Impor CSV massal.
  const [imporBuka, setImporBuka] = useState(false);
  const [csvTeks, setCsvTeks] = useState("");
  const [namaBerkas, setNamaBerkas] = useState("");
  const [mengimpor, setMengimpor] = useState(false);
  const [galatImpor, setGalatImpor] = useState("");
  const [hasilImpor, setHasilImpor] = useState<HasilImpor | null>(null);
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

  // Pratinjau nomor berikutnya menurut pola Pengaturan.
  const contohNomor = useMemo(
    () => nomorInventarisContoh(sistem.formatInventaris, (data?.eksemplar.length ?? 0) + 1),
    [sistem.formatInventaris, data],
  );

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

    const isi = {
      buku_id: form.buku_id,
      // Kosong → server membuat nomor berikutnya sesuai pola Pengaturan.
      nomor_inventaris: form.nomor_inventaris.trim() || undefined,
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

  const bukaImpor = () => {
    setCsvTeks("");
    setNamaBerkas("");
    setGalatImpor("");
    setHasilImpor(null);
    setImporBuka(true);
  };

  const pilihBerkas = async (berkas: File | null | undefined) => {
    if (!berkas) return;
    setGalatImpor("");
    setHasilImpor(null);
    try {
      setCsvTeks(await berkas.text());
      setNamaBerkas(berkas.name);
    } catch {
      setGalatImpor("Berkas tidak bisa dibaca.");
    }
  };

  const jalankanImpor = async () => {
    if (!csvTeks.trim()) return setGalatImpor("Pilih berkas CSV terlebih dahulu.");
    setMengimpor(true);
    setGalatImpor("");
    try {
      const res = await apiFetch<HasilImpor>("/api/eksemplar/impor", {
        method: "POST",
        body: { csv: csvTeks },
      });
      setHasilImpor(res);
      setSegar((s) => s + 1);
      if (res.ditambahkan > 0) {
        toast.sukses(`${res.ditambahkan} eksemplar berhasil diimpor.`);
      } else {
        toast.info("Tidak ada eksemplar baru yang ditambahkan.");
      }
    } catch (e) {
      setGalatImpor(pesanGalat(e));
    } finally {
      setMengimpor(false);
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
      <KepalaHalaman
        deskripsi="Setiap buku fisik punya satu nomor inventaris unik. Status dan kondisi di sini menjadi acuan ketersediaan di katalog."
        aksi={
          bolehKelola ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/inventaris/label" className="btn btn-ghost">
                Label QR
              </Link>
              <button type="button" className="btn btn-ghost" onClick={bukaImpor}>
                Impor CSV
              </button>
              <button type="button" className="btn btn-primary" onClick={bukaTambah}>
                Tambah Eksemplar
              </button>
            </div>
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
                {LABEL_STATUS[s] ?? s}
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
          <EmptyState
            kartu={false}
            pesan="Belum ada eksemplar yang cocok"
            sub="Tambahkan eksemplar baru atau ubah filter pencarian."
          />
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
                            className="text-sm font-semibold text-[var(--brand-ink)] hover:underline"
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
              className="input font-mono"
              placeholder={
                form.id ? "Ubah nomor inventaris" : `Otomatis: ${contohNomor}`
              }
              value={form.nomor_inventaris}
              onChange={(e) => setForm((f) => ({ ...f, nomor_inventaris: e.target.value }))}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              {form.id
                ? "Biarkan sesuai atau ganti manual."
                : `Kosongkan agar dibuat otomatis dari pola Pengaturan (${sistem.formatInventaris}).`}
            </p>
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

      <Modal
        open={imporBuka}
        onClose={() => setImporBuka(false)}
        title="Impor Eksemplar dari CSV"
        width="max-w-lg"
      >
        <div className="space-y-4 text-sm">
          <p className="leading-6 text-slate-600">
            Setiap baris mewakili satu salinan fisik. Unduh template berisi semua
            judul (satu baris per salinan sesuai stok), isi kolom{" "}
            <code className="rounded bg-slate-100 px-1">nomor_inventaris</code>, lalu
            unggah kembali. Baris yang nomornya sudah terdaftar akan dilewati.
          </p>

          <a className="btn btn-ghost w-fit" href="/api/eksemplar/impor" download>
            Unduh Template CSV
          </a>

          <div>
            <label className="label" htmlFor="f-berkas">
              Berkas CSV
            </label>
            <input
              id="f-berkas"
              type="file"
              accept=".csv,text/csv"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              onChange={(e) => void pilihBerkas(e.target.files?.[0])}
            />
            {namaBerkas && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {namaBerkas} · {csvTeks.split(/\r?\n/).filter((b) => b.trim()).length - 1} baris data
              </p>
            )}
          </div>

          {galatImpor && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
              {galatImpor}
            </p>
          )}

          {hasilImpor && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-semibold text-slate-800">
                {hasilImpor.ditambahkan} eksemplar ditambahkan · {hasilImpor.dilewati} dilewati
                {hasilImpor.total_galat > 0 ? ` · ${hasilImpor.total_galat} baris bermasalah` : ""}
              </p>
              {hasilImpor.galat.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-rose-700">
                  {hasilImpor.galat.map((g) => (
                    <li key={`${g.baris}-${g.pesan}`}>
                      Baris {g.baris}: {g.pesan}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setImporBuka(false)}>
              Tutup
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void jalankanImpor()}
              disabled={mengimpor || !csvTeks.trim()}
            >
              {mengimpor ? "Mengimpor…" : "Impor Sekarang"}
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
