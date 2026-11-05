
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBoleh } from "@/lib/auth";
import { useLibrary } from "@/lib/library-context";

type JenisAnggota = "Pelajar" | "Mahasiswa" | "Umum" | "Staf";

export default function TambahAnggotaPage() {
  const router = useRouter();
  const bolehKelola = useBoleh("anggota.kelola");
  const { tambahAnggota } = useLibrary();

  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [telepon, setTelepon] = useState("");
  const [alamat, setAlamat] = useState("");
  const [jenis, setJenis] = useState<JenisAnggota>("Umum");
  const [aktif, setAktif] = useState(true);
  const [memproses, setMemproses] = useState(false);
  const [pesan, setPesan] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPesan("");

    if (nama.trim().length < 3) {
      setPesan("Nama anggota minimal 3 karakter.");
      return;
    }

    if (
      email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      setPesan("Format email tidak valid.");
      return;
    }

    setMemproses(true);

    try {
      const hasil = await tambahAnggota({
        nama: nama.trim(),
        email: email.trim().toLowerCase(),
        telepon: telepon.trim(),
        alamat: alamat.trim(),
        jenis,
        aktif,
      });

      if (!hasil.ok) {
        setPesan(hasil.pesan || "Gagal menambahkan anggota.");
        return;
      }

      router.push("/anggota");
      router.refresh();
    } catch (error) {
      setPesan(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan anggota."
      );
    } finally {
      setMemproses(false);
    }
  }

  if (!bolehKelola) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Akses Tidak Diizinkan
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Kamu tidak memiliki izin untuk menambahkan anggota.
          </p>
          <Link
            href="/anggota"
            className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Kembali ke Direktori Anggota
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <div>
        <Link
          href="/anggota"
          className="text-sm font-medium text-slate-500 hover:text-teal-700"
        >
          ← Kembali ke Direktori Anggota
        </Link>

        <p className="mt-5 text-sm font-semibold text-teal-700">
          MANAJEMEN ANGGOTA
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          Tambah Anggota Baru
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Masukkan informasi anggota untuk membuat kartu keanggotaan.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 p-5 sm:p-7">
          <h2 className="font-semibold text-slate-900">
            Informasi Anggota
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Field bertanda * wajib diisi.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
          <div className="sm:col-span-2">
            <label htmlFor="nama" className="mb-2 block text-sm font-medium text-slate-700">
              Nama lengkap *
            </label>
            <input
              id="nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
              minLength={3}
              maxLength={120}
              placeholder="Masukkan nama lengkap"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              placeholder="nama@email.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>

          <div>
            <label htmlFor="telepon" className="mb-2 block text-sm font-medium text-slate-700">
              Nomor telepon
            </label>
            <input
              id="telepon"
              type="tel"
              value={telepon}
              onChange={(e) => setTelepon(e.target.value)}
              maxLength={40}
              placeholder="08xxxxxxxxxx"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>

          <div>
            <label htmlFor="jenis" className="mb-2 block text-sm font-medium text-slate-700">
              Jenis anggota *
            </label>
            <select
              id="jenis"
              value={jenis}
              onChange={(e) => setJenis(e.target.value as JenisAnggota)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
            >
              <option value="Pelajar">Pelajar</option>
              <option value="Mahasiswa">Mahasiswa</option>
              <option value="Umum">Umum</option>
              <option value="Staf">Staf</option>
            </select>
          </div>

          <div>
            <label htmlFor="aktif" className="mb-2 block text-sm font-medium text-slate-700">
              Status anggota
            </label>
            <select
              id="aktif"
              value={aktif ? "aktif" : "nonaktif"}
              onChange={(e) => setAktif(e.target.value === "aktif")}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="alamat" className="mb-2 block text-sm font-medium text-slate-700">
              Alamat
            </label>
            <textarea
              id="alamat"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Masukkan alamat anggota"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            />
          </div>

          <div className="sm:col-span-2 rounded-xl bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-900">
              Nomor anggota otomatis
            </p>
            <p className="mt-1 text-sm text-teal-800">
              Nomor kartu akan dibuat oleh sistem setelah data berhasil disimpan.
              Formulir ini tidak membuat akun login Supabase Auth.
            </p>
          </div>

          {pesan && (
            <div role="alert" className="sm:col-span-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {pesan}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:justify-end sm:px-7">
          <Link
            href="/anggota"
            className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={memproses}
            className="inline-flex justify-center rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {memproses ? "Menyimpan..." : "Simpan Anggota"}
          </button>
        </div>
      </form>
    </main>
  );
}
