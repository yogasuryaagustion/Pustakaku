"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLibrary, useHelper } from "@/lib/library-context";
import { useAuth, useBoleh } from "@/lib/auth";
import type { Buku } from "@/lib/types";

const BATAS_BUKU = 10;

const KATEGORI_UTAMA = [
  "Semua",
  "Fiksi Populer",
  "Sains & Teknologi",
  "Pengembangan Diri",
  "Bisnis & Finansial",
];

function tanggalHariIni() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${tanggal}`;
}

function CoverBuku({ buku }: { buku: Buku }) {
  const [gambarGagal, setGambarGagal] = useState(false);

  // Sampul pengganti memakai keluarga hijau gelap saja; variasi didapat dari
  // tingkat gelap dan paduan teal–emerald, bukan warna asing di luar palet.
  const warna = [
    "from-teal-600 to-emerald-800",
    "from-slate-800 to-teal-950",
    "from-teal-700 to-slate-900",
    "from-emerald-700 to-slate-900",
    "from-slate-700 to-emerald-950",
    "from-teal-800 to-slate-900",
  ];

  const indeksWarna =
    buku.judul
      .split("")
      .reduce((total, huruf) => total + huruf.charCodeAt(0), 0) % warna.length;

  return (
    <div
      className={`relative flex aspect-[3/3.3] w-full flex-col justify-end overflow-hidden rounded-lg bg-gradient-to-br ${warna[indeksWarna]} p-3 shadow-inner`}
    >
      {buku.gambar && !gambarGagal ? (
        <img
          src={buku.gambar}
          alt={`Sampul ${buku.judul}`}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={() => setGambarGagal(true)}
        />
      ) : (
        <>
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" />
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full border border-white/10" />

          <span className="absolute right-3 top-3 text-lg text-white/80">
            ✦
          </span>

          <div className="relative z-10">
            <p className="line-clamp-3 text-sm font-extrabold uppercase leading-tight tracking-tight text-white sm:text-base">
              {buku.judul}
            </p>

            <p className="mt-1.5 line-clamp-1 text-[10px] font-medium text-white/80">
              {buku.penulis}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function labelKategori(kategori: string) {
  const kata = (kategori || "").toLowerCase();

  if (kata.includes("fiksi") || kata.includes("novel")) {
    return "Fiksi Populer";
  }

  if (
    kata.includes("sains") ||
    kata.includes("teknologi") ||
    kata.includes("komputer")
  ) {
    return "Sains & Teknologi";
  }

  if (
    kata.includes("pengembangan") ||
    kata.includes("motivasi") ||
    kata.includes("psikologi")
  ) {
    return "Pengembangan Diri";
  }

  if (
    kata.includes("bisnis") ||
    kata.includes("ekonomi") ||
    kata.includes("keuangan")
  ) {
    return "Bisnis & Finansial";
  }

  return kategori;
}

export default function KoleksiPopuler() {
  const { buku, pinjamBuku, muatKatalogPublik } = useLibrary();
  const { stokTersedia } = useHelper();

  const { sedangMasuk, siap: authSiap } = useAuth();
  const bolehPinjam = useBoleh("katalog.pinjam");

  const [kategoriAktif, setKategoriAktif] = useState("Semua");
  const [sedangPinjam, setSedangPinjam] = useState<string | null>(null);
  const [pesan, setPesan] = useState("");
  const [jenisPesan, setJenisPesan] = useState<"sukses" | "gagal" | "info">(
    "info",
  );

  // Muat data buku dari API.
  useEffect(() => {
    void muatKatalogPublik();
  }, [muatKatalogPublik]);

  // Hanya tampilkan buku aktif.
  const daftarBuku = useMemo(() => buku, [buku]);

  // Ambil kategori yang benar-benar tersedia.
  const kategoriTersedia = useMemo(() => {
    const kategoriData = daftarBuku
      .map((item) => labelKategori(item.kategori))
      .filter(Boolean);

    return KATEGORI_UTAMA.filter(
      (kategori) => kategori === "Semua" || kategoriData.includes(kategori),
    );
  }, [daftarBuku]);

  // Filter buku berdasarkan kategori.
  const bukuTampil = useMemo(() => {
    const hasil = daftarBuku.filter((item) => {
      if (kategoriAktif === "Semua") return true;

      return labelKategori(item.kategori) === kategoriAktif;
    });

    return hasil.slice(0, BATAS_BUKU);
  }, [daftarBuku, kategoriAktif]);

  // Proses peminjaman menggunakan fungsi yang sudah tersedia.
  async function handlePinjam(item: Buku) {
    setPesan("");

    if (!authSiap) {
      setJenisPesan("info");
      setPesan("Sedang memeriksa akun. Silakan tunggu sebentar.");
      return;
    }

    if (!sedangMasuk) {
      window.location.href = `/login?redirect=${encodeURIComponent("/")}`;
      return;
    }

    if (!bolehPinjam) {
      setJenisPesan("gagal");
      setPesan("Akun kamu belum memiliki izin untuk meminjam buku.");
      return;
    }

    const anggotaId = sedangMasuk.anggotaId;

    if (!anggotaId) {
      setJenisPesan("gagal");
      setPesan("Data anggota belum terhubung dengan akun kamu.");
      return;
    }

    const stok = stokTersedia(item.id);

    if (stok <= 0) {
      setJenisPesan("gagal");
      setPesan("Maaf, buku ini sedang tidak tersedia.");
      return;
    }

    try {
      setSedangPinjam(item.id);

      const hasil = await pinjamBuku(item.id, anggotaId, tanggalHariIni());

      setJenisPesan(hasil.ok ? "sukses" : "gagal");
      setPesan(hasil.pesan);
    } catch {
      setJenisPesan("gagal");
      setPesan("Terjadi kesalahan saat memproses peminjaman.");
    } finally {
      setSedangPinjam(null);
    }
  }

  return (
    <section id="koleksi" className="bg-[#f7faf9] py-14 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
        {/* Header */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 sm:text-xs">
              <span>♧</span>
              Katalog Terlengkap
            </span>

            <h2 className="judul-editorial mt-3 text-2xl tracking-tight text-slate-900 sm:text-3xl">
              Koleksi Buku Terpopuler
            </h2>

            <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
              Pilihan judul terbaik dari pengarang nasional dan internasional,
              siap dibaca langsung tanpa antrean fisik.
            </p>
          </div>

          {/* Filter kategori */}
          <div className="flex flex-wrap gap-2">
            {kategoriTersedia.map((kategori) => (
              <button
                key={kategori}
                type="button"
                onClick={() => setKategoriAktif(kategori)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition sm:px-4 sm:py-2 sm:text-xs ${
                  kategoriAktif === kategori
                    ? "border-teal-800 bg-teal-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-teal-600 hover:text-teal-700"
                }`}
              >
                {kategori}
              </button>
            ))}
          </div>
        </div>

        {/* Notifikasi */}
        {pesan && (
          <div
            role="status"
            className={`mt-5 rounded-lg border px-3 py-2.5 text-xs sm:text-sm ${
              jenisPesan === "sukses"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : jenisPesan === "gagal"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-teal-200 bg-teal-50 text-teal-700"
            }`}
          >
            {pesan}
          </div>
        )}

        {/* Daftar buku */}
        {bukuTampil.length > 0 ? (
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {bukuTampil.map((item, index) => {
              const stok = stokTersedia(item.id);
              const tersedia = stok > 0;
              const sedangDiproses = sedangPinjam === item.id;

              const label =
                index === 0
                  ? "TRENDING"
                  : index === 1
                    ? "KOLEKSI PILIHAN"
                    : index === 2
                      ? "FAVORIT PEMBACA"
                      : "REKOMENDASI";

              return (
                <article
                  key={item.id}
                  className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  {/* Cover */}
                  <Link
                    href={`/katalog/${item.id}`}
                    className="relative block overflow-hidden rounded-lg"
                  >
                    <CoverBuku buku={item} />

                    <span className="absolute left-2 top-2 rounded-full bg-slate-950/65 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-white backdrop-blur sm:text-[9px]">
                      {label}
                    </span>
                  </Link>

                  {/* Informasi buku */}
                  <div className="flex flex-1 flex-col pt-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="min-w-0 truncate text-[9px] font-medium text-teal-700 sm:text-[10px]">
                        {item.kategori}
                      </span>

                      <span
                        className={`shrink-0 rounded-full px-1.5 py-1 text-[8px] font-semibold sm:text-[9px] ${
                          tersedia
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tersedia ? "Tersedia" : "Dipinjam"}
                      </span>
                    </div>

                    <Link
                      href={`/katalog/${item.id}`}
                      className="mt-1.5 line-clamp-2 text-xs font-bold leading-4 text-slate-900 transition hover:text-teal-700 sm:text-sm sm:leading-5"
                    >
                      {item.judul}
                    </Link>

                    <p className="mt-1 line-clamp-1 text-[10px] text-slate-500 sm:text-xs">
                      {item.penulis}
                    </p>

                    <p className="mt-1.5 line-clamp-2 min-h-8 text-[10px] leading-4 text-slate-400">
                      {item.deskripsi ||
                        "Lihat detail buku untuk informasi lebih lanjut."}
                    </p>

                    {/* Stok */}
                    <div className="mt-2 flex items-center justify-between gap-1 border-t border-slate-100 pt-2">
                      <span className="text-[9px] text-slate-500 sm:text-[10px]">
                        Stok tersedia
                      </span>

                      <span className="text-[10px] font-bold text-slate-700 sm:text-xs">
                        {stok} buku
                      </span>
                    </div>

                    {/* Tombol aksi */}
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        disabled={!tersedia || sedangDiproses}
                        onClick={() => void handlePinjam(item)}
                        className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[9px] font-bold transition sm:text-[10px] ${
                          tersedia
                            ? "bg-teal-800 text-white hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60"
                            : "cursor-not-allowed bg-slate-200 text-slate-400"
                        }`}
                      >
                        {sedangDiproses
                          ? "Memproses..."
                          : tersedia
                            ? "▣ Pinjam"
                            : "Penuh"}
                      </button>

                      <Link
                        href={`/katalog/${item.id}`}
                        aria-label={`Lihat detail ${item.judul}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-sm text-slate-500 transition hover:border-teal-600 hover:text-teal-700"
                      >
                        ↗
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="text-3xl">📚</div>

            <h3 className="mt-3 text-sm font-bold text-slate-800">
              Belum ada koleksi buku
            </h3>

            <p className="mt-2 text-xs text-slate-500">
              Buku yang tersedia akan ditampilkan di bagian ini.
            </p>
          </div>
        )}

        {/* Footer katalog */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/katalog"
            className="inline-flex items-center gap-2 rounded-lg border border-teal-800 px-5 py-2.5 text-xs font-bold text-teal-800 transition hover:bg-teal-800 hover:text-white sm:text-sm"
          >
            Lihat Semua Buku
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
