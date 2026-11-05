
"use client";

import { useMemo, useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import {
  useLibrary,
  useHelper,
  hariTerlambat,
} from "@/lib/library-context";
import {
  Badge,
  Modal,
  EmptyState,
  rupiah,
  tanggalPanjang,
  BadgeTone,
} from "@/components/ui";
import { useSistem } from "@/lib/sistem";
import { useToast } from "@/components/toast";

type Tab = "Aktif" | "Riwayat" | "Semua";

type KonfirmasiPinjaman = {
  id: string;
  judul: string;
};

// Menghitung sisa hari sampai tanggal jatuh tempo.
function sisaHari(iso: string): number {
  return Math.ceil(
    (new Date(iso).getTime() - Date.now()) / 86400000
  );
}

function statusBadge(
  status: string,
  telat: number
): { label: string; tone: BadgeTone } {
  if (status === "Dikembalikan") {
    return { label: "Dikembalikan", tone: "green" };
  }

  if (status === "Terlambat" || telat > 0) {
    return {
      label: telat > 0 ? `Terlambat ${telat} hr` : "Terlambat",
      tone: "rose",
    };
  }

  return { label: "Dipinjam", tone: "sky" };
}

// Format tanggal lokal agar tidak bergeser karena UTC.
function tanggalLokal(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function Ikon({
  nama,
  ukuran = 20,
}: {
  nama:
    | "buku"
    | "peringatan"
    | "uang"
    | "kalender"
    | "perpanjang"
    | "centang";
  ukuran?: number;
}) {
  const paths = {
    buku: (
      <>
        <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5M8 12h8M8 16h8" />
      </>
    ),
    peringatan: (
      <>
        <path d="M12 9v4m0 4h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </>
    ),
    uang: (
      <>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    kalender: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    perpanjang: (
      <>
        <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    centang: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[nama]}
    </svg>
  );
}

function KartuStatistik({
  judul,
  nilai,
  keterangan,
  ikon,
  warna,
  nilaiMerah = false,
}: {
  judul: string;
  nilai: string | number;
  keterangan: string;
  ikon: "buku" | "peringatan" | "uang";
  warna: "teal" | "emerald" | "amber";
  nilaiMerah?: boolean;
}) {
  const warnaIkon = {
    teal: "bg-teal-50 text-teal-700",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {judul}
        </p>

        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${warnaIkon[warna]}`}
        >
          <Ikon nama={ikon} ukuran={22} />
        </span>
      </div>

      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          nilaiMerah ? "text-rose-600" : "text-slate-950"
        }`}
      >
        {nilai}
      </div>

      <p className="mt-1 text-xs text-slate-400">
        {keterangan}
      </p>
    </div>
  );
}

export function PinjamanSaya({
  tabAwal = "Aktif",
}: {
  tabAwal?: Tab;
}) {
  const { sedangMasuk } = useAuth();

  const {
    buku,
    siap,
    pinjamBuku,
    perpanjangPinjam,
    kembalikanBuku,
  } = useLibrary();

  const {
    cariBuku,
    stokTersedia,
    pinjamanAnggota,
  } = useHelper();

  const sistem = useSistem();
  const toast = useToast();

  const bolehPinjam = useBoleh("katalog.pinjam");

  const [tab, setTab] = useState<Tab>(tabAwal);
  const [bukuDipilih, setBukuDipilih] = useState("");

  const [konfirmasi, setKonfirmasi] =
    useState<KonfirmasiPinjaman | null>(null);

  const [konfirmasiKembali, setKonfirmasiKembali] =
    useState<KonfirmasiPinjaman | null>(null);

  const [sedangProsesId, setSedangProsesId] =
    useState<string | null>(null);

  // Tanggal peminjaman dan jatuh tempo otomatis.
  const { hariIni, jatuhTempo } = useMemo(() => {
    const kini = new Date();

    const tempo = new Date(
      kini.getFullYear(),
      kini.getMonth(),
      kini.getDate() + sistem.lamaPinjam
    );

    return {
      hariIni: tanggalLokal(kini),
      jatuhTempo: tanggalLokal(tempo),
    };
  }, [sistem.lamaPinjam]);

  const anggotaId = sedangMasuk?.anggotaId;

  const riwayat = useMemo(() => {
    if (!anggotaId) return [];
    return pinjamanAnggota(anggotaId);
  }, [anggotaId, pinjamanAnggota]);

  const daftar = useMemo(() => {
    if (tab === "Aktif") {
      return riwayat.filter(
        (p) => p.status === "Dipinjam"
      );
    }

    if (tab === "Riwayat") {
      return riwayat.filter(
        (p) => p.status !== "Dipinjam"
      );
    }

    return riwayat;
  }, [riwayat, tab]);

  const bukuTersedia = useMemo(
    () => buku.filter((b) => stokTersedia(b.id) > 0),
    [buku, stokTersedia]
  );

  if (!siap || !sedangMasuk) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Memuat data peminjaman...
      </div>
    );
  }

  if (!anggotaId) {
    return (
      <EmptyState
        pesan="Akun ini tidak terikat kartu anggota"
        sub="Hubungi pustakawan untuk menghubungkan kartu anggota Anda."
      />
    );
  }

  const aktif = riwayat.filter(
    (p) => p.status === "Dipinjam"
  );

  const terlambat = aktif.filter(
    (p) => hariTerlambat(p.tanggalKembali) > 0
  );

  const dendaBelum = aktif.reduce(
    (total, p) =>
      total +
      hariTerlambat(p.tanggalKembali) *
        sistem.dendaPerHari,
    0
  );

  // Mengajukan peminjaman buku.
  async function submitPinjam(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!anggotaId || !bukuDipilih || sedangProsesId) {
      return;
    }

    const res = await pinjamBuku(
      bukuDipilih,
      anggotaId,
      hariIni
    );

    if (res.ok) {
      toast.sukses(res.pesan);
      setBukuDipilih("");
      setTab("Aktif");
    } else {
      toast.gagal(res.pesan);
    }
  }

  // Memperpanjang pinjaman.
  async function konfirmasiPerpanjang() {
    if (!konfirmasi || sedangProsesId) return;

    const data = konfirmasi;
    setSedangProsesId(data.id);

    try {
      const hasil = await perpanjangPinjam(data.id);

      if (hasil.ok) {
        toast.sukses(
          `Pinjaman "${data.judul}" diperpanjang ${sistem.lamaPinjam} hari.`
        );
      } else {
        toast.gagal(hasil.pesan);
      }
    } catch {
      toast.gagal(
        "Terjadi kesalahan saat memperpanjang pinjaman."
      );
    } finally {
      setSedangProsesId(null);
      setKonfirmasi(null);
    }
  }

  // Memproses pengembalian buku.
  async function konfirmasiPengembalian() {
    if (!konfirmasiKembali || sedangProsesId) return;

    const data = konfirmasiKembali;
    setSedangProsesId(data.id);

    try {
      const hasil = await kembalikanBuku(data.id);

      if (hasil.ok) {
        toast.sukses(
          `Buku "${data.judul}" berhasil dikembalikan.`
        );
        setTab("Riwayat");
      } else {
        toast.gagal(hasil.pesan);
      }
    } catch {
      toast.gagal(
        "Terjadi kesalahan saat mengembalikan buku."
      );
    } finally {
      setSedangProsesId(null);
      setKonfirmasiKembali(null);
    }
  }

  const jumlahTab: Record<Tab, number> = {
    Aktif: aktif.length,
    Riwayat: riwayat.filter(
      (p) => p.status !== "Dipinjam"
    ).length,
    Semua: riwayat.length,
  };

  return (
    <div className="min-h-full space-y-6 bg-slate-50/70">

      {/* STATISTIK PEMINJAMAN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuStatistik
          judul="Sedang Dipinjam"
          nilai={aktif.length}
          keterangan={`dari maks. ${sistem.maksPinjaman} buku`}
          ikon="buku"
          warna="teal"
        />

        <KartuStatistik
          judul="Terlambat"
          nilai={terlambat.length}
          keterangan={
            terlambat.length
              ? "Segera kembalikan buku"
              : "Semua tepat waktu"
          }
          ikon="peringatan"
          warna="emerald"
          nilaiMerah={terlambat.length > 0}
        />

        <KartuStatistik
          judul="Denda Berjalan"
          nilai={rupiah(dendaBelum)}
          keterangan={`${rupiah(sistem.dendaPerHari)}/hari keterlambatan`}
          ikon="uang"
          warna="amber"
          nilaiMerah={dendaBelum > 0}
        />
      </div>

      {/* DAFTAR PINJAMAN DAN FORM PINJAM */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">

        {/* DAFTAR PINJAMAN */}
        <div className="min-w-0 space-y-5 lg:col-span-2">

          {/* TAB NAVIGASI */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-1">
              {(["Aktif", "Riwayat", "Semua"] as Tab[]).map(
                (t) => {
                  const terpilih = tab === t;

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      aria-pressed={terpilih}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        terpilih
                          ? "bg-teal-800 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {t}

                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          terpilih
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {jumlahTab[t]}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <span className="px-2 text-xs font-medium text-slate-400">
              {daftar.length} transaksi
            </span>
          </div>

          {/* KARTU DAFTAR BUKU */}
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {daftar.length === 0 ? (
              <div className="flex min-h-[190px] flex-col items-center justify-center px-5 text-center">
                <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <Ikon nama="buku" ukuran={26} />
                </div>

                <p className="font-semibold text-slate-800">
                  {tab === "Aktif"
                    ? "Belum ada pinjaman aktif"
                    : "Belum ada riwayat peminjaman"}
                </p>

                <p className="mt-1 max-w-sm text-sm text-slate-400">
                  {tab === "Aktif"
                    ? "Silakan pilih buku yang tersedia melalui panel Pinjam Buku."
                    : "Riwayat peminjaman buku Anda akan ditampilkan di sini."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {daftar.map((p) => {
                  const telat = hariTerlambat(
                    p.tanggalKembali
                  );

                  const sb = statusBadge(p.status, telat);
                  const b = cariBuku(p.bukuId);
                  const sisa = sisaHari(p.tanggalKembali);
                  const sedangDiproses =
                    sedangProsesId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="flex flex-col gap-4 rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 transition hover:border-teal-200 hover:bg-white sm:flex-row sm:items-center"
                    >
                      {/* COVER BUKU */}
                      <div className="flex shrink-0 items-center gap-3 sm:block">
                        <div className="flex h-[112px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-950 via-teal-900 to-slate-800 p-2 text-center shadow-md">
                          <div className="line-clamp-4 text-[11px] font-bold uppercase leading-relaxed tracking-wide text-white">
                            {b?.judul ?? "Buku"}
                          </div>
                        </div>

                        <div className="sm:hidden">
                          <p className="font-semibold text-slate-900">
                            {b?.judul ?? "-"}
                          </p>

                          <div className="mt-2">
                            <Badge tone={sb.tone}>
                              {sb.label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* INFORMASI BUKU */}
                      <div className="min-w-0 flex-1">
                        <div className="hidden flex-wrap items-center gap-2 sm:flex">
                          <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
                            Informasi Peminjaman
                          </span>

                          <Badge tone={sb.tone}>
                            {sb.label}
                          </Badge>
                        </div>

                        <h3 className="mt-1 hidden break-words text-base font-bold text-slate-900 sm:block">
                          {b?.judul ?? "-"}
                        </h3>

                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Kode: {p.kodePinjam}
                        </p>

                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                          Dipinjam:{" "}
                          <span className="font-medium text-slate-700">
                            {tanggalPanjang(p.tanggalPinjam)}
                          </span>
                        </p>

                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Jatuh tempo:{" "}
                          <span className="font-semibold text-slate-800">
                            {tanggalPanjang(p.tanggalKembali)}
                          </span>
                        </p>

                        {p.status === "Dipinjam" && (
                          <p
                            className={`mt-2 text-xs font-semibold ${
                              sisa < 0
                                ? "text-rose-600"
                                : "text-teal-700"
                            }`}
                          >
                            {sisa >= 0
                              ? `Sisa waktu ${sisa} hari`
                              : `Terlambat ${Math.abs(sisa)} hari`}
                          </p>
                        )}

                        {p.tanggalKembaliAktual && (
                          <p className="mt-1 text-xs text-slate-500">
                            Dikembalikan:{" "}
                            {tanggalPanjang(
                              p.tanggalKembaliAktual
                            )}
                          </p>
                        )}

                        {p.denda > 0 && (
                          <p className="mt-2 text-xs font-semibold text-rose-600">
                            Denda: {rupiah(p.denda)}
                          </p>
                        )}
                      </div>

                      {/* TOMBOL AKSI */}
                      {p.status === "Dipinjam" && (
                        <div className="flex shrink-0 flex-col gap-2 sm:w-[150px]">

                          {/* PERPANJANG */}
                          <button
                            type="button"
                            onClick={() =>
                              setKonfirmasi({
                                id: p.id,
                                judul: b?.judul ?? p.kodePinjam,
                              })
                            }
                            disabled={!!sedangProsesId}
                            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Ikon nama="perpanjang" ukuran={16} />
                            Perpanjang
                          </button>

                          {/* KEMBALIKAN */}
                          <button
                            type="button"
                            onClick={() =>
                              setKonfirmasiKembali({
                                id: p.id,
                                judul: b?.judul ?? p.kodePinjam,
                              })
                            }
                            disabled={!!sedangProsesId}
                            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Ikon nama="centang" ukuran={16} />
                            Kembalikan
                          </button>

                          {sedangDiproses && (
                            <p className="text-center text-[11px] text-slate-500">
                              Memproses...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FORM PINJAM BUKU */}
        <div className="self-start overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Pinjam Buku
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Pilih buku yang tersedia
            </p>
          </div>

          <div className="p-5">
            {bolehPinjam ? (
              <form
                onSubmit={submitPinjam}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="pilih-buku"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Pilih buku tersedia
                  </label>

                  <select
                    id="pilih-buku"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    value={bukuDipilih}
                    onChange={(e) =>
                      setBukuDipilih(e.target.value)
                    }
                    required
                  >
                    <option value="">
                      — Pilih buku —
                    </option>

                    {bukuTersedia.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.judul} (sisa {stokTersedia(b.id)})
                      </option>
                    ))}
                  </select>

                  {bukuTersedia.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Saat ini belum ada buku yang tersedia.
                    </p>
                  )}
                </div>

                {/* INFORMASI JATUH TEMPO */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-teal-700">
                      <Ikon nama="kalender" ukuran={18} />
                    </span>

                    <div>
                      <p className="text-xs leading-relaxed text-slate-500">
                        Dipinjam hari ini · jatuh tempo otomatis:
                      </p>

                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {tanggalPanjang(jatuhTempo)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* TOMBOL PINJAM */}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !bukuDipilih ||
                    aktif.length >= sistem.maksPinjaman ||
                    !!sedangProsesId
                  }
                >
                  Pinjam Sekarang
                </button>

                {aktif.length >= sistem.maksPinjaman && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed text-rose-600">
                    Batas maksimal {sistem.maksPinjaman} buku sedang dipinjam. Kembalikan salah satu buku terlebih dahulu.
                  </div>
                )}

                <p className="text-xs leading-relaxed text-slate-400">
                  Lama pinjam {sistem.lamaPinjam} hari.
                  Pengembalian tetap mengikuti prosedur verifikasi
                  perpustakaan.
                </p>
              </form>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                Peminjaman mandiri dinonaktifkan oleh kebijakan akses.
                Silakan ajukan peminjaman melalui pustakawan.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL KONFIRMASI PERPANJANGAN */}
      <Modal
        open={!!konfirmasi}
        onClose={() => {
          if (!sedangProsesId) setKonfirmasi(null);
        }}
        title="Perpanjang Pinjaman"
        width="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-slate-600">
            Apakah Anda yakin ingin memperpanjang pinjaman{" "}
            <span className="font-bold text-slate-900">
              {konfirmasi?.judul}
            </span>{" "}
            selama {sistem.lamaPinjam} hari tambahan?
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!!sedangProsesId}
              onClick={() => setKonfirmasi(null)}
            >
              Batal
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!!sedangProsesId}
              onClick={konfirmasiPerpanjang}
            >
              {sedangProsesId
                ? "Memproses..."
                : "Ya, Perpanjang"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL KONFIRMASI PENGEMBALIAN */}
      <Modal
        open={!!konfirmasiKembali}
        onClose={() => {
          if (!sedangProsesId) {
            setKonfirmasiKembali(null);
          }
        }}
        title="Konfirmasi Pengembalian"
        width="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-slate-600">
            Apakah Anda yakin ingin mengembalikan buku{" "}
            <span className="font-bold text-slate-900">
              {konfirmasiKembali?.judul}
            </span>
            ?
          </p>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            Pastikan buku sudah diserahkan kepada pustakawan
            sebelum mengonfirmasi pengembalian.
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!!sedangProsesId}
              onClick={() => setKonfirmasiKembali(null)}
            >
              Batal
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!!sedangProsesId}
              onClick={konfirmasiPengembalian}
            >
              {sedangProsesId
                ? "Memproses..."
                : "Ya, Kembalikan"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
