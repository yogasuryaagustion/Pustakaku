"use client";

// Lembar label untuk ditempel di eksemplar fisik: nomor inventaris dalam
// bentuk QR atau barcode Code 128 (dipilih di layar sebelum mencetak)
//
// Satu label = satu salinan (nomor inventaris + judul + rak). Tata letaknya
// mengikuti kertas label A4 3 × 8 (24 label per lembar, 63,3 × 33,9 mm),
// sehingga bisa dicetak di kertas stiker maupun dipotong manual. Halaman ini
// tampil tanpa sidebar (lihat RUTE_POLOS di AppShell) agar hasil cetak bersih.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMuatApi } from "@/components/inventaris-ui";
import { useSistem } from "@/lib/sistem";
import { PILIHAN_FORMAT_LABEL, type FormatLabel } from "@/lib/label-format";

const LABEL_PER_LEMBAR = 24;

interface LabelEksemplar {
  id: string;
  nomor_inventaris: string;
  judul: string;
  rak: string;
  qr: string;
  /** Code 128 (1D) — untuk barcode gun biasa. */
  barcode: string;
}

export default function LabelInventarisPage() {
  const sistem = useSistem();
  const { data, memuat, galat } = useMuatApi<{ label: LabelEksemplar[] }>(
    "/api/eksemplar/label",
  );

  const label = useMemo(() => data?.label ?? [], [data]);

  // Penyaringan sebelum cetak: pustakawan biasanya mencetak label per rak,
  // atau mengulang label untuk satu judul saja.
  const [cari, setCari] = useState("");
  const [rak, setRak] = useState("");
  // Bentuk kode yang dicetak; keduanya berisi nomor inventaris yang sama.
  // Null = ikut pengaturan ("Bentuk Label Eksemplar Bawaan"); memilih tombol
  // hanya mengubah cetakan kali ini.
  const [formatPilihan, setFormatPilihan] = useState<FormatLabel | null>(null);
  const format = formatPilihan ?? sistem.formatLabel;

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

  const menyaring = cari.trim() !== "" || rak !== "";
  const jumlahLembar = Math.max(1, Math.ceil(tampil.length / LABEL_PER_LEMBAR));

  return (
    <main className="min-h-screen bg-slate-100 print:min-h-0 print:bg-white">
      <div className="mx-auto w-full max-w-[240mm] px-4 py-6 print:max-w-none print:p-0">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <Link
              href="/inventaris/eksemplar"
              className="text-sm font-semibold text-teal-800 hover:underline"
            >
              ← Data Eksemplar
            </Link>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Label Inventaris
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {menyaring
                ? `${tampil.length} dari ${label.length} eksemplar`
                : `${label.length} eksemplar`}{" "}
              · {jumlahLembar} lembar A4 · 24 label per lembar (3 × 8). Kode
              berisi nomor inventaris saja, dalam bentuk{" "}
              {format === "qr" ? "QR" : "barcode Code 128"}.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            disabled={tampil.length === 0}
          >
            Cetak label
          </button>
        </header>

        {!memuat && label.length > 0 && (
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 print:hidden">
            <div className="min-w-[220px] flex-1">
              <label
                className="mb-1 block text-xs font-semibold text-slate-600"
                htmlFor="label-cari"
              >
                Cari judul atau nomor inventaris
              </label>
              <input
                id="label-cari"
                className="input"
                placeholder="mis. Laskar Pelangi atau INV-0007"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Bentuk kode
              </span>
              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
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

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-slate-600"
                htmlFor="label-rak"
              >
                Rak
              </label>
              <select
                id="label-rak"
                className="input w-auto"
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

            {menyaring && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setCari("");
                  setRak("");
                }}
              >
                Tampilkan semua
              </button>
            )}
          </div>
        )}

        {galat && (
          <p
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 print:hidden"
            role="alert"
          >
            {galat}
          </p>
        )}

        {memuat && (
          <p className="text-sm text-slate-500 print:hidden">Menyiapkan label…</p>
        )}

        {!memuat && label.length === 0 && !galat && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 print:hidden">
            Belum ada eksemplar untuk dilabeli.
          </p>
        )}

        {!memuat && label.length > 0 && tampil.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 print:hidden">
            Tidak ada label yang cocok dengan penyaringan ini.
          </p>
        )}

        {tampil.length > 0 && (
          <div className="overflow-x-auto print:overflow-visible">
            <section
              className="lembar-label mx-auto w-[210mm] min-w-[210mm] bg-white p-[10mm] shadow-[0_10px_30px_rgba(15,23,42,0.08)] print:w-auto print:min-w-0 print:p-0 print:shadow-none"
              aria-label={`Lembar label ${format === "qr" ? "QR" : "barcode Code 128"} inventaris`}
            >
              <div className="grid grid-cols-3">
                {tampil.map((l) =>
                  format === "qr" ? (
                    <article
                      key={l.id}
                      className="label-item flex h-[33.9mm] items-center gap-[2.5mm] border border-dashed border-slate-300 p-[3mm]"
                    >
                      <div
                        className="h-[22mm] w-[22mm] shrink-0 [&>svg]:h-full [&>svg]:w-full"
                        role="img"
                        aria-label={`QR ${l.nomor_inventaris}`}
                        dangerouslySetInnerHTML={{ __html: l.qr }}
                      />

                      <div className="min-w-0">
                        <p className="truncate text-[5.5pt] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          {sistem.nama}
                        </p>
                        <p className="mt-[0.6mm] truncate font-mono text-[10pt] font-bold leading-tight text-slate-900">
                          {l.nomor_inventaris}
                        </p>
                        <p className="mt-[0.6mm] line-clamp-2 text-[6.5pt] leading-[1.25] text-slate-600">
                          {l.judul}
                        </p>
                        {l.rak && (
                          <p className="mt-[0.6mm] truncate text-[6pt] text-slate-500">
                            Rak {l.rak}
                          </p>
                        )}
                      </div>
                    </article>
                  ) : (
                    // Barcode 1D butuh lebar penuh label agar modul tidak
                    // menyempit saat dicetak; teks tetap di atas & bawahnya.
                    <article
                      key={l.id}
                      className="label-item flex h-[33.9mm] flex-col justify-center gap-[1.2mm] border border-dashed border-slate-300 p-[3mm]"
                    >
                      <div className="flex items-baseline justify-between gap-[2mm]">
                        <p className="truncate text-[5.5pt] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          {sistem.nama}
                        </p>
                        {l.rak && (
                          <p className="shrink-0 truncate text-[6pt] text-slate-500">
                            Rak {l.rak}
                          </p>
                        )}
                      </div>

                      <p className="truncate font-mono text-[9pt] font-bold leading-tight text-slate-900">
                        {l.nomor_inventaris}
                      </p>

                      <div
                        className="w-full [&>svg]:h-auto [&>svg]:w-full"
                        role="img"
                        aria-label={`Barcode ${l.nomor_inventaris}`}
                        dangerouslySetInnerHTML={{ __html: l.barcode ?? "" }}
                      />

                      <p className="line-clamp-1 text-[6pt] leading-[1.2] text-slate-600">
                        {l.judul}
                      </p>
                    </article>
                  )
                )}
              </div>
            </section>
          </div>
        )}

        <p className="mt-4 text-center text-xs leading-5 text-slate-500 print:hidden">
          Saat mencetak, pilih ukuran kertas A4, skala 100% (ukuran aktual), dan
          nonaktifkan header/footer browser. Label dirancang 63,3 × 33,9 mm untuk
          kertas stiker 3 × 8.
        </p>
      </div>
    </main>
  );
}
