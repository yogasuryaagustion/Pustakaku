
"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { useLibrary } from "@/lib/library-context";
import type { Anggota } from "@/lib/types";
import { catatJejak } from "@/lib/audit";
import { keThumbnailFoto } from "@/lib/foto";
import { tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";

type SedangMasuk = NonNullable<
  ReturnType<typeof useAuth>["sedangMasuk"]
>;

type TabProfil = "identitas" | "preferensi" | "keamanan" | "aktivitas";

const kategoriBuku = [
  "Teknologi & Komputer",
  "Pengembangan Diri",
  "Fiksi Ilmiah & Fantasi",
  "Sains & Kosmologi",
  "Filsafat & Logika",
  "Bisnis & Manajemen",
  "Sastra & Sejarah",
  "Psikologi & Kognitif",
  "Desain & Seni Visual",
  "Kesehatan & Kebugaran",
];

function Ikon({
  nama,
  ukuran = 17,
}: {
  nama: string;
  ukuran?: number;
}) {
  const props = {
    width: ukuran,
    height: ukuran,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const gambar: Record<string, React.ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z" />
        <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
        <path d="M9 7h6" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" />
      </>
    ),
    camera: (
      <>
        <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    phone: (
      <path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M4 17v3h16v-3" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    flame: (
      <path d="M12 22c4.5 0 7-3.1 7-7 0-3-1.5-5-4-7-.2 2-1 3-2 3-1-3-2-5-4-7 0 4-1 6-3 9-2 4 1 9 6 9z" />
    ),
    shield: (
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };

  return <svg {...props}>{gambar[nama] ?? gambar.user}</svg>;
}

function TabButton({
  aktif,
  onClick,
  ikon,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  ikon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
        aktif
          ? "bg-[var(--brand)] text-white shadow-sm"
          : "text-slate-600 hover:bg-teal-50 hover:text-teal-800"
      }`}
    >
      <Ikon nama={ikon} ukuran={15} />
      {children}
    </button>
  );
}

function InputProfil({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-50"
      />
    </div>
  );
}

function Informasi({
  label,
  nilai,
  ikon,
}: {
  label: string;
  nilai: string;
  ikon?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {ikon && <span className="text-slate-400"><Ikon nama={ikon} ukuran={14} /></span>}
        <p className="break-words text-sm font-semibold text-slate-900">
          {nilai}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  aktif,
  onChange,
}: {
  aktif: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      onClick={() => onChange(!aktif)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        aktif ? "bg-[var(--brand)]" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
          aktif ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function PengaturanProfilPage() {
  const { sedangMasuk } = useAuth();
  const { anggota, siap } = useLibrary();
  const boleh = useBoleh("panel.profil");

  const kartu = useMemo(() => {
    if (!sedangMasuk) return undefined;

    if (sedangMasuk.anggotaId) {
      return anggota.find((a) => a.id === sedangMasuk.anggotaId);
    }

    return anggota.find(
      (a) =>
        a.email.toLowerCase() === sedangMasuk.email.toLowerCase()
    );
  }, [anggota, sedangMasuk]);

  if (!sedangMasuk || !siap || !kartu || !boleh) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--muted)]">
        Memuat data profil...
      </div>
    );
  }

  return <KontenProfil sedangMasuk={sedangMasuk} kartu={kartu} />;
}

function KontenProfil({
  sedangMasuk,
  kartu,
}: {
  sedangMasuk: SedangMasuk;
  kartu: Anggota;
}) {
  const { ubahProfil, gantiSandi } = useAuth();
  const { ubahAnggota } = useLibrary();
  const toast = useToast();

  const [tab, setTab] = useState<TabProfil>("identitas");
  const [modeEdit, setModeEdit] = useState(false);

  const [form, setForm] = useState({
    nama: sedangMasuk.nama,
    email: sedangMasuk.email,
    telepon: kartu.telepon ?? "",
    alamat: kartu.alamat ?? "",
  });

  const [sandi, setSandi] = useState({
    lama: "",
    baru: "",
    ulangi: "",
  });

  const [prosesSandi, setProsesSandi] = useState(false);

  const [fotoBaru, setFotoBaru] = useState<string | null | undefined>(
    undefined
  );

  const inputFotoRef = useRef<HTMLInputElement>(null);

  const previewFoto =
    fotoBaru !== undefined ? fotoBaru : kartu.foto;

  const inisial = sedangMasuk.nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((kata) => kata[0])
    .join("")
    .toUpperCase();

  const [minat, setMinat] = useState<string[]>([
    "Teknologi & Komputer",
    "Pengembangan Diri",
    "Fiksi Ilmiah & Fantasi",
    "Sains & Kosmologi",
  ]);

  const [notifikasi, setNotifikasi] = useState({
    email: true,
    whatsapp: true,
    rekomendasi: true,
    buletin: false,
  });

  function ubahForm(kunci: keyof typeof form, nilai: string) {
    setForm((sebelumnya) => ({
      ...sebelumnya,
      [kunci]: nilai,
    }));
  }

  function ubahNotifikasi(
    kunci: keyof typeof notifikasi,
    nilai: boolean
  ) {
    setNotifikasi((sebelumnya) => ({
      ...sebelumnya,
      [kunci]: nilai,
    }));
  }

  function pilihKategori(kategori: string) {
    setMinat((sebelumnya) => {
      if (sebelumnya.includes(kategori)) {
        return sebelumnya.filter((item) => item !== kategori);
      }

      if (sebelumnya.length >= 4) {
        toast.gagal("Maksimal pilih 4 kategori favorit.");
        return sebelumnya;
      }

      return [...sebelumnya, kategori];
    });
  }

  async function pilihFotoBaru(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    const hasil = await keThumbnailFoto(file);

    if (!hasil.ok || !hasil.dataUrl) {
      toast.gagal(
        hasil.pesan ?? "Foto tidak bisa dibaca. Silakan coba berkas lain."
      );
      return;
    }

    setFotoBaru(hasil.dataUrl);
  }

  async function simpanProfil(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nama = form.nama.trim();
    const email = form.email.trim();

    if (!nama || !email) {
      toast.gagal("Nama dan email wajib diisi.");
      return;
    }

    const hasilProfil = await ubahProfil({ nama, email });

    if (!hasilProfil.ok) {
      toast.gagal(hasilProfil.pesan);
      return;
    }

    const hasilAnggota = await ubahAnggota(kartu.id, {
      nama,
      email,
      telepon: form.telepon.trim(),
      alamat: form.alamat.trim(),
      ...(fotoBaru !== undefined ? { foto: fotoBaru } : {}),
    });

    if (!hasilAnggota.ok) {
      toast.gagal(hasilAnggota.pesan);
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
            : "Data profil dan foto profil diperbarui dari halaman Profil",
    });

    setFotoBaru(undefined);
    setModeEdit(false);
    toast.sukses("Profil berhasil diperbarui.");
  }

  async function simpanSandi(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProsesSandi(true);

    const hasil = await gantiSandi(
      sandi.lama,
      sandi.baru,
      sandi.ulangi
    );

    setProsesSandi(false);

    if (!hasil.ok) {
      toast.gagal(hasil.pesan);
      return;
    }

    setSandi({ lama: "", baru: "", ulangi: "" });
    toast.sukses("Kata sandi berhasil diganti.");
  }

  function batalkanEdit() {
    setForm({
      nama: sedangMasuk.nama,
      email: sedangMasuk.email,
      telepon: kartu.telepon ?? "",
      alamat: kartu.alamat ?? "",
    });
    setFotoBaru(undefined);
    setModeEdit(false);
  }

  const statistik = [
    { label: "Sedang Dipinjam", nilai: "—", keterangan: "Data pinjaman" },
    { label: "Riwayat Selesai", nilai: "—", keterangan: "Buku selesai" },
    { label: "Tanggungan Denda", nilai: "—", keterangan: "Belum tersedia" },
    { label: "Kedisiplinan Waktu", nilai: "—", keterangan: "Belum tersedia" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-8">
      {/* HEADER PROFIL */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-white/10 grad-brand p-6 text-white shadow-[var(--sh-3)] sm:p-8">

  {/* DEKORASI BACKGROUND */}
  <div className="pointer-events-none absolute inset-0 bg-teal-600 overflow-hidden">

    {/* Lingkaran kiri */}
    <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-emerald-400/10 blur-2xl" />

    {/* Cahaya kanan */}
    <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-green-300/20 blur-3xl" />

    {/* Gelombang bawah */}
    <div className="absolute -bottom-36 left-[20%] h-64 w-[65%] rotate-[-8deg] rounded-[50%] border-t border-white/10 bg-emerald-300/5" />

    <div className="absolute -bottom-44 right-[-5%] h-72 w-[50%] rotate-[-12deg] rounded-[50%] border-t border-white/10 bg-emerald-300/10" />

    {/* Ikon buku transparan */}
    <svg
      viewBox="0 0 120 100"
      fill="none"
      className="absolute right-[22%] top-1/2 hidden h-36 w-40 -translate-y-1/2 text-white/[0.07] lg:block"
    >
      <path
        d="M60 27C48 12 29 9 8 14V78C29 73 48 76 60 91C72 76 91 73 112 78V14C91 9 72 12 60 27Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M60 27V91M18 27C34 24 47 29 60 38M102 27C86 24 73 29 60 38"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>

  </div>

  {/* KONTEN UTAMA */}
  <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-center">

    {/* FOTO DAN IDENTITAS */}
    <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-center">

      {/* FOTO PROFIL */}
      <div className="relative shrink-0">

        {previewFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewFoto}
            alt={`Foto ${sedangMasuk.nama}`}
            className="h-24 w-24 rounded-[22px] border-2 border-emerald-200/50 object-cover shadow-xl sm:h-[120px] sm:w-[120px]"
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-[22px] border-2 border-white/30 grad-brand text-3xl font-extrabold text-white shadow-xl sm:h-[120px] sm:w-[120px] sm:text-4xl">
            {inisial || "A"}
          </div>
        )}

        {/* TOMBOL KAMERA */}
        <button
          type="button"
          onClick={() => {
            setTab("identitas");
            setModeEdit(true);
            setTimeout(() => inputFotoRef.current?.click(), 0);
          }}
          title="Ganti foto profil"
          aria-label="Ganti foto profil"
          className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-xl border-2 border-white bg-white text-emerald-800 shadow-lg transition hover:bg-emerald-50"
        >
          <Ikon nama="camera" ukuran={18} />
        </button>

      </div>

      {/* INFORMASI IDENTITAS */}
      <div className="min-w-0">

        {/* NOMOR ANGGOTA DAN STATUS */}
        <div className="mb-3 flex flex-wrap items-center gap-2">

          <span className="rounded-lg border border-white/25 bg-white/15 px-3 py-1.5 font-mono text-[10px] font-bold tracking-wide text-white">
            {kartu.nomorAnggota}
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/40 bg-emerald-300/20 px-3 py-1.5 text-[10px] font-semibold text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3.5 w-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9 12 2 2 4-4"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3 4.5 6v5c0 4.5 3.2 8 7.5 10 4.3-2 7.5-5.5 7.5-10V6L12 3Z"
              />
            </svg>

            {kartu.aktif
              ? "Anggota Aktif • Terverifikasi"
              : "Anggota Nonaktif"}
          </span>

        </div>

        {/* NAMA ANGGOTA — h2, karena judul halaman (h1) ada di header AppShell. */}
        <h2 className="break-words text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {sedangMasuk.nama}
        </h2>

        {/* INFORMASI TAMBAHAN */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-emerald-50 sm:text-sm">

          <span>
            Jenis: <span className="font-semibold text-white">{kartu.jenis}</span>
          </span>

          <span className="hidden text-emerald-200 sm:inline">•</span>

          <span>
            Bergabung:{" "}
            <span className="font-semibold text-white">
              {tanggalPanjang(kartu.bergabungPada)}
            </span>
          </span>

          <span className="hidden text-emerald-200 sm:inline">•</span>

          <span className="break-all font-semibold text-white">
            {sedangMasuk.email}
          </span>

        </div>

      </div>

    </div>

    {/* TOMBOL AKSI */}
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row xl:flex-col">

      {/* KARTU DIGITAL */}
      <button
        type="button"
        onClick={() => toast.info("Fitur kartu digital belum tersedia.")}
        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-lg"
      >
        <Ikon nama="card" ukuran={18} />
        Buka Kartu Anggota Digital
      </button>

      {/* UNDUH BIODATA */}
      <button
        type="button"
        onClick={() => toast.info("Fitur unduh biodata PDF belum tersedia.")}
        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/15 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/25"
      >
        <Ikon nama="download" ukuran={18} />
        Unduh Biodata PDF
      </button>

    </div>

  </div>

</section>

      {/* NAVIGASI TAB */}
      <nav className="overflow-x-auto card p-2">
        <div className="flex min-w-max items-center gap-1">
          <TabButton
            aktif={tab === "identitas"}
            onClick={() => setTab("identitas")}
            ikon="user"
          >
            Data Diri & Identitas
          </TabButton>

          <TabButton
            aktif={tab === "preferensi"}
            onClick={() => setTab("preferensi")}
            ikon="book"
          >
            Minat & Preferensi Baca
          </TabButton>

          <TabButton
            aktif={tab === "keamanan"}
            onClick={() => setTab("keamanan")}
            ikon="lock"
          >
            Keamanan & Kata Sandi
          </TabButton>

          <TabButton
            aktif={tab === "aktivitas"}
            onClick={() => setTab("aktivitas")}
            ikon="trophy"
          >
            Aktivitas & Prestasi
          </TabButton>
        </div>
      </nav>

      {/* TAB DATA DIRI */}
      {tab === "identitas" && (
        <div className="space-y-6">
          {!modeEdit ? (
            <section className="card p-6 sm:p-7">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Informasi Lengkap Keanggotaan
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Rincian data identitas resmi anggota yang terdaftar pada sistem PustakaKu.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModeEdit(true)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-teal-800 transition hover:bg-emerald-100"
                >
                  Ubah Data Profil
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
                <Informasi label="Nomor Anggota" nilai={kartu.nomorAnggota} ikon="card" />
                <Informasi label="Nama Lengkap" nilai={kartu.nama} />
                <Informasi label="Email Terdaftar" nilai={kartu.email} ikon="mail" />
                <Informasi label="Nomor Telepon / WhatsApp" nilai={kartu.telepon || "Belum diisi"} ikon="phone" />
                <Informasi label="Jenis Keanggotaan" nilai={kartu.jenis} />
                <Informasi label="Tanggal Bergabung" nilai={tanggalPanjang(kartu.bergabungPada)} ikon="calendar" />
                <Informasi label="Status Keanggotaan" nilai={kartu.aktif ? "Aktif" : "Nonaktif"} />
                <div className="md:col-span-2">
                  <Informasi label="Alamat Domisili" nilai={kartu.alamat || "Belum diisi"} ikon="location" />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="text-xs font-bold text-teal-800">
                  INFORMASI AKUN
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Data identitas ini digunakan untuk keperluan administrasi dan layanan keanggotaan perpustakaan digital PustakaKu.
                </p>
              </div>
            </section>
          ) : (
            <form
              onSubmit={simpanProfil}
              className="card p-6 sm:p-7"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Edit Data Diri Anggota
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Perbarui data diri Anda. Perubahan akan tersinkronisasi pada kartu anggota digital.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={batalkanEdit}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                >
                  Batal Edit
                </button>
              </div>

              <div className="flex flex-col gap-4 border-b border-slate-100 py-5 sm:flex-row sm:items-center">
                {previewFoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewFoto}
                    alt="Pratinjau foto profil"
                    className="h-16 w-16 rounded-2xl border border-slate-100 object-cover"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand)] text-xl font-bold text-white">
                    {inisial || "A"}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Foto Profil
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    JPG/PNG/WebP maksimal 5 MB.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => inputFotoRef.current?.click()}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      {previewFoto ? "Ganti Foto" : "Pilih Foto"}
                    </button>

                    {previewFoto && (
                      <button
                        type="button"
                        onClick={() => setFotoBaru(null)}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Hapus Foto
                      </button>
                    )}

                    {fotoBaru !== undefined && (
                      <button
                        type="button"
                        onClick={() => setFotoBaru(undefined)}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        Batalkan Foto
                      </button>
                    )}
                  </div>
                  <input
                    ref={inputFotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={pilihFotoBaru}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 pt-5 md:grid-cols-2">
                <InputProfil
                  label="Nama Lengkap"
                  value={form.nama}
                  onChange={(v) => ubahForm("nama", v)}
                  placeholder="Masukkan nama lengkap"
                />
                <InputProfil
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => ubahForm("email", v)}
                  placeholder="nama@email.com"
                />
                <InputProfil
                  label="Nomor Telepon / WhatsApp"
                  type="tel"
                  value={form.telepon}
                  onChange={(v) => ubahForm("telepon", v)}
                  placeholder="Masukkan nomor telepon"
                />
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Alamat Domisili
                  </label>
                  <textarea
                    rows={3}
                    value={form.alamat}
                    onChange={(e) => ubahForm("alamat", e.target.value)}
                    placeholder="Masukkan alamat lengkap"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-50"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={batalkanEdit}
                  className="rounded-xl bg-slate-100 px-5 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--brand)] px-6 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-hover)]"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB PREFERENSI */}
      {tab === "preferensi" && (
        <div className="space-y-6">
          <section className="card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Kategori Buku Favorit
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Pilih topik yang Anda minati untuk personalisasi rekomendasi katalog.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
                {minat.length}/4 dipilih
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-5">
              {kategoriBuku.map((kategori) => {
                const dipilih = minat.includes(kategori);
                return (
                  <button
                    key={kategori}
                    type="button"
                    onClick={() => pilihKategori(kategori)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      dipilih
                        ? "border-teal-800 bg-teal-800 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-300 hover:bg-teal-50"
                    }`}
                  >
                    {dipilih ? "✓ " : ""}
                    {kategori}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card p-6 sm:p-7">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-base font-bold text-slate-900">
                Target & Tantangan Membaca
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Atur target membaca dan pantau perkembangan literasi Anda.
              </p>
            </div>

            <div className="grid gap-4 pt-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-800">
                  Target Tahunan
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Pengaturan target membaca belum terhubung dengan data aktivitas.
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-0 rounded-full bg-teal-600" />
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Progress belum tersedia
                </p>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
                  <Ikon nama="flame" ukuran={23} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Tantangan Membaca
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Fitur tantangan membaca akan tersedia setelah data aktivitas membaca terhubung.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="card p-6 sm:p-7">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-base font-bold text-slate-900">
                Pengaturan Notifikasi & Pengingat Otomatis
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Atur preferensi pemberitahuan dari sistem PustakaKu.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {[
                {
                  key: "email" as const,
                  judul: "Pengingat H-2 Jatuh Tempo (Email)",
                  deskripsi: "Pengingat sebelum masa pinjam buku berakhir.",
                },
                {
                  key: "whatsapp" as const,
                  judul: "Notifikasi WhatsApp untuk Sirkulasi Buku",
                  deskripsi: "Informasi pengingat terkait peminjaman buku.",
                },
                {
                  key: "rekomendasi" as const,
                  judul: "Rekomendasi Buku Sesuai Minat",
                  deskripsi: "Pemberitahuan saat buku sesuai minat tersedia.",
                },
                {
                  key: "buletin" as const,
                  judul: "Buletin & Info Kegiatan Literasi Perpustakaan",
                  deskripsi: "Informasi kegiatan dan berita perpustakaan.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {item.judul}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {item.deskripsi}
                    </p>
                  </div>
                  <Toggle
                    aktif={notifikasi[item.key]}
                    onChange={(v) => ubahNotifikasi(item.key, v)}
                  />
                </div>
              ))}
            </div>

            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-700">
              Pengaturan preferensi pada halaman ini masih bersifat lokal dan belum disimpan ke database.
            </p>
          </section>
        </div>
      )}

      {/* TAB KEAMANAN */}
      {tab === "keamanan" && (
        <div className="space-y-6">
          <form
            onSubmit={simpanSandi}
            className="card p-6 sm:p-7"
          >
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-base font-bold text-slate-900">
                Ganti Kata Sandi Akun
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Gunakan kombinasi minimal 8 karakter dengan huruf besar, angka, dan simbol.
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-1 gap-5 pt-5">
              <InputProfil
                label="Kata Sandi Saat Ini"
                type="password"
                value={sandi.lama}
                onChange={(v) => setSandi({ ...sandi, lama: v })}
                placeholder="Masukkan kata sandi lama"
              />
              <InputProfil
                label="Kata Sandi Baru"
                type="password"
                value={sandi.baru}
                onChange={(v) => setSandi({ ...sandi, baru: v })}
                placeholder="Minimal 8 karakter"
              />
              <InputProfil
                label="Ulangi Kata Sandi Baru"
                type="password"
                value={sandi.ulangi}
                onChange={(v) => setSandi({ ...sandi, ulangi: v })}
                placeholder="Ulangi kata sandi baru"
              />
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={prosesSandi}
                className="rounded-xl bg-[var(--brand)] px-6 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prosesSandi ? "Memproses..." : "Perbarui Kata Sandi"}
              </button>
            </div>
          </form>

          <section className="card p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Sesi Perangkat Masuk
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Informasi sesi perangkat yang sedang menggunakan akun Anda.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600">
                Sesi saat ini
              </span>
            </div>

            <div className="mt-5 flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500">
                <Ikon nama="user" ukuran={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  Perangkat yang sedang digunakan
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Sesi aktif untuk akun {sedangMasuk.email}
                </p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                Aktif
              </span>
            </div>
          </section>

          <section className="flex flex-col justify-between gap-4 card p-6 sm:flex-row sm:items-center sm:p-7">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Ikon nama="shield" ukuran={22} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Autentikasi Dua Langkah (2FA)
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Perlindungan tambahan untuk keamanan akun Anda.
                </p>
              </div>
            </div>
            <span className="w-fit rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
              Status belum tersedia
            </span>
          </section>
        </div>
      )}

      {/* TAB AKTIVITAS */}
      {tab === "aktivitas" && (
        <div className="space-y-6">
          <section className="card p-6 sm:p-7">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-base font-bold text-slate-900">
                Lencana Kehormatan Anggota
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Penghargaan yang dapat diperoleh melalui aktivitas dan kedisiplinan membaca.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  ikon: "trophy",
                  judul: "Pembaca Disiplin",
                  deskripsi: "Mengembalikan buku tepat waktu.",
                  warna: "emerald",
                },
                {
                  ikon: "book",
                  judul: "Penjelajah Wawasan",
                  deskripsi: "Menyelesaikan berbagai bacaan.",
                  warna: "blue",
                },
                {
                  ikon: "flame",
                  judul: "Streak Membaca",
                  deskripsi: "Konsisten membaca setiap hari.",
                  warna: "amber",
                },
                {
                  ikon: "trophy",
                  judul: "Resensi Terpilih",
                  deskripsi: "Menulis ulasan buku berkualitas.",
                  warna: "purple",
                },
              ].map((item) => (
                <div
                  key={item.judul}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-center"
                >
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-500 shadow-sm">
                    <Ikon nama={item.ikon} ukuran={22} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-800">
                    {item.judul}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {item.deskripsi}
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-500">
                    Belum tersedia
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6 sm:p-7">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-base font-bold text-slate-900">
                Statistik Baca Akumulatif
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Ringkasan aktivitas membaca selama menjadi anggota PustakaKu.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                "Total Buku Diselesaikan",
                "Total Halaman Terbaca",
                "Akumulasi Jam Membaca",
                "Rata-rata Waktu / Hari",
              ].map((judul) => (
                <div
                  key={judul}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-center"
                >
                  <p className="text-xs text-slate-400">{judul}</p>
                  <p className="mt-3 text-2xl font-bold text-slate-800">
                    —
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Data belum tersedia
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
