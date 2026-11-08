
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KepalaHalaman } from "@/components/kepala-halaman";
import type { FormEvent } from "react";
import { useLibrary } from "@/lib/library-context";
import {
  useAuth,
  type Peran,
  type Pengguna,
} from "@/lib/auth";

type AnggotaData = {
  id: string;
  nama: string;
  aktif: boolean;
  email?: string;
  telepon?: string;
  alamat?: string;
  instansi?: string;
  kategori?: string;
  jenis?: string;
  peran?: string;
  nomorAnggota?: string;
  kode?: string;
  nomorIdentitas?: string;
  tanggalBergabung?: string;
  tanggalDaftar?: string;
  createdAt?: string;
};

type ModeTampilan = "grid" | "tabel";
type FilterStatus = "Semua" | "Aktif" | "Nonaktif";
type JenisAnggota = "Pelajar" | "Mahasiswa" | "Umum" | "Staf";

function ikon(path: string, size = 20) {
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
      <path d={path} />
    </svg>
  );
}

function nilai(teks?: string | null) {
  return teks?.trim() || "";
}

function tanggalAnggota(a: AnggotaData) {
  const tanggal =
    a.tanggalBergabung || a.tanggalDaftar || a.createdAt;

  if (!tanggal) return "-";

  const d = new Date(tanggal);

  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function inisial(nama: string) {
  return (
    nama
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((kata) => kata.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function nomorKartu(a: AnggotaData) {
  return a.nomorAnggota || a.kode || a.id;
}

function kategoriAnggota(a: AnggotaData) {
  return a.kategori || a.jenis || a.peran || "Umum";
}

function labelPeran(peran: Peran) {
  if (peran === "superadmin") return "Super Admin";
  if (peran === "admin") return "Admin";
  return "Anggota";
}

function unduhCSV(anggota: AnggotaData[]) {
  const kolom = [
    "ID Anggota",
    "Nama",
    "Email",
    "Telepon",
    "Instansi",
    "Kategori",
    "Status",
    "Tanggal Bergabung",
  ];

  const kutip = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const baris = anggota.map((a) =>
    [
      nomorKartu(a),
      a.nama,
      a.email,
      a.telepon,
      a.instansi,
      kategoriAnggota(a),
      a.aktif ? "Aktif" : "Nonaktif",
      tanggalAnggota(a),
    ]
      .map(kutip)
      .join(",")
  );

  const csv =
    "\uFEFF" +
    [kolom.map(kutip).join(","), ...baris].join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "data-anggota-pustakaku.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function AnggotaPage() {
  const {
    anggota,
    peminjaman,
    siap,
    ubahAnggota,
    hapusAnggota,
  } = useLibrary();

  const {
    pengguna,
    sedangMasuk,
    siap: authSiap,
    buatAkun,
    resetSandi,
    ubahPeran,
    hapusAkun,
  } = useAuth();

  const superAdmin = sedangMasuk?.peran === "superadmin";

  const [mode, setMode] = useState<ModeTampilan>("grid");
  const [filter, setFilter] = useState<FilterStatus>("Semua");
  const [pencarian, setPencarian] = useState("");
  const [kategori, setKategori] = useState("Semua Kategori");

  // Modal pilihan pengelolaan.
  const [anggotaPilihan, setAnggotaPilihan] =
    useState<AnggotaData | null>(null);

  // Target anggota yang akan dibuatkan akun.
  const [targetAkunAnggota, setTargetAkunAnggota] =
    useState<AnggotaData | null>(null);

  // Modal edit data anggota.
  const [anggotaEdit, setAnggotaEdit] =
    useState<AnggotaData | null>(null);

  const [formEdit, setFormEdit] = useState({
    nama: "",
    email: "",
    telepon: "",
    alamat: "",
    jenis: "Umum" as JenisAnggota,
    aktif: true,
  });

  // Modal pengelolaan akun.
  const [modalAkun, setModalAkun] = useState(false);
  const [akunEdit, setAkunEdit] = useState<Pengguna | null>(null);

  const [formAkun, setFormAkun] = useState({
    nama: "",
    email: "",
    sandi: "",
    peran: "user" as Peran,
  });

  const [sandiBaru, setSandiBaru] = useState("");

  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [sedangMenghapus, setSedangMenghapus] = useState(false);
  const [sedangProsesAkun, setSedangProsesAkun] = useState(false);
  const [notifikasi, setNotifikasi] = useState<{
  judul: string;
  pesan: string;
} | null>(null);

  const daftarAnggota = anggota as AnggotaData[];

  // Menghitung jumlah buku yang sedang dipinjam setiap anggota.
  const jumlahDipinjam = useMemo(() => {
    const hasil = new Map<string, number>();

    peminjaman
      .filter((p) => p.status === "Dipinjam")
      .forEach((p) => {
        hasil.set(
          p.anggotaId,
          (hasil.get(p.anggotaId) || 0) + 1
        );
      });

    return hasil;
  }, [peminjaman]);

  // Mencari akun berdasarkan anggotaId.
  function cariAkunAnggota(anggotaId: string) {
    if (!superAdmin) return undefined;

    return pengguna.find(
      (akun) => akun.anggotaId === anggotaId
    );
  }

  // Akun admin yang tidak memiliki kartu anggota.
  const akunTanpaAnggota = superAdmin
    ? pengguna.filter(
        (akun) =>
          akun.peran !== "user" &&
          !akun.anggotaId
      )
    : [];

  const totalAktif = daftarAnggota.filter((a) => a.aktif).length;
  const totalNonaktif = daftarAnggota.length - totalAktif;

  const anggotaMeminjam = daftarAnggota.filter(
    (a) => (jumlahDipinjam.get(a.id) || 0) > 0
  ).length;

  const totalBukuDipinjam = peminjaman.filter(
    (p) => p.status === "Dipinjam"
  ).length;

  const semuaKategori = Array.from(
    new Set(daftarAnggota.map(kategoriAnggota))
  ).sort();

  const anggotaTampil = daftarAnggota.filter((a) => {
    const statusCocok =
      filter === "Semua" ||
      (filter === "Aktif" && a.aktif) ||
      (filter === "Nonaktif" && !a.aktif);

    const kata = pencarian.toLowerCase().trim();

    const pencarianCocok =
      !kata ||
      [
        a.nama,
        a.id,
        a.email,
        a.telepon,
        a.instansi,
        nomorKartu(a),
      ].some((item) =>
        String(item || "").toLowerCase().includes(kata)
      );

    const kategoriCocok =
      kategori === "Semua Kategori" ||
      kategoriAnggota(a) === kategori;

    return statusCocok && pencarianCocok && kategoriCocok;
  });

  // Membuka pilihan pengelolaan anggota.
  function bukaEdit(a: AnggotaData) {
    setAnggotaPilihan(a);
  }

  // Membuka formulir edit data anggota.
  function bukaEditData(a: AnggotaData) {
    setAnggotaPilihan(null);
    setAnggotaEdit(a);

    setFormEdit({
      nama: a.nama || "",
      email: a.email || "",
      telepon: a.telepon || "",
      alamat: a.alamat || "",
      jenis: (a.jenis || a.kategori || "Umum") as JenisAnggota,
      aktif: a.aktif,
    });
  }

  // Membuka modal kelola akun.
  function bukaKelolaAkun(a: AnggotaData) {
    if (!superAdmin) {
      window.alert(
        "Pengelolaan akun hanya dapat dilakukan oleh Super Admin."
      );
      return;
    }

    const akun = cariAkunAnggota(a.id);

    setTargetAkunAnggota(a);
    setAnggotaPilihan(null);
    setAkunEdit(akun || null);

    setFormAkun({
      nama: akun?.nama || a.nama || "",
      email: akun?.email || a.email || "",
      sandi: "",
      peran: akun?.peran || "user",
    });

    setSandiBaru("");
    setModalAkun(true);
  }

  // Membuka pengelolaan akun tanpa kartu anggota.
  function bukaAkunMandiri(akun: Pengguna) {
    if (!superAdmin) return;

    setTargetAkunAnggota(null);
    setAnggotaPilihan(null);
    setAkunEdit(akun);

    setFormAkun({
      nama: akun.nama,
      email: akun.email,
      sandi: "",
      peran: akun.peran,
    });

    setSandiBaru("");
    setModalAkun(true);
  }

  // Menyimpan perubahan data anggota.
  async function simpanEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!anggotaEdit || sedangMenyimpan) return;

    if (!formEdit.nama.trim()) {
      window.alert("Nama anggota wajib diisi.");
      return;
    }

    setSedangMenyimpan(true);

    try {
      const hasil = await ubahAnggota(anggotaEdit.id, {
        nama: formEdit.nama.trim(),
        email: formEdit.email.trim().toLowerCase(),
        telepon: formEdit.telepon.trim(),
        alamat: formEdit.alamat.trim(),
        jenis: formEdit.jenis,
        aktif: formEdit.aktif,
      });

      if (!hasil.ok) {
        window.alert(hasil.pesan || "Gagal memperbarui anggota.");
        return;
      }

      setAnggotaEdit(null);
      window.alert(hasil.pesan || "Data anggota berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memperbarui anggota:", error);
      window.alert("Terjadi kesalahan saat memperbarui anggota.");
    } finally {
      setSedangMenyimpan(false);
    }
  }

  // Menyimpan akun baru atau perubahan peran akun.
  async function simpanAkun(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();

  if (sedangProsesAkun) return;

  if (!superAdmin) {
    window.alert("Akses hanya untuk Super Admin.");
    return;
  }

  if (!formAkun.nama.trim() || !formAkun.email.trim()) {
    window.alert("Nama dan email wajib diisi.");
    return;
  }

  if (!akunEdit && !targetAkunAnggota) {
    window.alert("Anggota tujuan akun tidak ditemukan.");
    return;
  }

  if (!akunEdit && formAkun.sandi.length < 8) {
    window.alert("Kata sandi minimal 8 karakter.");
    return;
  }

  setSedangProsesAkun(true);

  try {
    let hasil;
    const sedangEdit = Boolean(akunEdit);

    if (akunEdit) {
      hasil = await ubahPeran(akunEdit.id, formAkun.peran);
    } else {
      hasil = await buatAkun({
        nama: formAkun.nama.trim(),
        email: formAkun.email.trim().toLowerCase(),
        sandi: formAkun.sandi,
        peran: "user",
        anggotaId: targetAkunAnggota!.id,
      });
    }

    if (!hasil.ok) {
      window.alert(hasil.pesan || "Gagal menyimpan akun.");
      return;
    }

    setModalAkun(false);
    setAkunEdit(null);
    setTargetAkunAnggota(null);

    setNotifikasi({
      judul: sedangEdit
        ? "Akun Berhasil Diperbarui"
        : "Akun Berhasil Dibuat",
      pesan:
        hasil.pesan ||
        (sedangEdit
          ? "Perubahan akun berhasil disimpan."
          : "Akun anggota berhasil dibuat dan terhubung dengan data anggota."),
    });
  } catch (error) {
    console.error("Gagal menyimpan akun:", error);
    window.alert("Terjadi kesalahan saat menyimpan akun.");
  } finally {
    setSedangProsesAkun(false);
  }
}

  // Reset kata sandi akun.
  async function prosesResetSandi() {
    if (!akunEdit || !superAdmin || sedangProsesAkun) return;

    if (sandiBaru.length < 8) {
      window.alert("Kata sandi minimal 8 karakter.");
      return;
    }

    setSedangProsesAkun(true);

    try {
      const hasil = await resetSandi(akunEdit.id, sandiBaru);

      if (!hasil.ok) {
        window.alert(hasil.pesan || "Gagal mereset kata sandi.");
        return;
      }

      setSandiBaru("");
      window.alert(hasil.pesan || "Kata sandi berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal reset kata sandi:", error);
      window.alert("Terjadi kesalahan saat mereset kata sandi.");
    } finally {
      setSedangProsesAkun(false);
    }
  }

  // Menghapus akun tanpa menghapus data anggota.
  async function prosesHapusAkun() {
    if (!akunEdit || !superAdmin || sedangProsesAkun) return;

    const yakin = window.confirm(
      `Hapus akun ${akunEdit.email}?\n\nData anggota yang terhubung tidak akan dihapus. Penghapusan akun tidak dapat dibatalkan.`
    );

    if (!yakin) return;

    setSedangProsesAkun(true);

    try {
      const hasil = await hapusAkun(akunEdit.id);

      if (!hasil.ok) {
        window.alert(hasil.pesan || "Gagal menghapus akun.");
        return;
      }

      setModalAkun(false);
      setAkunEdit(null);
      setTargetAkunAnggota(null);

      window.alert(
        hasil.pesan || "Akun berhasil dihapus. Data anggota tetap tersimpan."
      );
    } catch (error) {
      console.error("Gagal menghapus akun:", error);
      window.alert("Terjadi kesalahan saat menghapus akun.");
    } finally {
      setSedangProsesAkun(false);
    }
  }

  // Menghapus anggota setelah pemeriksaan pinjaman.
  async function konfirmasiHapus(a: AnggotaData) {
    if (sedangMenghapus) return;

    const jumlahPinjaman = jumlahDipinjam.get(a.id) || 0;

    if (jumlahPinjaman > 0) {
      window.alert(
        `Anggota "${a.nama}" masih memiliki ${jumlahPinjaman} buku yang sedang dipinjam.\n\nNonaktifkan anggota terlebih dahulu setelah transaksi diselesaikan.`
      );
      return;
    }

    if (superAdmin && cariAkunAnggota(a.id)) {
      window.alert(
        "Anggota ini masih memiliki akun login.\n\nKelola atau hapus akun terlebih dahulu sebelum menghapus data anggota."
      );
      return;
    }

    const yakin = window.confirm(
      `Apakah kamu yakin ingin menghapus anggota "${a.nama}" dengan nomor ${nomorKartu(a)}?\n\nTindakan ini tidak dapat dibatalkan.`
    );

    if (!yakin) return;

    setSedangMenghapus(true);

    try {
      const hasil = await hapusAnggota(a.id);

      if (!hasil.ok) {
        window.alert(hasil.pesan || "Gagal menghapus anggota.");
        return;
      }

      window.alert(hasil.pesan || "Anggota berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus anggota:", error);
      window.alert("Terjadi kesalahan saat menghapus anggota.");
    } finally {
      setSedangMenghapus(false);
    }
  }

  if (!siap || !authSiap) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Memuat data manajemen pengguna...
      </div>
    );
  }

  return (
    <main className="min-w-0 space-y-6 pb-8">
      {/* Kepala halaman — judul sudah tampil di header AppShell. */}
      <KepalaHalaman
        remah={
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {daftarAnggota.length} anggota
          </span>
        }
        deskripsi="Kelola data anggota, informasi keanggotaan, dan akun akses PustakaKu dalam satu halaman."
        aksi={
          <>
            <div className="flex rounded-2xl border border-[var(--border)] bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("grid")}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  mode === "grid"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {ikon(
                  "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
                  16
                )}
                Grid
              </button>

              <button
                type="button"
                onClick={() => setMode("tabel")}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  mode === "tabel"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {ikon(
                  "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
                  16
                )}
                Tabel
              </button>
            </div>

            <button
              type="button"
              onClick={() => unduhCSV(anggotaTampil)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {ikon(
                "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
                17
              )}
              Ekspor CSV
            </button>

            <Link
              href="/anggota/tambah"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-hover)]"
            >
              {ikon("M12 5v14 M5 12h14", 17)}
              Tambah Anggota
            </Link>
          </>
        }
      />

      {/* Statistik */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Anggota Terdaftar
            </p>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              {ikon(
                "M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M10 11a4 4 0 100-8 4 4 0 000 8 M20 8v6 M23 11h-6",
                20
              )}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight text-slate-900">
              {daftarAnggota.length}
            </span>
            <span className="text-sm text-slate-400">Civitas</span>
          </div>
          <p className="mt-2 text-sm text-emerald-600">
            Seluruh anggota yang terdaftar
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status Anggota Aktif
            </p>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              {ikon(
                "M22 11.1V12a10 10 0 11-5.9-9.1 M22 4L12 14.01l-3-3",
                20
              )}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight text-slate-900">
              {totalAktif}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {daftarAnggota.length
              ? Math.round((totalAktif / daftarAnggota.length) * 100)
              : 0}
            % dari seluruh anggota
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Sedang Meminjam Buku
            </p>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-600">
              {ikon(
                "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
                20
              )}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight text-slate-900">
              {anggotaMeminjam}
            </span>
            <span className="text-sm text-slate-400">Anggota</span>
          </div>
          <p className="mt-2 text-sm text-teal-700">
            Total {totalBukuDipinjam} buku sedang dipinjam
          </p>
        </article>
      </section>

      {/* Pencarian dan filter */}
      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {(
            [
              ["Semua", daftarAnggota.length],
              ["Aktif", totalAktif],
              ["Nonaktif", totalNonaktif],
            ] as [FilterStatus, number][]
          ).map(([status, jumlah]) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                filter === status
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {status} ({jumlah})
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1 sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {ikon(
                "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35",
                17
              )}
            </span>
            <input
              type="search"
              value={pencarian}
              onChange={(e) => setPencarian(e.target.value)}
              placeholder="Cari nama, ID, email, instansi..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500"
            aria-label="Filter kategori anggota"
          >
            <option>Semua Kategori</option>
            {semuaKategori.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Daftar anggota - Grid */}
      {mode === "grid" ? (
        anggotaTampil.length > 0 ? (
          <section className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
            {anggotaTampil.map((a, index) => {
              const jumlah = jumlahDipinjam.get(a.id) || 0;
              const akun = cariAkunAnggota(a.id);

              const warnaAvatar = [
                "bg-teal-600",
                "bg-cyan-600",
                "bg-emerald-600",
                "bg-teal-700",
                "bg-cyan-700",
                "bg-emerald-700",
              ][index % 6];

              return (
                <article
                  key={a.id}
                  className="flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white ${warnaAvatar}`}
                    >
                      {inisial(a.nama)}
                    </div>

                    <div className="min-w-0 flex-1 pt-1">
                      <h2 className="break-words font-bold text-slate-900">
                        {a.nama}
                      </h2>
                      <p className="mt-1 break-all font-mono text-[11px] text-teal-800">
                        {nomorKartu(a)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        a.aktif
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      {a.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div className="my-4 border-t border-slate-100" />

                  <div className="flex-1 space-y-3 text-sm text-slate-500">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-slate-400">
                        {ikon("M4 4h16v16H4z M22 6l-10 7L2 6", 16)}
                      </span>
                      <span className="min-w-0 break-all">
                        {nilai(a.email) || "Email belum tersedia"}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-slate-400">
                        {ikon(
                          "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.12.96.36 1.9.7 2.8a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.84.58 2.8.7a2 2 0 011.73 2.03z",
                          16
                        )}
                      </span>
                      <span>
                        {nilai(a.telepon) || "Telepon belum tersedia"}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-slate-400">
                        {ikon(
                          "M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4 M9 9v.01 M9 12v.01 M9 15v.01 M9 18v.01",
                          16
                        )}
                      </span>
                      <span className="min-w-0 break-words">
                        {nilai(a.instansi) || "Instansi belum tersedia"}
                      </span>
                    </div>
                  </div>

                  <div className="my-4 border-t border-slate-100" />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-800">
                      {kategoriAnggota(a)}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          window.alert(
                            `Kartu Anggota\n\nNama: ${a.nama}\nID: ${nomorKartu(a)}\nKategori: ${kategoriAnggota(a)}\nStatus: ${a.aktif ? "Aktif" : "Nonaktif"}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-50"
                        title="Lihat informasi kartu anggota"
                      >
                        {ikon("M2 7h20v13H2z M2 11h20 M6 16h4", 15)}
                        KTA
                      </button>

                      <button
                        type="button"
                        onClick={() => bukaEdit(a)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        {ikon(
                          "M12 20h9 M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4Z",
                          15
                        )}
                        Kelola
                      </button>

                      <button
                        type="button"
                        onClick={() => void konfirmasiHapus(a)}
                        disabled={sedangMenghapus}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ikon(
                          "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5",
                          15
                        )}
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-xs">
                    <p className="text-slate-400">
                      Pinjaman:{" "}
                      <span className="font-bold text-slate-900">
                        {jumlah} buku
                      </span>
                    </p>
                    <p className="text-slate-400">
                      Bergabung: {tanggalAnggota(a)}
                    </p>
                  </div>

                  {/* Status akun */}
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          !superAdmin
                            ? "bg-slate-400"
                            : akun
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                        }`}
                      />
                      <span className="text-xs font-medium text-slate-600">
                        {!superAdmin
                          ? "Status akun"
                          : akun
                            ? "Akun terhubung"
                            : "Belum memiliki akun"}
                      </span>
                    </div>

                    {superAdmin && akun && (
                      <span className="truncate text-xs font-semibold text-teal-800">
                        {labelPeran(akun.peran)}
                      </span>
                    )}

                    {superAdmin && !akun && (
                      <span className="text-xs font-semibold text-amber-700">
                        Belum terhubung
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              {ikon(
                "M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M10 11a4 4 0 100-8 4 4 0 000 8",
                25
              )}
            </div>
            <h2 className="mt-4 font-bold text-slate-900">
              Anggota tidak ditemukan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Coba ubah kata pencarian atau filter yang dipilih.
            </p>
            <button
              type="button"
              onClick={() => {
                setPencarian("");
                setFilter("Semua");
                setKategori("Semua Kategori");
              }}
              className="mt-4 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"
            >
              Reset Filter
            </button>
          </section>
        )
      ) : (
        /* Tampilan Tabel */
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Anggota</th>
                  <th className="px-5 py-4 font-semibold">Kontak</th>
                  <th className="px-5 py-4 font-semibold">Kategori</th>
                  <th className="px-5 py-4 font-semibold">Bergabung</th>
                  <th className="px-5 py-4 font-semibold">Pinjaman</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Akun</th>
                  <th className="px-5 py-4 font-semibold">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {anggotaTampil.map((a) => {
                  const akun = cariAkunAnggota(a.id);

                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 font-bold text-teal-800">
                            {inisial(a.nama)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {a.nama}
                            </p>
                            <p className="font-mono text-xs text-slate-400">
                              {nomorKartu(a)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p>{a.email || "-"}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {a.telepon || "-"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {kategoriAnggota(a)}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {tanggalAnggota(a)}
                      </td>

                      <td className="px-5 py-4">
                        {jumlahDipinjam.get(a.id) || 0} buku
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            a.aktif
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {a.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {!superAdmin ? (
                          <span className="text-xs text-slate-400">
                            -
                          </span>
                        ) : akun ? (
                          <div>
                            <span className="font-medium text-emerald-700">
                              Terhubung
                            </span>
                            <p className="mt-1 text-xs text-slate-400">
                              {labelPeran(akun.peran)}
                            </p>
                          </div>
                        ) : (
                          <span className="font-medium text-amber-700">
                            Belum terhubung
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bukaEdit(a)}
                            title="Kelola pengguna"
                            className="rounded-lg bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100"
                          >
                            {ikon(
                              "M12 20h9 M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4Z",
                              16
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void konfirmasiHapus(a)}
                            disabled={sedangMenghapus}
                            title="Hapus anggota"
                            className="rounded-lg bg-red-50 p-2 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {ikon(
                              "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
                              16
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {anggotaTampil.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Tidak ada anggota yang sesuai dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Akun Admin tanpa kartu anggota */}
      {superAdmin && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Akun tanpa Kartu Anggota
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Akun pengelola sistem yang tidak terhubung dengan data anggota.
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {akunTanpaAnggota.length} Akun
            </span>
          </div>

          {akunTanpaAnggota.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {akunTanpaAnggota.map((akun) => (
                <div
                  key={akun.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 font-bold text-slate-700">
                      {inisial(akun.nama)}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {akun.nama}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {akun.email}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                        {labelPeran(akun.peran)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => bukaAkunMandiri(akun)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {ikon(
                      "M12 20h9 M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4Z",
                      16
                    )}
                    Kelola Akun
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-500">
                Tidak ada akun pengelola tanpa kartu anggota.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Modal pilihan pengelolaan */}
      {anggotaPilihan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setAnggotaPilihan(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Manajemen Pengguna
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pilih bagian yang ingin dikelola.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAnggotaPilihan(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
                aria-label="Tutup"
              >
                {ikon("M18 6 6 18 M6 6l12 12", 20)}
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                {anggotaPilihan.nama}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {nomorKartu(anggotaPilihan)}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => bukaEditData(anggotaPilihan)}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-800">
                  {ikon(
                    "M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M10 11a4 4 0 100-8 4 4 0 000 8 M19 8v6 M22 11h-6",
                    21
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">
                    Data Anggota
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Ubah identitas, kontak, kategori, dan status anggota.
                  </span>
                </span>
                {ikon("M9 18l6-6-6-6", 18)}
              </button>

              <button
                type="button"
                disabled={!superAdmin}
                onClick={() => bukaKelolaAkun(anggotaPilihan)}
                className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800">
                  {ikon(
                    "M12 15v2 M8 11V7a4 4 0 118 0v4 M5 11h14v10H5z",
                    21
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">
                    Kelola Akun
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Buat akun login, ubah peran, reset kata sandi, atau hapus akun.
                  </span>
                  {!superAdmin && (
                    <span className="mt-1 block text-xs font-medium text-amber-700">
                      Khusus Super Admin
                    </span>
                  )}
                </span>
                {ikon("M9 18l6-6-6-6", 18)}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAnggotaPilihan(null)}
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Modal Edit Data Anggota */}
      {anggotaEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !sedangMenyimpan
            ) {
              setAnggotaEdit(null);
            }
          }}
        >
          <div className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Edit Data Anggota
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Perbarui informasi anggota PustakaKu.
                </p>
              </div>

              <button
                type="button"
                disabled={sedangMenyimpan}
                onClick={() => setAnggotaEdit(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup formulir"
              >
                {ikon("M18 6 6 18 M6 6l12 12", 20)}
              </button>
            </div>

            <div className="mb-5 rounded-2xl bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Nomor Keanggotaan
              </p>
              <p className="mt-1 font-mono font-bold text-teal-900">
                {nomorKartu(anggotaEdit)}
              </p>
              <p className="mt-1 text-xs text-teal-700">
                Nomor keanggotaan tidak dapat diubah.
              </p>
            </div>

            <form onSubmit={simpanEdit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Nama Lengkap
                </label>
                <input
                  required
                  maxLength={120}
                  value={formEdit.nama}
                  onChange={(e) =>
                    setFormEdit({
                      ...formEdit,
                      nama: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={formEdit.email}
                  onChange={(e) =>
                    setFormEdit({
                      ...formEdit,
                      email: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Nomor Telepon
                </label>
                <input
                  maxLength={40}
                  value={formEdit.telepon}
                  onChange={(e) =>
                    setFormEdit({
                      ...formEdit,
                      telepon: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Alamat
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={formEdit.alamat}
                  onChange={(e) =>
                    setFormEdit({
                      ...formEdit,
                      alamat: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Kategori
                  </label>
                  <select
                    value={formEdit.jenis}
                    onChange={(e) =>
                      setFormEdit({
                        ...formEdit,
                        jenis: e.target.value as JenisAnggota,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="Pelajar">Pelajar</option>
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Umum">Umum</option>
                    <option value="Staf">Staf</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Status Anggota
                  </label>
                  <select
                    value={formEdit.aktif ? "aktif" : "nonaktif"}
                    onChange={(e) =>
                      setFormEdit({
                        ...formEdit,
                        aktif: e.target.value === "aktif",
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={sedangMenyimpan}
                  onClick={() => setAnggotaEdit(null)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={sedangMenyimpan}
                  className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sedangMenyimpan
                    ? "Menyimpan..."
                    : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Akun */}
      {modalAkun && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !sedangProsesAkun
            ) {
              setModalAkun(false);
              setAkunEdit(null);
              setTargetAkunAnggota(null);
            }
          }}
        >
          <div className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {akunEdit ? "Kelola Akun" : "Buat Akun Anggota"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {akunEdit
                    ? "Atur peran dan keamanan akun pengguna."
                    : "Buat akun login yang terhubung dengan kartu anggota."}
                </p>
              </div>

              <button
                type="button"
                disabled={sedangProsesAkun}
                onClick={() => {
                  setModalAkun(false);
                  setAkunEdit(null);
                  setTargetAkunAnggota(null);
                }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
                aria-label="Tutup"
              >
                {ikon("M18 6 6 18 M6 6l12 12", 20)}
              </button>
            </div>

            {targetAkunAnggota && (
              <div className="mb-5 rounded-2xl bg-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Anggota yang terhubung
                </p>
                <p className="mt-1 font-bold text-teal-900">
                  {targetAkunAnggota.nama}
                </p>
                <p className="mt-1 font-mono text-xs text-teal-700">
                  {nomorKartu(targetAkunAnggota)}
                </p>
              </div>
            )}

            <form onSubmit={simpanAkun} className="space-y-4">
              {!akunEdit ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Nama Pengguna
                    </label>
                    <input
                      required
                      maxLength={120}
                      value={formAkun.nama}
                      onChange={(e) =>
                        setFormAkun({
                          ...formAkun,
                          nama: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Email Login
                    </label>
                    <input
                      required
                      type="email"
                      value={formAkun.email}
                      onChange={(e) =>
                        setFormAkun({
                          ...formAkun,
                          email: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Kata Sandi Awal
                    </label>
                    <input
                      required
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      value={formAkun.sandi}
                      onChange={(e) =>
                        setFormAkun({
                          ...formAkun,
                          sandi: e.target.value,
                        })
                      }
                      placeholder="Minimal 8 karakter"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                    Akun baru akan dibuat dengan peran <strong>Anggota</strong> dan otomatis dihubungkan dengan data anggota di atas.
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Nama Pengguna
                    </label>
                    <input
                      readOnly
                      value={akunEdit.nama}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Email Login
                    </label>
                    <input
                      readOnly
                      value={akunEdit.email}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Peran Akun
                    </label>
                    <select
                      value={formAkun.peran}
                      onChange={(e) =>
                        setFormAkun({
                          ...formAkun,
                          peran: e.target.value as Peran,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="user">Anggota</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Perubahan peran mengikuti aturan keamanan di server.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      sedangProsesAkun ||
                      formAkun.peran === akunEdit.peran
                    }
                    className="w-full rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sedangProsesAkun
                      ? "Menyimpan..."
                      : "Simpan Perubahan Peran"}
                  </button>

                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="font-semibold text-slate-900">
                      Reset Kata Sandi
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Atur kata sandi baru untuk akun ini.
                    </p>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="password"
                        minLength={8}
                        autoComplete="new-password"
                        value={sandiBaru}
                        onChange={(e) => setSandiBaru(e.target.value)}
                        placeholder="Kata sandi baru"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500"
                      />

                      <button
                        type="button"
                        onClick={() => void prosesResetSandi()}
                        disabled={
                          sedangProsesAkun || sandiBaru.length < 8
                        }
                        className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset Sandi
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-red-100 pt-5">
                    <h3 className="font-semibold text-red-700">
                      Hapus Akun
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Menghapus akun login. Data anggota yang terhubung tidak ikut dihapus.
                    </p>

                    <button
                      type="button"
                      onClick={() => void prosesHapusAkun()}
                      disabled={sedangProsesAkun}
                      className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Hapus Akun Login
                    </button>
                  </div>
                </>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={sedangProsesAkun}
                  onClick={() => {
                    setModalAkun(false);
                    setAkunEdit(null);
                    setTargetAkunAnggota(null);
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Tutup
                </button>

                {!akunEdit && (
                  <button
                    type="submit"
                    disabled={sedangProsesAkun}
                    className="rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sedangProsesAkun
                      ? "Membuat Akun..."
                      : "Buat Akun Anggota"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Popup Notifikasi Keberhasilan */}
{notifikasi && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) {
        setNotifikasi(null);
      }
    }}
  >
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="judul-notifikasi"
      aria-describedby="pesan-notifikasi"
      className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-2xl"
    >
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h2
        id="judul-notifikasi"
        className="mt-5 text-xl font-bold tracking-tight text-slate-900"
      >
        {notifikasi.judul}
      </h2>

      <p
        id="pesan-notifikasi"
        className="mt-2 text-sm leading-6 text-slate-500"
      >
        {notifikasi.pesan}
      </p>

      <button
        type="button"
        autoFocus
        onClick={() => setNotifikasi(null)}
        className="mt-6 w-full rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900 active:scale-[0.98]"
      >
        Mengerti
      </button>
    </div>
  </div>
)}
    </main>
  );
}
