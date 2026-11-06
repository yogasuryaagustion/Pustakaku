"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useBoleh } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/ui";
import {
  BadgeKondisi,
  BadgeStatus,
  KepalaInventaris,
  NavigasiInventaris,
  pesanGalat,
  useMuatApi,
} from "@/components/inventaris-ui";
import { KONDISI_EKSEMPLAR, STATUS_EKSEMPLAR } from "@/lib/supabase/inventaris";

// Stock Opname — cocokkan eksemplar fisik satu judul dengan catatan sistem.
// Tiap baris ditandai ditemukan/tidak ditemukan, boleh sekaligus memperbarui
// status & kondisi. Simpan akan membuat sesi opname (riwayat) sekaligus
// menerapkan perubahan ke eksemplar terkait.

interface BarisRingkas {
  buku_id: string;
  judul: string;
  stok: number;
  total_eksemplar: number;
}

interface Pemeriksaan {
  id: string;
  nomor_inventaris: string;
  status: string;
  kondisi_fisik: string;
  tanggal_pengadaan: string;
  keterangan: string;
}

interface BarisCek {
  id: string;
  nomor_inventaris: string;
  statusSistem: string;
  kondisiSistem: string;
  ditemukan: boolean;
  status: string;
  kondisi: string;
  keterangan: string;
}

export default function HalamanStockOpname() {
  const toast = useToast();
  const bolehKelola = useBoleh("katalog.kelola");
  const params = useSearchParams();
  const bukuAwal = params.get("buku") ?? "";

  const [buku, setBuku] = useState(bukuAwal);
  const [baris, setBaris] = useState<BarisCek[]>([]);
  const [komentar, setKomentar] = useState("");
  const [memuatBaris, setMemuatBaris] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const [segar, setSegar] = useState(0);

  const { data: dataRingkasan, memuat, galat: galatRingkasan } = useMuatApi<{
    ringkasan: BarisRingkas[];
  }>("/api/eksemplar", segar);

  const ringkasan = useMemo(
    () => (Array.isArray(dataRingkasan?.ringkasan) ? dataRingkasan.ringkasan : []),
    [dataRingkasan],
  );

  // Daftar eksemplar dimuat ulang setiap judul berganti atau setelah menyimpan.
  useEffect(() => {
    if (!buku) return;
    let batal = false;
    apiFetch<{ eksemplar: Pemeriksaan[] }>(`/api/eksemplar/${buku}/pemeriksaan`)
      .then((res) => {
        if (batal) return;
        setBaris(
          (res.eksemplar ?? []).map((e) => ({
            id: e.id,
            nomor_inventaris: e.nomor_inventaris,
            statusSistem: e.status,
            kondisiSistem: e.kondisi_fisik,
            ditemukan: true,
            status: e.status,
            kondisi: e.kondisi_fisik,
            keterangan: e.keterangan ?? "",
          })),
        );
        setGalat("");
      })
      .catch((e: unknown) => {
        if (batal) return;
        setBaris([]);
        setGalat(pesanGalat(e));
      })
      .finally(() => {
        if (!batal) setMemuatBaris(false);
      });
    return () => {
      batal = true;
    };
  }, [buku, segar]);

  const pesanGalatTampil = galatRingkasan || galat;

  const judul = useMemo(
    () => ringkasan.find((r) => r.buku_id === buku)?.judul ?? "",
    [ringkasan, buku],
  );

  const statistik = useMemo(() => {
    const ditemukan = baris.filter((b) => b.ditemukan).length;
    const berubah = baris.filter(
      (b) => b.status !== b.statusSistem || b.kondisi !== b.kondisiSistem,
    ).length;
    return { total: baris.length, ditemukan, tidak: baris.length - ditemukan, berubah };
  }, [baris]);

  const ubah = (id: string, patch: Partial<BarisCek>) => {
    setBaris((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const simpan = async () => {
    if (!bolehKelola) return;
    if (!buku) return setGalat("Pilih judul yang akan diopname.");
    if (baris.length === 0) return setGalat("Judul ini belum punya eksemplar untuk diperiksa.");

    setMenyimpan(true);
    setGalat("");
    try {
      await apiFetch("/api/opname", {
        method: "POST",
        body: {
          komentar: komentar.trim() || null,
          baris: baris.map((b) => ({
            id: b.id,
            buku_id: buku,
            nomor_inventaris: b.nomor_inventaris,
            status: b.ditemukan ? b.status : "hilang",
            kondisi_fisik: b.ditemukan ? b.kondisi : "hilang",
            keterangan: b.keterangan.trim() || null,
            jumlah_fisik: b.ditemukan ? 1 : 0,
            tidak_ditemukan: b.ditemukan ? 0 : 1,
          })),
        },
      });
      toast.sukses("Hasil opname tersimpan dan eksemplar diperbarui.");
      setKomentar("");
      setSegar((s) => s + 1);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-6">
      <KepalaInventaris
        judul="Stock Opname"
        sub="Periksa barang fisik satu judul, tandai yang tidak ditemukan, lalu simpan. Hasilnya tersimpan sebagai riwayat dan langsung memperbarui status eksemplar."
      />

      <NavigasiInventaris />

      {pesanGalatTampil && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pesanGalatTampil}
        </div>
      )}

      <section className="card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="opname-buku">
              Judul yang diperiksa
            </label>
            <select
              id="opname-buku"
              className="input"
              value={buku}
              onChange={(e) => {
                setBaris([]);
                setMemuatBaris(true);
                setBuku(e.target.value);
              }}
              disabled={memuat}
            >
              <option value="">Pilih judul…</option>
              {ringkasan.map((r) => (
                <option key={r.buku_id} value={r.buku_id}>
                  {r.judul} ({Number(r.total_eksemplar) || 0} eksemplar)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="opname-komentar">
              Catatan sesi (opsional)
            </label>
            <input
              id="opname-komentar"
              className="input"
              placeholder="mis. opname rutin rak A"
              value={komentar}
              onChange={(e) => setKomentar(e.target.value)}
            />
          </div>
        </div>
      </section>

      {buku && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Diperiksa
            </div>
            <div className="mt-1 text-2xl font-bold">{statistik.total}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Ditemukan
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{statistik.ditemukan}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Tidak ditemukan / perubahan
            </div>
            <div className="mt-1 text-2xl font-bold text-rose-600">
              {statistik.tidak} / {statistik.berubah}
            </div>
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="font-bold">{judul || "Belum ada judul dipilih"}</h2>
            <p className="text-xs text-[var(--muted)]">
              {buku ? "Tandai eksemplar yang benar-benar ada di rak." : "Pilih judul untuk memulai opname."}
            </p>
          </div>
          {bolehKelola && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void simpan()}
              disabled={menyimpan || memuatBaris || baris.length === 0}
            >
              {menyimpan ? "Menyimpan…" : "Simpan Hasil Opname"}
            </button>
          )}
        </div>

        {!buku ? (
          <div className="p-6">
            <EmptyState pesan="Pilih judul terlebih dahulu" sub="Daftar eksemplar akan muncul di sini." />
          </div>
        ) : memuatBaris ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Memuat eksemplar…
          </div>
        ) : baris.length === 0 ? (
          <div className="p-6">
            <EmptyState
              pesan="Judul ini belum punya eksemplar"
              sub="Tambahkan eksemplar lewat halaman Data Eksemplar."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Ditemukan</th>
                  <th>Nomor Inventaris</th>
                  <th>Status Sistem</th>
                  <th>Status Fisik</th>
                  <th>Kondisi Fisik</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr key={b.id} className={b.ditemukan ? undefined : "bg-rose-50/40"}>
                    <td>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--brand)]"
                        checked={b.ditemukan}
                        onChange={(e) => ubah(b.id, { ditemukan: e.target.checked })}
                        aria-label={`Tandai ${b.nomor_inventaris} ditemukan`}
                      />
                    </td>
                    <td className="font-mono text-xs font-semibold text-slate-700">
                      {b.nomor_inventaris}
                    </td>
                    <td>
                      <BadgeStatus status={b.statusSistem} />
                      <div className="mt-1">
                        <BadgeKondisi kondisi={b.kondisiSistem} />
                      </div>
                    </td>
                    <td>
                      <select
                        className="input w-auto"
                        value={b.ditemukan ? b.status : "hilang"}
                        onChange={(e) => ubah(b.id, { status: e.target.value })}
                        disabled={!b.ditemukan}
                        aria-label={`Status fisik ${b.nomor_inventaris}`}
                      >
                        {STATUS_EKSEMPLAR.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="input w-auto"
                        value={b.ditemukan ? b.kondisi : "hilang"}
                        onChange={(e) => ubah(b.id, { kondisi: e.target.value })}
                        disabled={!b.ditemukan}
                        aria-label={`Kondisi fisik ${b.nomor_inventaris}`}
                      >
                        {KONDISI_EKSEMPLAR.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        placeholder="Catatan pemeriksaan…"
                        value={b.keterangan}
                        onChange={(e) => ubah(b.id, { keterangan: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
