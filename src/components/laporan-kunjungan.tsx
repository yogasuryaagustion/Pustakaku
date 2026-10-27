"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { useToast } from "@/components/toast";
import { Badge, EmptyState, StatCard, tanggalPanjang } from "@/components/ui";
import { unduhXlsx, type LembarXlsx } from "@/lib/xlsx";
import { cetakHTML, eskapHTML } from "@/lib/cetak";

// === Laporan Kunjungan ======================================================
// Isi tab "Laporan Kunjungan" di halaman /laporan (panel admin).
//
// Semua angka dibaca dari Supabase lewat GET /api/kunjungan (izin
// laporan.lihat, RLS `kunjungan_lihat` is_admin) — tanpa data dummy dan tanpa
// localStorage. Metriknya sengaja terpisah:
//   * Total Kunjungan = jumlah baris check-in pada rentang + pencarian;
//   * Anggota Unik    = jumlah kartu berbeda (bukan total kunjungan);
//   * Hari Ini        = check-in hari ini menurut zona Asia/Jakarta.
// Filter tanggal memakai tanggal_kunjungan yang sudah dihitung di zona
// Asia/Jakarta oleh database (migrasi 0009), sehingga pergantian hari di
// grafik/harian-bulanan konsisten dengan kios.

const PER_PAGE = 20;

interface BarisKunjungan {
  id: string;
  anggotaId: string;
  nama: string;
  nomorAnggota: string;
  tanggal: string;
  waktuMasuk: string;
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
  return new Date(Date.now() + hari * 86_400_000).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Jakarta",
  });
}

function jamWIB(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function pesanApi(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
    return (e as Error).message;
  }
  return "Permintaan gagal diproses.";
}

type ModeGrafik = "harian" | "bulanan";

export function LaporanKunjungan() {
  const toast = useToast();
  const sistem = useSistem();
  const bolehEkspor = useBoleh("laporan.ekspor");

  const [dari, setDari] = useState(() => tanggalOffset(-13));
  const [sampai, setSampai] = useState(() => tanggalOffset(0));
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [hal, setHal] = useState(1);
  const [urut, setUrut] = useState<"waktu" | "tanggal">("waktu");
  const [turun, setTurun] = useState(true);
  const [modeGrafik, setModeGrafik] = useState<ModeGrafik>("harian");
  const [prosesEkspor, setProsesEkspor] = useState(false);

  // Kunci permintaan — dipakai agar "sedang memuat" bisa diturunkan dari
  // perbandingan data↔kunci (tanpa setState sinkron di dalam effect).
  const kunci = useMemo(() => {
    const p = new URLSearchParams({
      dari,
      sampai,
      hal: String(hal),
      per: String(PER_PAGE),
      urut,
      arah: turun ? "turun" : "naik",
    });
    if (q) p.set("q", q);
    return p.toString();
  }, [dari, sampai, hal, urut, turun, q]);

  const [simpanan, setSimpanan] = useState<{ kunci: string; respon: ResponRekap } | null>(null);
  const [galat, setGalat] = useState<{ kunci: string; pesan: string } | null>(null);

  useEffect(() => {
    let batal = false;
    apiFetch<ResponRekap>(`/api/kunjungan?${kunci}`)
      .then((r) => {
        if (!batal) setSimpanan({ kunci, respon: r });
      })
      .catch((e) => {
        if (!batal) setGalat({ kunci, pesan: pesanApi(e) });
      });
    return () => {
      batal = true;
    };
  }, [kunci]);

  // Pencarian diberi jeda agar tidak memanggil server tiap ketikan.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput.trim());
      setHal(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const respon = simpanan && simpanan.kunci === kunci ? simpanan.respon : null;
  const sedangGalat = galat?.kunci === kunci ? galat.pesan : null;
  const memuat = !respon && !sedangGalat;

  const perHari = useMemo(() => respon?.ringkasan ?? [], [respon]);
  const perBulan = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of perHari) m.set(h.tanggal.slice(0, 7), (m.get(h.tanggal.slice(0, 7)) ?? 0) + h.jumlah);
    return Array.from(m.entries())
      .map(([bulan, jumlah]) => ({ bulan, jumlah }))
      .sort((a, b) => (a.bulan < b.bulan ? 1 : -1));
  }, [perHari]);
  const seri = useMemo(
    () =>
      modeGrafik === "harian"
        ? perHari.map((h) => ({ label: h.tanggal, jumlah: h.jumlah }))
        : perBulan.map((b) => ({ label: b.bulan, jumlah: b.jumlah })),
    [modeGrafik, perHari, perBulan]
  );
  const maks = Math.max(1, ...seri.map((s) => s.jumlah));

  function terapkanRentang(baruDari: string, baruSampai: string) {
    setDari(baruDari);
    setSampai(baruSampai);
    setHal(1);
  }

  async function muatUntukEkspor(): Promise<ResponRekap> {
    const p = new URLSearchParams({
      dari,
      sampai,
      urut,
      arah: turun ? "turun" : "naik",
      semua: "true",
    });
    if (q) p.set("q", q);
    return apiFetch<ResponRekap>(`/api/kunjungan?${p.toString()}`);
  }

  async function unduhExcel() {
    setProsesEkspor(true);
    try {
      const r = await muatUntukEkspor();
      const lembar: LembarXlsx[] = [
        {
          nama: "Kunjungan",
          baris: [
            [sistem.nama],
            ["Laporan Kunjungan"],
            ["Periode", `${r.dari} s.d. ${r.sampai}`],
            ["Pencarian", r.q || "-"],
            ["Total Kunjungan", r.total],
            ["Anggota Unik", r.pengunjungUnik],
            ["Dicetak Pada", new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })],
            [],
            ["No.", "Tanggal Kunjungan", "Waktu Masuk", "No. Anggota", "Nama Anggota"],
            ...r.kunjungan.map((b, i) => [
              i + 1,
              b.tanggal,
              jamWIB(b.waktuMasuk),
              b.nomorAnggota,
              b.nama,
            ]),
          ],
        },
      ];
      unduhXlsx(`laporan-kunjungan-${r.dari}-${r.sampai}`, lembar);
      toast.sukses(`Ekspor berhasil — ${r.kunjungan.length} baris sesuai filter aktif.`);
    } catch (e) {
      toast.gagal(`Ekspor gagal: ${pesanApi(e)}`);
    } finally {
      setProsesEkspor(false);
    }
  }

  async function cetakPdf() {
    setProsesEkspor(true);
    try {
      const r = await muatUntukEkspor();
      const baris = r.kunjungan
        .map(
          (b, i) =>
            `<tr><td>${i + 1}</td><td>${eskapHTML(tanggalPanjang(b.tanggal))}</td>` +
            `<td>${jamWIB(b.waktuMasuk)}</td><td>${eskapHTML(b.nomorAnggota)}</td>` +
            `<td>${eskapHTML(b.nama)}</td></tr>`
        )
        .join("");
      const html =
        `<h1>Laporan Kunjungan</h1>` +
        `<div class="meta">${eskapHTML(sistem.nama)}<br/>` +
        `Periode: ${r.dari} s.d. ${r.sampai} · Pencarian: ${eskapHTML(r.q || "-")}<br/>` +
        `Total kunjungan: ${r.total} · Anggota unik: ${r.pengunjungUnik} · Hari ini: ${r.hariIni}<br/>` +
        `Dicetak pada: ${new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</div>` +
        `<table><thead><tr><th>No.</th><th>Tanggal</th><th>Waktu</th><th>No. Anggota</th><th>Nama</th></tr></thead>` +
        `<tbody>${baris || `<tr><td colspan="5">Tidak ada data pada filter ini.</td></tr>`}</tbody></table>`;
      cetakHTML(html, "Laporan Kunjungan");
      toast.info("Dialog cetak dibuka — pilih “Simpan sebagai PDF”.");
    } catch (e) {
      toast.gagal(`Cetak gagal: ${pesanApi(e)}`);
    } finally {
      setProsesEkspor(false);
    }
  }

  const nomorBaris = (i: number) => (respon ? (respon.hal - 1) * respon.per + i + 1 : i + 1);

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Kunjungan"
          value={respon?.total ?? 0}
          sub={`${dari} s.d. ${sampai}`}
          tone="brand"
        />
        <StatCard
          label="Anggota Unik"
          value={respon?.pengunjungUnik ?? 0}
          sub="kartu berbeda (bukan total kunjungan)"
          tone="sky"
        />
        <StatCard
          label="Kunjungan Hari Ini"
          value={respon?.hariIni ?? 0}
          sub="zona Asia/Jakarta"
          tone="amber"
        />
        <StatCard
          label="Hari Terdata"
          value={perHari.length}
          sub={modeGrafik === "harian" ? "pada rentang ini" : `${perBulan.length} bulan`}
          tone="rose"
        />
      </div>

      {/* Filter tanggal + pencarian */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => terapkanRentang(tanggalOffset(0), tanggalOffset(0))}>
              Hari ini
            </button>
            <button className="btn btn-ghost" onClick={() => terapkanRentang(tanggalOffset(-6), tanggalOffset(0))}>
              7 hari
            </button>
            <button className="btn btn-ghost" onClick={() => terapkanRentang(tanggalOffset(-13), tanggalOffset(0))}>
              14 hari
            </button>
            <button className="btn btn-ghost" onClick={() => terapkanRentang(tanggalOffset(-29), tanggalOffset(0))}>
              30 hari
            </button>
          </div>
          <div className="flex flex-1 flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="kunjungan-dari">Dari</label>
              <input
                id="kunjungan-dari"
                type="date"
                className="input"
                value={dari}
                max={sampai}
                onChange={(e) => {
                  setDari(e.target.value || tanggalOffset(-13));
                  setHal(1);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="kunjungan-sampai">Sampai</label>
              <input
                id="kunjungan-sampai"
                type="date"
                className="input"
                value={sampai}
                min={dari}
                onChange={(e) => {
                  setSampai(e.target.value || tanggalOffset(0));
                  setHal(1);
                }}
              />
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="label" htmlFor="kunjungan-cari">Cari nomor / nama anggota</label>
              <input
                id="kunjungan-cari"
                className="input"
                placeholder="AGT-0001 atau Budi…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="kunjungan-urut">Urutkan</label>
              <select
                id="kunjungan-urut"
                className="input"
                value={`${urut}:${turun ? "turun" : "naik"}`}
                onChange={(e) => {
                  const [u, a] = e.target.value.split(":");
                  setUrut(u === "tanggal" ? "tanggal" : "waktu");
                  setTurun(a !== "naik");
                  setHal(1);
                }}
              >
                <option value="waktu:turun">Waktu masuk — terbaru</option>
                <option value="waktu:naik">Waktu masuk — terlama</option>
                <option value="tanggal:turun">Tanggal — terbaru</option>
                <option value="tanggal:naik">Tanggal — terlama</option>
              </select>
            </div>
            {bolehEkspor && (
              <div className="flex gap-2">
                <button className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => void unduhExcel()} disabled={prosesEkspor || !respon}>
                  {prosesEkspor ? "Menyiapkan…" : "Ekspor Excel"}
                </button>
                <button className="btn bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={() => void cetakPdf()} disabled={prosesEkspor || !respon}>
                  Cetak PDF
                </button>
              </div>
            )}
          </div>
        </div>
        {!bolehEkspor && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Ekspor dinonaktifkan oleh kebijakan akses (izin laporan.ekspor).
          </p>
        )}
        {respon?.terpotong && (
          <p className="mt-3 text-xs text-amber-600">
            Grafik dihitung dari 5.000 kunjungan terakhir pada rentang ini — persempit rentang
            tanggal untuk angka yang lebih teliti.
          </p>
        )}
      </div>

      {/* Grafik */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Statistik Kunjungan</h3>
            <p className="text-xs text-[var(--muted)]">
              Sumber data yang sama dengan tabel riwayat — angka mengikuti filter di atas.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["harian", "bulanan"] as ModeGrafik[]).map((m) => (
              <button
                key={m}
                onClick={() => setModeGrafik(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  modeGrafik === m ? "bg-white text-[var(--brand)] shadow-sm" : "text-slate-600"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {seri.length === 0 ? (
          <div className="mt-4">
            <EmptyState pesan="Belum ada kunjungan pada rentang ini" sub="Ubah rentang tanggal atau kata kunci pencarian." />
          </div>
        ) : (
          <ul className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {seri.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-xs text-[var(--muted)]">
                  {modeGrafik === "harian" ? tanggalPanjang(s.label) : s.label}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.round((s.jumlah / maks) * 100)}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right font-semibold">{s.jumlah}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tabel riwayat */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="font-bold">Riwayat Kunjungan</h3>
            <p className="text-xs text-[var(--muted)]">
              {memuat
                ? "Memuat…"
                : sedangGalat
                  ? "Gagal memuat data."
                  : `${respon?.total ?? 0} baris${q ? ` untuk pencarian “${q}”` : ""} · halaman ${respon?.hal ?? 1} dari ${respon?.halTerakhir ?? 1}`}
            </p>
          </div>
          {(q || respon?.hal !== 1) && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setQInput("");
                setQ("");
                setHal(1);
              }}
            >
              Atur ulang filter
            </button>
          )}
        </div>

        {sedangGalat ? (
          <div className="p-5">
            <EmptyState pesan="Data kunjungan gagal dimuat" sub={sedangGalat} />
          </div>
        ) : memuat ? (
          <div className="p-5 text-sm text-[var(--muted)]">Memuat riwayat kunjungan…</div>
        ) : (respon?.kunjungan.length ?? 0) === 0 ? (
          <div className="p-5">
            <EmptyState
              pesan="Tidak ada kunjungan yang cocok"
              sub="Periksa rentang tanggal, kata kunci, atau tunggu check-in berikutnya di kios."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-14">No.</th>
                    <th>Tanggal Kunjungan</th>
                    <th>Waktu Masuk</th>
                    <th>No. Anggota</th>
                    <th>Nama Anggota</th>
                  </tr>
                </thead>
                <tbody>
                  {respon!.kunjungan.map((b, i) => (
                    <tr key={b.id}>
                      <td className="text-[var(--muted)]">{nomorBaris(i)}</td>
                      <td className="whitespace-nowrap">{tanggalPanjang(b.tanggal)}</td>
                      <td className="whitespace-nowrap">
                        {jamWIB(b.waktuMasuk)} <span className="text-xs text-[var(--muted)]">WIB</span>
                      </td>
                      <td className="font-mono text-sm">{b.nomorAnggota}</td>
                      <td className="font-medium">{b.nama}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
              <span className="text-xs text-[var(--muted)]">
                Menampilkan {respon!.kunjungan.length} dari {respon!.total} baris
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost"
                  disabled={(respon!.hal ?? 1) <= 1}
                  onClick={() => setHal((h) => Math.max(1, h - 1))}
                >
                  Sebelumnya
                </button>
                <Badge tone="sky">
                  Halaman {respon!.hal} / {respon!.halTerakhir}
                </Badge>
                <button
                  className="btn btn-ghost"
                  disabled={(respon!.hal ?? 1) >= (respon!.halTerakhir ?? 1)}
                  onClick={() => setHal((h) => h + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}