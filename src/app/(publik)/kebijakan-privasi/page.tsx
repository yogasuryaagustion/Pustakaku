import type { Metadata } from "next";
import Link from "next/link";

// Kebijakan privasi — tujuan tautan "Kebijakan Privasi" di footer landing.
// Isi mengikuti cara sistem ini benar-benar bekerja: akun lewat Supabase Auth,
// data operasional di PostgreSQL dengan Row Level Security, dan jejak aktivitas
// untuk audit. Teks statis (server component) agar cepat & mudah diindeks.

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Bagaimana sistem perpustakaan mengumpulkan, menyimpan, dan melindungi data anggota.",
};

const BAB: { judul: string; isi: React.ReactNode }[] = [
  {
    judul: "1. Data yang kami kumpulkan",
    isi: (
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
        <li>
          <b className="text-slate-800">Data akun:</b> nama, alamat email, dan
          kata sandi. Kata sandi tidak pernah disimpan dalam bentuk teks biasa —
          disimpan ter-hash oleh Supabase Auth.
        </li>
        <li>
          <b className="text-slate-800">Data kartu anggota:</b> nomor anggota,
          jenis keanggotaan, nomor telepon, alamat, dan foto profil bila Anda
          mengunggahnya.
        </li>
        <li>
          <b className="text-slate-800">Data sirkulasi:</b> buku yang dipinjam,
          tanggal pinjam, tanggal kembali, perpanjangan, dan denda yang timbul.
        </li>
        <li>
          <b className="text-slate-800">Jejak aktivitas:</b> catatan keamanan
          berupa siapa yang masuk dan tindakan apa yang dilakukan (dipakai untuk
          audit, bukan untuk keperluan pemasaran).
        </li>
        <li>
          <b className="text-slate-800">Data di peramban Anda:</b> cookie sesi
          (agar Anda tidak perlu masuk berulang kali) serta preferensi tema
          yang disimpan di penyimpanan lokal peramban.
        </li>
      </ul>
    ),
  },
  {
    judul: "2. Cara data digunakan",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Data dipakai semata-mata untuk menjalankan layanan perpustakaan:
        mengelola keanggotaan, memproses peminjaman dan pengembalian, menghitung
        jatuh tempo serta denda, menyusun laporan, dan menjaga keamanan akun.
      </p>
    ),
  },
  {
    judul: "3. Penyimpanan dan keamanan",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Seluruh data tersimpan di database Supabase (PostgreSQL) milik
        perpustakaan. Akses dibatasi lewat Row Level Security (RLS) dan matriks
        izin: anggota hanya dapat melihat datanya sendiri, sedangkan pustakawan
        mengakses data sesuai kewenangannya. Kunci akses server tidak pernah
        dikirimkan ke peramban.
      </p>
    ),
  },
  {
    judul: "4. Pembagian data",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Kami tidak menjual, menyewakan, atau membagikan data pribadi Anda ke
        pihak ketiga untuk keperluan pemasaran. Data hanya dapat dibuka bila
        diwajibkan oleh hukum atau untuk melindungi hak perpustakaan dan
        anggota lain.
      </p>
    ),
  },
  {
    judul: "5. Hak Anda",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Anda berhak meminta salinan, koreksi, atau penghapusan data pribadi
        Anda. Kirimkan permintaan ke{" "}
        <a
          href="mailto:info@pustakaku.id"
          className="font-semibold text-[var(--brand)] underline underline-offset-2 hover:text-teal-600"
        >
          info@pustakaku.id
        </a>{" "}
        atau melalui halaman{" "}
        <Link
          href="/kontak"
          className="font-semibold text-[var(--brand)] underline underline-offset-2 hover:text-teal-600"
        >
          Kontak
        </Link>
        . Untuk mengubah data akun Anda sendiri, gunakan halaman Profil di
        panel anggota.
      </p>
    ),
  },
  {
    judul: "6. Perubahan kebijakan",
    isi: (
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Kebijakan ini dapat diperbarui sewaktu-waktu. Versi terbaru selalu
        dipublikasikan di halaman ini, dan perubahan penting akan
        dikomunikasikan melalui kanal resmi perpustakaan.
      </p>
    ),
  },
];

export default function HalamanKebijakanPrivasi() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-teal-800">
        Legal
      </span>

      <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
        Kebijakan Privasi
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
        Halaman ini menjelaskan data apa yang dikumpulkan sistem perpustakaan,
        untuk apa digunakan, dan bagaimana data itu dilindungi.
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
          href="/syarat-ketentuan"
          className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Baca Syarat &amp; Ketentuan
        </Link>
      </div>
    </div>
  );
}
