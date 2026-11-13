"use client";

// Grafik area interaktif untuk panel "Analitik Visual & Tren Operasional".
// Digambar sendiri dengan SVG supaya tidak menambah dependensi: dua seri halus
// dengan gradien area, garis bantu, titik data, dan tooltip yang mengikuti
// bulan di bawah kursor (atau panah kiri/kanan saat memakai keyboard).

import { useEffect, useId, useRef, useState } from "react";

export interface TitikTren {
  label: string;
  pinjam: number;
  /** Opsional: dashboard hanya memakai satu seri, laporan memakai keduanya. */
  kembali?: number;
}

const TINGGI = 180;
const PAD_ATAS = 16;
const PAD_BAWAH = 26;
const PAD_KIRI = 30;
const PAD_KANAN = 10;
// Kekakuan kurva: makin kecil, makin landai. 0,16 cukup untuk data bulanan
// tanpa membuat garis melengkung melewati titiknya sendiri.
const TENSI = 0.16;

type Titik = [number, number];

/**
 * Kurva halus Catmull-Rom yang diterjemahkan menjadi kurva Bezier. Titik
 * kendali dijepit ke area plot supaya garis tidak melintas di bawah garis nol
 * atau di atas atap grafik saat data berubah tajam.
 */
function jalurHalus(titik: Titik[], atas: number, bawah: number): string {
  if (titik.length === 0) return "";
  if (titik.length === 1) return `M ${titik[0][0]} ${titik[0][1]}`;

  const jepit = (nilai: number) => Math.min(bawah, Math.max(atas, nilai));
  let d = `M ${titik[0][0]} ${titik[0][1]}`;

  for (let i = 0; i < titik.length - 1; i += 1) {
    const p0 = titik[i - 1] ?? titik[i];
    const p1 = titik[i];
    const p2 = titik[i + 1];
    const p3 = titik[i + 2] ?? p2;

    const c1x = p1[0] + (p2[0] - p0[0]) * TENSI;
    const c1y = jepit(p1[1] + (p2[1] - p0[1]) * TENSI);
    const c2x = p2[0] - (p3[0] - p1[0]) * TENSI;
    const c2y = jepit(p2[1] - (p3[1] - p1[1]) * TENSI);

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }

  return d;
}

export function GrafikTren({ data }: { data: TitikTren[] }) {
  const wadah = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(0);
  const [aktif, setAktif] = useState<number | null>(null);
  const idGrad = useId().replace(/[:]/g, "");

  // Lebar diukur dari wadah agar SVG digambar 1:1 dengan piksel layar
  // (viewBox = ukuran asli), sehingga teks dan titik tidak ikut teregang.
  useEffect(() => {
    const el = wadah.current;
    if (!el) return;

    const ukur = () => setLebar(el.clientWidth);
    ukur();

    const pengamat = new ResizeObserver(ukur);
    pengamat.observe(el);

    return () => pengamat.disconnect();
  }, []);

  if (data.length === 0) return null;

  // Seri pengembalian hanya digambar bila datanya memang dikirim pemanggil.
  const adaKembali = data.some((d) => typeof d.kembali === "number");
  const maks = Math.max(1, ...data.flatMap((d) => [d.pinjam, d.kembali ?? 0]));
  const dasar = TINGGI - PAD_BAWAH;
  const tinggiPlot = dasar - PAD_ATAS;
  const langkah =
    data.length > 1 ? (lebar - PAD_KIRI - PAD_KANAN) / (data.length - 1) : 0;

  const x = (i: number) => PAD_KIRI + i * langkah;
  const y = (nilai: number) => dasar - (nilai / maks) * tinggiPlot;

  const titik = (kunci: "pinjam" | "kembali"): Titik[] =>
    data.map((d, i) => [x(i), y(d[kunci] ?? 0)]);

  const seriPinjam = titik("pinjam");
  const seriKembali = adaKembali ? titik("kembali") : [];
  const garisPinjam = jalurHalus(seriPinjam, PAD_ATAS, dasar);
  const garisKembali = jalurHalus(seriKembali, PAD_ATAS, dasar);

  const area = (garis: string, seri: Titik[]) =>
    `${garis} L ${seri[seri.length - 1][0]} ${dasar} L ${seri[0][0]} ${dasar} Z`;

  const pilih = (klienX: number, kiri: number) => {
    if (langkah <= 0) {
      setAktif(0);
      return;
    }

    const indeks = Math.round((klienX - kiri - PAD_KIRI) / langkah);
    setAktif(Math.min(data.length - 1, Math.max(0, indeks)));
  };

  const terpilih = aktif === null ? null : data[aktif];
  const posisiTooltip = terpilih
    ? Math.min(Math.max(x(aktif as number), 66), Math.max(lebar - 66, 66))
    : 0;

  return (
    <div
      ref={wadah}
      role="img"
      tabIndex={0}
      aria-label={`Grafik tren ${adaKembali ? "peminjaman dan pengembalian" : "peminjaman"} ${data.length} bulan terakhir. Gunakan panah kiri dan kanan untuk membaca tiap bulan.`}
      className="relative rounded-xl"
      style={{ height: TINGGI }}
      onPointerMove={(e) =>
        pilih(e.clientX, e.currentTarget.getBoundingClientRect().left)
      }
      onPointerLeave={() => setAktif(null)}
      onFocus={() => setAktif((kini) => kini ?? data.length - 1)}
      onBlur={() => setAktif(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
          if (e.key === "Escape") setAktif(null);
          return;
        }

        e.preventDefault();
        setAktif((kini) => {
          const mulai = kini ?? data.length - 1;
          const geser = e.key === "ArrowRight" ? 1 : -1;
          return Math.min(data.length - 1, Math.max(0, mulai + geser));
        });
      }}
    >
      {lebar > 0 && (
        <svg
          width="100%"
          height={TINGGI}
          viewBox={`0 0 ${lebar} ${TINGGI}`}
          aria-hidden
        >
          <defs>
            <linearGradient id={`${idGrad}-p`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: "var(--brand-solid)", stopOpacity: 0.3 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: "var(--brand-solid)", stopOpacity: 0.02 }}
              />
            </linearGradient>
            <linearGradient id={`${idGrad}-k`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                style={{
                  stopColor: "color-mix(in srgb, var(--brand) 55%, #ffffff)",
                  stopOpacity: 0.24,
                }}
              />
              <stop offset="100%" style={{ stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {/* Garis bantu + skala Y (nol, tengah, maksimum). */}
          {[0, 0.5, 1].map((rasio) => (
            <g key={`sumbu-${rasio}`}>
              <line
                x1={PAD_KIRI}
                x2={lebar - PAD_KANAN}
                y1={y(maks * rasio)}
                y2={y(maks * rasio)}
                className="tren-sumbu-garis"
              />
              <text
                x={PAD_KIRI - 9}
                y={y(maks * rasio)}
                textAnchor="end"
                dominantBaseline="middle"
                className="tren-sumbu-teks"
              >
                {Math.round(maks * rasio)}
              </text>
            </g>
          ))}

          {adaKembali && (
            <path d={area(garisKembali, seriKembali)} fill={`url(#${idGrad}-k)`} />
          )}
          <path d={area(garisPinjam, seriPinjam)} fill={`url(#${idGrad}-p)`} />

          {adaKembali && (
            <path
              d={garisKembali}
              pathLength={1}
              fill="none"
              className="tren-areas tren-kembali-garis"
            />
          )}
          <path
            d={garisPinjam}
            pathLength={1}
            fill="none"
            className="tren-areas tren-pinjam-garis"
          />

          {terpilih && (
            <line
              x1={x(aktif as number)}
              x2={x(aktif as number)}
              y1={PAD_ATAS - 4}
              y2={dasar}
              className="tren-silang"
            />
          )}

          {data.map((d, i) => (
            <g key={`titik-${d.label}-${i}`}>
              {adaKembali && (
                <circle
                  cx={x(i)}
                  cy={y(d.kembali ?? 0)}
                  r={aktif === i ? 4 : 2.6}
                  className="tren-titik tren-titik-kembali"
                />
              )}
              <circle
                cx={x(i)}
                cy={y(d.pinjam)}
                r={aktif === i ? 4 : 2.6}
                className="tren-titik tren-titik-pinjam"
              />
            </g>
          ))}

          {data.map((d, i) => (
            <text
              key={`bulan-${d.label}-${i}`}
              x={x(i)}
              y={TINGGI - 8}
              textAnchor="middle"
              className="tren-bulan-teks"
            >
              {d.label}
            </text>
          ))}
        </svg>
      )}

      {terpilih && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-white/80 bg-white/95 px-2.5 py-1.5 text-[10px] shadow-lg"
          style={{ left: posisiTooltip, top: 0 }}
        >
          <p className="font-bold text-slate-700">{terpilih.label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-slate-500">
            <i className="h-1.5 w-1.5 rounded-full tren-pinjam-titik" />
            Peminjaman
            <strong className="font-mono text-slate-800">{terpilih.pinjam}</strong>
          </p>
          {adaKembali && (
            <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-slate-500">
              <i className="h-1.5 w-1.5 rounded-full tren-kembali-titik" />
              Pengembalian
              <strong className="font-mono text-slate-800">
                {terpilih.kembali ?? 0}
              </strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
