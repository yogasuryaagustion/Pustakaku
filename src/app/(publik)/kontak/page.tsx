import type { Metadata } from "next";
import Link from "next/link";

// Halaman kontak — tujuan tombol "Hubungi Tim Layanan" di kartu FAQ landing.
// Konten statis (server component) supaya cepat ter-cetak & bisa diindeks.

export const metadata: Metadata = {
  title: "Kontak",
  description:
    "Cara menghubungi perpustakaan: alamat, telepon, email, dan bantuan anggota.",
};

const KONTAK = [
  {
    label: "Alamat",
    isi: "Jl. Cihampelas No. 15, Bandung",
    aksi: "Lihat di peta",
    href: "https://www.google.com/maps/search/?api=1&query=Jl.+Cihampelas+No.+15+Bandung",
    eksternal: true,
  },
  {
    label: "Telepon",
    isi: "(022) 123-4567",
    aksi: "Telepon sekarang",
    href: "tel:+62221234567",
    eksternal: false,
  },
  {
    label: "Email",
    isi: "info@pustakaku.id",
    aksi: "Kirim email",
    href: "mailto:info@pustakaku.id?subject=Hubungan%20dengan%20Perpustakaan",
    eksternal: false,
  },
];

export default function HalamanKontak() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-800">
        Layanan Perpustakaan
      </span>

      <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
        Hubungi Kami
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
        Ada pertanyaan soal peminjaman, perpanjangan, denda, atau status
        keanggotaan? Pilih kanal di bawah ini — pertanyaan Anda akan dijawab
        oleh tim pustakawan.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KONTAK.map((k) => (
          <div
            key={k.label}
            className="card card-raised flex flex-col justify-between gap-4 p-6"
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--brand-ink)]">
                {k.label}
              </div>
              <div className="mt-2 break-words text-base font-semibold text-slate-900">
                {k.isi}
              </div>
            </div>
            <a
              href={k.href}
              {...(k.eksternal ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              className="btn w-full justify-center border border-[var(--brand)]/40 text-[var(--brand-ink)] hover:bg-[var(--brand-solid)] hover:text-white"
            >
              {k.aksi}
            </a>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Sudah menjadi anggota?
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
              Pinjaman, jatuh tempo, denda, dan pertanyaan umum tersedia di
              panel Anda — lebih cepat daripada menunggu balasan email.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/panel/bantuan" className="btn btn-primary">
              Buka Bantuan
            </Link>
            <Link href="/katalog" className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              Lihat Katalog
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs leading-6 text-[var(--muted)]">
        Informasi kontak pada halaman ini juga tercantum di bagian footer
        halaman utama, sehingga selalu konsisten.
      </p>
    </div>
  );
}
