"use client";

import { useMemo, useState } from "react";
import { useLibrary, useHelper, hariTerlambat } from "@/lib/library-context";
import { useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { StatCard, Badge, EmptyState, rupiah, tanggalPanjang } from "@/components/ui";
import { unduhXlsx, type LembarXlsx, type SelXlsx } from "@/lib/xlsx";
import { cetakHTML, eskapHTML } from "@/lib/cetak";
import { LaporanKunjungan } from "@/components/laporan-kunjungan";

// Statistik di atas selalu bulanan — mengikuti "Laporan Sirkulasi Peminjaman
// Bulanan" pada generator laporan di bawah.
type JenisPeriode = "bulan";

const LABEL_PERIODE: Record<JenisPeriode, string> = {
  bulan: "Bulanan",
};

// Jenis laporan pada generator: sirkulasi bulanan, denda & keuangan,
// atau inventaris katalog terkini.
type JenisLaporan = "sirkulasi" | "denda" | "inventaris";

const LABEL_LAPORAN: Record<JenisLaporan, string> = {
  sirkulasi: "Laporan Sirkulasi Peminjaman Bulanan",
  denda: "Laporan Denda & Keuangan",
  inventaris: "Laporan Inventaris Katalog Terkini",
};

/** Isi siap cetak/ekspor: ringkasan label–nilai + beberapa tabel. */
interface BagianLaporan {
  judul: string;
  kolom: string[];
  baris: (string | number)[][];
}
interface IsiLaporan {
  ringkas: [string, string | number][];
  bagian: BagianLaporan[];
}

function fmtID(iso: string, opt: Intl.DateTimeFormatOptions) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", opt);
}

// Tab pada halaman Laporan. "Semua Laporan" mempertahankan seluruh isi lama
// (ringkasan, generator, kategori, tunggungan) persis seperti sebelumnya.
type TabLaporan = "semua" | "buku" | "peminjaman" | "kunjungan";

const TAB_LAPORAN: { id: TabLaporan; label: string }[] = [
  { id: "semua", label: "Semua Laporan" },
  { id: "buku", label: "Laporan Buku" },
  { id: "peminjaman", label: "Laporan Peminjaman" },
  { id: "kunjungan", label: "Laporan Kunjungan" },
];

export default function LaporanPage() {
  const { buku, anggota, peminjaman, siap } = useLibrary();
  const { cariBuku, cariAnggota, jumlahDipinjam, stokTersedia } = useHelper();
  const sistem = useSistem();
  // Ekspor CSV butuh izin laporan.ekspor — bisa dicabut di Kontrol Akses.
  const bolehEkspor = useBoleh("laporan.ekspor");

  // Semua tanggal aktivitas dari data (pinjam & kembali aktual), untuk membangun pilihan periode.
  const semuaTanggal = useMemo(() => {
    const set = new Set<string>();
    peminjaman.forEach((p) => {
      if (p.tanggalPinjam) set.add(p.tanggalPinjam);
      if (p.tanggalKembaliAktual) set.add(p.tanggalKembaliAktual);
    });
    return Array.from(set).sort().reverse();
  }, [peminjaman]);

  const jenisPeriode: JenisPeriode = "bulan";
  const [tab, setTab] = useState<TabLaporan>("semua");
  const [jenisPilihan, setJenisLaporan] = useState<JenisLaporan>("sirkulasi");
  // Jenis efektif mengikuti tab: tab Buku terkunci pada inventaris, tab
  // Peminjaman hanya sirkulasi/denda — pilihan lama tidak hilang.
  const jenisLaporan: JenisLaporan =
    tab === "buku"
      ? "inventaris"
      : tab === "peminjaman" && jenisPilihan === "inventaris"
        ? "sirkulasi"
        : jenisPilihan;
  // Tanggal acuan periode (default: hari terakhir yang punya data).
  const [tanggalAcuan, setTanggalAcuan] = useState(semuaTanggal[0] ?? new Date().toISOString().slice(0, 10));

  // Rentang tanggal [mulai, akhir] — periode bulanan mengikuti tanggal acuan.
  // Memakai format tanggal lokal (bukan toISOString) agar tidak bergeser satu
  // hari untuk zona waktu positif (UTC+7 s.d. UTC+9).
  const rentang = useMemo(() => {
    const acuan = new Date(tanggalAcuan + "T00:00:00");
    if (Number.isNaN(acuan.getTime())) return null;
    const mulai = new Date(acuan.getFullYear(), acuan.getMonth(), 1);
    const akhir = new Date(acuan.getFullYear(), acuan.getMonth() + 1, 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { mulai: iso(mulai), akhir: iso(akhir) };
  }, [tanggalAcuan]);

  const labelPeriode = useMemo(
    () => (rentang ? fmtID(rentang.mulai, { month: "long", year: "numeric" }) : "-"),
    [rentang]
  );

  // Semua aktivitas pengunjung dalam periode terpilih: peminjaman, pengembalian, keterlambatan, denda.
  const aktivitasPeriode = useMemo(() => {
    if (!rentang) return [];
    const diR = (iso?: string | null) => !!iso && iso >= rentang.mulai && iso <= rentang.akhir;
    return peminjaman.filter((p) => diR(p.tanggalPinjam) || diR(p.tanggalKembaliAktual));
  }, [peminjaman, rentang]);

  const ringkasanPeriode = useMemo(() => {
    const diR = (iso?: string | null) => !!iso && !!rentang && iso >= rentang.mulai && iso <= rentang.akhir;
    const dipinjam = aktivitasPeriode.filter((p) => diR(p.tanggalPinjam));
    const dikembalikan = aktivitasPeriode.filter((p) => diR(p.tanggalKembaliAktual));
    const terlambat = dikembalikan.filter((p) => p.denda > 0);
    const denda = dikembalikan.reduce((s, p) => s + p.denda, 0);
    const pengunjungUnik = new Set(aktivitasPeriode.map((p) => p.anggotaId)).size;
    return {
      dipinjam: dipinjam.length,
      dikembalikan: dikembalikan.length,
      terlambat: terlambat.length,
      denda,
      pengunjungUnik,
    };
  }, [aktivitasPeriode, rentang]);

  // Agregasi per pengunjung dalam periode terpilih — dipakai untuk export CSV
  // agar tiap anggota punya baris ringkas sendiri (peminjaman, telat, denda).
  const perPengunjung = useMemo(() => {
    const grup = new Map<
      string,
      { anggotaId: string; pinjam: number; kembali: number; telat: number; denda: number }
    >();
    for (const p of aktivitasPeriode) {
      const g = grup.get(p.anggotaId) ?? {
        anggotaId: p.anggotaId,
        pinjam: 0,
        kembali: 0,
        telat: 0,
        denda: 0,
      };
      const diR = (iso?: string | null) => !!iso && !!rentang && iso >= rentang.mulai && iso <= rentang.akhir;
      if (diR(p.tanggalPinjam)) g.pinjam += 1;
      if (diR(p.tanggalKembaliAktual)) {
        g.kembali += 1;
        if (p.denda > 0) g.telat += 1;
        g.denda += p.denda;
      }
      grup.set(p.anggotaId, g);
    }
    return Array.from(grup.values()).sort((a, b) => b.pinjam - a.pinjam || b.denda - a.denda);
  }, [aktivitasPeriode, rentang]);

  // Riwayat denda yang jatuh dalam periode terpilih (sudah dicatat saat
  // pengembalian) — bahan "Laporan Denda & Keuangan".
  const dendaPeriode = useMemo(() => {
    if (!rentang) return [];
    return peminjaman.filter(
      (p) =>
        p.denda > 0 &&
        p.tanggalKembaliAktual &&
        p.tanggalKembaliAktual >= rentang.mulai &&
        p.tanggalKembaliAktual <= rentang.akhir
    );
  }, [peminjaman, rentang]);

  const ringkasan = useMemo(() => {
    const totalPeminjaman = peminjaman.length;
    const masihDipinjam = peminjaman.filter((p) => p.status === "Dipinjam").length;
    const terlambat = peminjaman.filter(
      (p) => p.status === "Dipinjam" && hariTerlambat(p.tanggalKembali) > 0
    );
    const sudahKembali = peminjaman.filter((p) => p.status !== "Dipinjam");
    const dendaTerkumpul = peminjaman.reduce((s, p) => s + p.denda, 0);
    const dendaPotensi = terlambat.reduce(
      (s, p) => s + hariTerlambat(p.tanggalKembali) * sistem.dendaPerHari,
      0
    );
    const rataRata =
      sudahKembali.length === 0
        ? 0
        : sudahKembali.reduce((s, p) => {
            const d1 = new Date(p.tanggalPinjam).getTime();
            const d2 = new Date(p.tanggalKembaliAktual ?? p.tanggalKembali).getTime();
            return s + Math.max(0, (d2 - d1) / 86400000);
          }, 0) / sudahKembali.length;

    return {
      totalPeminjaman,
      masihDipinjam,
      terlambat,
      sudahKembali,
      dendaTerkumpul,
      dendaPotensi,
      rataRata: Math.round(rataRata),
    };
  }, [peminjaman, sistem]);

  // Statistik per kategori
  const perKategori = useMemo(() => {
    const map: Record<string, { judul: number; eksemplar: number }> = {};
    buku.forEach((b) => {
      if (!map[b.kategori]) map[b.kategori] = { judul: 0, eksemplar: 0 };
      map[b.kategori].judul += 1;
      map[b.kategori].eksemplar += b.stok;
    });
    return Object.entries(map)
      .map(([kategori, v]) => ({ kategori, ...v }))
      .sort((a, b) => b.eksemplar - a.eksemplar);
  }, [buku]);

  const maxEksemplar = Math.max(1, ...perKategori.map((k) => k.eksemplar));

  // Buku populer
  const populer = useMemo(() => {
    const hitung: Record<string, number> = {};
    peminjaman.forEach((p) => {
      hitung[p.bukuId] = (hitung[p.bukuId] || 0) + 1;
    });
    return Object.entries(hitung)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, n]) => ({ buku: cariBuku(id), n }))
      .filter((x) => x.buku);
  }, [peminjaman, cariBuku]);

  if (!siap) return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;

  // Bangun isi laporan sesuai jenis terpilih — dipakai bersama oleh ekspor
  // Excel dan cetak PDF agar keduanya selalu identik isinya.
  function siapkanLaporan(): IsiLaporan {
    const meta: [string, string | number][] = [
      ["Perpustakaan", sistem.nama],
      ["Jenis Laporan", LABEL_LAPORAN[jenisLaporan]],
    ];
    if (rentang && jenisLaporan !== "inventaris") {
      meta.push(
        ["Periode", labelPeriode],
        ["Rentang Tanggal", `${rentang.mulai} s.d. ${rentang.akhir}`]
      );
    }
    meta.push(
      ["Dicetak Pada", new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })]
    );

    if (jenisLaporan === "inventaris") {
      const kolom = ["Judul", "Penulis", "Penerbit", "Tahun", "ISBN", "Kategori", "Rak", "Stok", "Dipinjam", "Tersedia"];
      const baris = buku
        .slice()
        .sort((a, b) => a.judul.localeCompare(b.judul, "id"))
        .map((b) => [
          b.judul,
          b.penulis,
          b.penerbit,
          b.tahun,
          b.isbn,
          b.kategori,
          b.rak,
          b.stok,
          jumlahDipinjam(b.id),
          stokTersedia(b.id),
        ]);
      return {
        ringkas: [
          ...meta,
          ["Total Judul", buku.length],
          ["Total Eksemplar", buku.reduce((s, b) => s + b.stok, 0)],
          ["Sedang Dipinjam", buku.reduce((s, b) => s + jumlahDipinjam(b.id), 0)],
          ["Kategori", perKategori.length],
        ],
        bagian: [{ judul: "Inventaris Katalog Terkini", kolom, baris }],
      };
    }

    if (jenisLaporan === "denda") {
      const telatHari = (p: (typeof peminjaman)[number]) =>
        p.tanggalKembaliAktual
          ? Math.max(
              0,
              Math.round(
                (new Date(p.tanggalKembaliAktual).getTime() -
                  new Date(p.tanggalKembali).getTime()) /
                  86400000
              )
            )
          : hariTerlambat(p.tanggalKembali);
      const kolom = ["Kode", "Anggota", "No. Anggota", "Buku", "Jatuh Tempo", "Kembali Aktual", "Telat (hari)", "Denda"];
      const barisRiwayat = dendaPeriode
        .slice()
        .sort((a, b) => (a.tanggalKembaliAktual ?? "").localeCompare(b.tanggalKembaliAktual ?? ""))
        .map((p) => [
          p.kodePinjam,
          cariAnggota(p.anggotaId)?.nama ?? "-",
          cariAnggota(p.anggotaId)?.nomorAnggota ?? "-",
          cariBuku(p.bukuId)?.judul ?? "-",
          p.tanggalKembali,
          p.tanggalKembaliAktual ?? "-",
          telatHari(p),
          p.denda,
        ]);
      const barisTunggakan = ringkasan.terlambat.map((p) => [
        p.kodePinjam,
        cariAnggota(p.anggotaId)?.nama ?? "-",
        cariAnggota(p.anggotaId)?.nomorAnggota ?? "-",
        cariBuku(p.bukuId)?.judul ?? "-",
        p.tanggalKembali,
        "-",
        hariTerlambat(p.tanggalKembali),
        hariTerlambat(p.tanggalKembali) * sistem.dendaPerHari,
      ]);
      return {
        ringkas: [
          ...meta,
          ["Tarif Denda per Hari", sistem.dendaPerHari],
          ["Denda Terkumpul (Periode)", ringkasanPeriode.denda],
          ["Denda Terkumpul (Semua Waktu)", ringkasan.dendaTerkumpul],
          ["Potensi Denda Berjalan", ringkasan.dendaPotensi],
        ],
        bagian: [
          { judul: `Denda Terkumpul — ${labelPeriode}`, kolom, baris: barisRiwayat },
          { judul: "Tunggakan Belum Dibayar", kolom, baris: barisTunggakan },
        ],
      };
    }

    // Default: sirkulasi peminjaman bulanan.
    const kolomDetail = [
      "Kode",
      "Anggota",
      "No. Anggota",
      "Email",
      "Telepon",
      "Jenis",
      "Buku",
      "Kategori",
      "Tgl Pinjam",
      "Tgl Kembali Target",
      "Tgl Kembali Aktual",
      "Status",
      "Telat (hari)",
      "Denda",
    ];
    const detailBaris = aktivitasPeriode
      .slice()
      .sort((a, b) => (a.tanggalPinjam < b.tanggalPinjam ? 1 : -1))
      .map((p) => {
        const a = cariAnggota(p.anggotaId);
        const b = cariBuku(p.bukuId);
        const telat = p.tanggalKembaliAktual
          ? Math.max(
              0,
              Math.round(
                (new Date(p.tanggalKembaliAktual).getTime() -
                  new Date(p.tanggalKembali).getTime()) /
                  86400000
              )
            )
          : 0;
        return [
          p.kodePinjam,
          a?.nama ?? "-",
          a?.nomorAnggota ?? "-",
          a?.email ?? "-",
          a?.telepon ?? "-",
          a?.jenis ?? "-",
          b?.judul ?? "-",
          b?.kategori ?? "-",
          p.tanggalPinjam,
          p.tanggalKembali,
          p.tanggalKembaliAktual ?? "",
          p.status,
          telat,
          p.denda,
        ];
      });
    return {
      ringkas: [
        ...meta,
        ["Total Transaksi", aktivitasPeriode.length],
        ["Peminjaman", ringkasanPeriode.dipinjam],
        ["Pengembalian", ringkasanPeriode.dikembalikan],
        ["Pengunjung Unik", ringkasanPeriode.pengunjungUnik],
        ["Keterlambatan", ringkasanPeriode.terlambat],
        ["Total Denda", ringkasanPeriode.denda],
      ],
      bagian: [
        {
          judul: `Ringkasan Per Pengunjung — ${labelPeriode}`,
          kolom: ["No. Anggota", "Nama", "Email", "Telepon", "Jenis", "Peminjaman", "Pengembalian", "Keterlambatan", "Total Denda"],
          baris: perPengunjung.map((g) => {
            const a = cariAnggota(g.anggotaId);
            return [
              a?.nomorAnggota ?? "-",
              a?.nama ?? "-",
              a?.email ?? "-",
              a?.telepon ?? "-",
              a?.jenis ?? "-",
              g.pinjam,
              g.kembali,
              g.telat,
              g.denda,
            ];
          }),
        },
        { judul: `Detail Aktivitas Pengunjung — ${labelPeriode}`, kolom: kolomDetail, baris: detailBaris },
      ],
    };
  }

  function namaFileLaporan(): string {
    const tanggal = rentang ? rentang.mulai : new Date().toISOString().slice(0, 10);
    return `laporan-${jenisLaporan}-${tanggal}`;
  }

  // Ekspor Excel: lembar Ringkasan + satu lembar per tabel detail.
  function unduhExcel() {
    const isi = siapkanLaporan();
    const lembar: LembarXlsx[] = [
      {
        nama: "Ringkasan",
        baris: [
          [LABEL_LAPORAN[jenisLaporan]],
          [],
          ...isi.ringkas.map(([k, v]): SelXlsx[] => [k, v]),
        ],
      },
      ...isi.bagian.map((b) => ({
        // Nama sheet maks 31 karakter — dipangkas di pustaka xlsx.
        nama: b.judul,
        baris: [[...b.kolom] as SelXlsx[], ...b.baris.map((r) => [...r] as SelXlsx[])],
      })),
    ];
    unduhXlsx(`${namaFileLaporan()}.xlsx`, lembar);
  }

  // Cetak PDF: dialog print browser ("Simpan sebagai PDF") dengan gaya A4.
  function cetakPdf() {
    const isi = siapkanLaporan();
    const th = (kolom: string[]) =>
      `<tr>${kolom.map((k) => `<th>${eskapHTML(k)}</th>`).join("")}</tr>`;
    const td = (baris: (string | number)[][]) =>
      baris
        .map(
          (r) =>
            `<tr>${r.map((c) => `<td>${eskapHTML(String(c ?? ""))}</td>`).join("")}</tr>`
        )
        .join("");
    const html =
      `<h1>${eskapHTML(LABEL_LAPORAN[jenisLaporan])}</h1>` +
      `<table class="ringkas">${isi.ringkas
        .map(
          ([k, v]) =>
            `<tr><td>${eskapHTML(k)}</td><td>${eskapHTML(String(v))}</td></tr>`
        )
        .join("")}</table>` +
      isi.bagian
        .map(
          (b) =>
            `<h2>${eskapHTML(b.judul)}</h2>` +
            (b.baris.length
              ? `<table>${th(b.kolom)}${td(b.baris)}</table>`
              : `<p class="meta">Tidak ada data pada bagian ini.</p>`)
        )
        .join("") +
      `<div class="kaki">Dokumen dihasilkan otomatis oleh ${eskapHTML(sistem.nama)}.</div>`;
    cetakHTML(html, LABEL_LAPORAN[jenisLaporan]);
  }

  // Generator aktif saat minimal satu baris data tersedia untuk jenisnya.
  const generatorSiap =
    jenisLaporan === "sirkulasi"
      ? aktivitasPeriode.length > 0
      : jenisLaporan === "denda"
        ? dendaPeriode.length > 0 || ringkasan.terlambat.length > 0
        : buku.length > 0;

  return (
    <div className="space-y-6">
      {/* Tab laporan — mengikuti gaya kartu/sakelar PustakaKu. */}
      <div className="card p-1.5 flex flex-wrap gap-1.5">
        {TAB_LAPORAN.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Kartu ringkasan periode (harian/mingguan/bulanan/tahunan) */}
      {(tab === "semua" || tab === "peminjaman") && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`Peminjaman ${LABEL_PERIODE[jenisPeriode]}`} value={ringkasanPeriode.dipinjam} sub={labelPeriode} tone="brand" />
        <StatCard label="Pengembalian" value={ringkasanPeriode.dikembalikan} sub={`${ringkasanPeriode.pengunjungUnik} pengunjung`} tone="sky" />
        <StatCard label="Keterlambatan" value={ringkasanPeriode.terlambat} sub={LABEL_PERIODE[jenisPeriode].toLowerCase()} tone="rose" />
        <StatCard label="Denda Terkumpul" value={rupiah(ringkasanPeriode.denda)} sub={LABEL_PERIODE[jenisPeriode].toLowerCase()} tone="amber" />
      </div>
      )}

      {/* Kartu ringkasan total */}
      {(tab === "semua" || tab === "peminjaman") && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Peminjaman" value={ringkasan.totalPeminjaman} sub="semua waktu" tone="brand" />
        <StatCard label="Masih Dipinjam" value={ringkasan.masihDipinjam} sub={`${anggota.filter((a) => a.aktif).length} anggota aktif`} tone="sky" />
        <StatCard label="Tunggakan" value={ringkasan.terlambat.length} sub={rupiah(ringkasan.dendaPotensi)} tone="rose" />
        <StatCard label="Rata-rata Pinjam" value={`${ringkasan.rataRata} hr`} sub={`${ringkasan.sudahKembali.length} selesai`} tone="amber" />
      </div>
      )}

      {/* Laporan Kunjungan — check-in kios; sumber data sama dengan Statistik Kunjungan. */}
      {tab === "kunjungan" && <LaporanKunjungan />}

      {/* Generator laporan — pilih jenis, lalu unduh Excel atau cetak PDF */}
      {tab !== "kunjungan" && (
      <>
      <div className="card p-5">
        <div className="font-bold">Generator Laporan &amp; Cetak PDF/Excel</div>
        <div className="mt-4 flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 min-w-0">
            <label className="label" htmlFor="jenis-laporan">Pilih Jenis Laporan</label>
            <select
              id="jenis-laporan"
              className="input"
              value={jenisLaporan}
              onChange={(e) => setJenisLaporan(e.target.value as JenisLaporan)}
              disabled={tab === "buku"}
              title={tab === "buku" ? "Tab Laporan Buku selalu menampilkan inventaris katalog" : undefined}
            >
              <option value="sirkulasi">Laporan Sirkulasi Peminjaman Bulanan</option>
              <option value="denda">Laporan Denda &amp; Keuangan</option>
              {tab !== "peminjaman" && (
                <option value="inventaris">Laporan Inventaris Katalog Terkini</option>
              )}
            </select>
          </div>
          <div className="lg:w-60">
            <label className="label" htmlFor="periode-tanggal">Periode Tanggal</label>
            <input
              id="periode-tanggal"
              className="input"
              type="date"
              value={tanggalAcuan}
              onChange={(e) => setTanggalAcuan(e.target.value)}
              disabled={jenisLaporan === "inventaris"}
              title={jenisLaporan === "inventaris" ? "Inventaris selalu menampilkan kondisi terkini" : undefined}
            />
          </div>
          {bolehEkspor ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2"
                onClick={unduhExcel}
                disabled={!generatorSiap}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8M8 17h5" />
                </svg>
                Excel (.xlsx)
              </button>
              <button
                className="btn bg-red-600 hover:bg-red-700 text-white shadow-sm gap-2"
                onClick={cetakPdf}
                disabled={!generatorSiap}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 15h6" />
                </svg>
                Cetak PDF
              </button>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)] pb-2">
              Ekspor laporan dinonaktifkan oleh kebijakan akses (izin laporan.ekspor).
            </div>
          )}
        </div>
        <div className="mt-3 text-sm text-[var(--muted)]">
          {jenisLaporan === "sirkulasi" &&
            `Menampilkan ${aktivitasPeriode.length} transaksi — ${labelPeriode}${rentang ? ` (${rentang.mulai} s.d. ${rentang.akhir})` : ""}.`}
          {jenisLaporan === "denda" &&
            `${dendaPeriode.length} riwayat denda pada periode & ${ringkasan.terlambat.length} tunggakan belum dibayar.`}
          {jenisLaporan === "inventaris" &&
            `${buku.length} judul — selalu menampilkan kondisi katalog terkini.`}
        </div>
      </div>
      </>
      )}

      {/* Kategori & buku populer — bagian laporan buku. */}
      {(tab === "semua" || tab === "buku") && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per kategori */}
        <div className="card">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-bold">Koleksi per Kategori</h2>
          </div>
          <div className="p-5 space-y-4">
            {perKategori.map((k) => (
              <div key={k.kategori}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{k.kategori}</span>
                  <span className="text-[var(--muted)]">{k.judul} judul · {k.eksemplar} eks.</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-[var(--brand)]" style={{ width: `${(k.eksemplar / maxEksemplar) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buku populer */}
        <div className="card">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-bold">Buku Paling Banyak Dipinjam</h2>
          </div>
          {populer.length === 0 ? (
            <div className="p-5"><EmptyState pesan="Belum ada data" /></div>
          ) : (
            <table className="table-base">
              <thead>
                <tr><th>#</th><th>Judul</th><th>Penulis</th><th className="text-right">Dipinjam</th></tr>
              </thead>
              <tbody>
                {populer.map(({ buku: b, n }, i) => (
                  <tr key={b!.id}>
                    <td className="text-[var(--muted)]">{i + 1}</td>
                    <td className="font-medium">{b!.judul}</td>
                    <td className="text-[var(--muted)]">{b!.penulis}</td>
                    <td className="text-right font-semibold">{n}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {/* Tunggakan detail — bagian laporan peminjaman. */}
      {(tab === "semua" || tab === "peminjaman") && (
      <div className="card">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-bold">Daftar Tunggakan</h2>
          {ringkasan.dendaTerkumpul > 0 && (
            <span className="text-sm text-[var(--muted)]">
              Total denda tercatat: <span className="font-bold text-rose-600">{rupiah(ringkasan.dendaTerkumpul)}</span>
            </span>
          )}
        </div>
        {ringkasan.terlambat.length === 0 ? (
          <div className="p-5"><EmptyState pesan="Tidak ada tunggakan" sub="Semua peminjaman masih dalam tempo." /></div>
        ) : (
          <table className="table-base">
            <thead>
              <tr><th>Kode</th><th>Buku</th><th>Anggota</th><th>Jatuh Tempo</th><th>Telat</th><th className="text-right">Denda</th></tr>
            </thead>
            <tbody>
              {ringkasan.terlambat.map((p) => {
                const telat = hariTerlambat(p.tanggalKembali);
                return (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.kodePinjam}</td>
                    <td className="font-medium">{cariBuku(p.bukuId)?.judul ?? "-"}</td>
                    <td>{cariAnggota(p.anggotaId)?.nama ?? "-"}</td>
                    <td className="text-[var(--muted)]">{tanggalPanjang(p.tanggalKembali)}</td>
                    <td><Badge tone="rose">{telat} hari</Badge></td>
                    <td className="text-right font-semibold text-rose-600">{rupiah(telat * sistem.dendaPerHari)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
