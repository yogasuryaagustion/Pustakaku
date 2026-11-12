"use client";

// Form cetak label eksemplar dalam dialog. Pustakawan memilih judul/rak dan
// bentuk kode di sini, melihat perkiraan jumlah lembar, lalu mencetak tanpa
// meninggalkan halaman Inventaris (sebelumnya harus pindah ke
// /inventaris/label lalu kembali).
//
// Lembar label dicetak lewat iframe (lib/cetak), bukan window.print(): dialog
// dirender ke <body>, jadi aturan @media print halaman akan ikut mencetak
// sidebar dan dialognya sendiri. Iframe berisi HTML label saja, sehingga hasil
// cetak selalu bersih.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { cetakHTML, eskapHTML } from "@/lib/cetak";
import { useSistem } from "@/lib/sistem";
import { PILIHAN_FORMAT_LABEL, type FormatLabel } from "@/lib/label-format";
import { pesanGalat } from "@/components/inventaris-ui";

const LABEL_PER_LEMBAR = 24;

interface LabelEksemplar {
  id: string;
  nomor_inventaris: string;
  judul: string;
  rak: string;
  /** QR dalam bentuk SVG (sudah dirender server). */
  qr: string;
  /** Barcode Code 128 dalam bentuk SVG. */
  barcode: string;
}

// Gaya khusus dokumen cetak. Dimuat setelah gaya dasar lib/cetak, sehingga
// @page di sini yang dipakai: margin 10 mm dan 24 label (3 × 8) per lembar A4.
const GAYA_LABEL_CETAK = `
@page {
  size: A4;
  margin: 10mm;
}

body {
  margin: 0;
}

/* Lebar dikunci ke 3 kolom (189,9 mm) supaya lembar tidak melebar melewati
   area cetak 190 mm — kalau melebar, Chromium mengecilkan skala cetak dan
   label tidak lagi pas dengan kertas stiker 63,3 x 33,9 mm. */
.lembar-label {
  display: grid;
  grid-template-columns: repeat(3, 63.3mm);
  width: 189.9mm;
}

.label {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 2.5mm;
  height: 33.9mm;
  padding: 3mm;
  overflow: hidden;
  border: 1px dashed #cbd5e1;
  break-inside: avoid;
}

.label-1d {
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1.2mm;
}

.label-qr {
  flex: 0 0 auto;
  width: 22mm;
  height: 22mm;
}

.label-qr svg {
  display: block;
  width: 100%;
  height: 100%;
}

.label-teks {
  min-width: 0;
}

.label-nama {
  margin: 0;
  font-size: 5.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.label-nomor {
  margin: 0.6mm 0 0;
  font-family: "Courier New", monospace;
  font-size: 10pt;
  font-weight: 700;
  line-height: 1.1;
  color: #0f172a;
}

.label-judul {
  margin: 0.6mm 0 0;
  font-size: 6.5pt;
  line-height: 1.25;
  color: #475569;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.label-rak {
  margin: 0.6mm 0 0;
  font-size: 6pt;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.label-baris {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 2mm;
}

.label-baris .label-rak {
  flex: 0 0 auto;
  margin: 0;
}

.label-barcode {
  width: 100%;
}

.label-barcode svg {
  display: block;
  width: 100%;
  height: auto;
}
`;

/** Satu label untuk dokumen cetak (63,3 × 33,9 mm). */
function labelCetak(
  l: LabelEksemplar,
  format: FormatLabel,
  namaSistem: string,
): string {
  const nama = eskapHTML(namaSistem);
  const nomor = eskapHTML(l.nomor_inventaris);
  const judul = eskapHTML(l.judul);
  const rak = l.rak ? eskapHTML(l.rak) : "";

  if (format === "qr") {
    return `<article class="label">
      <div class="label-qr">${l.qr}</div>
      <div class="label-teks">
        <p class="label-nama">${nama}</p>
        <p class="label-nomor">${nomor}</p>
        <p class="label-judul">${judul}</p>
        ${rak ? `<p class="label-rak">Rak ${rak}</p>` : ""}
      </div>
    </article>`;
  }

  return `<article class="label label-1d">
    <div class="label-baris">
      <span class="label-nama">${nama}</span>
      ${rak ? `<span class="label-rak">Rak ${rak}</span>` : ""}
    </div>
    <p class="label-nomor">${nomor}</p>
    <div class="label-barcode">${l.barcode}</div>
    <p class="label-judul">${judul}</p>
  </article>`;
}

export function CetakLabel({
  terbuka,
  onTutup,
}: {
  terbuka: boolean;
  onTutup: () => void;
}) {
  const sistem = useSistem();

  const [label, setLabel] = useState<LabelEksemplar[]>([]);
  const [galat, setGalat] = useState("");
  const [sudahDimuat, setSudahDimuat] = useState(false);

  const [cari, setCari] = useState("");
  const [rak, setRak] = useState("");
  // Null = ikut pengaturan ("Bentuk Label Eksemplar Bawaan"); tombol pilihan
  // hanya mengubah cetakan kali ini.
  const [formatPilihan, setFormatPilihan] = useState<FormatLabel | null>(null);
  const format = formatPilihan ?? sistem.formatLabel;

  // SVG QR/barcode untuk semua salinan dibuat server dan ukurannya cukup
  // besar, jadi baru dimuat saat dialog dibuka — bukan setiap halaman
  // Inventaris dibuka.
  useEffect(() => {
    if (!terbuka || sudahDimuat) return;

    let batal = false;

    apiFetch<{ label: LabelEksemplar[] }>("/api/eksemplar/label")
      .then((res) => {
        if (batal) return;
        setLabel(Array.isArray(res.label) ? res.label : []);
        setSudahDimuat(true);
      })
      .catch((e: unknown) => {
        if (!batal) setGalat(pesanGalat(e));
      });

    return () => {
      batal = true;
    };
  }, [terbuka, sudahDimuat]);

  // Status memuat diturunkan dari state, bukan disetel di dalam effect —
  // menyetel state langsung di body effect memicu render berantai.
  const memuat = terbuka && !sudahDimuat && !galat;

  const daftarRak = useMemo(() => {
    const kumpulan = new Set<string>();
    for (const l of label) kumpulan.add(l.rak || "Tanpa rak");
    return [...kumpulan].sort((a, b) => a.localeCompare(b, "id"));
  }, [label]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return label.filter((l) => {
      if (rak && (l.rak || "Tanpa rak") !== rak) return false;
      if (!q) return true;
      return (
        l.judul.toLowerCase().includes(q) ||
        l.nomor_inventaris.toLowerCase().includes(q)
      );
    });
  }, [label, cari, rak]);

  const jumlahLembar = Math.max(1, Math.ceil(tampil.length / LABEL_PER_LEMBAR));

  const cetak = () => {
    if (tampil.length === 0) return;

    const isi = tampil
      .map((l) => labelCetak(l, format, sistem.nama))
      .join("");

    cetakHTML(
      `<div class="lembar-label">${isi}</div>`,
      "Label Inventaris",
      GAYA_LABEL_CETAK,
    );
  };

  return (
    <Modal
      open={terbuka}
      onClose={onTutup}
      title="Cetak Label Inventaris"
      width="max-w-3xl"
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Satu label untuk satu salinan fisik (nomor inventaris + judul + rak),
          24 label per lembar A4. Pilih penyaringan bila hanya mencetak sebagian
          rak, lalu cetak.
        </p>

        {memuat && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
            Menyiapkan label eksemplar…
          </p>
        )}

        {galat && (
          <div
            role="alert"
            className="flex flex-col justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center"
          >
            <span>{galat}</span>
            <button
              type="button"
              className="shrink-0 font-semibold underline"
              onClick={() => {
                setGalat("");
                setSudahDimuat(false);
              }}
            >
              Muat ulang
            </button>
          </div>
        )}

        {!galat && !memuat && label.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">
            Belum ada salinan buku untuk dilabeli. Tambahkan eksemplar lebih
            dulu di tab Salinan Buku.
          </p>
        )}

        {label.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="label"
                  htmlFor="label-cetak-cari"
                >
                  Cari judul atau nomor inventaris
                </label>
                <input
                  id="label-cetak-cari"
                  className="input"
                  placeholder="mis. Laskar Pelangi atau INV-0007"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>

              <div>
                <label className="label" htmlFor="label-cetak-rak">
                  Rak
                </label>
                <select
                  id="label-cetak-rak"
                  className="input"
                  value={rak}
                  onChange={(e) => setRak(e.target.value)}
                >
                  <option value="">Semua rak</option>
                  {daftarRak.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="label block">Bentuk kode</span>
              <div className="flex w-fit rounded-xl border border-[var(--border)] bg-slate-100 p-1">
                {PILIHAN_FORMAT_LABEL.map((pilihan) => (
                  <button
                    key={pilihan.nilai}
                    type="button"
                    onClick={() => setFormatPilihan(pilihan.nilai)}
                    aria-pressed={format === pilihan.nilai}
                    title={pilihan.ket}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      format === pilihan.nilai
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {pilihan.judul}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
              <span className="font-semibold text-slate-700">
                {tampil.length} label
              </span>{" "}
              dari {label.length} eksemplar · {jumlahLembar} lembar A4 · bentuk{" "}
              {format === "qr" ? "QR" : "barcode Code 128"}.
            </div>

            {tampil.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                Tidak ada label yang cocok dengan penyaringan ini.
              </p>
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pratinjau
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tampil.slice(0, 4).map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-2.5 rounded-lg border border-dashed border-slate-300 bg-white p-2"
                    >
                      {format === "qr" ? (
                        <div
                          className="h-11 w-11 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                          role="img"
                          aria-label={`QR ${l.nomor_inventaris}`}
                          dangerouslySetInnerHTML={{ __html: l.qr }}
                        />
                      ) : (
                        <div
                          className="h-11 w-20 shrink-0 self-center [&>svg]:h-auto [&>svg]:w-full"
                          role="img"
                          aria-label={`Barcode ${l.nomor_inventaris}`}
                          dangerouslySetInnerHTML={{ __html: l.barcode ?? "" }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-bold text-slate-900">
                          {l.nomor_inventaris}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {l.judul}
                        </p>
                        {l.rak && (
                          <p className="truncate text-[11px] text-slate-400">
                            Rak {l.rak}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {tampil.length > 4 && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    +{tampil.length - 4} label lainnya ikut tercetak.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <Link
            href="/inventaris/label"
            className="text-sm font-semibold text-[var(--brand-ink)] hover:underline"
          >
            Buka pratinjau lembar penuh
          </Link>

          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onTutup}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={cetak}
              disabled={memuat || tampil.length === 0}
            >
              Cetak {tampil.length > 0 ? `${tampil.length} label` : "label"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
