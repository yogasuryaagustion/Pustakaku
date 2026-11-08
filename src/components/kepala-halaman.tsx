import type { ReactNode } from "react";

// Kepala halaman bersama untuk semua halaman di dalam AppShell.
//
// Judul halaman sudah tampil SEKALI di header AppShell (diambil dari label menu),
// jadi komponen ini sengaja tidak mengulang judul: isinya konteks singkat
// (remah/eyebrow), satu kalimat penjelas, dan aksi utama di kanan. Dengan satu
// komponen, jarak, ukuran teks, dan posisi tombol sama di semua halaman —
// sebelumnya setiap halaman menyusun kepalanya sendiri.

export function KepalaHalaman({
  remah,
  deskripsi,
  aksi,
  className = "",
}: {
  /** Konteks kecil di atas deskripsi (breadcrumb, badge status, dsb.). */
  remah?: ReactNode;
  /** Satu-dua kalimat yang menjelaskan isi halaman. */
  deskripsi?: ReactNode;
  /** Tombol/aksi utama halaman. */
  aksi?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {remah && (
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
            {remah}
          </div>
        )}

        {deskripsi && (
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {deskripsi}
          </p>
        )}
      </div>

      {aksi && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{aksi}</div>
      )}
    </section>
  );
}
