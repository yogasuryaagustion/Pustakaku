"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { useLibrary } from "@/lib/library-context";
import type { Anggota } from "@/lib/types";
import { catatJejak } from "@/lib/audit";
import { keThumbnailFoto } from "@/lib/foto";
import { tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";

// Profil (anggota) — info profil, edit profil, & ganti kata sandi dalam satu
// halaman. Izin panel.profil mengatur visibilitas (menu & rute dijaga
// AppShell); mutasinya dicek ulang di auth.ubahProfil / gantiSandi, bukan
// hanya UI.
// Formulir jadi komponen terpisah agar nilai awal bisa diinisialisasi
// saat kartu anggota sudah siap (tanpa setState di dalam effect).

type SedangMasuk = NonNullable<ReturnType<typeof useAuth>["sedangMasuk"]>;

export default function PengaturanProfilPage() {
  const { sedangMasuk } = useAuth();
  const { anggota, siap } = useLibrary();
  const boleh = useBoleh("panel.profil");

  // Kartu anggota: lewat tautan anggotaId pada akun; fallback email.
  const kartu = useMemo(() => {
    if (!sedangMasuk) return undefined;
    if (sedangMasuk.anggotaId) return anggota.find((a) => a.id === sedangMasuk.anggotaId);
    return anggota.find((a) => a.email.toLowerCase() === sedangMasuk.email.toLowerCase());
  }, [anggota, sedangMasuk]);

  // Tunggu data lengkap dulu; seluruh hook sudah di atas (aturan hooks aman).
  if (!sedangMasuk || !siap || !kartu || !boleh) {
    return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;
  }
  return <FormProfil sedangMasuk={sedangMasuk} kartu={kartu} />;
}

function FormProfil({ sedangMasuk, kartu }: { sedangMasuk: SedangMasuk; kartu: Anggota }) {
  const { ubahProfil, gantiSandi } = useAuth();
  const { ubahAnggota } = useLibrary();
  const toast = useToast();

  const [form, setForm] = useState({
    nama: sedangMasuk.nama,
    email: sedangMasuk.email,
    telepon: kartu.telepon,
    alamat: kartu.alamat,
  });
  const [sandi, setSandi] = useState({ lama: "", baru: "", ulangi: "" });
  const [prosesSandi, setProsesSandi] = useState(false);
  // Foto: undefined = tidak diubah, null = dihapus, string = foto baru hasil
  // resize. Hanya dikirim ke context saat berubah (di Simpan Profil).
  const [fotoBaru, setFotoBaru] = useState<string | null | undefined>(undefined);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const previewFoto = fotoBaru !== undefined ? fotoBaru : kartu.foto;

  async function pilihFotoBaru(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan memilih berkas yang sama lagi
    if (!file) return;
    const hasil = await keThumbnailFoto(file);
    if (!hasil.ok || !hasil.dataUrl) {
      toast.gagal(hasil.pesan ?? "Foto tidak bisa dibaca — coba berkas lain.");
      return;
    }
    setFotoBaru(hasil.dataUrl);
  }

  async function simpanProfil(e: React.FormEvent) {
    e.preventDefault();
    const nama = form.nama.trim();
    const email = form.email.trim();
    if (!nama) return;
    const r = await ubahProfil({ nama, email });
    if (!r.ok) {
      toast.gagal(r.pesan);
      return;
    }
    const kartuBaru = await ubahAnggota(kartu.id, {
      nama,
      email,
      telepon: form.telepon.trim(),
      alamat: form.alamat.trim(),
      // Terapkan foto hanya bila berubah (undefined = lewati).
      ...(fotoBaru !== undefined ? { foto: fotoBaru } : {}),
    });
    if (!kartuBaru.ok) {
      toast.gagal(kartuBaru.pesan);
      return;
    }
    catatJejak({
      aktor: nama,
      peran: sedangMasuk.peran,
      jenis: "sistem",
      aksi: "Profil diperbarui",
      objek: email,
      detail:
        fotoBaru === undefined
          ? "Data profil diperbarui dari halaman Profil"
          : fotoBaru === null
            ? "Foto profil dihapus dari halaman Profil"
            : "Data profil & foto profil diperbarui dari halaman Profil",
    });
    setFotoBaru(undefined);
    toast.sukses(
      fotoBaru !== undefined ? "Profil & foto berhasil diperbarui." : "Profil berhasil diperbarui."
    );
  }

  async function simpanSandi(e: React.FormEvent) {
    e.preventDefault();
    setProsesSandi(true);
    const r = await gantiSandi(sandi.lama, sandi.baru, sandi.ulangi);
    setProsesSandi(false);
    if (!r.ok) {
      toast.gagal(r.pesan);
      return;
    }
    setSandi({ lama: "", baru: "", ulangi: "" });
    toast.sukses("Kata sandi berhasil diganti.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Kepala: identitas (foto bila ada) */}
      <div className="card flex items-center gap-4 p-5">
        {kartu.foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL kecil hasil resize lokal
          <img
            src={kartu.foto}
            alt={`Foto ${sedangMasuk.nama}`}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl grad-brand text-xl font-bold text-white">
            {sedangMasuk.nama.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{sedangMasuk.nama}</h1>
          <p className="truncate text-xs text-[var(--muted)]">
            {kartu?.nomorAnggota ?? "Tanpa kartu"} · {sedangMasuk.email}
          </p>
        </div>
      </div>

      {/* Info profil — ringkasan data kartu anggota (baca saja) */}
      <div className="card p-6">
        <h2 className="font-bold">Info Profil</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Ringkasan data keanggotaan Anda. Ubah lewat formulir Edit Profil di bawah.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          {[
            ["Nomor Anggota", kartu.nomorAnggota],
            ["Nama Lengkap", kartu.nama],
            ["Email", kartu.email],
            ["Telepon", kartu.telepon || "—"],
            ["Alamat", kartu.alamat || "—"],
            ["Jenis Anggota", kartu.jenis],
            ["Bergabung Sejak", tanggalPanjang(kartu.bergabungPada)],
            ["Status", kartu.aktif ? "Aktif" : "Nonaktif"],
          ].map(([label, nilai]) => (
            <div key={label}>
              <dt className="text-xs text-[var(--muted)]">{label}</dt>
              <dd className="mt-0.5 font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Edit profil */}
      <form onSubmit={simpanProfil} className="card p-6">
        <h2 className="font-bold">Edit Profil</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Perubahan nama, email, & foto berlaku untuk akun masuk dan kartu anggota Anda.
        </p>
        {/* Ubah foto profil — pratinjau langsung, diterapkan saat Simpan */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {previewFoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL kecil hasil resize lokal
            <img
              src={previewFoto}
              alt="Pratinjau foto profil"
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl grad-brand text-xl font-bold text-white">
              {sedangMasuk.nama.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div className="text-sm font-semibold">Foto Profil</div>
            <p className="text-xs text-[var(--muted)]">JPG/PNG maks 5 MB — otomatis dikecilkan.</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => inputFotoRef.current?.click()}
              >
                {previewFoto ? "Ganti Foto" : "Pilih Foto"}
              </button>
              {fotoBaru !== undefined && (
                <button type="button" className="btn btn-ghost" onClick={() => setFotoBaru(undefined)}>
                  Batalkan
                </button>
              )}
              {previewFoto && (
                <button
                  type="button"
                  className="btn btn-ghost text-[var(--danger,#dc2626)]"
                  onClick={() => setFotoBaru(null)}
                >
                  Hapus Foto
                </button>
              )}
            </div>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Pilih foto profil baru"
              onChange={pilihFotoBaru}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profil-nama">Nama Lengkap</label>
            <input
              id="profil-nama"
              className="input"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="profil-email">Email</label>
            <input
              id="profil-email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="profil-telepon">Telepon</label>
            <input
              id="profil-telepon"
              className="input"
              value={form.telepon}
              onChange={(e) => setForm({ ...form, telepon: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profil-alamat">Alamat</label>
            <textarea
              id="profil-alamat"
              className="input"
              rows={2}
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="submit" className="btn btn-primary">
            Simpan Profil
          </button>
        </div>
      </form>

      {/* Ganti kata sandi */}
      <form onSubmit={simpanSandi} className="card p-6">
        <h2 className="font-bold">Kata Sandi</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Gunakan kata sandi yang panjang dan tidak dipakai di layanan lain.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="sandi-lama">Kata Sandi Saat Ini</label>
            <input
              id="sandi-lama"
              className="input"
              type="password"
              value={sandi.lama}
              onChange={(e) => setSandi({ ...sandi, lama: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="sandi-baru">Kata Sandi Baru</label>
            <input
              id="sandi-baru"
              className="input"
              type="password"
              value={sandi.baru}
              onChange={(e) => setSandi({ ...sandi, baru: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="sandi-ulangi">Ulangi Kata Sandi Baru</label>
            <input
              id="sandi-ulangi"
              className="input"
              type="password"
              value={sandi.ulangi}
              onChange={(e) => setSandi({ ...sandi, ulangi: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={prosesSandi}>
            {prosesSandi ? "Menyimpan…" : "Ganti Kata Sandi"}
          </button>
        </div>
      </form>
    </div>
  );
}
