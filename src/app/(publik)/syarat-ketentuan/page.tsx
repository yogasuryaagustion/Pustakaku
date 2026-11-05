import type { Metadata } from "next";
import Link from "next/link";

// Syarat & ketentuan — tujuan tautan "Syarat & Ketentuan" di footer landing.
// Angka durasi/denda sengaja TIDAK ditulis di sini: nilainya diatur admin dan
// ditampilkan langsung oleh sistem (katalog, panel, FAQ) sehingga halaman ini
// tidak pernah basi.

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Ketentuan keanggotaan, peminjaman, pengembalian, dan penggunaan sistem perpustakaan.",
};

const BAB: { judul: string; isi: React.ReactNode }[] = [
  {
    judul: "1. Penerimaan ketentuan",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Dengan mendaftar dan menggunakan sistem ini, Anda dianggap telah
        membaca serta menyetujui seluruh ketentuan di halaman ini. Bila Anda
        tidak setuju, mohon tidak menggunakan layanan.
      </p>
    ),
  },
  {
    judul: "2. Keanggotaan",
    isi: (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
        <li>
          Pendaftaran dilakukan dengan data yang benar dan dapat
          dipertanggungjawabkan; satu akun untuk satu orang.
        </li>
        <li>
          Kartu anggota digital dibuat otomatis setelah pendaftaran dan
          digunakan untuk seluruh layanan sirkulasi.
        </li>
        <li>
          Perpustakaan berhak menonaktifkan keanggotaan yang melanggar ketentuan
          atau memberikan data tidak benar.
        </li>
      </ul>
    ),
  },
  {
    judul: "3. Peminjaman buku",
    isi: (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
        <li>
          Durasi pinjam, batas jumlah buku, dan tanggal jatuh tempo mengikuti
          ketentuan yang ditampilkan sistem saat Anda mengajukan peminjaman —
          dihitung otomatis, bukan manual.
        </li>
        <li>
          Peminjaman hanya dapat diajukan oleh anggota aktif dengan akun yang
          masih berlaku.
        </li>
        <li>
          Eksemplar yang tersedia mengikuti data katalog; peminjaman otomatis
          ditolak bila stok habis.
        </li>
      </ul>
    ),
  },
  {
    judul: "4. Pengembalian, perpanjangan & denda",
    isi: (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
        <li>
          Buku dikembalikan ke meja layanan perpustakaan; pencatatan dilakukan
          oleh pustakawan sehingga status pinjaman akurat.
        </li>
        <li>
          Perpanjangan dapat diminta dari panel anggota sebelum jatuh tempo,
          sesuai jumlah perpanjangan yang diizinkan sistem.
        </li>
        <li>
          Keterlambatan dikenakan denda per hari sesuai ketentuan yang tampil di
          panel dan FAQ, dan wajib diselesaikan sebelum pinjaman berikutnya.
        </li>
      </ul>
    ),
  },
  {
    judul: "5. Tanggung jawab akun",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Anda bertanggung jawab menjaga kerahasiaan kata sandi. Seluruh aktivitas
        yang dilakukan melalui akun Anda menjadi tanggung jawab Anda. Segera
        laporkan ke pustakawan bila mencurigakan ada pihak lain yang menggunakan
        akun Anda.
      </p>
    ),
  },
  {
    judul: "6. Penggunaan yang tidak diizinkan",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Dilarang meminjamkan akun, memanipulasi data peminjaman, melakukan
        akses di luar kewenangan peran, atau merusak koleksi. Pelanggaran dapat
        berujung penonaktifan keanggotaan sesuai kebijakan perpustakaan.
      </p>
    ),
  },
  {
    judul: "7. Data pribadi & perubahan ketentuan",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Penggunaan data pribadi Anda diatur dalam{" "}
        <Link
          href="/kebijakan-privasi"
          className="font-semibold text-[var(--brand)] underline underline-offset-2 hover:text-teal-600"
        >
          Kebijakan Privasi
        </Link>
        . Ketentuan ini dapat diperbarui sewaktu-waktu; versi terbaru selalu
        tersedia di halaman ini.
      </p>
    ),
  },
];

export default function HalamanSyaratKetentuan() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-800">
        Legal
      </span>

      <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
        Syarat &amp; Ketentuan
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
        Ketentuan penggunaan layanan perpustakaan, mulai dari keanggotaan
        hingga pengembalian buku.
      </p>

      <div className="mt-8 space-y-4">
        {BAB.map((b) => (
          <section key={b.judul} className="card p-6 sm:p-7">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              {b.judul}
            </h2>
            {b.isi}
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/" className="btn btn-primary">
          Kembali ke Beranda
        </Link>
        <Link
          href="/kebijakan-privasi"
          className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Baca Kebijakan Privasi
        </Link>
      </div>
    </div>
  );
}
