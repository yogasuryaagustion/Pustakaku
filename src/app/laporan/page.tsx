
"use client";

import { useMemo, useState } from "react";
import { useLibrary, useHelper, hariTerlambat } from "@/lib/library-context";
import { useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { EmptyState, rupiah, tanggalPanjang } from "@/components/ui";
import { unduhXlsx, type LembarXlsx, type SelXlsx } from "@/lib/xlsx";
import { cetakHTML, eskapHTML } from "@/lib/cetak";

type JenisLaporan = "sirkulasi" | "denda" | "inventaris";

const LABEL_LAPORAN: Record<JenisLaporan, string> = {
  sirkulasi: "Laporan Sirkulasi Peminjaman Bulanan",
  denda: "Laporan Denda & Keuangan",
  inventaris: "Laporan Inventaris Katalog Terkini",
};

interface BagianLaporan {
  judul: string;
  kolom: string[];
  baris: (string | number)[][];
}

interface IsiLaporan {
  ringkas: [string, string | number][];
  bagian: BagianLaporan[];
}

type TabLaporan = "semua" | "buku" | "peminjaman" | "anggota";

const TAB_LAPORAN: { id: TabLaporan; label: string }[] = [
  { id: "semua", label: "Semua Laporan" },
  { id: "buku", label: "Laporan Buku" },
  { id: "peminjaman", label: "Laporan Peminjaman" },
  { id: "anggota", label: "Direktori Anggota" },
];

function fmtID(iso: string, opt: Intl.DateTimeFormatOptions) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", opt);
}

function tanggalLokalISO(): string {
  const sekarang = new Date();

  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

export default function LaporanPage() {
  const { buku, anggota, peminjaman, siap } = useLibrary();
  const { cariBuku, cariAnggota, jumlahDipinjam, stokTersedia } = useHelper();
  const sistem = useSistem();
  const bolehEkspor = useBoleh("laporan.ekspor");

  const [tab, setTab] = useState<TabLaporan>("semua");
  const [jenisPilihan, setJenisLaporan] = useState<JenisLaporan>("sirkulasi");
  const [tanggalAcuan, setTanggalAcuan] = useState(tanggalLokalISO);
  const [cariTabel, setCariTabel] = useState("");
  const [filterJenisAnggota, setFilterJenisAnggota] = useState("semua");
  const [filterStatusAnggota, setFilterStatusAnggota] = useState("semua");

  const jenisLaporan: JenisLaporan =
    tab === "buku"
      ? "inventaris"
      : tab === "peminjaman" && jenisPilihan === "inventaris"
        ? "sirkulasi"
        : jenisPilihan;

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
    () =>
      rentang
        ? fmtID(rentang.mulai, { month: "long", year: "numeric" })
        : "-",
    [rentang]
  );

  const aktivitasPeriode = useMemo(() => {
    if (!rentang) return [];

    const diR = (iso?: string | null) =>
      !!iso && iso >= rentang.mulai && iso <= rentang.akhir;

    return peminjaman.filter(
      (p) => diR(p.tanggalPinjam) || diR(p.tanggalKembaliAktual)
    );
  }, [peminjaman, rentang]);

  const ringkasanPeriode = useMemo(() => {
    const diR = (iso?: string | null) =>
      !!iso && !!rentang && iso >= rentang.mulai && iso <= rentang.akhir;

    const dipinjam = aktivitasPeriode.filter((p) => diR(p.tanggalPinjam));
    const dikembalikan = aktivitasPeriode.filter((p) =>
      diR(p.tanggalKembaliAktual)
    );
    const terlambat = dikembalikan.filter((p) => p.denda > 0);
    const denda = dikembalikan.reduce((s, p) => s + p.denda, 0);
    const pengunjungUnik = new Set(
      aktivitasPeriode.map((p) => p.anggotaId)
    ).size;

    return {
      dipinjam: dipinjam.length,
      dikembalikan: dikembalikan.length,
      terlambat: terlambat.length,
      denda,
      pengunjungUnik,
    };
  }, [aktivitasPeriode, rentang]);

  const perPengunjung = useMemo(() => {
    const grup = new Map<
      string,
      {
        anggotaId: string;
        pinjam: number;
        kembali: number;
        telat: number;
        denda: number;
      }
    >();

    for (const p of aktivitasPeriode) {
      const g = grup.get(p.anggotaId) ?? {
        anggotaId: p.anggotaId,
        pinjam: 0,
        kembali: 0,
        telat: 0,
        denda: 0,
      };

      const diR = (iso?: string | null) =>
        !!iso && !!rentang && iso >= rentang.mulai && iso <= rentang.akhir;

      if (diR(p.tanggalPinjam)) g.pinjam += 1;

      if (diR(p.tanggalKembaliAktual)) {
        g.kembali += 1;
        if (p.denda > 0) g.telat += 1;
        g.denda += p.denda;
      }

      grup.set(p.anggotaId, g);
    }

    return Array.from(grup.values()).sort(
      (a, b) => b.pinjam - a.pinjam || b.denda - a.denda
    );
  }, [aktivitasPeriode, rentang]);

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
    const masihDipinjam = peminjaman.filter(
      (p) => p.status === "Dipinjam"
    ).length;

    const terlambat = peminjaman.filter(
      (p) =>
        p.status === "Dipinjam" &&
        hariTerlambat(p.tanggalKembali) > 0
    );

    const sudahKembali = peminjaman.filter(
      (p) => p.status !== "Dipinjam"
    );

    const dendaTerkumpul = peminjaman.reduce((s, p) => s + p.denda, 0);

    const dendaPotensi = terlambat.reduce(
      (s, p) =>
        s + hariTerlambat(p.tanggalKembali) * sistem.dendaPerHari,
      0
    );

    const rataRata =
      sudahKembali.length === 0
        ? 0
        : sudahKembali.reduce((s, p) => {
            const d1 = new Date(p.tanggalPinjam).getTime();
            const d2 = new Date(
              p.tanggalKembaliAktual ?? p.tanggalKembali
            ).getTime();

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

  const perKategori = useMemo(() => {
    const map: Record<string, { judul: number; eksemplar: number }> = {};

    buku.forEach((b) => {
      if (!map[b.kategori]) {
        map[b.kategori] = { judul: 0, eksemplar: 0 };
      }

      map[b.kategori].judul += 1;
      map[b.kategori].eksemplar += b.stok;
    });

    return Object.entries(map)
      .map(([kategori, v]) => ({ kategori, ...v }))
      .sort((a, b) => b.eksemplar - a.eksemplar);
  }, [buku]);

  const maxEksemplar = Math.max(
    1,
    ...perKategori.map((k) => k.eksemplar)
  );

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

  // Statistik direktori anggota
  const statistikAnggota = useMemo(() => {
    const total = anggota.length;
    const aktif = anggota.filter((a) => a.aktif).length;
    const tidakAktif = total - aktif;

    const jenis = anggota.reduce<Record<string, number>>((acc, a) => {
      const namaJenis = a.jenis || "Lainnya";
      acc[namaJenis] = (acc[namaJenis] || 0) + 1;
      return acc;
    }, {});

    const totalTransaksi = peminjaman.length;
    const anggotaMeminjam = new Set(
      peminjaman.map((p) => p.anggotaId)
    ).size;

    return {
      total,
      aktif,
      tidakAktif,
      jenis: Object.entries(jenis)
        .map(([nama, jumlah]) => ({ nama, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah),
      totalTransaksi,
      anggotaMeminjam,
    };
  }, [anggota, peminjaman]);

  const maxJenisAnggota = Math.max(
    1,
    ...statistikAnggota.jenis.map((j) => j.jumlah)
  );

  const anggotaTersaring = useMemo(() => {
    const q = cariTabel.trim().toLowerCase();

    return anggota
      .filter((a) => {
        const cocokCari =
          !q ||
          [
            a.nama,
            a.nomorAnggota,
            a.email,
            a.telepon,
            a.alamat,
            a.jenis,
          ].some((v) => String(v ?? "").toLowerCase().includes(q));

        const cocokJenis =
          filterJenisAnggota === "semua" ||
          a.jenis === filterJenisAnggota;

        const cocokStatus =
          filterStatusAnggota === "semua" ||
          (filterStatusAnggota === "aktif" && a.aktif) ||
          (filterStatusAnggota === "nonaktif" && !a.aktif);

        return cocokCari && cocokJenis && cocokStatus;
      })
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [
    anggota,
    cariTabel,
    filterJenisAnggota,
    filterStatusAnggota,
  ]);

  const daftarJenisAnggota = useMemo(
    () =>
      Array.from(
        new Set(anggota.map((a) => a.jenis).filter(Boolean))
      ).sort(),
    [anggota]
  );

  if (!siap) {
    return (
      <div className="p-6 text-[var(--muted)]">
        Memuat data…
      </div>
    );
  }

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

    meta.push([
      "Dicetak Pada",
      new Date().toLocaleString("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    ]);

    if (jenisLaporan === "inventaris") {
      const kolom = [
        "Judul",
        "Penulis",
        "Penerbit",
        "Tahun",
        "ISBN",
        "Kategori",
        "Rak",
        "Stok",
        "Dipinjam",
        "Tersedia",
      ];

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
          [
            "Sedang Dipinjam",
            buku.reduce((s, b) => s + jumlahDipinjam(b.id), 0),
          ],
          ["Kategori", perKategori.length],
        ],
        bagian: [
          {
            judul: "Inventaris Katalog Terkini",
            kolom,
            baris,
          },
        ],
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

      const kolom = [
        "Kode",
        "Anggota",
        "No. Anggota",
        "Buku",
        "Jatuh Tempo",
        "Kembali Aktual",
        "Telat (hari)",
        "Denda",
      ];

      const barisRiwayat = dendaPeriode.map((p) => [
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
          {
            judul: `Denda Terkumpul — ${labelPeriode}`,
            kolom,
            baris: barisRiwayat,
          },
          {
            judul: "Tunggakan Belum Dibayar",
            kolom,
            baris: barisTunggakan,
          },
        ],
      };
    }

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

    const detailBaris = aktivitasPeriode.map((p) => {
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
          kolom: [
            "No. Anggota",
            "Nama",
            "Email",
            "Telepon",
            "Jenis",
            "Peminjaman",
            "Pengembalian",
            "Keterlambatan",
            "Total Denda",
          ],
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
        {
          judul: `Detail Aktivitas Pengunjung — ${labelPeriode}`,
          kolom: kolomDetail,
          baris: detailBaris,
        },
      ],
    };
  }

  function namaFileLaporan() {
    const tanggal = rentang
      ? rentang.mulai
      : new Date().toISOString().slice(0, 10);

    return `laporan-${jenisLaporan}-${tanggal}`;
  }

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
        nama: b.judul,
        baris: [
          [...b.kolom] as SelXlsx[],
          ...b.baris.map((r) => [...r] as SelXlsx[]),
        ],
      })),
    ];

    unduhXlsx(`${namaFileLaporan()}.xlsx`, lembar);
  }

  function cetakPdf() {
    const isi = siapkanLaporan();

    const th = (kolom: string[]) =>
      `<tr>${kolom
        .map((k) => `<th>${eskapHTML(k)}</th>`)
        .join("")}</tr>`;

    const td = (baris: (string | number)[][]) =>
      baris
        .map(
          (r) =>
            `<tr>${r
              .map((c) => `<td>${eskapHTML(String(c ?? ""))}</td>`)
              .join("")}</tr>`
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

  const generatorSiap =
    jenisLaporan === "sirkulasi"
      ? aktivitasPeriode.length > 0
      : jenisLaporan === "denda"
        ? dendaPeriode.length > 0 || ringkasan.terlambat.length > 0
        : buku.length > 0;

  const dataTabel = aktivitasPeriode
    .filter((p) => {
      if (!cariTabel.trim()) return true;

      const q = cariTabel.toLowerCase();
      const nama = cariAnggota(p.anggotaId)?.nama ?? "";
      const judul = cariBuku(p.bukuId)?.judul ?? "";

      return [p.kodePinjam, nama, judul].some((v) =>
        String(v).toLowerCase().includes(q)
      );
    })
    .sort((a, b) =>
      b.tanggalPinjam.localeCompare(a.tanggalPinjam)
    );

  const trenBulanan = Array.from({ length: 6 }, (_, i) => {
    const acuan = new Date();
    acuan.setDate(1);
    acuan.setMonth(acuan.getMonth() - (5 - i));

    const tahun = acuan.getFullYear();
    const bulan = acuan.getMonth();

    const pinjam = peminjaman.filter((p) => {
      const d = new Date(`${p.tanggalPinjam}T00:00:00`);
      return d.getFullYear() === tahun && d.getMonth() === bulan;
    }).length;

    const kembali = peminjaman.filter((p) => {
      if (!p.tanggalKembaliAktual) return false;

      const d = new Date(`${p.tanggalKembaliAktual}T00:00:00`);
      return d.getFullYear() === tahun && d.getMonth() === bulan;
    }).length;

    return {
      label: acuan.toLocaleDateString("id-ID", { month: "short" }),
      pinjam,
      kembali,
    };
  });

  const maxTren = Math.max(
    1,
    ...trenBulanan.flatMap((x) => [x.pinjam, x.kembali])
  );

  return (
    <div className="min-h-full space-y-5 bg-[#f7f9fb] p-1 sm:p-2">
      {/* Navigasi tab laporan */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
        {TAB_LAPORAN.map((item) => {
          const jumlah =
            item.id === "buku"
              ? buku.length
              : item.id === "peminjaman"
                ? peminjaman.length
                : item.id === "anggota"
                  ? anggota.length
                  : buku.length + peminjaman.length;

          return (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setCariTabel("");
              }}
              className={`shrink-0 border-b-2 px-4 py-3 text-xs font-bold transition ${
                tab === item.id
                  ? "border-[#00665c] text-[#00665c]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {item.label}
              <span className="ml-2 font-mono text-[10px] text-slate-400">
                · {jumlah}
              </span>
            </button>
          );
        })}
      </nav>

      {/* DIREKTORI ANGGOTA */}
      {tab === "anggota" ? (
        <div className="space-y-5">
          {/* Header direktori */}
          <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                Direktori Anggota
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Kelola dan lihat informasi seluruh anggota perpustakaan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Data anggota
              </span>
            </div>
          </section>

          {/* KPI anggota */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total Anggota",
                value: statistikAnggota.total,
                sub: "Seluruh anggota terdaftar",
                icon: "♙",
                tone: "teal",
              },
              {
                label: "Anggota Aktif",
                value: statistikAnggota.aktif,
                sub: "Status keanggotaan aktif",
                icon: "✓",
                tone: "green",
              },
              {
                label: "Anggota Nonaktif",
                value: statistikAnggota.tidakAktif,
                sub: "Status keanggotaan nonaktif",
                icon: "◷",
                tone: "amber",
              },
              {
                label: "Pernah Meminjam",
                value: statistikAnggota.anggotaMeminjam,
                sub: "Anggota dengan riwayat transaksi",
                icon: "▤",
                tone: "blue",
              },
            ].map((item) => (
              <article
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black tracking-tight text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.sub}
                  </p>
                </div>

                <span
                  className={`ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${
                    item.tone === "green"
                      ? "bg-emerald-50 text-emerald-600"
                      : item.tone === "amber"
                        ? "bg-amber-50 text-amber-600"
                        : item.tone === "blue"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-teal-50 text-[#00665c]"
                  }`}
                >
                  {item.icon}
                </span>
              </article>
            ))}
          </section>

          {/* Analitik anggota */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-lg text-[#00665c]">
                  ▥
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Analitik Keanggotaan
                  </h2>
                  <p className="text-xs text-slate-400">
                    Distribusi anggota berdasarkan jenis keanggotaan.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Data dari basis data
              </span>
            </div>

            <div className="grid gap-6 pt-5 lg:grid-cols-[1.7fr_1fr]">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-600">
                  Distribusi berdasarkan jenis anggota
                </p>

                {statistikAnggota.jenis.length === 0 ? (
                  <EmptyState pesan="Belum ada data anggota." />
                ) : (
                  statistikAnggota.jenis.map((item) => (
                    <div key={item.nama}>
                      <div className="mb-1.5 flex justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-700">
                          {item.nama}
                        </span>
                        <span className="font-mono text-slate-500">
                          {item.jumlah} anggota
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#00665c] transition-all"
                          style={{
                            width: `${(item.jumlah / maxJenisAnggota) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Ringkasan keanggotaan
                </p>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total anggota</span>
                  <strong>{statistikAnggota.total}</strong>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Anggota aktif</span>
                  <strong className="text-emerald-700">
                    {statistikAnggota.aktif}
                  </strong>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Anggota nonaktif</span>
                  <strong className="text-rose-600">
                    {statistikAnggota.tidakAktif}
                  </strong>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Pernah meminjam</span>
                  <strong>{statistikAnggota.anggotaMeminjam}</strong>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total transaksi</span>
                  <strong>{statistikAnggota.totalTransaksi}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Tabel direktori */}
          <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)] sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Anggota Perpustakaan
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Informasi identitas dan status keanggotaan.
                </p>
              </div>

              <span className="w-fit rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-[#00665c]">
                {anggotaTersaring.length} anggota ditemukan
              </span>
            </div>

            <div className="grid gap-2 border-y border-slate-100 py-3 md:grid-cols-[1fr_190px_190px]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>
                <input
                  value={cariTabel}
                  onChange={(e) => setCariTabel(e.target.value)}
                  placeholder="Cari nama, nomor anggota, email, telepon..."
                  className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-teal-500 focus:bg-white"
                />
              </div>

              <select
                value={filterJenisAnggota}
                onChange={(e) => setFilterJenisAnggota(e.target.value)}
                className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="semua">Semua Jenis</option>
                {daftarJenisAnggota.map((jenis) => (
                  <option key={jenis} value={jenis}>
                    {jenis}
                  </option>
                ))}
              </select>

              <select
                value={filterStatusAnggota}
                onChange={(e) => setFilterStatusAnggota(e.target.value)}
                className="min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-teal-500"
              >
                <option value="semua">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[950px] text-left text-xs">
                <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Anggota</th>
                    <th className="px-4 py-3">Nomor Anggota</th>
                    <th className="px-4 py-3">Kontak</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Tanggal Bergabung</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {anggotaTersaring.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-slate-400"
                      >
                        Tidak ada anggota yang sesuai dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    anggotaTersaring.map((a) => (
                      <tr
                        key={a.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {a.foto ? (
                              <img
                                src={a.foto}
                                alt={a.nama}
                                className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-black text-[#00665c]">
                                {(a.nama || "?").charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="font-bold text-slate-900">
                                {a.nama}
                              </p>
                              <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-400">
                                {a.alamat || "Alamat belum diisi"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                          {a.nomorAnggota || "—"}
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-slate-700">
                            {a.email || "—"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {a.telepon || "Nomor telepon belum diisi"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                            {a.jenis || "Umum"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {a.bergabungPada
                            ? tanggalPanjang(a.bergabungPada)
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${
                              a.aktif
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {a.aktif ? "AKTIF" : "NONAKTIF"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col justify-between gap-2 text-[11px] text-slate-400 sm:flex-row sm:items-center">
              <p>
                Menampilkan {anggotaTersaring.length} dari {anggota.length}{" "}
                anggota.
              </p>
              <p>
                Direktori anggota diperbarui berdasarkan data perpustakaan.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* KPI laporan umum */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label:
                  tab === "buku" ? "Total Judul Buku" : "Total Peminjaman",
                value:
                  tab === "buku"
                    ? buku.length
                    : ringkasan.totalPeminjaman,
                sub:
                  tab === "buku"
                    ? "Koleksi terdaftar"
                    : "Seluruh transaksi tercatat",
                icon: "▤",
                tone: "teal",
              },
              {
                label:
                  tab === "buku" ? "Total Eksemplar" : "Masih Dipinjam",
                value:
                  tab === "buku"
                    ? buku.reduce((s, b) => s + b.stok, 0)
                    : ringkasan.masihDipinjam,
                sub:
                  tab === "buku"
                    ? "Jumlah stok buku"
                    : "Sedang di tangan anggota",
                icon: "◷",
                tone: "amber",
              },
              {
                label:
                  tab === "buku" ? "Kategori Koleksi" : "Telah Kembali",
                value:
                  tab === "buku"
                    ? perKategori.length
                    : ringkasan.sudahKembali.length,
                sub:
                  tab === "buku"
                    ? "Klasifikasi buku"
                    : "Transaksi selesai",
                icon: "✓",
                tone: "green",
              },
              {
                label:
                  tab === "buku" ? "Sedang Dipinjam" : "Keterlambatan",
                value:
                  tab === "buku"
                    ? buku.reduce(
                        (s, b) => s + jumlahDipinjam(b.id),
                        0
                      )
                    : ringkasan.terlambat.length,
                sub:
                  tab === "buku"
                    ? "Eksemplar dalam sirkulasi"
                    : "Melewati batas kembali",
                icon: "△",
                tone: "rose",
              },
            ].map((item) => (
              <article
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black tracking-tight text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.sub}
                  </p>
                </div>

                <span
                  className={`ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${
                    item.tone === "amber"
                      ? "bg-amber-50 text-amber-600"
                      : item.tone === "green"
                        ? "bg-emerald-50 text-emerald-600"
                        : item.tone === "rose"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-teal-50 text-[#00665c]"
                  }`}
                >
                  {item.icon}
                </span>
              </article>
            ))}
          </section>

          {/* Analitik visual */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-lg text-[#00665c]">
                  ▥
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Analitik Visual & Tren Operasional
                  </h2>
                  <p className="text-xs text-slate-400">
                    {tab === "buku"
                      ? "Distribusi koleksi buku berdasarkan kategori"
                      : "Tren peminjaman dan pengembalian enam bulan terakhir"}
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Data dari basis data
              </span>
            </div>

            {tab === "buku" ? (
              <div className="grid gap-6 pt-5 lg:grid-cols-[1.7fr_1fr]">
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-600">
                    Distribusi koleksi berdasarkan kategori
                  </p>

                  {perKategori.length === 0 ? (
                    <EmptyState pesan="Belum ada data kategori buku" />
                  ) : (
                    perKategori.slice(0, 6).map((k) => (
                      <div key={k.kategori}>
                        <div className="mb-1.5 flex justify-between gap-3 text-xs">
                          <span className="font-medium text-slate-700">
                            {k.kategori}
                          </span>
                          <span className="font-mono text-slate-500">
                            {k.eksemplar} eks.
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#00665c]"
                            style={{
                              width: `${(k.eksemplar / maxEksemplar) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Ringkasan inventaris
                  </p>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Total judul</span>
                    <strong>{buku.length}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Total eksemplar</span>
                    <strong>
                      {buku.reduce((s, b) => s + b.stok, 0)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Sedang dipinjam</span>
                    <strong>
                      {buku.reduce(
                        (s, b) => s + jumlahDipinjam(b.id),
                        0
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Tersedia</span>
                    <strong className="text-emerald-700">
                      {buku.reduce(
                        (s, b) => s + stokTersedia(b.id),
                        0
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 pt-5 lg:grid-cols-[1.8fr_1fr]">
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex gap-4">
                      <span className="inline-flex items-center gap-1.5">
                        <i className="h-2.5 w-2.5 rounded-sm bg-[#00665c]" />
                        Peminjaman Baru
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <i className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                        Pengembalian Selesai
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      6 bulan terakhir
                    </span>
                  </div>

                  <div className="flex h-44 items-end justify-between gap-3 rounded-xl bg-slate-50/70 px-4 pb-3 pt-5">
                    {trenBulanan.map((item, i) => (
                      <div
                        key={`${item.label}-${i}`}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <div className="flex h-32 w-full items-end justify-center gap-1">
                          <div
                            title={`${item.pinjam} peminjaman`}
                            className="w-3.5 rounded-t-sm bg-[#00665c] transition-all"
                            style={{
                              height: `${Math.max(
                                5,
                                (item.pinjam / maxTren) * 100
                              )}%`,
                            }}
                          />
                          <div
                            title={`${item.kembali} pengembalian`}
                            className="w-3.5 rounded-t-sm bg-emerald-400 transition-all"
                            style={{
                              height: `${Math.max(
                                5,
                                (item.kembali / maxTren) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Indikator kinerja sirkulasi
                  </p>
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-600">
                      Peminjaman periode ini
                    </span>
                    <strong>{ringkasanPeriode.dipinjam}</strong>
                  </div>
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-600">
                      Pengembalian periode ini
                    </span>
                    <strong>{ringkasanPeriode.dikembalikan}</strong>
                  </div>
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-600">
                      Rata-rata durasi pinjam
                    </span>
                    <strong>{ringkasan.rataRata} hari</strong>
                  </div>
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-slate-600">
                      Total denda tercatat
                    </span>
                    <strong className="text-rose-600">
                      {rupiah(ringkasan.dendaTerkumpul)}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Generator dan tabel laporan */}
          <section className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)] sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    onClick={() =>
                      setTanggalAcuan(new Date().toISOString().slice(0, 10))
                    }
                    className="rounded-lg bg-white px-3 py-2 text-slate-900 shadow-sm"
                  >
                    Bulan Ini
                  </button>
                  <span className="px-3 py-2 text-slate-500">
                    Bulanan
                  </span>
                </div>

                <input
                  aria-label="Tanggal acuan laporan"
                  type="date"
                  value={tanggalAcuan}
                  onChange={(e) => setTanggalAcuan(e.target.value)}
                  disabled={jenisLaporan === "inventaris"}
                  className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-teal-500"
                />

                <select
                  value={jenisLaporan}
                  onChange={(e) =>
                    setJenisLaporan(e.target.value as JenisLaporan)
                  }
                  disabled={tab === "buku"}
                  className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500"
                >
                  {tab !== "buku" && (
                    <>
                      <option value="sirkulasi">Sirkulasi</option>
                      <option value="denda">Denda & Sanksi</option>
                    </>
                  )}
                  {tab !== "peminjaman" && (
                    <option value="inventaris">Inventaris Buku</option>
                  )}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={unduhExcel}
                  disabled={!bolehEkspor || !generatorSiap}
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ▦ Ekspor Excel
                </button>

                <button
                  onClick={cetakPdf}
                  disabled={!bolehEkspor || !generatorSiap}
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-[#00665c] px-3.5 text-xs font-bold text-white transition hover:bg-[#004d45] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ▣ Cetak PDF
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                <strong className="font-mono text-slate-800">
                  {jenisLaporan === "inventaris"
                    ? buku.length
                    : jenisLaporan === "denda"
                      ? dendaPeriode.length +
                        ringkasan.terlambat.length
                      : dataTabel.length}{" "}
                  baris data
                </strong>
                <span className="mx-2 text-slate-300">·</span>
                Periode{" "}
                {rentang
                  ? `${rentang.mulai} s.d. ${rentang.akhir}`
                  : "—"}
              </p>

              <input
                value={cariTabel}
                onChange={(e) => setCariTabel(e.target.value)}
                placeholder="Cari dalam tabel..."
                className="min-h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none placeholder:text-slate-400 focus:border-teal-500 sm:max-w-64"
              />
            </div>

            {jenisLaporan === "inventaris" ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      {[
                        "Judul Buku",
                        "Penulis",
                        "Kategori",
                        "Stok",
                        "Dipinjam",
                        "Tersedia",
                      ].map((h) => (
                        <th key={h} className="px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {buku
                      .filter(
                        (b) =>
                          !cariTabel ||
                          [b.judul, b.penulis, b.kategori].some((v) =>
                            String(v)
                              .toLowerCase()
                              .includes(cariTabel.toLowerCase())
                          )
                      )
                      .map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {b.judul}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {b.penulis || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {b.kategori}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {b.stok}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {jumlahDipinjam(b.id)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                            {stokTersedia(b.id)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : jenisLaporan === "denda" ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      {[
                        "Kode",
                        "Anggota",
                        "Buku",
                        "Jatuh Tempo",
                        "Telat",
                        "Denda",
                      ].map((h) => (
                        <th key={h} className="px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {ringkasan.terlambat.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono">
                          {p.kodePinjam}
                        </td>
                        <td className="px-4 py-3">
                          {cariAnggota(p.anggotaId)?.nama ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {cariBuku(p.bukuId)?.judul ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {tanggalPanjang(p.tanggalKembali)}
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          {hariTerlambat(p.tanggalKembali)} hari
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-600">
                          {rupiah(
                            hariTerlambat(p.tanggalKembali) *
                              sistem.dendaPerHari
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-[#f8faf9] text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      {[
                        "ID Pinjam",
                        "Judul Buku",
                        "Peminjam",
                        "Kategori",
                        "Tgl Pinjam",
                        "Batas Kembali",
                        "Status",
                      ].map((h) => (
                        <th key={h} className="px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {dataTabel.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          Tidak ada data ditemukan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      dataTabel.map((p) => {
                        const b = cariBuku(p.bukuId);
                        const a = cariAnggota(p.anggotaId);
                        const telat =
                          p.status === "Dipinjam" &&
                          hariTerlambat(p.tanggalKembali) > 0;

                        return (
                          <tr
                            key={p.id}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                              {p.kodePinjam}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 font-bold text-slate-900">
                              {b?.judul ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {a?.nama ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {a?.jenis ?? "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {fmtID(p.tanggalPinjam, {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                              {fmtID(p.tanggalKembali, {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                                  telat
                                    ? "bg-rose-50 text-rose-700"
                                    : p.status === "Dipinjam"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {telat
                                  ? "TERLAMBAT"
                                  : p.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Statistik koleksi dan buku populer */}
          {(tab === "semua" || tab === "buku") && (
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-bold text-slate-900">
                  Koleksi per Kategori
                </h2>
                <p className="mb-4 mt-1 text-xs text-slate-400">
                  Distribusi judul dan jumlah eksemplar
                </p>

                {perKategori.length === 0 ? (
                  <EmptyState pesan="Belum ada kategori buku" />
                ) : (
                  perKategori.map((k) => (
                    <div key={k.kategori} className="mb-4">
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-700">
                          {k.kategori}
                        </span>
                        <span className="text-slate-500">
                          {k.judul} judul · {k.eksemplar} eksemplar
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#00665c]"
                          style={{
                            width: `${
                              (k.eksemplar / maxEksemplar) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Buku Paling Banyak Dipinjam
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Berdasarkan frekuensi transaksi
                  </p>
                </div>

                {populer.length === 0 ? (
                  <div className="p-5">
                    <EmptyState pesan="Belum ada data peminjaman buku" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="px-5 py-3">#</th>
                          <th className="px-5 py-3">Judul Buku</th>
                          <th className="px-5 py-3 text-right">
                            Dipinjam
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {populer.map(({ buku: b, n }, i) => (
                          <tr key={b!.id}>
                            <td className="px-5 py-3 text-slate-400">
                              #{i + 1}
                            </td>
                            <td className="px-5 py-3 font-semibold text-slate-800">
                              {b!.judul}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-teal-700">
                              {n}x
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
