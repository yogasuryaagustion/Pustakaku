
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useLibrary,
  useHelper,
  hariTerlambat,
  PESAN_KONDISI_KEMBALI,
  type KondisiKembali,
} from "@/lib/library-context";
import { useBoleh } from "@/lib/auth";
import type { Peminjaman } from "@/lib/types";
import type { BarisEksemplar } from "@/lib/supabase/peta";
import { useSistem } from "@/lib/sistem";
import {
  pesanNominalDenda,
  sisaDenda,
  totalDendaTertunggak,
} from "@/lib/denda";
import { KepalaHalaman } from "@/components/kepala-halaman";
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

/**
 * Pilihan kondisi saat pengembalian. Status salinan mengikuti aturan:
 * layak → tersedia, rusak_ringan/rusak_beda → rusak, hilang → hilang.
 */
const PILIHAN_KONDISI: Array<{
  nilai: KondisiKembali;
  judul: string;
  ket: string;
}> = [
  {
    nilai: "layak",
    judul: "Layak",
    ket: "Status tersedia — kembali ke rak dan bisa dipinjam lagi.",
  },
  {
    nilai: "rusak_ringan",
    judul: "Rusak ringan",
    ket: "Status rusak — tidak ditawarkan untuk dipinjam.",
  },
  {
    nilai: "rusak_beda",
    judul: "Rusak berbeda",
    ket: "Status rusak — buku yang kembali tidak sesuai catatan (edisi/judul lain).",
  },
  {
    nilai: "hilang",
    judul: "Hilang",
    ket: "Status hilang — buku tidak kembali; stok menyusut saat Perbaiki Selisih dijalankan.",
  },
];

export default function SirkulasiPage() {
  const {
    buku,
    anggota,
    peminjaman,
    siap,
    pinjamBuku,
    kembalikanBuku,
    perpanjangPinjam,
    lunasiDenda,
    bayarDenda,
  } = useLibrary();

  const { cariBuku, cariAnggota, stokTersedia, ajuanMenunggu } = useHelper();
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
  // Lama pinjam untuk transaksi ini saja. Dimulai dari standar Pengaturan,
  // tetapi petugas boleh memendekkan/memanjangkan tanpa mengubah pengaturan.
  const [lamaPinjam, setLamaPinjam] = useState(sistem.lamaPinjam);
  const [konfirmasiKembali, setKonfirmasiKembali] =
    useState<Peminjaman | null>(null);
  const [kondisiKembali, setKondisiKembali] =
    useState<KondisiKembali>("layak");
  // Pinjaman lama bisa belum tertaut ke salinan; petugas memilih salinan yang
  // benar-benar diterima agar kondisi fisiknya tercatat di inventaris.
  const [salinanKembali, setSalinanKembali] = useState("");
  const [salinanBuku, setSalinanBuku] = useState<BarisEksemplar[]>([]);

  // Denda & cicilan: modal dibuka per pinjaman. Yang disimpan hanya id, agar
  // riwayat selalu memakai data terbaru dari konteks setelah pembayaran.
  const [dendaId, setDendaId] = useState<string | null>(null);
  const [nominalBayar, setNominalBayar] = useState("");
  const [catatanBayar, setCatatanBayar] = useState("");
  const [sedangBayar, setSedangBayar] = useState(false);

  useEffect(() => {
    if (!konfirmasiKembali || konfirmasiKembali.nomorInventaris) return;

    const bukuId = konfirmasiKembali.bukuId;
    let batal = false;

    fetch("/api/eksemplar")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { eksemplar?: BarisEksemplar[] } | null) => {
        if (batal || !data) return;
        const daftar = (data.eksemplar ?? []).filter(
          (e) => e.buku_id === bukuId && e.status !== "hilang",
        );
        setSalinanBuku(daftar);

        const sedangDipinjam = daftar.find((e) => e.status === "dipinjam");
        if (sedangDipinjam) setSalinanKembali(sedangDipinjam.id);
        else if (daftar.length === 1) setSalinanKembali(daftar[0].id);
      })
      .catch(() => {});

    return () => {
      batal = true;
    };
  }, [konfirmasiKembali]);

  /** Jatuh tempo bila dipinjam hari ini dengan lama pinjam terpilih. */
  const jatuhTempo = useMemo(() => {
    const tanggal = new Date();
    tanggal.setDate(tanggal.getDate() + (lamaPinjam || 0));
    return tanggal.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [lamaPinjam]);

  const dendaAktif = useMemo(
    () => peminjaman.find((p) => p.id === dendaId) ?? null,
    [peminjaman, dendaId],
  );
  const sisaDendaAktif = dendaAktif
    ? sisaDenda(dendaAktif.denda, dendaAktif.dendaDibayar)
    : 0;

  // Tunggakan anggota terpilih — ditampilkan sebelum menyimpan, karena
  // database juga menolak peminjaman selama denda belum dilunasi.
  const tertunggakAnggota = useMemo(
    () => totalDendaTertunggak(peminjaman, formPinjam.anggotaId),
    [peminjaman, formPinjam.anggotaId],
  );

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

  /** Buka modal denda untuk satu pinjaman; nominal awal = sisa denda. */
  function bukaDenda(p: Peminjaman) {
    setDendaId(p.id);
    setNominalBayar(String(sisaDenda(p.denda, p.dendaDibayar)));
    setCatatanBayar("");
  }

  async function kirimPembayaranDenda(nominal: number) {
    if (!dendaAktif) return;
    const galat = pesanNominalDenda(nominal, sisaDendaAktif);
    if (galat) {
      toast.gagal(galat);
      return;
    }

    setSedangBayar(true);
    const hasil = await bayarDenda(
      dendaAktif.id,
      nominal,
      catatanBayar.trim() || undefined,
    );
    setSedangBayar(false);

    if (hasil.ok) {
      toast.sukses(`Pembayaran ${rupiah(nominal)} dicatat.`);
      setDendaId(null);
      setNominalBayar("");
      setCatatanBayar("");
    } else {
      toast.gagal(hasil.pesan);
    }
  }

  async function submitPinjam(e: React.FormEvent) {
    e.preventDefault();

    if (!Number.isInteger(lamaPinjam) || lamaPinjam < 1 || lamaPinjam > 90) {
      toast.gagal("Lama pinjam harus antara 1 dan 90 hari.");
      return;
    }

    if (tertunggakAnggota > 0) {
      toast.gagal(
        `Anggota ini masih memiliki denda tertunggak ${rupiah(tertunggakAnggota)}. Lunasi denda terlebih dahulu.`,
      );
      return;
    }

    const res = await pinjamBuku(
      formPinjam.bukuId,
      formPinjam.anggotaId,
      undefined,
      lamaPinjam
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
      {/* Kepala halaman — judul sudah tampil di header AppShell. */}
      <KepalaHalaman
        remah={
          <span className="inline-flex items-center gap-2 text-[var(--brand-ink)]">
            <span className="h-4 w-1 rounded-full bg-[var(--brand)]" />
            Operasional perpustakaan
          </span>
        }
        deskripsi="Catat peminjaman baru, perpanjang masa pinjam, dan proses pengembalian buku. Riwayat peminjaman pembaca tampil di tabel yang sama."
        aksi={
          bolehKelola && (
            <button
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand-solid)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-solid-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)]"
              onClick={() => {
                setLamaPinjam(sistem.lamaPinjam);
                setOpenPinjam(true);
              }}
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
          )
        }
      />

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

            {/* Tabel 1000px hanya muat di layar lebar; di ponsel diganti kartu. */}
            <div className="hidden overflow-x-auto md:block">
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
                          {ajuanMenunggu(p.id) && (
                            <p className="mt-1 whitespace-nowrap text-[11px] font-semibold text-amber-700">
                              Diajukan kembali
                            </p>
                          )}
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
                                  onClick={() => {
                                    setKondisiKembali("layak");
                                    setSalinanKembali("");
                                    setSalinanBuku([]);
                                    setKonfirmasiKembali(p);
                                  }}
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

                            {!masihAktif &&
                              (p.denda > 0 && sisaDenda(p.denda, p.dendaDibayar) > 0 ? (
                                bolehKelola ? (
                                  <button
                                    className="whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100"
                                    title="Catat pembayaran denda (boleh dicicil)"
                                    onClick={() => bukaDenda(p)}
                                  >
                                    Bayar {rupiah(sisaDenda(p.denda, p.dendaDibayar))}
                                  </button>
                                ) : (
                                  <span className="text-xs font-semibold text-rose-600">
                                    Denda {rupiah(sisaDenda(p.denda, p.dendaDibayar))} belum lunas
                                  </span>
                                )
                              ) : (
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
                                  {p.denda > 0 ? "Denda lunas" : "Buku Sudah Kembali"}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Versi ponsel: satu kartu per peminjaman supaya petugas tidak
                perlu menggeser tabel ke samping untuk melihat status & aksi. */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {daftar.map((p) => {
                const b = cariBuku(p.bukuId);
                const a = cariAnggota(p.anggotaId);
                const telat = hariTerlambat(p.tanggalKembali);
                const sb = statusBadge(p);
                const masihAktif =
                  p.status === "Dipinjam" || p.status === "Terlambat";

                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold text-slate-900"
                          title={b?.judul ?? "-"}
                        >
                          {b?.judul ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {a?.nama ?? "-"}
                          {a?.nomorAnggota ? ` · ${a.nomorAnggota}` : ""}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                          {p.kodePinjam}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <Badge tone={sb.tone}>{sb.label}</Badge>
                        {ajuanMenunggu(p.id) && (
                          <p className="mt-1 text-[11px] font-semibold text-amber-700">
                            Diajukan kembali
                          </p>
                        )}
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <dt className="text-slate-400">Dipinjam</dt>
                      <dd className="text-right text-slate-600">
                        {tanggalPanjang(p.tanggalPinjam)}
                      </dd>

                      <dt className="text-slate-400">Batas kembali</dt>
                      <dd
                        className={`text-right font-semibold ${
                          masihAktif && telat > 0
                            ? "text-rose-700"
                            : "text-slate-700"
                        }`}
                      >
                        {tanggalPanjang(p.tanggalKembali)}
                      </dd>

                      {masihAktif && telat > 0 && (
                        <>
                          <dt className="text-slate-400">Terlambat</dt>
                          <dd className="text-right font-medium text-rose-600">
                            {telat} hari
                          </dd>
                        </>
                      )}

                      {p.tanggalKembaliAktual && (
                        <>
                          <dt className="text-slate-400">Dikembalikan</dt>
                          <dd className="text-right text-slate-600">
                            {tanggalPanjang(p.tanggalKembaliAktual)}
                          </dd>
                        </>
                      )}

                      {p.denda > 0 && (
                        <>
                          <dt className="text-slate-400">Denda</dt>
                          <dd className="text-right font-medium text-rose-600">
                            {rupiah(p.denda)}
                            {sisaDenda(p.denda, p.dendaDibayar) === 0
                              ? " · lunas"
                              : ` · sisa ${rupiah(sisaDenda(p.denda, p.dendaDibayar))}`}
                          </dd>
                        </>
                      )}
                    </dl>

                    {!masihAktif &&
                      p.denda > 0 &&
                      sisaDenda(p.denda, p.dendaDibayar) > 0 &&
                      bolehKelola && (
                        <button
                          className="btn mt-3 w-full !py-2 text-xs !bg-rose-50 !text-rose-700"
                          onClick={() => bukaDenda(p)}
                        >
                          Bayar denda {rupiah(sisaDenda(p.denda, p.dendaDibayar))}
                        </button>
                      )}

                    {masihAktif && bolehKelola && (
                      <div className="mt-3 flex gap-2">
                        <button
                          className="btn btn-ghost flex-1 !py-2 text-xs"
                          onClick={async () => {
                            const hasil = await perpanjangPinjam(p.id);

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
                          className="btn btn-primary flex-1 !py-2 text-xs"
                          onClick={() => {
                            setKondisiKembali("layak");
                            setSalinanKembali("");
                            setSalinanBuku([]);
                            setKonfirmasiKembali(p);
                          }}
                        >
                          Proses Kembali
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

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

          <div>
            <label className="label" htmlFor="lama-pinjam">
              Lama pinjam (hari)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="lama-pinjam"
                type="number"
                className="input"
                min={1}
                max={90}
                step={1}
                required
                value={lamaPinjam}
                onChange={(e) => {
                  const nilai = Number(e.target.value);
                  setLamaPinjam(Number.isFinite(nilai) ? nilai : 0);
                }}
              />
              <div className="flex shrink-0 gap-1">
                {[7, 14, 30].map((hari) => (
                  <button
                    key={hari}
                    type="button"
                    className="btn btn-ghost px-2.5 py-1.5 text-xs"
                    onClick={() => setLamaPinjam(hari)}
                  >
                    {hari} hr
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Standar dari pengaturan: {sistem.lamaPinjam} hari. Nilai di sini
              hanya berlaku untuk peminjaman ini.
            </p>
          </div>

          {tertunggakAnggota > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-semibold">
                Anggota ini masih memiliki denda tertunggak{" "}
                {rupiah(tertunggakAnggota)}.
              </p>
              <p className="mt-1 text-xs">
                Lunasi denda lewat tombol <strong>Lunasi</strong> pada baris
                pinjaman bersangkutan. Peminjaman baru ditolak sampai dendanya
                lunas.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
            <p>
              Jatuh tempo: <strong>{jatuhTempo}</strong>
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={tertunggakAnggota > 0}
            >
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-800">
                Kondisi salinan yang diterima
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Kondisi selain layak membuat salinan tidak ditawarkan untuk
                dipinjam lagi; hilang juga menyusutkan stok saat Perbaiki
                Selisih dijalankan.
              </p>

              {!konfirmasiKembali.nomorInventaris && salinanBuku.length > 0 && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Salinan yang Anda terima
                  </label>
                  <select
                    className="input input-bordered w-full"
                    value={salinanKembali}
                    onChange={(e) => setSalinanKembali(e.target.value)}
                  >
                    <option value="">— Pilih nomor inventaris —</option>
                    {salinanBuku.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nomor_inventaris} · {e.status}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Pinjaman ini belum tertaut ke salinan fisik. Pilih nomor
                    inventaris yang tertulis pada buku agar kondisi yang dipilih
                    tercatat di inventaris.
                  </p>
                </div>
              )}

              {!konfirmasiKembali.nomorInventaris && salinanBuku.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Judul ini belum punya data eksemplar fisik, jadi kondisi tidak
                  ikut dicatat.
                </p>
              )}

              <div className="mt-3 space-y-2">
                {PILIHAN_KONDISI.map((pilihan) => (
                  <label
                    key={pilihan.nilai}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <input
                      type="radio"
                      name="kondisi-kembali"
                      className="mt-1 h-4 w-4 accent-[var(--brand)]"
                      value={pilihan.nilai}
                      checked={kondisiKembali === pilihan.nilai}
                      onChange={() => setKondisiKembali(pilihan.nilai)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {pilihan.judul}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {pilihan.ket}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

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

                  if (
                    !konfirmasiKembali.nomorInventaris &&
                    salinanBuku.length > 0 &&
                    !salinanKembali
                  ) {
                    toast.gagal(
                      "Pilih salinan yang Anda terima agar kondisinya tercatat.",
                    );
                    return;
                  }

                  // Kondisi hanya bisa tercatat bila ada salinan yang terhubung.
                  const punyaSalinan =
                    Boolean(konfirmasiKembali.nomorInventaris) ||
                    Boolean(salinanKembali);

                  const hasil = await kembalikanBuku(
                    konfirmasiKembali.id,
                    kondisiKembali,
                    salinanKembali || undefined,
                  );

                  setKonfirmasiKembali(null);

                  if (hasil.ok) {
                    toast.sukses(
                      !punyaSalinan
                        ? `Pengembalian "${judul}" dicatat — judul ini belum punya salinan fisik, kondisi belum tercatat.`
                        : `Pengembalian "${judul}" dicatat — ${PESAN_KONDISI_KEMBALI[kondisiKembali]}.`,
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

      {/* Denda & riwayat pembayaran (boleh dicicil) */}
      <Modal
        open={!!dendaAktif}
        onClose={() => setDendaId(null)}
        title="Denda Pinjaman"
        width="max-w-lg"
      >
        {dendaAktif && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-xs text-slate-500">
                {dendaAktif.kodePinjam} ·{" "}
                {cariBuku(dendaAktif.bukuId)?.judul ?? "-"} ·{" "}
                {cariAnggota(dendaAktif.anggotaId)?.nama ?? "-"}
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Denda
                  </dt>
                  <dd className="font-semibold text-slate-800">
                    {rupiah(dendaAktif.denda)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Dibayar
                  </dt>
                  <dd className="font-semibold text-emerald-700">
                    {rupiah(dendaAktif.dendaDibayar)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                    Sisa
                  </dt>
                  <dd className="font-semibold text-rose-600">
                    {rupiah(sisaDendaAktif)}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <p className="label">Riwayat pembayaran</p>
              {(dendaAktif.pembayaranDenda ?? []).length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Belum ada pembayaran untuk pinjaman ini.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {(dendaAktif.pembayaranDenda ?? []).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          {new Date(b.dibuatPada).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {b.catatan && (
                          <p className="truncate text-xs text-slate-600" title={b.catatan}>
                            {b.catatan}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-700">
                        {rupiah(b.nominal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {sisaDendaAktif > 0 ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void kirimPembayaranDenda(Number(nominalBayar));
                }}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="nominal-denda">
                      Nominal diterima (Rp)
                    </label>
                    <input
                      id="nominal-denda"
                      type="number"
                      className="input"
                      min={1}
                      max={sisaDendaAktif}
                      step={1}
                      required
                      value={nominalBayar}
                      onChange={(e) => setNominalBayar(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="catatan-denda">
                      Catatan (opsional)
                    </label>
                    <input
                      id="catatan-denda"
                      type="text"
                      className="input"
                      maxLength={200}
                      placeholder="mis. cicilan pertama"
                      value={catatanBayar}
                      onChange={(e) => setCatatanBayar(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setDendaId(null)}
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={sedangBayar}
                    onClick={async () => {
                      const hasil = await lunasiDenda(dendaAktif.id);
                      if (hasil.ok) {
                        toast.sukses(
                          `Sisa denda ${rupiah(sisaDendaAktif)} dilunasi.`,
                        );
                        setDendaId(null);
                      } else {
                        toast.gagal(hasil.pesan);
                      }
                    }}
                  >
                    Lunasi sisa
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sedangBayar}
                  >
                    {sedangBayar ? "Menyimpan..." : "Catat pembayaran"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-800">
                  Denda pinjaman ini sudah lunas.
                </p>
                <button
                  className="btn btn-ghost"
                  onClick={() => setDendaId(null)}
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
