
"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, StatCard, tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  salinKebijakan,
  KEBIJAKAN_BAWAAN,
  DAFTAR_IZIN,
  GRUP_IZIN,
  PERAN_AKSES,
  INFO_PERAN,
  KUNCI_IZIN,
  type DefinisiIzin,
  type Kebijakan,
  type PeranAkses,
} from "@/lib/akses";
import {
  muatKebijakan,
  useKebijakan,
  simpanKebijakan,
} from "@/lib/kebijakan";

function Sakelar({
  nyala,
  onUbah,
  label,
  terkunci,
}: {
  nyala: boolean;
  onUbah: () => void;
  label: string;
  terkunci?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={nyala}
      aria-label={label}
      disabled={terkunci}
      onClick={onUbah}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
        terkunci ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${nyala ? "bg-[var(--brand-solid)]" : "bg-slate-200"}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          nyala ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function GrupBaris({
  grup,
  izin,
  draf,
  onToggle,
}: {
  grup: string;
  izin: DefinisiIzin[];
  draf: Kebijakan;
  onToggle: (peran: PeranAkses, id: string) => void;
}) {
  if (izin.length === 0) return null;

  return (
    <>
      <tr>
        <td
          colSpan={1 + PERAN_AKSES.length}
          className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]"
        >
          {grup}
        </td>
      </tr>

      {izin.map((z) => (
        <tr key={z.id}>
          <td>
            <div className="font-medium">{z.label}</div>
            <div className="text-xs text-[var(--muted)]">
              {z.bantuan} · <span className="font-mono">{z.id}</span>
            </div>
          </td>

          {PERAN_AKSES.map((p) => {
            const terkunci = (KUNCI_IZIN[z.id] ?? []).includes(p);

            return (
              <td key={p} className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  {terkunci && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[var(--muted)]"
                      aria-hidden
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}

                  <Sakelar
                    nyala={draf.izin[p][z.id]}
                    terkunci={terkunci}
                    onUbah={() => onToggle(p, z.id)}
                    label={`${z.label} — ${INFO_PERAN[p].label}`}
                  />
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export default function KontrolAksesPage() {
  const tersimpan = useKebijakan();
  const toast = useToast();

  const [draf, setDraf] = useState<Kebijakan | null>(null);
  const [sedangMemuat, setSedangMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState("");
  const [q, setQ] = useState("");
  const [tanyaReset, setTanyaReset] = useState(false);
  const [proses, setProses] = useState(false);

  // Muat draf berdasarkan data yang benar-benar diterima dari server.
  useEffect(() => {
    let aktif = true;

    async function muat() {
      setSedangMemuat(true);
      setGalatMuat("");

      try {
        const nilai = await muatKebijakan();

        if (aktif) {
          setDraf(salinKebijakan(nilai));
        }
      } catch (error) {
        if (aktif) {
          const pesan =
            error instanceof Error
              ? error.message
              : "Gagal memuat kebijakan akses.";

          setGalatMuat(pesan);
        }
      } finally {
        if (aktif) {
          setSedangMemuat(false);
        }
      }
    }

    void muat();

    return () => {
      aktif = false;
    };
  }, []);

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase();

    return DAFTAR_IZIN.filter(
      (z) =>
        !kata ||
        z.label.toLowerCase().includes(kata) ||
        z.id.toLowerCase().includes(kata) ||
        z.grup.toLowerCase().includes(kata)
    );
  }, [q]);

  async function muatUlang() {
    setSedangMemuat(true);
    setGalatMuat("");

    try {
      const nilai = await muatKebijakan();
      setDraf(salinKebijakan(nilai));
    } catch (error) {
      const pesan =
        error instanceof Error
          ? error.message
          : "Gagal memuat kebijakan akses.";

      setGalatMuat(pesan);
      toast.gagal(pesan);
    } finally {
      setSedangMemuat(false);
    }
  }

  if (sedangMemuat) {
    return (
      <div className="p-6 text-[var(--muted)]">
        Memuat kebijakan akses dari server…
      </div>
    );
  }

  if (galatMuat || !draf) {
    return (
      <div className="card space-y-3 p-6">
        <h2 className="font-bold">Kebijakan gagal dimuat</h2>
        <p className="text-sm text-rose-600">
          {galatMuat || "Data kebijakan belum tersedia."}
        </p>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={muatUlang}
            disabled={sedangMemuat}
          >
            Coba Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  const kotor =
    JSON.stringify(draf.izin) !== JSON.stringify(tersimpan.izin);

  const samaBawaan =
    JSON.stringify(draf.izin) ===
    JSON.stringify(KEBIJAKAN_BAWAAN.izin);

  const jumlahAktif = (peran: PeranAkses) =>
    DAFTAR_IZIN.filter((z) => draf.izin[peran][z.id]).length;

  function toggle(peran: PeranAkses, id: string) {
    setDraf((d) => {
      if (!d) return d;

      return {
        ...d,
        izin: {
          ...d.izin,
          [peran]: {
            ...d.izin[peran],
            [id]: !d.izin[peran][id],
          },
        },
      };
    });
  }

  async function simpan() {
    if (!draf || proses || !kotor) return;

    setProses(true);

    try {
      const hasilSimpan = await simpanKebijakan(draf);

      // Sinkronkan draf dengan hasil resmi dari server.
      setDraf(salinKebijakan(hasilSimpan));

      toast.sukses(
        "Kebijakan akses berhasil disimpan dan berlaku di aplikasi."
      );
    } catch (error) {
      const pesan =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan kebijakan akses.";

      toast.gagal(pesan);
    } finally {
      setProses(false);
    }
  }

  function pulihkanBawaan() {
    setDraf(salinKebijakan(KEBIJAKAN_BAWAAN));
    setTanyaReset(false);
  }

  return (
    <div className="space-y-4">
      {/* Kepala dan ringkasan */}
      <div className="card p-6">
        {/* Judul "Kelola Akses" sudah tampil di header AppShell. */}
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Matriks izin (peran × aksi) yang menentukan halaman, tombol,
          dan data mana yang bisa diakses. Menyimpan perubahan langsung
          berlaku di seluruh aplikasi tanpa mengubah kode atau memuat ulang.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-ink)]">
            Default-deny — izin tak dicentang berarti ditolak
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            Tersimpan di database (tabel kebijakan_akses)
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            Halaman ini khusus admin (gerbang peran, di luar matriks)
          </span>

          {tersimpan.diubahPada && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              Terakhir diubah{" "}
              {tanggalPanjang(tersimpan.diubahPada.slice(0, 10))}
              {tersimpan.diubahOleh
                ? ` oleh ${tersimpan.diubahOleh}`
                : ""}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Izin Terdaftar"
            value={DAFTAR_IZIN.length}
            sub="dipakai guard rute, tombol & data"
            tone="brand"
          />

          <StatCard
            label="Peran"
            value={PERAN_AKSES.length}
            sub="tamu · anggota · admin"
            tone="sky"
          />

          <StatCard
            label="Izin Aktif (draf)"
            value={
              jumlahAktif("tamu") +
              jumlahAktif("user") +
              jumlahAktif("admin")
            }
            sub="dari total kemungkinan"
            tone="amber"
          />

          <StatCard
            label="Terkunci"
            value={Object.keys(KUNCI_IZIN).length}
            sub="anti-lockout admin"
            tone="rose"
          />
        </div>
      </div>

      {/* Matriks izin */}
      <div className="card overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-bold">Matriks Izin</h2>
            <p className="text-xs text-[var(--muted)]">
              Klik sakelar untuk memberi atau mencabut izin per peran.
            </p>
          </div>

          <input
            className="input sm:w-64"
            placeholder="Cari izin, grup, atau id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari izin"
          />
        </div>

        {hasil.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--muted)]">
            Tidak ada izin yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Izin</th>

                  {PERAN_AKSES.map((p) => (
                    <th key={p} className="text-center">
                      <div>{INFO_PERAN[p].label}</div>
                      <div className="text-[10px] font-normal text-[var(--muted)]">
                        {INFO_PERAN[p].bantuan}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {GRUP_IZIN.map((grup) => (
                  <GrupBaris
                    key={grup}
                    grup={grup}
                    izin={DAFTAR_IZIN.filter(
                      (z) => z.grup === grup && hasil.includes(z)
                    )}
                    draf={draf}
                    onToggle={toggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tombol aksi */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-xs text-[var(--muted)]">
          {kotor ? (
            <span className="font-semibold text-amber-600">
              Ada perubahan belum disimpan
            </span>
          ) : (
            "Kebijakan tersimpan sedang berlaku"
          )}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTanyaReset(true)}
            disabled={samaBawaan || proses}
          >
            Pulihkan Bawaan
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={simpan}
            disabled={!kotor || proses}
          >
            {proses ? "Menyimpan…" : "Simpan Kebijakan"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={tanyaReset}
        onClose={() => setTanyaReset(false)}
        onConfirm={pulihkanBawaan}
        title="Pulihkan Kebijakan Bawaan"
        message="Seluruh matriks dikembalikan ke pengaturan bawaan. Kendali halaman ini tetap terkunci di peran Super Admin. Ini baru draf — tekan Simpan Kebijakan agar berlaku."
      />
    </div>
  );
}
