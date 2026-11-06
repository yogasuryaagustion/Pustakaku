"use client";

// Lembar label QR untuk ditempel di eksemplar fisik.
//
// Satu label = satu salinan (nomor inventaris + judul + rak). Tata letaknya
// mengikuti kertas label A4 3 × 8 (24 label per lembar, 63,3 × 33,9 mm),
// sehingga bisa dicetak di kertas stiker maupun dipotong manual. Halaman ini
// tampil tanpa sidebar (lihat RUTE_POLOS di AppShell) agar hasil cetak bersih.

import Link from "next/link";
import { useMemo } from "react";
import { useMuatApi } from "@/components/inventaris-ui";
import { useSistem } from "@/lib/sistem";

const LABEL_PER_LEMBAR = 24;

interface LabelEksemplar {
  id: string;
  nomor_inventaris: string;
  judul: string;
  rak: string;
  qr: string;
}

export default function LabelInventarisPage() {
  const sistem = useSistem();
  const { data, memuat, galat } = useMuatApi<{ label: LabelEksemplar[] }>(
    "/api/eksemplar/label",
  );

  const label = useMemo(() => data?.label ?? [], [data]);
  const jumlahLembar = Math.max(1, Math.ceil(label.length / LABEL_PER_LEMBAR));

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
              Label QR Inventaris
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {label.length} eksemplar · {jumlahLembar} lembar A4 · 24 label per
              lembar (3 × 8). QR berisi nomor inventaris saja.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            disabled={label.length === 0}
          >
            Cetak label
          </button>
        </header>

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

        {label.length > 0 && (
          <div className="overflow-x-auto print:overflow-visible">
            <section
              className="lembar-label mx-auto w-[210mm] min-w-[210mm] bg-white p-[10mm] shadow-[0_10px_30px_rgba(15,23,42,0.08)] print:w-auto print:min-w-0 print:p-0 print:shadow-none"
              aria-label="Lembar label QR inventaris"
            >
              <div className="grid grid-cols-3">
                {label.map((l) => (
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
                ))}
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
