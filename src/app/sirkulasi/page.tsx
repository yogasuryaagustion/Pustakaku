
"use client";

import { useMemo, useState } from "react";
import {
  useLibrary,
  useHelper,
  hariTerlambat,
} from "@/lib/library-context";
import { useBoleh } from "@/lib/auth";
import type { Peminjaman } from "@/lib/types";
import { useSistem } from "@/lib/sistem";
import {
  Modal,
  Badge,
  EmptyState,
  rupiah,
  tanggalPanjang,
  type BadgeTone,
} from "@/components/ui";
import { useToast } from "@/components/toast";

type Tab = "Semua" | "Aktif" | "Selesai";

function statusBadge(
  p: Peminjaman
): { label: string; tone: BadgeTone } {
  const telat = hariTerlambat(p.tanggalKembali);

  if (p.status === "Dikembalikan") {
    return { label: "Selesai", tone: "green" };
  }

  if (p.status === "Terlambat" || telat > 0) {
    return {
      label: telat > 0 ? `Terlambat ${telat} hari` : "Terlambat",
      tone: "rose",
    };
  }

  return { label: "Sedang Dipinjam", tone: "green" };
}

export default function SirkulasiPage() {
  const {
    buku,
    anggota,
    peminjaman,
    siap,
    pinjamBuku,
    kembalikanBuku,
    perpanjangPinjam,
  } = useLibrary();

  const { cariBuku, cariAnggota, stokTersedia } = useHelper();
  const sistem = useSistem();
  const toast = useToast();
  const bolehKelola = useBoleh("sirkulasi.kelola");

  const [tab, setTab] = useState<Tab>("Semua");
  const [q, setQ] = useState("");
  const [openPinjam, setOpenPinjam] = useState(false);
  const [formPinjam, setFormPinjam] = useState({
    bukuId: "",
    anggotaId: "",
  });
  const [konfirmasiKembali, setKonfirmasiKembali] =
    useState<Peminjaman | null>(null);

  const bukuTersedia = useMemo(
    () => buku.filter((b) => stokTersedia(b.id) > 0),
    [buku, stokTersedia]
  );

  const anggotaAktif = useMemo(
    () => anggota.filter((a) => a.aktif),
    [anggota]
  );

  const daftar = useMemo(() => {
    let list = peminjaman.slice();

    if (tab === "Aktif") {
      list = list.filter(
        (p) =>
          p.status === "Dipinjam" ||
          p.status === "Terlambat"
      );
    }

    if (tab === "Selesai") {
      list = list.filter(
        (p) => p.status === "Dikembalikan"
      );
    }

    const kata = q.trim().toLowerCase();

    if (kata) {
      list = list.filter((p) => {
        const b = cariBuku(p.bukuId);
        const a = cariAnggota(p.anggotaId);

        return (
          p.kodePinjam.toLowerCase().includes(kata) ||
          (b?.judul.toLowerCase().includes(kata) ?? false) ||
          (a?.nama.toLowerCase().includes(kata) ?? false)
        );
      });
    }

    return list.sort((a, b) => {
      const aktifA =
        a.status === "Dipinjam" || a.status === "Terlambat";
      const aktifB =
        b.status === "Dipinjam" || b.status === "Terlambat";

      if (aktifA !== aktifB) return aktifA ? -1 : 1;

      if (a.tanggalKembali === b.tanggalKembali) return 0;
      return a.tanggalKembali < b.tanggalKembali ? -1 : 1;
    });
  }, [peminjaman, tab, q, cariBuku, cariAnggota]);

  async function submitPinjam(e: React.FormEvent) {
    e.preventDefault();

    const res = await pinjamBuku(
      formPinjam.bukuId,
      formPinjam.anggotaId
    );

    if (res.ok) {
      toast.sukses(res.pesan);
      setOpenPinjam(false);
      setFormPinjam({ bukuId: "", anggotaId: "" });
      setTab("Aktif");
    } else {
      toast.gagal(res.pesan);
    }
  }

  if (!siap) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">
        Memuat data sirkulasi...
      </div>
    );
  }

  const totalDendaBelum = peminjaman
    .filter(
      (p) =>
        p.status === "Dipinjam" ||
        p.status === "Terlambat"
    )
    .reduce(
      (total, p) =>
        total +
        hariTerlambat(p.tanggalKembali) *
          sistem.dendaPerHari,
      0
    );

  const jumlahAktif = peminjaman.filter(
    (p) =>
      p.status === "Dipinjam" ||
      p.status === "Terlambat"
  ).length;

  const jumlahSelesai = peminjaman.filter(
    (p) => p.status === "Dikembalikan"
  ).length;

  return (
    <div className="min-h-full space-y-6 pb-8">
      {/* Judul halaman */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-6 w-1 rounded-full bg-teal-700" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
              Operasional Perpustakaan
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Meja Sirkulasi Peminjaman
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Kelola peminjaman aktif, tanggal pengembalian,
            dan riwayat sirkulasi pembaca.
          </p>
        </div>

        {bolehKelola && (
          <button
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
            onClick={() => setOpenPinjam(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Pinjam Buku
          </button>
        )}
      </section>

      {/* Ringkasan */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Peminjaman
          </p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-bold text-slate-900">
              {peminjaman.length}
            </p>
            <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
                <path d="M4 5.5V21M8 7h8M8 11h8" />
              </svg>
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Sedang Dipinjam
          </p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-bold text-teal-800">
              {jumlahAktif}
            </p>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
                <path d="M4 5.5V21M8 7h8" />
                <path d="m10 13 2 2 4-4" />
              </svg>
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Sudah Dikembalikan
          </p>
          <div className="mt-2 flex items-end justify-between">
            <p className="text-2xl font-bold text-slate-900">
              {jumlahSelesai}
            </p>
            <span className="rounded-lg bg-slate-100 p-2 text-slate-500">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="m5 12 4 4L19 6" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </span>
          </div>
        </div>
      </section>

      {/* Tab, pencarian, dan denda */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            {(["Semua", "Aktif", "Selesai"] as Tab[]).map(
              (t) => {
                const aktif = tab === t;

                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                      aktif
                        ? "bg-teal-800 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {t}
                    {t === "Aktif" && (
                      <span
                        className={`ml-2 text-xs ${
                          aktif ? "text-teal-100" : "text-slate-400"
                        }`}
                      >
                        {jumlahAktif}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" />
              </svg>

              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50"
                placeholder="Cari peminjaman..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {totalDendaBelum > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm">
                <span className="text-slate-600">
                  Potensi denda
                </span>
                <span className="font-bold text-rose-700">
                  {rupiah(totalDendaBelum)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabel peminjaman */}
        {daftar.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <EmptyState
              pesan="Tidak ada data peminjaman"
              sub="Coba ubah filter atau kata pencarian. Anda juga dapat mencatat peminjaman baru."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="font-bold text-slate-900">
                  Daftar Peminjaman
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Data transaksi sirkulasi perpustakaan
                </p>
              </div>

              <span className="mt-2 w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:mt-0">
                {daftar.length} transaksi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90">
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-6">
                      Kode Pinjam
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Judul Buku
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Anggota
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Tgl Pinjam
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Batas Kembali
                    </th>
                    <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-6">
                      Tindakan
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {daftar.map((p) => {
                    const b = cariBuku(p.bukuId);
                    const a = cariAnggota(p.anggotaId);
                    const telat = hariTerlambat(p.tanggalKembali);
                    const sb = statusBadge(p);
                    const masihAktif =
                      p.status === "Dipinjam" ||
                      p.status === "Terlambat";

                    return (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-teal-50/30"
                      >
                        <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {p.kodePinjam}
                          </span>
                        </td>

                        <td className="max-w-[260px] px-5 py-4">
                          <p
                            className="truncate text-sm font-semibold text-slate-900"
                            title={b?.judul ?? "-"}
                          >
                            {b?.judul ?? "-"}
                          </p>
                          {p.nomorInventaris && (
                            <p className="mt-1 font-mono text-xs text-slate-500">
                              Inv. {p.nomorInventaris}
                            </p>
                          )}
                          {p.denda > 0 && (
                            <p className="mt-1 text-xs font-medium text-rose-600">
                              Denda {rupiah(p.denda)}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                            {a?.nama ?? "-"}
                          </p>
                          {a?.nomorAnggota && (
                            <p className="mt-1 text-xs text-slate-400">
                              {a.nomorAnggota}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                          {tanggalPanjang(p.tanggalPinjam)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <p
                            className={`text-sm font-semibold ${
                              masihAktif && telat > 0
                                ? "text-rose-700"
                                : "text-slate-800"
                            }`}
                          >
                            {tanggalPanjang(p.tanggalKembali)}
                          </p>

                          {masihAktif && telat > 0 && (
                            <p className="mt-1 text-xs font-medium text-rose-600">
                              Terlambat {telat} hari
                            </p>
                          )}

                          {p.tanggalKembaliAktual && (
                            <p className="mt-1 text-xs text-slate-400">
                              Kembali:{" "}
                              {tanggalPanjang(
                                p.tanggalKembaliAktual
                              )}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <Badge tone={sb.tone}>{sb.label}</Badge>
                        </td>

                        <td className="px-5 py-4 sm:px-6">
                          <div className="flex items-center justify-end gap-2">
                            {masihAktif && bolehKelola && (
                              <>
                                <button
                                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                                  onClick={async () => {
                                    const hasil =
                                      await perpanjangPinjam(p.id);

                                    if (hasil.ok) {
                                      toast.sukses(
                                        `Pinjaman "${b?.judul ?? p.kodePinjam}" diperpanjang ${sistem.lamaPinjam} hari.`
                                      );
                                    } else {
                                      toast.gagal(hasil.pesan);
                                    }
                                  }}
                                >
                                  Perpanjang
                                </button>

                                <button
                                  className="whitespace-nowrap rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
                                  onClick={() =>
                                    setKonfirmasiKembali(p)
                                  }
                                >
                                  Proses Kembali
                                </button>
                              </>
                            )}

                            {masihAktif && !bolehKelola && (
                              <span className="text-xs text-slate-400">
                                Tidak ada izin
                              </span>
                            )}

                            {!masihAktif && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="m5 12 4 4L19 6" />
                                </svg>
                                Buku Sudah Kembali
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>
                Menampilkan{" "}
                <strong className="text-slate-700">
                  {daftar.length}
                </strong>{" "}
                transaksi peminjaman
              </span>
              <span>
                Lama pinjam standar:{" "}
                <strong className="text-slate-700">
                  {sistem.lamaPinjam} hari
                </strong>
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Modal pinjam buku */}
      <Modal
        open={openPinjam}
        onClose={() => setOpenPinjam(false)}
        title="Pinjam Buku"
      >
        <form onSubmit={submitPinjam} className="space-y-4">
          <div>
            <label className="label">Buku yang tersedia</label>
            <select
              className="input"
              required
              value={formPinjam.bukuId}
              onChange={(e) =>
                setFormPinjam({
                  ...formPinjam,
                  bukuId: e.target.value,
                })
              }
            >
              <option value="">— Pilih buku —</option>
              {bukuTersedia.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.judul} (sisa {stokTersedia(b.id)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Anggota</label>
            <select
              className="input"
              required
              value={formPinjam.anggotaId}
              onChange={(e) =>
                setFormPinjam({
                  ...formPinjam,
                  anggotaId: e.target.value,
                })
              }
            >
              <option value="">— Pilih anggota —</option>
              {anggotaAktif.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nomorAnggota} — {a.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
            <p>
              Lama pinjam:{" "}
              <strong>{sistem.lamaPinjam} hari</strong>
            </p>
            <p className="mt-1">
              Denda keterlambatan:{" "}
              <strong>{rupiah(sistem.dendaPerHari)}/hari</strong>
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpenPinjam(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Catat Peminjaman
            </button>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi pengembalian */}
      <Modal
        open={!!konfirmasiKembali}
        onClose={() => setKonfirmasiKembali(null)}
        title="Konfirmasi Pengembalian"
        width="max-w-md"
      >
        {konfirmasiKembali && (
          <div className="space-y-4 text-sm">
            <p className="leading-6 text-slate-600">
              Apakah Anda yakin ingin mengembalikan buku{" "}
              <strong className="text-slate-900">
                {cariBuku(konfirmasiKembali.bukuId)?.judul}
              </strong>{" "}
              milik{" "}
              <strong className="text-slate-900">
                {cariAnggota(konfirmasiKembali.anggotaId)?.nama}
              </strong>
              ?
            </p>

            {(() => {
              const telat = hariTerlambat(
                konfirmasiKembali.tanggalKembali
              );

              return telat > 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
                  <p className="font-semibold">
                    Pengembalian terlambat {telat} hari
                  </p>
                  <p className="mt-1">
                    Denda:{" "}
                    <strong>
                      {rupiah(telat * sistem.dendaPerHari)}
                    </strong>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                  Pengembalian tepat waktu, tanpa denda.
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn btn-ghost"
                onClick={() => setKonfirmasiKembali(null)}
              >
                Batal
              </button>

              <button
                className="btn btn-primary"
                onClick={async () => {
                  const judul =
                    cariBuku(konfirmasiKembali.bukuId)?.judul ??
                    konfirmasiKembali.kodePinjam;

                  const hasil = await kembalikanBuku(
                    konfirmasiKembali.id
                  );

                  setKonfirmasiKembali(null);

                  if (hasil.ok) {
                    toast.sukses(
                      `Pengembalian "${judul}" berhasil dicatat.`
                    );
                  } else {
                    toast.gagal(hasil.pesan);
                  }
                }}
              >
                Ya, Kembalikan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
