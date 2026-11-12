"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { useLibrary, useHelper } from "@/lib/library-context";
import { useAuth, useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { KATEGORI_LIST, type Buku, type Kategori } from "@/lib/types";
import { apiFetch } from "@/lib/api";

import {
  Modal,
  ConfirmDialog,
  EmptyState,
  SampulBuku,
  tanggalPanjang,
} from "@/components/ui";
import { KepalaHalaman } from "@/components/kepala-halaman";

import { useToast } from "@/components/toast";

const KOSONG_FORM = {
  judul: "",
  penulis: "",
  penerbit: "",
  tahun: new Date().getFullYear().toString(),
  isbn: "",
  kategori: "Fiksi" as Kategori,
  rak: "",
  stok: "1",
  deskripsi: "",
  harga: "",
  gambar: "",
};

type HasilPencarianBuku = {
  googleBooksId: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: string;
  isbn: string;
  deskripsi: string;
  bahasa: string;
  kategori: string;
  sampul: string;
  sumber: string;
};

type ResponsPencarianBuku = {
  sukses: boolean;
  total: number;
  pesan: string;
  sumber: string[];
  buku: HasilPencarianBuku[];
};

/** Baris daftar arsip — buku yang dihapus tapi masih punya riwayat pinjaman. */
type BukuArsip = {
  id: string;
  judul: string;
  penulis: string;
  kategori: string;
  rak: string;
  stok: number;
  dihapusPada: string | null;
};

const IKON = {
  cari: "m21 21-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
  buku: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  tambah: "M12 5v14M5 12h14",
  cek: "m5 12 4 4L19 6",
  panah: "m9 18 6-6-6-6",
  edit: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z",
  hapus: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5",
  bukuTerbuka:
    "M12 7v14 M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4 4 4 0 0 1 4-4h3a2 2 0 0 1 2 2v13 M3 18h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5",
  arsip: "M3 7h18v3H3z M5 10v10h14V10 M9 14h6",
};

function Ikon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function angka(nilai: number) {
  return new Intl.NumberFormat("id-ID").format(nilai);
}

function KatalogKonten() {
  const { buku, siap, tambahBuku, ubahBuku, hapusBuku, pinjamBuku, muatUlang } =
    useLibrary();

  const { stokTersedia } = useHelper();
  const { sedangMasuk } = useAuth();
  const sistem = useSistem();
  const toast = useToast();
  const params = useSearchParams();

  const bolehKelolaBuku = useBoleh("katalog.kelola");
  const bolehPinjam = useBoleh("katalog.pinjam");
  const bolehDaftar = useBoleh("akun.daftar");

  const anggotaIdUser = sedangMasuk?.anggotaId;

  const [q, setQ] = useState(() => params.get("q") ?? "");

  const [filterKategori, setFilterKategori] = useState<string>(() => {
    const kategori = params.get("kategori");

    return kategori && KATEGORI_LIST.includes(kategori as Kategori)
      ? kategori
      : "Semua";
  });

  const [filterStok, setFilterStok] = useState<"Semua" | "Tersedia" | "Habis">(
    "Semua",
  );

  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...KOSONG_FORM });

  // Pencarian metadata buku dari Google Books dan Open Library.
  const [kataKunciBuku, setKataKunciBuku] = useState("");
  const [hasilPencarianBuku, setHasilPencarianBuku] = useState<
    HasilPencarianBuku[]
  >([]);
  const [sedangMencariBuku, setSedangMencariBuku] = useState(false);
  const [pesanPencarianBuku, setPesanPencarianBuku] = useState("");

  const [detailTarget, setDetailTarget] = useState<Buku | null>(null);

  const [hapusTarget, setHapusTarget] = useState<Buku | null>(null);
  const [pinjamTarget, setPinjamTarget] = useState<Buku | null>(null);

  // Arsip: buku yang dihapus namun riwayatnya dipertahankan. Daftarnya dibaca
  // saat modal dibuka agar katalog tidak menambah satu request di setiap muat.
  const [bukaArsip, setBukaArsip] = useState(false);
  const [arsip, setArsip] = useState<BukuArsip[]>([]);
  const [memuatArsip, setMemuatArsip] = useState(false);
  const [memulihkan, setMemulihkan] = useState<string | null>(null);

  const [tanggalPinjam, setTanggalPinjam] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const daftarKategori = useMemo(() => {
    return ["Semua", ...KATEGORI_LIST];
  }, []);

  const hasil = useMemo(() => {
    const kata = q.trim().toLocaleLowerCase("id-ID");

    return buku.filter((item) => {
      const cocokKata =
        !kata ||
        [item.judul, item.penulis, item.isbn, item.penerbit].some((nilai) =>
          String(nilai ?? "")
            .toLocaleLowerCase("id-ID")
            .includes(kata),
        );

      const cocokKategori =
        filterKategori === "Semua" || item.kategori === filterKategori;

      const stok = stokTersedia(item.id);

      const cocokStok =
        filterStok === "Semua" ||
        (filterStok === "Tersedia" && stok > 0) ||
        (filterStok === "Habis" && stok <= 0);

      return cocokKata && cocokKategori && cocokStok;
    });
  }, [buku, q, filterKategori, filterStok, stokTersedia]);

  const jatuhTempo = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalPinjam)) {
      return "";
    }

    const tanggal = new Date(`${tanggalPinjam}T00:00:00`);
    tanggal.setDate(tanggal.getDate() + sistem.lamaPinjam);

    return tanggal.toISOString().slice(0, 10);
  }, [tanggalPinjam, sistem.lamaPinjam]);

  function resetFilter() {
    setQ("");
    setFilterKategori("Semua");
    setFilterStok("Semua");
  }

  function bukaTambah() {
    setEditId(null);
    setForm({ ...KOSONG_FORM });
    setKataKunciBuku("");
    setHasilPencarianBuku([]);
    setPesanPencarianBuku("");
    setOpenForm(true);
  }

  async function cariDataBuku() {
    const kataKunci = kataKunciBuku.trim();

    if (!kataKunci) {
      setPesanPencarianBuku(
        "Masukkan judul buku, ISBN, atau kata kunci terlebih dahulu.",
      );
      setHasilPencarianBuku([]);
      return;
    }

    setSedangMencariBuku(true);
    setPesanPencarianBuku("");
    setHasilPencarianBuku([]);

    try {
      const response = await fetch(
        `/api/buku/search?q=${encodeURIComponent(kataKunci)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );

      const hasil = (await response.json()) as ResponsPencarianBuku;

      if (!response.ok || !hasil.sukses) {
        throw new Error(hasil.pesan || "Pencarian data buku gagal.");
      }

      setHasilPencarianBuku(Array.isArray(hasil.buku) ? hasil.buku : []);
      setPesanPencarianBuku(
        hasil.buku?.length
          ? `Ditemukan ${hasil.buku.length} data buku. Pilih data yang sesuai.`
          : hasil.pesan || "Buku tidak ditemukan. Coba judul atau ISBN lain.",
      );
    } catch (error) {
      setPesanPencarianBuku(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mencari data buku.",
      );
    } finally {
      setSedangMencariBuku(false);
    }
  }

  function gunakanDataBuku(item: HasilPencarianBuku) {
    const kategoriCocok = KATEGORI_LIST.find(
      (kategori) =>
        kategori.toLocaleLowerCase("id-ID") ===
        (item.kategori || "").toLocaleLowerCase("id-ID"),
    );

    setForm((sebelumnya) => ({
      ...sebelumnya,
      judul: item.judul || sebelumnya.judul,
      penulis: item.penulis || sebelumnya.penulis,
      penerbit: item.penerbit || sebelumnya.penerbit,
      tahun: item.tahun || sebelumnya.tahun,
      isbn: item.isbn || sebelumnya.isbn,
      deskripsi: item.deskripsi || sebelumnya.deskripsi,
      gambar: item.sampul || sebelumnya.gambar,
      // Kategori, rak, dan stok tetap bisa ditentukan pengelola.
      kategori: kategoriCocok || sebelumnya.kategori,
    }));

    setPesanPencarianBuku(
      `Data "${item.judul}" sudah dimasukkan ke formulir. Periksa kembali sebelum menyimpan.`,
    );
  }

  async function muatArsip() {
    setMemuatArsip(true);
    try {
      const hasil = await apiFetch<{ buku: BukuArsip[] }>("/api/buku/arsip");
      setArsip(hasil.buku ?? []);
    } catch (error) {
      toast.gagal(
        error instanceof Error ? error.message : "Gagal memuat buku diarsipkan.",
      );
    } finally {
      setMemuatArsip(false);
    }
  }

  async function pulihkanBuku(item: BukuArsip) {
    setMemulihkan(item.id);
    try {
      await apiFetch(`/api/buku/${item.id}/pulihkan`, { method: "POST" });
      toast.sukses(`Buku "${item.judul}" dikembalikan ke katalog.`);
      setArsip((sebelumnya) => sebelumnya.filter((b) => b.id !== item.id));
      // Katalog memuat ulang agar buku hasil pemulihan langsung tampil.
      muatUlang(["buku"]);
    } catch (error) {
      toast.gagal(
        error instanceof Error ? error.message : "Buku gagal dipulihkan.",
      );
    } finally {
      setMemulihkan(null);
    }
  }

  function bukaEdit(item: Buku) {
    setEditId(item.id);

    setKataKunciBuku("");
    setHasilPencarianBuku([]);
    setPesanPencarianBuku("");

    setForm({
      judul: item.judul,
      penulis: item.penulis,
      penerbit: item.penerbit,
      tahun: String(item.tahun),
      isbn: item.isbn,
      kategori: item.kategori,
      rak: item.rak,
      stok: String(item.stok),
      deskripsi: item.deskripsi,
      harga: item.harga ? String(item.harga) : "",
      gambar: item.gambar ?? "",
    });

    setOpenForm(true);
  }

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = {
      judul: form.judul.trim(),
      penulis: form.penulis.trim(),
      penerbit: form.penerbit.trim(),
      tahun: Number(form.tahun) || new Date().getFullYear(),
      isbn: form.isbn.trim(),
      kategori: form.kategori,
      rak: form.rak.trim(),
      stok: Math.max(0, Number(form.stok) || 0),
      deskripsi: form.deskripsi.trim(),
      harga: Math.max(0, Number(form.harga) || 0),
      gambar: form.gambar.trim() || null,
    };

    if (!data.judul) {
      toast.gagal("Judul buku wajib diisi.");
      return;
    }

    const hasilSimpan = editId
      ? await ubahBuku(editId, data)
      : await tambahBuku(data);

    if (!hasilSimpan.ok) {
      toast.gagal(hasilSimpan.pesan);
      return;
    }

    toast.sukses(
      editId
        ? `Buku "${data.judul}" berhasil diperbarui.`
        : `Buku "${data.judul}" berhasil ditambahkan.`,
    );

    setOpenForm(false);
  }

  async function konfirmasiPinjam() {
    if (!pinjamTarget || !anggotaIdUser) return;

    const hasilPinjam = await pinjamBuku(
      pinjamTarget.id,
      anggotaIdUser,
      tanggalPinjam,
    );

    if (hasilPinjam.ok) {
      toast.sukses(hasilPinjam.pesan);
    } else {
      toast.gagal(hasilPinjam.pesan);
    }

    setPinjamTarget(null);
    setTanggalPinjam(new Date().toISOString().slice(0, 10));
  }

  if (!siap) {
    return (
      <div className="grid min-h-64 place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />
          <p className="text-sm text-[var(--muted)]">Memuat katalog buku...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 pb-8">
      {/* HEADER KONTEN — judul sudah tampil di header AppShell. */}
      <KepalaHalaman
        remah={
          <span className="inline-flex items-center gap-1.5 text-[var(--brand-ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
            Koleksi perpustakaan
          </span>
        }
        deskripsi="Kelola dan jelajahi koleksi buku fisik maupun e-book yang terdaftar dalam inventaris perpustakaan."
        aksi={
          bolehKelolaBuku &&
          sedangMasuk && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBukaArsip(true);
                  void muatArsip();
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-[var(--brand-ink)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)]"
              >
                <Ikon d={IKON.arsip} size={18} />
                Buku Diarsipkan
              </button>
              <button
                type="button"
                onClick={bukaTambah}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand-solid)] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:-translate-y-0.5 hover:bg-[var(--brand-solid-hover)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)]"
              >
                <Ikon d={IKON.tambah} size={18} />
                Tambah Judul Baru
              </button>
            </div>
          )
        }
      />

      {/* STATISTIK RINGKAS */}

      {/* PENCARIAN DAN FILTER */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 transition focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/10">
            <span className="shrink-0 text-slate-400">
              <Ikon d={IKON.cari} size={19} />
            </span>

            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul buku, penulis, ISBN, atau penerbit..."
              aria-label="Cari buku"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400"
            />

            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Hapus pencarian"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </label>

          <label className="relative shrink-0">
            <span className="sr-only">Filter stok</span>
            <select
              value={filterStok}
              onChange={(e) =>
                setFilterStok(e.target.value as "Semua" | "Tersedia" | "Habis")
              }
              className="min-h-12 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 pr-10 text-sm outline-none transition focus:border-teal-600 sm:w-40"
            >
              <option value="Semua">Semua stok</option>
              <option value="Tersedia">Tersedia</option>
              <option value="Habis">Stok habis</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              ▼
            </span>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-[var(--muted)]">
              Kategori
            </span>

            {daftarKategori.map((kategori) => {
              const aktif = filterKategori === kategori;

              return (
                <button
                  key={kategori}
                  type="button"
                  onClick={() => setFilterKategori(kategori)}
                  className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                    aktif
                      ? "bg-teal-800 text-white shadow-sm"
                      : "border border-transparent bg-slate-100 text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                  }`}
                >
                  {kategori}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={resetFilter}
            className="shrink-0 self-start text-xs font-semibold text-teal-800 transition hover:text-teal-950 hover:underline sm:self-center"
          >
            Reset filter
          </button>
        </div>
      </section>

      {/* JUDUL HASIL */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
              Koleksi Perpustakaan
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Menampilkan{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {angka(hasil.length)}
              </span>{" "}
              dari {angka(buku.length)} judul buku
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Katalog aktif
          </div>
        </div>

        {/* KARTU KOLEKSI */}
        {hasil.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-5 py-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-800">
              <Ikon d={IKON.cari} size={26} />
            </div>

            <h3 className="mt-4 text-base font-bold">Buku tidak ditemukan</h3>

            <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[var(--muted)]">
              Tidak ada koleksi yang cocok dengan pencarian atau filter yang
              dipilih. Coba kata kunci atau kategori lainnya.
            </p>

            <button
              type="button"
              onClick={resetFilter}
              className="mt-4 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              Tampilkan Semua Buku
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {hasil.map((item) => {
              const stok = Math.max(0, Number(stokTersedia(item.id)) || 0);
              const tersedia = stok > 0;

              return (
                <article
                  key={item.id}
                  className="group flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_2px_5px_rgba(15,23,42,0.025)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:p-5"
                >
                  {/* INFORMASI UTAMA BUKU */}
                  <div className="flex min-w-0 gap-4">
                    <div className="relative w-[70px] shrink-0 self-start sm:w-[78px]">
                      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-emerald-50 shadow-sm ring-1 ring-black/5">
                        <SampulBuku
                          buku={item}
                          className="h-full w-full"
                          rounded=""
                        />
                      </div>

                      <div className="absolute bottom-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-md bg-black/30 text-white backdrop-blur-sm">
                        <Ikon d={IKON.bukuTerbuka} size={14} />
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="mb-2 flex min-w-0">
                        <span className="max-w-full truncate rounded-md bg-teal-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800 sm:text-[11px]">
                          {item.kategori || "Umum"}
                        </span>
                      </div>

                      <h3
                        className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-[var(--foreground)] transition group-hover:text-teal-800"
                        title={item.judul}
                      >
                        {item.judul}
                      </h3>

                      <p
                        className="mt-1.5 truncate text-sm text-[var(--muted)]"
                        title={item.penulis}
                      >
                        {item.penulis || "Penulis tidak diketahui"}
                      </p>

                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.penerbit
                          ? `${item.penerbit}${item.tahun ? ` · ${item.tahun}` : ""}`
                          : item.tahun || "Informasi penerbit belum tersedia"}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            tersedia ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              tersedia ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {tersedia ? "Tersedia langsung" : "Stok habis"}
                        </span>

                        <span className="text-xs text-[var(--muted)]">
                          · {angka(stok)} tersedia
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GARIS PEMISAH DAN AKSI */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          tersedia ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      {tersedia
                        ? `Total ${angka(item.stok)} eksemplar`
                        : "Tidak ada stok tersedia"}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailTarget(item)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 transition hover:text-teal-950"
                        aria-label={`Lihat detail buku ${item.judul}`}
                      >
                        Detail
                        <Ikon d={IKON.panah} size={14} />
                      </button>

                      {sedangMasuk && bolehKelolaBuku && (
                        <>
                          <button
                            type="button"
                            onClick={() => bukaEdit(item)}
                            title="Edit buku"
                            aria-label={`Edit ${item.judul}`}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-slate-500 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                          >
                            <Ikon d={IKON.edit} size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setHapusTarget(item)}
                            title="Hapus buku"
                            aria-label={`Hapus ${item.judul}`}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Ikon d={IKON.hapus} size={15} />
                          </button>
                        </>
                      )}

                      {sedangMasuk &&
                        !bolehKelolaBuku &&
                        anggotaIdUser &&
                        bolehPinjam && (
                          <button
                            type="button"
                            disabled={!tersedia}
                            onClick={() => {
                              setPinjamTarget(item);
                              setTanggalPinjam(
                                new Date().toISOString().slice(0, 10),
                              );
                            }}
                            className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {tersedia ? "Pinjam Buku" : "Stok Habis"}
                          </button>
                        )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* AJAKAN MASUK UNTUK PENGUNJUNG */}
      {!sedangMasuk && (
        <section className="flex flex-col gap-4 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-800 text-white">
              <Ikon d={IKON.bukuTerbuka} size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Ingin meminjam buku?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Masuk ke akun atau daftar sebagai anggota untuk mengajukan
                peminjaman koleksi perpustakaan.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-800"
            >
              Masuk
            </Link>

            {bolehDaftar && (
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900"
              >
                Daftar
              </Link>
            )}
          </div>
        </section>
      )}

      {/* FOOTER KATALOG */}
      <footer className="flex flex-col justify-between gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center">
        <p>Katalog PustakaKu · Data mengikuti koleksi perpustakaan.</p>

        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Katalog siap digunakan
        </p>
      </footer>

      {/* MODAL DETAIL BUKU */}
    {/* MODAL DETAIL BUKU */}
<Modal
  open={!!detailTarget}
  onClose={() => setDetailTarget(null)}
  title="Detail Buku"
  width="max-w-2xl"
>
  {detailTarget && (
    <div className="space-y-3">

      {/* INFORMASI UTAMA */}
      <div className="flex items-start gap-4">
        {/* SAMPUL */}
        <div className="w-24 shrink-0 sm:w-28">
          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            <SampulBuku
              buku={detailTarget}
              className="h-full w-full"
              rounded=""
            />
          </div>
        </div>

        {/* JUDUL DAN STATUS */}
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            {detailTarget.kategori || "Umum"}
          </span>

          <h2 className="mt-2 text-lg font-bold leading-snug text-[var(--foreground)]">
            {detailTarget.judul}
          </h2>

          <p className="mt-1 text-sm text-[var(--muted)]">
            Oleh {detailTarget.penulis || "Penulis tidak diketahui"}
          </p>

          <div className="mt-3">
            {stokTersedia(detailTarget.id) > 0 ? (
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Tersedia
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                Stok Habis
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-[var(--muted)]">
            {detailTarget.penerbit || "Penerbit tidak tersedia"}
            {detailTarget.tahun ? ` · ${detailTarget.tahun}` : ""}
          </p>
        </div>
      </div>

      {/* INFORMASI BUKU */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-3">
        <h3 className="mb-2 text-sm font-bold text-[var(--foreground)]">
          Informasi Buku
        </h3>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-xs text-[var(--muted)]">ISBN</p>
            <p className="mt-1 break-all text-sm font-medium text-[var(--foreground)]">
              {detailTarget.isbn || "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted)]">Tahun Terbit</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {detailTarget.tahun || "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted)]">Penerbit</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {detailTarget.penerbit || "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted)]">Lokasi Rak</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {detailTarget.rak || "-"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted)]">Kategori</p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {detailTarget.kategori || "Umum"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[var(--muted)]">Stok Tersedia</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">
              {angka(
                Math.max(0, Number(stokTersedia(detailTarget.id)) || 0)
              )} eksemplar
            </p>
          </div>
        </div>
      </div>

      {/* DESKRIPSI */}
      <div>
        <h3 className="mb-1 text-sm font-bold text-[var(--foreground)]">
          Deskripsi Buku
        </h3>

        <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">
          {detailTarget.deskripsi?.trim() ||
            "Belum ada deskripsi untuk buku ini."}
        </p>
      </div>

      {/* TOMBOL AKSI */}
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={() => setDetailTarget(null)}
          className="btn btn-ghost"
        >
          Tutup
        </button>

        {sedangMasuk &&
          !bolehKelolaBuku &&
          anggotaIdUser &&
          bolehPinjam && (
            <button
              type="button"
              disabled={stokTersedia(detailTarget.id) <= 0}
              onClick={() => {
                setPinjamTarget(detailTarget);
                setTanggalPinjam(
                  new Date().toISOString().slice(0, 10)
                );
                setDetailTarget(null);
              }}
              className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stokTersedia(detailTarget.id) > 0
                ? "Pinjam Buku"
                : "Stok Habis"}
            </button>
          )}
      </div>

    </div>
  )}
</Modal>

      {/* MODAL TAMBAH DAN EDIT BUKU */}
      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editId ? "Edit Buku" : "Tambah Judul Baru"}
        width="max-w-2xl"
      >
        <form
          onSubmit={simpan}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {!editId && (
            <details className="group rounded-xl border border-teal-100 bg-teal-50/60 p-3 sm:col-span-2 lg:col-span-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <h3 className="text-sm font-bold text-teal-950">
                    Cari Data Buku Otomatis
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-teal-800/80">
                    Cari berdasarkan judul atau ISBN. Data yang ditemukan dapat
                    digunakan untuk mengisi formulir, termasuk URL sampul.
                  </p>
                </div>

                <span className="shrink-0 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 group-open:hidden">
                  Buka
                </span>
                <span className="hidden shrink-0 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 group-open:inline">
                  Tutup
                </span>
              </summary>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="input min-w-0 flex-1 bg-white"
                  value={kataKunciBuku}
                  onChange={(e) => setKataKunciBuku(e.target.value)}
                  placeholder="Contoh: Hujan Tere Liye atau ISBN"
                  aria-label="Cari data buku dari sumber eksternal"
                />
                <button
                  type="button"
                  onClick={() => void cariDataBuku()}
                  disabled={sedangMencariBuku || !kataKunciBuku.trim()}
                  className="btn btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sedangMencariBuku ? "Mencari..." : "Cari Buku"}
                </button>
              </div>

              {pesanPencarianBuku && (
                <p
                  className="mt-3 text-xs leading-5 text-teal-900"
                  role="status"
                >
                  {pesanPencarianBuku}
                </p>
              )}

              {hasilPencarianBuku.length > 0 && (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {hasilPencarianBuku.map((item, index) => (
                    <article
                      key={`${item.googleBooksId || item.isbn || item.judul}-${index}`}
                      className="flex gap-3 rounded-xl border border-teal-100 bg-white p-3"
                    >
                      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {item.sampul ? (
                          // URL sampul berasal dari API pencarian eksternal.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.sampul}
                            alt={`Sampul ${item.judul}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-[10px] text-slate-400">
                            Tanpa sampul
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="line-clamp-2 text-sm font-bold text-slate-900">
                          {item.judul || "Judul tidak tersedia"}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600">
                          {item.penulis || "Penulis tidak diketahui"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[item.penerbit, item.tahun]
                            .filter(Boolean)
                            .join(" · ") || "Penerbit/tahun tidak tersedia"}
                        </p>
                        {item.isbn && (
                          <p className="mt-1 break-all text-[11px] text-slate-500">
                            ISBN: {item.isbn}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-semibold text-teal-800">
                            {item.sumber || "Sumber eksternal"}
                          </span>
                          <button
                            type="button"
                            onClick={() => gunakanDataBuku(item)}
                            className="rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-900"
                          >
                            Gunakan Buku Ini
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </details>
          )}

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">Judul Buku *</label>
            <input
              className="input"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Masukkan judul buku"
              required
            />
          </div>

          <div>
            <label className="label">Penulis</label>
            <input
              className="input"
              value={form.penulis}
              onChange={(e) => setForm({ ...form, penulis: e.target.value })}
              placeholder="Nama penulis"
            />
          </div>

          <div>
            <label className="label">Penerbit</label>
            <input
              className="input"
              value={form.penerbit}
              onChange={(e) => setForm({ ...form, penerbit: e.target.value })}
              placeholder="Nama penerbit"
            />
          </div>

          <div>
            <label className="label">Tahun Terbit</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.tahun}
              onChange={(e) => setForm({ ...form, tahun: e.target.value })}
            />
          </div>

          <div>
            <label className="label">ISBN</label>
            <input
              className="input"
              value={form.isbn}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              placeholder="Nomor ISBN"
            />
          </div>

          <div>
            <label className="label">Kategori</label>
            <select
              className="input"
              value={form.kategori}
              onChange={(e) =>
                setForm({
                  ...form,
                  kategori: e.target.value as Kategori,
                })
              }
            >
              {KATEGORI_LIST.map((kategori) => (
                <option key={kategori} value={kategori}>
                  {kategori}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Lokasi Rak</label>
            <input
              className="input"
              value={form.rak}
              onChange={(e) => setForm({ ...form, rak: e.target.value })}
              placeholder="Contoh: A-1"
            />
          </div>

          <div>
            <label className="label">Jumlah Stok</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.stok}
              onChange={(e) => setForm({ ...form, stok: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Harga Buku (Rp)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={form.harga}
              onChange={(e) => setForm({ ...form, harga: e.target.value })}
              placeholder="Kosongkan bila belum diketahui"
            />
            <p className="mt-1 text-xs text-slate-400">
              Dipakai sebagai denda penggantian bila salinan dinyatakan hilang
              saat pengembalian.
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label className="label">Deskripsi Buku</label>
            <textarea
              className="input"
              rows={2}
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Deskripsi singkat tentang buku"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label">URL Gambar Sampul</label>

            <div className="flex items-start gap-3">
              <SampulBuku
                buku={{
                  judul: form.judul || "Judul buku",
                  penulis: form.penulis,
                  gambar: form.gambar,
                }}
                className="h-20 w-[56px] shrink-0"
                tampilkanJudul={false}
              />

              <div className="min-w-0 flex-1">
                <input
                  className="input"
                  type="url"
                  value={form.gambar}
                  onChange={(e) => setForm({ ...form, gambar: e.target.value })}
                  placeholder="https://contoh.com/sampul.jpg"
                />

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Kosongkan untuk memakai sampul otomatis. Jika menggunakan URL,
                  pastikan gambar dapat diakses.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3 sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpenForm(false)}
            >
              Batal
            </button>

            <button type="submit" className="btn btn-primary">
              {editId ? "Simpan Perubahan" : "Tambah Buku"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL PEMINJAMAN */}
      <Modal
        open={!!pinjamTarget}
        onClose={() => setPinjamTarget(null)}
        title="Ajukan Peminjaman"
        width="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Buku yang dipilih
            </p>
            <p className="mt-1 font-bold text-slate-900">
              {pinjamTarget?.judul}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {pinjamTarget?.penulis || "Penulis tidak diketahui"}
            </p>
          </div>

          <p className="leading-6 text-[var(--muted)]">
            Lama peminjaman adalah{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {sistem.lamaPinjam} hari
            </span>
            .
          </p>

          <div>
            <label className="label">Tanggal Peminjaman</label>
            <input
              className="input"
              type="date"
              value={tanggalPinjam}
              onChange={(e) => setTanggalPinjam(e.target.value)}
            />
          </div>

          {jatuhTempo && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-[var(--muted)]">Tanggal jatuh tempo</p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">
                {tanggalPanjang(jatuhTempo)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPinjamTarget(null)}
            >
              Batal
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!tanggalPinjam}
              onClick={konfirmasiPinjam}
            >
              Ajukan Pinjaman
            </button>
          </div>
        </div>
      </Modal>

      {/* ARSIP BUKU — buku yang dihapus namun riwayatnya dipertahankan. */}
      <Modal
        open={bukaArsip}
        onClose={() => setBukaArsip(false)}
        title="Buku Diarsipkan"
        width="max-w-2xl"
      >
        <p className="text-sm text-slate-600">
          Buku di sini sudah tidak tampil di katalog tetapi riwayat
          peminjamannya masih tersimpan, sehingga barisnya tidak dibuang
          permanen. Pulihkan bila buku ingin dipinjamkan lagi.
        </p>

        {memuatArsip ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Memuat arsip...</p>
        ) : arsip.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              kartu={false}
              pesan="Tidak ada buku diarsipkan"
              sub="Buku yang dihapus tanpa riwayat peminjaman langsung hilang permanen dan tidak tampil di sini."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {arsip.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {item.judul}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {[
                      item.penulis || "Penulis tidak diketahui",
                      item.kategori,
                      item.rak ? `Rak ${item.rak}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · Diarsipkan "}
                    {tanggalPanjang(item.dihapusPada ?? "")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => pulihkanBuku(item)}
                  disabled={memulihkan === item.id}
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {memulihkan === item.id ? "Memulihkan..." : "Pulihkan"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* KONFIRMASI HAPUS */}
      <ConfirmDialog
        open={!!hapusTarget}
        onClose={() => setHapusTarget(null)}
        onConfirm={async () => {
          if (!hapusTarget) return;

          const target = hapusTarget;
          const hasilHapus = await hapusBuku(target.id);

          if (hasilHapus.ok) {
            // Buku beriwayat tidak bisa dibuang permanen; server hanya
            // mengarsipkannya, jadi pesan ke petugas dibedakan.
            toast.sukses(
              hasilHapus.diarsipkan
                ? `Buku "${target.judul}" diarsipkan — riwayat peminjamannya tetap tersimpan.`
                : `Buku "${target.judul}" dihapus dari katalog.`,
            );
          } else {
            toast.gagal(hasilHapus.pesan);
          }

          setHapusTarget(null);
        }}
        title="Hapus Buku"
        message={`Buku "${hapusTarget?.judul}" akan dihapus dari katalog. Bila buku ini sudah punya riwayat peminjaman, buku hanya diarsipkan agar riwayatnya tidak hilang. Apakah Anda yakin ingin melanjutkan?`}
      />
    </div>
  );
}

export default function KatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--muted)]">Memuat katalog...</div>
      }
    >
      <KatalogKonten />
    </Suspense>
  );
}
