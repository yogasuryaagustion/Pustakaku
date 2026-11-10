
"use client";

import { useMemo, useState } from "react";
import { useAuth, type Peran, type Pengguna } from "@/lib/auth";
import { useLibrary } from "@/lib/library-context";
import {
  Modal,
  ConfirmDialog,
  Badge,
  EmptyState,
  tanggalPanjang,
} from "@/components/ui";
import { useToast } from "@/components/toast";

const KOSONG = {
  nama: "",
  email: "",
  sandi: "",
  peran: "user" as Peran,
  anggotaId: "",
};

function Ikon({
  nama,
  ukuran = 20,
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

  switch (nama) {
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "link":
      return (
        <svg {...props}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    default:
      return null;
  }
}

export default function HalamanAkun() {
  const {
    pengguna,
    sedangMasuk,
    buatAkun,
    resetSandi,
    ubahPeran,
    hapusAkun,
  } = useAuth();

  const { anggota } = useLibrary();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [filterPeran, setFilterPeran] = useState("semua");
  const [openBuat, setOpenBuat] = useState(false);
  const [form, setForm] = useState({ ...KOSONG });
  const [resetTarget, setResetTarget] = useState<Pengguna | null>(null);
  const [peranTarget, setPeranTarget] = useState<Pengguna | null>(null);
  const [peranBaru, setPeranBaru] = useState<Peran>("user");
  const [sandiBaru, setSandiBaru] = useState("");
  const [hapusTarget, setHapusTarget] = useState<Pengguna | null>(null);

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase();

    return pengguna.filter((u) => {
      const cocokKata =
        !kata ||
        u.nama.toLowerCase().includes(kata) ||
        u.email.toLowerCase().includes(kata) ||
        u.id.toLowerCase().includes(kata);

      const cocokPeran =
        filterPeran === "semua" || u.peran === filterPeran;

      return cocokKata && cocokPeran;
    });
  }, [pengguna, q, filterPeran]);

  const anggotaTanpaAkun = useMemo(
    () =>
      anggota.filter(
        (a) => !pengguna.some((u) => u.anggotaId === a.id)
      ),
    [anggota, pengguna]
  );

  const jumlahSuperAdmin = pengguna.filter(
    (u) => u.peran === "superadmin"
  ).length;

  const jumlahAdmin = pengguna.filter(
    (u) => u.peran === "admin"
  ).length;

  const jumlahAnggota = pengguna.filter(
    (u) => u.peran === "user"
  ).length;

  async function submitBuat(e: React.FormEvent) {
    e.preventDefault();

    const res = await buatAkun({
      nama: form.nama,
      email: form.email,
      sandi: form.sandi,
      peran: form.peran,
      anggotaId:
        form.peran === "user" && form.anggotaId
          ? form.anggotaId
          : undefined,
    });

    if (res.ok) {
      toast.sukses(res.pesan);
      setOpenBuat(false);
      setForm({ ...KOSONG });
    } else {
      toast.gagal(res.pesan);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;

    const res = await resetSandi(resetTarget.id, sandiBaru);

    if (res.ok) {
      toast.sukses(res.pesan);
      setResetTarget(null);
      setSandiBaru("");
    } else {
      toast.gagal(res.pesan);
    }
  }

  // Avatar inisial memakai palet hijau pekat (bukan warna acak) supaya senada
  // dengan tombol solid; variasi tetap ada lewat tingkat gelapnya.
  const warnaAvatar = [
    "bg-[var(--brand-solid)]",
    "bg-teal-700",
    "bg-[var(--brand-solid-hover)]",
    "bg-teal-900",
    "bg-emerald-800",
  ];

  // Ubah peran akun yang sudah ada (hanya Super Admin yang sampai ke sini).
  async function submitPeran(e: React.FormEvent) {
    e.preventDefault();
    if (!peranTarget) return;

    if (peranBaru === peranTarget.peran) {
      setPeranTarget(null);
      return;
    }

    const res = await ubahPeran(peranTarget.id, peranBaru);

    if (res.ok) {
      toast.sukses(res.pesan);
      setPeranTarget(null);
    } else {
      toast.gagal(res.pesan);
    }
  }

  return (
    <div className="min-h-full space-y-6 bg-slate-50/70 p-1 sm:p-3 lg:p-5">

      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Pengaturan</span>
            <span>/</span>
            <span className="text-teal-700">Kelola Akun</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Kelola Akun
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manajemen kredensial, peran operasional, dan hak akses
            pengguna perpustakaan PustakaKu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setForm({ ...KOSONG });
            setOpenBuat(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
        >
          <Ikon nama="plus" ukuran={17} />
          Tambah Baru
        </button>
      </header>

      {/* Statistik akun */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <Ikon nama="users" ukuran={23} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Total Akun Terdaftar
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {pengguna.length} Akun
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Seluruh akun terdaftar
            </p>
          </div>
        </article>

        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <Ikon nama="shield" ukuran={23} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Akun Super Admin
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {jumlahSuperAdmin} Super Admin
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Kelola akun, hak akses, & pengaturan
            </p>
          </div>
        </article>

        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Ikon nama="check" ukuran={23} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Akun Admin
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {jumlahAdmin} Admin
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Operasional: katalog, sirkulasi, anggota, laporan
            </p>
          </div>
        </article>

        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-ink)]">
            <Ikon nama="shield" ukuran={23} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Akun Anggota
            </p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {jumlahAnggota} Anggota
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Akun dengan hak akses anggota
            </p>
          </div>
        </article>
      </section>

      {/* Direktori akun */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">

        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Direktori Akun Pengguna
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Informasi akun, hak akses, dan kartu anggota yang terhubung.
            </p>
          </div>

          <span className="text-xs text-slate-400">
            Menampilkan {hasil.length} dari {pengguna.length} akun
          </span>
        </div>

        {/* Pencarian dan filter */}
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Ikon nama="search" ukuran={17} />
            </span>

            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-50"
              placeholder="Cari nama, email, atau ID akun..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari akun"
            />
          </div>

          <select
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50"
            value={filterPeran}
            onChange={(e) => setFilterPeran(e.target.value)}
            aria-label="Filter peran akun"
          >
            <option value="semua">Semua Peran</option>
            <option value="superadmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="user">Anggota</option>
          </select>
        </div>

        {hasil.length === 0 ? (
          <div className="p-5">
            <EmptyState
              pesan="Akun tidak ditemukan"
              sub="Coba ubah kata kunci atau filter pencarian."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/90">
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Akun & Kontak
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ID Akun
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Peran Akses
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Kartu Anggota
                  </th>
                  <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tanggal Dibuat
                  </th>
                  <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tindakan
                  </th>
                </tr>
              </thead>

              <tbody>
                {hasil.map((u, index) => {
                  const kartu = u.anggotaId
                    ? anggota.find((a) => a.id === u.anggotaId)
                    : undefined;

                  const sendiri = u.id === sedangMasuk?.id;

                  const inisial = u.nama
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className={`border-t border-slate-100 transition hover:bg-teal-50/30 ${
                        sendiri ? "bg-teal-50/40" : "bg-white"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex min-w-[235px] items-center gap-3">
                          <div
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white shadow-sm ${
                              warnaAvatar[index % warnaAvatar.length]
                            }`}
                          >
                            {inisial || "?"}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">
                                {u.nama}
                              </span>

                              {sendiri && (
                                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                                  Anda
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-mono text-xs text-slate-600">
                          {u.id}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <Badge tone={u.peran === "superadmin" ? "teal" : u.peran === "admin" ? "sky" : "slate"}>
                          {u.peran === "superadmin" ? "Super Admin" : u.peran === "admin" ? "Admin" : "Anggota"}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        {u.peran !== "user" ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : kartu ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-teal-700">
                            <Ikon nama="link" ukuran={13} />
                            {kartu.nomorAnggota}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Tanpa kartu
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-500">
                        {tanggalPanjang(u.dibuatPada)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
                            onClick={() => {
                              setPeranTarget(u);
                              setPeranBaru(u.peran);
                            }}
                          >
                            Ubah Peran
                          </button>

                          <button
                            type="button"
                            className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                            onClick={() => {
                              setResetTarget(u);
                              setSandiBaru("");
                            }}
                          >
                            Reset Sandi
                          </button>

                          <button
                            type="button"
                            className="whitespace-nowrap rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={sendiri}
                            title={
                              sendiri
                                ? "Tidak bisa menghapus akun sendiri"
                                : "Hapus akun"
                            }
                            onClick={() => setHapusTarget(u)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer direktori */}
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Akun admin: pengelolaan dilakukan melalui halaman ini.
          </p>
          <p className="text-xs font-medium text-slate-500">
            Total {pengguna.length} akun terdaftar
          </p>
        </div>
      </section>

      {/* Modal buat akun */}
      <Modal
        open={openBuat}
        onClose={() => setOpenBuat(false)}
        title="Buat Akun Baru"
      >
        <form
          onSubmit={submitBuat}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="label">Nama Lengkap *</label>
            <input
              className="input"
              value={form.nama}
              onChange={(e) =>
                setForm({ ...form, nama: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="label">Sandi Awal * (min. 6)</label>
            <input
              className="input"
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={form.sandi}
              onChange={(e) =>
                setForm({ ...form, sandi: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="label">Peran</label>
            <select
              className="input"
              value={form.peran}
              onChange={(e) =>
                setForm({
                  ...form,
                  peran: e.target.value as Peran,
                  anggotaId: "",
                })
              }
            >
              <option value="user">Anggota</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>

          {form.peran === "user" && (
            <div className="sm:col-span-2">
              <label className="label">
                Pautkan ke Kartu Anggota (opsional)
              </label>

              <select
                className="input"
                value={form.anggotaId}
                onChange={(e) =>
                  setForm({ ...form, anggotaId: e.target.value })
                }
              >
                <option value="">— Tanpa kartu —</option>
                {anggotaTanpaAkun.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nomorAnggota} — {a.nama}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-slate-400">
                Anggota yang mendaftar secara publik sudah otomatis terpaut.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpenBuat(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Buat Akun
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal reset sandi */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset Sandi — ${resetTarget?.nama ?? ""}`}
        width="max-w-md"
      >
        <form onSubmit={submitReset} className="space-y-4">
          <div>
            <label className="label">Sandi Baru (min. 6 karakter)</label>
            <input
              className="input"
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={sandiBaru}
              onChange={(e) => setSandiBaru(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setResetTarget(null)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Sandi Baru
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal ubah peran */}
      <Modal
        open={!!peranTarget}
        onClose={() => setPeranTarget(null)}
        title={`Ubah Peran — ${peranTarget?.nama ?? ""}`}
        width="max-w-md"
      >
        <form onSubmit={submitPeran} className="space-y-4">
          <p className="text-xs text-[var(--muted)]">
            Peran saat ini:{" "}
            <span className="font-bold text-slate-700">
              {peranTarget
                ? peranTarget.peran === "superadmin"
                  ? "Super Admin"
                  : peranTarget.peran === "admin"
                    ? "Admin"
                    : "Anggota"
                : ""}
            </span>
          </p>

          <div>
            <label className="label">Peran Baru</label>
            <select
              className="input"
              value={peranBaru}
              onChange={(e) => setPeranBaru(e.target.value as Peran)}
            >
              <option value="superadmin">
                Super Admin — operasional + kelola akun, akses, & pengaturan
              </option>
              <option value="admin">
                Admin — operasional: dashboard, katalog, sirkulasi, anggota, laporan
              </option>
              <option value="user">Anggota — panel pribadi & peminjaman</option>
            </select>
          </div>

          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            Perubahan berlaku seketika: menu, halaman, dan seluruh izin mengikuti
            peran baru. Kewenangan sistem (Kelola Akun, Kelola Akses, Pengaturan)
            hanya dimiliki Super Admin.
          </p>

          {peranTarget?.id === sedangMasuk?.id && peranBaru !== "superadmin" && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-800">
              Anda mengubah akun sendiri — sesudah ini Anda tidak lagi bisa
              membuka halaman Kelola Akun.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPeranTarget(null)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Peran
            </button>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi hapus akun */}
      <ConfirmDialog
        open={!!hapusTarget}
        onClose={() => setHapusTarget(null)}
        onConfirm={async () => {
          if (!hapusTarget) return;

          const res = await hapusAkun(hapusTarget.id);

          if (res.ok) toast.sukses(res.pesan);
          else toast.gagal(res.pesan);

          setHapusTarget(null);
        }}
        title="Hapus Akun"
        message={`Akun "${hapusTarget?.nama}" (${hapusTarget?.email}) akan dihapus permanen. Kartu anggota (bila ada) tidak ikut terhapus. Lanjutkan?`}
      />
    </div>
  );
}
