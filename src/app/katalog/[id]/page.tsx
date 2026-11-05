"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useLibrary, useHelper } from "@/lib/library-context";
import { useAuth, useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { SampulBuku } from "@/components/ui";
import type { Buku } from "@/lib/types";

function tanggalLokal() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${tanggal}`;
}

function estimasiBaca(halaman: number) {
  const jam = Math.max(1, Math.ceil(halaman / 75));
  return `~${jam} jam`;
}

export default function DetailBukuPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { buku, muatKatalogPublik, pinjamBuku } = useLibrary();
  const { stokTersedia } = useHelper();

  const { sedangMasuk, siap: authSiap } = useAuth();
  const bolehPinjam = useBoleh("katalog.pinjam");
  const sistem = useSistem();

  const [memuat, setMemuat] = useState(true);
  const [memproses, setMemproses] = useState(false);
  const [pesan, setPesan] = useState("");
  const [sukses, setSukses] = useState(false);

  useEffect(() => {
    let aktif = true;

    async function muat() {
      try {
        await muatKatalogPublik();
      } finally {
        if (aktif) setMemuat(false);
      }
    }

    void muat();

    return () => {
      aktif = false;
    };
  }, [muatKatalogPublik]);

  const item = useMemo(
    () => buku.find((b) => b.id === params.id),
    [buku, params.id],
  );

  if (memuat && !item) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f3f7f6] px-4">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
          <p className="mt-3 text-sm text-slate-500">Memuat detail buku...</p>
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f3f7f6] px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">📚</div>
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            Buku tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Buku mungkin sudah dihapus atau tidak tersedia.
          </p>
          <Link
            href="/katalog"
            className="mt-5 inline-flex rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-900"
          >
            Kembali ke Katalog
          </Link>
        </div>
      </main>
    );
  }

  const stok = stokTersedia(item.id);
  const tersedia = stok > 0;

  const detail = item as Buku & {
    sinopsis?: string;
    deskripsi?: string;
    halaman?: number;
    jumlahHalaman?: number;
    rating?: number;
    penerbit?: string;
    isbn?: string;
    sampelBabUrl?: string;
    fileSampel?: string;
  };

  const jumlahHalaman = detail.halaman ?? detail.jumlahHalaman;
  const sinopsis =
    detail.sinopsis || detail.deskripsi || "Belum ada sinopsis untuk buku ini.";

  async function handlePinjam() {
    if (!item) return;
    setPesan("");
    setSukses(false);

    if (!authSiap) {
      setPesan("Sedang memeriksa akun. Silakan tunggu.");
      return;
    }

    if (!sedangMasuk) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/katalog/${item.id}`)}`,
      );
      return;
    }

    if (!bolehPinjam) {
      setPesan("Akun kamu belum memiliki izin untuk meminjam buku.");
      return;
    }

    if (!sedangMasuk.anggotaId) {
      setPesan("Akun belum terhubung dengan data anggota perpustakaan.");
      return;
    }

    if (stok <= 0) {
      setPesan("Maaf, buku sedang tidak tersedia.");
      return;
    }

    try {
      setMemproses(true);

      const hasil = await pinjamBuku(
        item.id,
        sedangMasuk.anggotaId,
        tanggalLokal(),
      );

      setSukses(hasil.ok);
      setPesan(hasil.pesan);
    } catch {
      setPesan("Terjadi kesalahan saat memproses peminjaman.");
    } finally {
      setMemproses(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f7f6] px-4 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto w-full max-w-4xl">
        {/* Navigasi kembali */}
        <Link
          href="/katalog"
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-teal-800 sm:text-sm"
        >
          <span aria-hidden="true">←</span>
          Kembali ke Katalog
        </Link>

        {/* Panel detail buku */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5 sm:rounded-3xl sm:p-6">
          <Link
            href="/katalog"
            aria-label="Tutup detail buku"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 transition hover:bg-slate-200 sm:right-4 sm:top-4"
          >
            ×
          </Link>

          <div className="grid gap-5 sm:gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
            {/* Cover buku */}
            <div className="mx-auto w-full max-w-[190px] lg:max-w-[220px]">
              <div className="overflow-hidden rounded-xl shadow-md sm:rounded-2xl">
                <SampulBuku
                  buku={item}
                  className="aspect-[3/4.4] w-full"
                  rounded=""
                />
              </div>

              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-xs sm:text-sm">
                <span className="font-semibold text-slate-600">
                  Ketersediaan
                </span>
                <span
                  className={`font-bold ${
                    tersedia ? "text-emerald-700" : "text-slate-500"
                  }`}
                >
                  {tersedia ? `${stok} tersedia` : "Tidak tersedia"}
                </span>
              </div>
            </div>

            {/* Informasi buku */}
            <div className="min-w-0 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${
                    tersedia
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span>{tersedia ? "✓" : "○"}</span>
                  {tersedia ? "Tersedia Langsung" : "Sedang Dipinjam"}
                </span>

                {item.kategori && (
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700 sm:text-xs">
                    {item.kategori}
                  </span>
                )}
              </div>

              <h1 className="mt-3 pr-8 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                {item.judul}
              </h1>

              <p className="mt-2 text-sm font-semibold text-teal-800 sm:text-base">
                Penulis: {item.penulis || "Tidak diketahui"}
              </p>

              {detail.penerbit && (
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Penerbit: {detail.penerbit}
                </p>
              )}

              {/* Statistik */}
              <div className="mt-5 grid grid-cols-3 border-y border-slate-100 py-3 sm:py-4">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Rating</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    <span className="text-amber-500">★</span>{" "}
                    {detail.rating ?? "—"}
                  </p>
                </div>

                <div className="border-x border-slate-100 text-center">
                  <p className="text-xs text-slate-400">Halaman</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {jumlahHalaman ? `${jumlahHalaman} Hal` : "—"}
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-xs text-slate-400">Estimasi</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {jumlahHalaman ? estimasiBaca(jumlahHalaman) : "—"}
                  </p>
                </div>
              </div>

              {/* Sinopsis */}
              <div className="mt-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sinopsis Buku
                </h2>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {sinopsis}
                </p>
              </div>

              {/* ISBN */}
              {detail.isbn && (
                <p className="mt-3 text-xs text-slate-400">
                  ISBN: {detail.isbn}
                </p>
              )}

              {/* Notifikasi */}
              {pesan && (
                <div
                  role="status"
                  className={`mt-4 rounded-lg border px-3 py-2.5 text-xs sm:text-sm ${
                    sukses
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {pesan}
                </div>
              )}

              {/* Tombol aksi */}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void handlePinjam()}
                  disabled={!tersedia || memproses}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-xs font-bold text-white shadow-md shadow-teal-900/10 transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:text-sm"
                >
                  <span aria-hidden="true">▣</span>
                  {memproses
                    ? "Memproses Peminjaman..."
                    : tersedia
                      ? "Pinjam Sekarang"
                      : "Buku Tidak Tersedia"}
                </button>

                {detail.sampelBabUrl || detail.fileSampel ? (
                  <a
                    href={detail.sampelBabUrl || detail.fileSampel}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 transition hover:border-teal-700 hover:text-teal-800 sm:text-sm"
                  >
                    Baca Sampel Bab
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Sampel bab belum tersedia"
                    className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-400 sm:text-sm"
                  >
                    Sampel Belum Tersedia
                  </button>
                )}

                <Link
                  href="/katalog"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:border-teal-700 hover:text-teal-800 sm:text-sm"
                >
                  ← Kembali
                </Link>
              </div>

              <p className="mt-3 text-[11px] leading-5 text-slate-400">
                Lama peminjaman mengikuti kebijakan perpustakaan yang berlaku.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
