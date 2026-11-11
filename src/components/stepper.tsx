"use client";

/**
 * Stepper: penunjuk tahapan untuk alur berlangkah (mis. transaksi peminjaman).
 *
 * Kenapa dipisah menjadi komponen: form pinjam buku punya empat langkah yang
 * semuanya butuh status "sedang di sini / sudah lewat / belum", sedangkan
 * indikator ad-hoc di dalam modal tidak bisa dipakai ulang, tidak punya garis
 * progres, dan tidak punya penanda aksesibilitas untuk pembaca layar.
 *
 * Aturan tampilan:
 * - langkah selesai diberi centang dan garis penghubung berwarna merek,
 * - langkah aktif menonjol dengan warna merek serta `aria-current="step"`,
 * - langkah setelahnya tetap redup agar arah alur terbaca,
 * - langkah yang sudah dilalui boleh menjadi tombol lewat `onPilih` +
 *   `bolehPilih`; langkah ke depan sengaja tidak bisa diklik supaya validasi
 *   tiap langkah (anggota aktif, keranjang tidak kosong, dan seterusnya) tetap
 *   berjalan lewat tombol Lanjut.
 */
export type TahapStepper<T extends string> = {
  id: T;
  label: string;
};

export function Stepper<T extends string>({
  tahap,
  aktif,
  onPilih,
  bolehPilih,
  label = "Tahapan transaksi",
  className = "",
}: {
  tahap: ReadonlyArray<TahapStepper<T>>;
  aktif: T;
  onPilih?: (id: T) => void;
  bolehPilih?: (id: T) => boolean;
  label?: string;
  className?: string;
}) {
  const indeksAktif = Math.max(
    0,
    tahap.findIndex((t) => t.id === aktif),
  );

  return (
    <ol
      aria-label={label}
      className={`flex items-center gap-1 sm:gap-2 ${className}`}
    >
      {tahap.map((t, i) => {
        const selesai = i < indeksAktif;
        const iniAktif = i === indeksAktif;
        const bisaDiklik =
          Boolean(onPilih) &&
          !iniAktif &&
          (bolehPilih ? bolehPilih(t.id) : selesai);

        const lingkaran = `grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold tabular-nums ${
          iniAktif
            ? "border-[var(--brand-solid)] bg-[var(--brand-solid)] text-white shadow-sm"
            : selesai
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-400"
        }`;

        const teks = `truncate text-xs font-semibold ${
          iniAktif
            ? "text-[var(--brand-ink)]"
            : selesai
              ? "text-slate-600"
              : "text-slate-400"
        }`;

        const isi = (
          <>
            <span className={lingkaran} aria-hidden="true">
              {selesai ? (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            {/* Label disembunyikan di layar sempit: empat tahap tetap muat
                sebagai deretan angka bercincin tanpa membuat modal meluber. */}
            <span className={`hidden sm:inline ${teks}`}>{t.label}</span>
          </>
        );

        return (
          <li
            key={t.id}
            className="flex min-w-0 flex-1 items-center gap-1.5 last:flex-none sm:gap-2"
          >
            {bisaDiklik ? (
              <button
                type="button"
                onClick={() => onPilih?.(t.id)}
                aria-label={`Kembali ke langkah ${i + 1}: ${t.label}`}
                className="flex min-w-0 items-center gap-1.5 rounded-full transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:gap-2"
              >
                {isi}
              </button>
            ) : (
              <span
                aria-current={iniAktif ? "step" : undefined}
                className="flex min-w-0 items-center gap-1.5 sm:gap-2"
              >
                {isi}
              </span>
            )}

            {i < tahap.length - 1 && (
              <span
                aria-hidden="true"
                className={`mx-0.5 h-0.5 min-w-3 flex-1 rounded-full ${
                  selesai ? "bg-[var(--brand)]" : "bg-slate-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
