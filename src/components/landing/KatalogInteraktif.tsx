"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useLibrary, useHelper } from "@/lib/library-context";
import { useAuth, useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { KATEGORI_LIST, type Buku } from "@/lib/types";

import { Modal, SampulBuku, tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";

function tanggalLokal(): string {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

function formatAngka(nilai: number): string {
  return new Intl.NumberFormat("id-ID").format(nilai);
}

export default function KatalogInteraktif() {
  const { buku, muatKatalogPublik, pinjamBuku } = useLibrary();

  const { stokTersedia } = useHelper();
  const { sedangMasuk, siap: authSiap } = useAuth();
  const sistem = useSistem();
  const toast = useToast();

  const bolehPinjam = useBoleh("katalog.pinjam");
  const anggotaId = sedangMasuk?.anggotaId;

  const [memuat, setMemuat] = useState(true);
  const [kataKunci, setKataKunci] = useState("");
  const [kategori, setKategori] = useState("Semua");
  const [filterStok, setFilterStok] = useState("Semua");

  const [targetPinjam, setTargetPinjam] = useState<Buku | null>(null);
  const [tanggalPinjam, setTanggalPinjam] = useState(tanggalLokal());
  const [sedangMengajukan, setSedangMengajukan] = useState(false);

  useEffect(() => {
    let aktif = true;

    void muatKatalogPublik().finally(() => {
      if (aktif) setMemuat(false);
    });

    return () => {
      aktif = false;
    };
  }, [muatKatalogPublik]);

  const hasil = useMemo(() => {
    const q = kataKunci.trim().toLocaleLowerCase("id-ID");

    return buku.filter((item) => {
      const cocokKata =
        !q ||
        [item.judul, item.penulis, item.isbn, item.penerbit].some((nilai) =>
          String(nilai ?? "")
            .toLocaleLowerCase("id-ID")
            .includes(q),
        );

      const cocokKategori = kategori === "Semua" || item.kategori === kategori;

      const stok = stokTersedia(item.id);

      const cocokStok =
        filterStok === "Semua" ||
        (filterStok === "Tersedia" && stok > 0) ||
        (filterStok === "Habis" && stok <= 0);

      return cocokKata && cocokKategori && cocokStok;
    });
  }, [buku, kataKunci, kategori, filterStok, stokTersedia]);

  const jumlahTersedia = useMemo(
    () => buku.filter((item) => stokTersedia(item.id) > 0).length,
    [buku, stokTersedia],
  );

  const jatuhTempo = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalPinjam)) return "";

    const tanggal = new Date(`${tanggalPinjam}T00:00:00`);
    tanggal.setDate(tanggal.getDate() + sistem.lamaPinjam);

    const tahun = tanggal.getFullYear();
    const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
    const hari = String(tanggal.getDate()).padStart(2, "0");

    return `${tahun}-${bulan}-${hari}`;
  }, [tanggalPinjam, sistem.lamaPinjam]);

  function resetFilter() {
    setKataKunci("");
    setKategori("Semua");
    setFilterStok("Semua");
  }

  async function ajukanPeminjaman() {
    if (!targetPinjam || !anggotaId || sedangMengajukan) return;

    setSedangMengajukan(true);

    try {
      const hasilPinjam = await pinjamBuku(
        targetPinjam.id,
        anggotaId,
        tanggalPinjam,
      );

      if (hasilPinjam.ok) {
        toast.sukses(hasilPinjam.pesan);
        setTargetPinjam(null);
        setTanggalPinjam(tanggalLokal());
      } else {
        toast.gagal(hasilPinjam.pesan);
      }
    } finally {
      setSedangMengajukan(false);
    }
  }

  return (
    <section id="koleksi" className="relative bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-teal-800">
              <span className="h-2 w-2 rounded-full bg-teal-600" />
              Jelajahi koleksi
            </span>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Temukan buku favoritmu
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Cari koleksi perpustakaan, lihat ketersediaan buku, dan ajukan
              peminjaman langsung melalui PustakaKu.
            </p>
          </div>

          <Link
            href="/katalog"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-teal-800 px-5 py-3 text-sm font-semibold text-teal-900 transition hover:bg-teal-800 hover:text-white md:self-auto"
          >
            Lihat katalog lengkap
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Statistik katalog */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total judul</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatAngka(buku.length)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Judul tersedia</p>
            <p className="mt-1 text-2xl font-bold text-teal-800">
              {formatAngka(jumlahTersedia)}
            </p>
          </div>

          <div className="col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:col-span-1">
            <p className="text-xs text-slate-500">Judul stok habis</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">
              {formatAngka(Math.max(0, buku.length - jumlahTersedia))}
            </p>
          </div>
        </div>

        {/* Pencarian dan filter */}
        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_190px]">
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-4 transition focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/10">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>

              <input
                type="search"
                value={kataKunci}
                onChange={(e) => setKataKunci(e.target.value)}
                placeholder="Cari judul, penulis, ISBN, penerbit..."
                aria-label="Cari koleksi buku"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>

            <select
              value={filterStok}
              onChange={(e) => setFilterStok(e.target.value)}
              aria-label="Filter ketersediaan stok"
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="Semua">Semua ketersediaan</option>
              <option value="Tersedia">Buku tersedia</option>
              <option value="Habis">Stok habis</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold text-slate-500">
              Kategori:
            </span>

            {["Semua", ...KATEGORI_LIST].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKategori(item)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  kategori === item
                    ? "bg-teal-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-800"
                }`}
              >
                {item}
              </button>
            ))}

            <button
              type="button"
              onClick={resetFilter}
              className="ml-auto text-xs font-semibold text-teal-800 hover:underline"
            >
              Reset filter
            </button>
          </div>
        </div>

        {/* Hasil katalog */}
        <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Koleksi buku</h3>
            <p className="mt-1 text-sm text-slate-500">
              Menampilkan {formatAngka(hasil.length)} dari{" "}
              {formatAngka(buku.length)} judul
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Data katalog
          </span>
        </div>

        {memuat ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-100">
            <div className="text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
              <p className="mt-3 text-sm text-slate-500">
                Memuat koleksi buku...
              </p>
            </div>
          </div>
        ) : hasil.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-14 text-center">
            <div className="text-3xl">📚</div>
            <h3 className="mt-3 font-bold text-slate-900">
              Buku tidak ditemukan
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Coba kata kunci atau filter yang berbeda.
            </p>
            <button
              type="button"
              onClick={resetFilter}
              className="mt-4 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
            >
              Tampilkan semua buku
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hasil.map((item) => {
              const stok = stokTersedia(item.id);
              const tersedia = stok > 0;

              return (
                <article
                  key={item.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl sm:p-5"
                >
                  <div className="flex gap-4">
                    <div className="h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-teal-50 shadow-sm">
                      <SampulBuku
                        buku={item}
                        className="h-full w-full"
                        rounded=""
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="w-fit max-w-full truncate rounded-md bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                        {item.kategori || "Umum"}
                      </span>

                      <h4
                        className="mt-2 line-clamp-2 text-base font-bold leading-snug text-slate-900 transition group-hover:text-teal-800"
                        title={item.judul}
                      >
                        {item.judul}
                      </h4>

                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {item.penulis || "Penulis tidak diketahui"}
                      </p>

                      <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                        {item.penerbit || "Penerbit tidak diketahui"}
                        {item.tahun ? ` · ${item.tahun}` : ""}
                      </p>

                      <div
                        className={`mt-auto flex items-center gap-2 pt-3 text-xs font-semibold ${
                          tersedia ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            tersedia ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        {tersedia
                          ? `${formatAngka(stok)} tersedia`
                          : "Stok habis"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <Link
                      href={`/katalog/${item.id}`}
                      className="text-sm font-semibold text-teal-800 transition hover:text-teal-950 hover:underline"
                    >
                      Detail buku →
                    </Link>

                    {sedangMasuk && anggotaId && bolehPinjam && (
                      <button
                        type="button"
                        disabled={!tersedia}
                        onClick={() => {
                          setTanggalPinjam(tanggalLokal());
                          setTargetPinjam(item);
                        }}
                        className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        {tersedia ? "Pinjam buku" : "Stok habis"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Ajakan untuk pengunjung */}
        {authSiap && !sedangMasuk && (
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h3 className="font-bold text-slate-900">Ingin meminjam buku?</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Masuk atau daftar sebagai anggota untuk mengajukan peminjaman
                koleksi perpustakaan.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Daftar
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Modal peminjaman */}
      <Modal
        open={!!targetPinjam}
        onClose={() => {
          if (!sedangMengajukan) setTargetPinjam(null);
        }}
        title="Ajukan Peminjaman"
        width="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Buku yang dipilih
            </p>
            <p className="mt-1 font-bold text-slate-900">
              {targetPinjam?.judul}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {targetPinjam?.penulis || "Penulis tidak diketahui"}
            </p>
          </div>

          <p className="leading-6 text-slate-600">
            Lama peminjaman adalah{" "}
            <strong className="text-slate-900">{sistem.lamaPinjam} hari</strong>
            .
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Tanggal peminjaman
            </label>
            <input
              type="date"
              value={tanggalPinjam}
              min={tanggalLokal()}
              onChange={(e) => setTanggalPinjam(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-teal-600"
            />
          </div>

          {jatuhTempo && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Tanggal jatuh tempo</p>
              <p className="mt-1 font-semibold text-slate-900">
                {tanggalPanjang(jatuhTempo)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={sedangMengajukan}
              onClick={() => setTargetPinjam(null)}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={
                sedangMengajukan ||
                !tanggalPinjam ||
                tanggalPinjam < tanggalLokal()
              }
              onClick={() => void ajukanPeminjaman()}
              className="rounded-xl bg-teal-800 px-4 py-2.5 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sedangMengajukan ? "Mengajukan..." : "Ajukan pinjaman"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
