"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useBoleh } from "@/lib/auth";
import { useToast } from "@/components/toast";
import {
  Badge,
  Modal,
  StatCard,
  tanggalPanjang,
} from "@/components/ui";
import { KepalaHalaman } from "@/components/kepala-halaman";

// === Monitoring Kunjungan ==================================================
// Halaman presensi/buku tamu di DALAM panel admin (src/components/AppShell.tsx):
// sidebar, header, menu mobile, dan kontrol akun dipakai BERSAMA halaman admin
// lainnya — halaman ini hanya menyediakan isinya, tanpa kerangka sendiri.
//
// Semua baris & angka dibaca dari GET /api/kunjungan (izin laporan.lihat) sesuai
// model data sebenarnya (migrasi 202610270003): satu baris = satu check-in
// anggota per hari (tanggal_kunjungan + waktu_masuk, zona Asia/Jakarta). Tabel
// tidak punya kolom keluar/keperluan/area, jadi yang ditampilkan hanyalah data
// yang benar-benar ada — tanpa placeholder yang menyesatkan.
//
// Check-in baru lewat POST /api/kunjungan (RPC `catat_kunjungan`) — bisa dari
// panel ini atau dari kios perpustakaan; fungsi database menolak nomor yang
// tidak terdaftar/nonaktif dan mencegah check-in ganda dalam sehari.

const PER_HAL = 10;

/** Rentang yang didukung server: maksimal 90 hari (BATAS_HARI di API). */
type RentangId = "hari" | "7" | "14" | "30";

const RENTANG: { id: RentangId; label: string; hari: number }[] = [
  { id: "hari", label: "Hari Ini", hari: 0 },
  { id: "7", label: "7 Hari", hari: 6 },
  { id: "14", label: "14 Hari", hari: 13 },
  { id: "30", label: "30 Hari", hari: 29 },
];

interface BarisKunjungan {
  id: string;
  anggotaId: string;
  nama: string;
  nomorAnggota: string;
  /** Jenis keanggotaan (Pelajar/Mahasiswa/Umum/Staf) dari relasi `anggota`. */
  kategori?: string | null;
  tanggal: string; // YYYY-MM-DD
  waktuMasuk: string; // ISO timestamptz
}

interface ResponRekap {
  dari: string;
  sampai: string;
  q: string;
  hal: number;
  per: number;
  total: number;
  halTerakhir: number;
  pengunjungUnik: number;
  hariIni: number;
  terpotong: boolean;
  ringkasan: { tanggal: string; jumlah: number }[];
  kunjungan: BarisKunjungan[];
}

/** Tanggal YYYY-MM-DD (zona Asia/Jakarta) untuk offset hari dari hari ini. */
function tanggalOffset(hari: number): string {
  return new Date(Date.now() + hari * 86_400_000).toLocaleDateString(
    "sv-SE",
    { timeZone: "Asia/Jakarta" },
  );
}

function jamWIB(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function pesanApi(e: unknown): string {
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as Error).message === "string"
  ) {
    return (e as Error).message;
  }
  return "Permintaan gagal diproses.";
}

function ikon(path: string, size = 16) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function inisial(nama: string): string {
  return (
    nama
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((v) => v.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

const IKON_CARI =
  "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35";

function unduhCSV(baris: BarisKunjungan[]) {
  const kolom = [
    "Tanggal",
    "Waktu Masuk",
    "Nomor Anggota",
    "Nama",
    "Kategori",
  ];
  const escapeCSV = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const rows = baris.map((b) => [
    b.tanggal,
    `${jamWIB(b.waktuMasuk)} WIB`,
    b.nomorAnggota,
    b.nama,
    b.kategori || "-",
  ]);

  const csv = [kolom, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `presensi-kunjungan-${tanggalOffset(0)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function MonitoringKunjunganPage() {
  const toast = useToast();
  const bolehEkspor = useBoleh("laporan.ekspor");

  const [rentang, setRentang] = useState<RentangId>("hari");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [hal, setHal] = useState(1);
  // Penanda muat ulang (setelah check-in) tanpa mengubah kueri.
  const [segar, setSegar] = useState(0);

  const [modal, setModal] = useState(false);
  const [nomor, setNomor] = useState("");
  const [proses, setProses] = useState(false);
  const [galatModal, setGalatModal] = useState("");
  const [prosesEkspor, setProsesEkspor] = useState(false);

  const hari =
    RENTANG.find((r) => r.id === rentang)?.hari ?? 0;
  const dari = tanggalOffset(-hari);
  const sampai = tanggalOffset(0);

  const kunci = useMemo(() => {
    const p = new URLSearchParams({
      dari,
      sampai,
      hal: String(hal),
      per: String(PER_HAL),
    });
    if (q) p.set("q", q);
    return p.toString();
  }, [dari, sampai, hal, q]);

  const [simpanan, setSimpanan] = useState<{
    kunci: string;
    segar: number;
    respon: ResponRekap;
  } | null>(null);
  const [galat, setGalat] = useState<{
    kunci: string;
    segar: number;
    pesan: string;
  } | null>(null);

  useEffect(() => {
    let batal = false;
    apiFetch<ResponRekap>(`/api/kunjungan?${kunci}`)
      .then((r) => {
        if (!batal) setSimpanan({ kunci, segar, respon: r });
      })
      .catch((e) => {
        if (!batal) setGalat({ kunci, segar, pesan: pesanApi(e) });
      });
    return () => {
      batal = true;
    };
  }, [kunci, segar]);

  // Pencarian diberi jeda supaya tidak memanggil server tiap ketikan.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput.trim());
      setHal(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const cocok =
    simpanan !== null &&
    simpanan.kunci === kunci &&
    simpanan.segar === segar;
  const respon = cocok ? simpanan.respon : null;
  const sedangGalat =
    galat && galat.kunci === kunci && galat.segar === segar
      ? galat.pesan
      : null;
  const memuat = !respon && !sedangGalat;

  const puncak = useMemo(() => {
    const ringkas = respon?.ringkasan ?? [];
    return ringkas.reduce(
      (tertinggi, x) =>
        x.jumlah > tertinggi.jumlah ? x : tertinggi,
      { tanggal: "", jumlah: 0 },
    );
  }, [respon]);

  async function catatKunjungan(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();
    const nilai = nomor.trim();
    if (!nilai || proses) return;

    setProses(true);
    setGalatModal("");

    try {
      const r = await apiFetch<{
        kunjungan?: { status?: string; nama?: string };
        pesan?: string;
      }>("/api/kunjungan", {
        method: "POST",
        body: { nomorAnggota: nilai },
      });

      const pesan = r.pesan ?? "Kunjungan tercatat.";
      setNomor("");
      setModal(false);
      setHal(1);
      setSegar((s) => s + 1);

      if (r.kunjungan?.status === "baru") toast.sukses(pesan);
      else toast.info(pesan);
    } catch (err) {
      // Galat form tetap inline (konvensi aplikasi), bukan toast.
      setGalatModal(pesanApi(err));
    } finally {
      setProses(false);
    }
  }

  async function eksporCSV() {
    setProsesEkspor(true);
    try {
      const p = new URLSearchParams({
        dari,
        sampai,
        semua: "true",
      });
      if (q) p.set("q", q);
      const r = await apiFetch<ResponRekap>(
        `/api/kunjungan?${p.toString()}`,
      );
      if (r.kunjungan.length === 0) {
        toast.info("Tidak ada baris pada filter aktif.");
        return;
      }
      unduhCSV(r.kunjungan);
      toast.sukses(
        r.total > r.kunjungan.length
          ? `Ekspor ${r.kunjungan.length} baris pertama dari ${r.total} baris filter aktif.`
          : `Ekspor berhasil — ${r.kunjungan.length} baris sesuai filter aktif.`,
      );
    } catch (err) {
      toast.gagal(pesanApi(err));
    } finally {
      setProsesEkspor(false);
    }
  }

  function resetFilter() {
    setRentang("hari");
    setQInput("");
    setQ("");
    setHal(1);
  }

  const adaFilter = rentang !== "hari" || q !== "";

  return (
    <main className="min-w-0 space-y-6 pb-8">
      {/* Kepala halaman — judul sudah tampil di header AppShell. */}
      <KepalaHalaman
        remah={
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Check-in langsung
          </span>
        }
        deskripsi="Buku kunjungan dan presensi: log pengunjung perpustakaan — satu anggota tercatat sekali per hari lengkap dengan waktu check-in (WIB)."
        aksi={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setGalatModal("");
                setModal(true);
              }}
            >
              Catat Kunjungan
            </button>

            {bolehEkspor && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void eksporCSV()}
                disabled={prosesEkspor || memuat}
              >
                {prosesEkspor ? "Menyiapkan…" : "Ekspor CSV"}
              </button>
            )}
          </>
        }
      />

      {!bolehEkspor && (
        <p className="text-xs text-[var(--muted)]">
          Ekspor dinonaktifkan oleh kebijakan akses (izin laporan.ekspor).
        </p>
      )}

      {sedangGalat && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center"
        >
          <span>{sedangGalat}</span>
          <button
            type="button"
            className="shrink-0 font-semibold underline"
            onClick={() => setSegar((s) => s + 1)}
          >
            Coba muat ulang
          </button>
        </div>
      )}

      {/* STATISTIK — hanya dihitung bila respons tersedia (hindari angka dari data kosong). */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kunjungan Hari Ini"
          value={respon ? respon.hariIni : "—"}
          sub="check-in hari ini (WIB)"
          tone="brand"
          ikon="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"
        />
        <StatCard
          label="Total Kunjungan"
          value={respon ? respon.total : "—"}
          sub={`rentang ${tanggalPanjang(dari)} – ${tanggalPanjang(sampai)}`}
          tone="sky"
          ikon="M3 12h4l3 8 4-16 3 8h4"
        />
        <StatCard
          label="Anggota Unik"
          value={respon ? respon.pengunjungUnik : "—"}
          sub="kartu berbeda pada rentang ini"
          tone="amber"
          ikon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        />
        <StatCard
          label="Hari Terpadat"
          value={puncak.jumlah === 0 ? "—" : puncak.jumlah}
          sub={
            puncak.tanggal
              ? `kunjungan pada ${tanggalPanjang(puncak.tanggal)}`
              : "belum ada kunjungan pada rentang ini"
          }
          tone="rose"
          ikon="M3 3v18h18M7 15l4-5 4 3 5-7"
        />
      </section>

      {/* FILTER */}
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="label">Rentang tanggal</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {RENTANG.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRentang(r.id);
                    setHal(1);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    rentang === r.id
                      ? "bg-[var(--brand)] text-white shadow-[var(--sh-1)]"
                      : "border border-[var(--border)] bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label className="label" htmlFor="kunjungan-cari">
                Cari nomor / nama anggota
              </label>
              <div className="mt-1 flex overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-sm">
                <span
                  className="shrink-0 border-r border-[var(--border)] bg-slate-50 text-[var(--muted)]"
                  aria-hidden
                >
                  <span className="block px-3 py-2.5">
                    {ikon(IKON_CARI, 15)}
                  </span>
                </span>
                <input
                  id="kunjungan-cari"
                  className="input min-w-0 border-0 p-2.5 pl-2"
                  placeholder="Nomor anggota / nama…"
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={resetFilter}
              disabled={!adaFilter && hal === 1}
            >
              Atur ulang filter
            </button>
          </div>
        </div>

        {respon?.terpotong && (
          <p className="mt-3 text-xs text-amber-600">
            Jumlah unik &amp; rekap harian dihitung dari 5.000 kunjungan
            terakhir pada rentang ini — persempit rentang tanggal untuk angka
            yang lebih teliti.
          </p>
        )}
      </section>

      {/* TABEL */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="font-bold">Daftar Presensi Kunjungan</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {memuat
                ? "Memuat…"
                : sedangGalat
                  ? "Gagal memuat data kunjungan."
                  : `${respon?.total ?? 0} baris${
                      q ? ` untuk pencarian “${q}”` : ""
                    } · halaman ${respon?.hal ?? 1} dari ${
                      respon?.halTerakhir ?? 1
                    }`}
            </p>
          </div>
        </div>

        {sedangGalat ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-500">
              {ikon("M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", 22)}
            </div>
            <h4 className="font-semibold">Data kunjungan gagal dimuat</h4>
            <p className="mt-1 text-sm text-[var(--muted)]">{sedangGalat}</p>
            <button
              type="button"
              className="btn btn-ghost mt-4"
              onClick={() => setSegar((s) => s + 1)}
            >
              Coba muat ulang
            </button>
          </div>
        ) : memuat ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand)]" />
            Memuat data presensi…
          </div>
        ) : respon!.kunjungan.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-[var(--muted)]">
              {ikon("M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35", 22)}
            </div>
            <h4 className="font-semibold">Belum ada kunjungan tercatat</h4>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ubah rentang tanggal, periksa kata kunci, atau catat kunjungan
              baru.
            </p>
            <button
              type="button"
              className="btn btn-ghost mt-4"
              onClick={resetFilter}
            >
              Atur ulang filter
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-14">No.</th>
                    <th>Pengunjung</th>
                    <th>Kategori</th>
                    <th>Tanggal Kunjungan</th>
                    <th>Waktu Masuk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {respon!.kunjungan.map((b, i) => {
                    const hariIni = b.tanggal === tanggalOffset(0);
                    return (
                      <tr key={b.id}>
                        <td className="text-[var(--muted)]">
                          {(respon!.hal - 1) * respon!.per + i + 1}
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <span
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white ${
                                i % 2 === 0 ? "grad-brand" : "bg-emerald-600"
                              }`}
                              aria-hidden
                            >
                              {inisial(b.nama)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium text-slate-900">
                                {b.nama}
                              </span>
                              <span className="block font-mono text-xs text-[var(--muted)]">
                                {b.nomorAnggota}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge tone="sky">
                            {b.kategori || "Umum"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          {tanggalPanjang(b.tanggal)}
                        </td>
                        <td className="whitespace-nowrap">
                          {jamWIB(b.waktuMasuk)}{" "}
                          <span className="text-xs text-[var(--muted)]">
                            WIB
                          </span>
                        </td>
                        <td>
                          <Badge tone={hariIni ? "green" : "slate"}>
                            {hariIni ? "Hari Ini" : "Riwayat"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
              <span className="text-xs text-[var(--muted)]">
                Menampilkan {respon!.kunjungan.length} dari{" "}
                {respon!.total} baris
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={respon!.hal <= 1}
                  onClick={() => setHal((h) => Math.max(1, h - 1))}
                >
                  Sebelumnya
                </button>
                <span className="text-xs text-[var(--muted)]">
                  Hal. {respon!.hal} / {respon!.halTerakhir}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={respon!.hal >= respon!.halTerakhir}
                  onClick={() => setHal((h) => h + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* MODAL CHECK-IN */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Catat Kunjungan Baru"
      >
        <form onSubmit={catatKunjungan}>
          <label className="label" htmlFor="nomor-anggota">
            Nomor Anggota
          </label>
          <input
            id="nomor-anggota"
            className="input mt-1"
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            autoFocus
            required
            autoComplete="off"
            placeholder="Contoh: AGT-0001"
          />

          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Nomor harus terdaftar dan masih aktif. Sistem menolak nomor yang
            tidak dikenal, dan satu anggota hanya tercatat sekali per hari.
          </p>

          {galatModal && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {galatModal}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModal(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={proses}
            >
              {proses ? "Menyimpan…" : "Catat Kunjungan"}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
