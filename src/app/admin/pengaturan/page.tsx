
"use client";

import { useState } from "react";
import { rupiah } from "@/components/ui";
import { useToast } from "@/components/toast";
import { catatJejak } from "@/lib/audit";
import { aktorSesi } from "@/lib/auth";
import {
  useSistem,
  terapkanSistem,
  simpanSistem,
  type SistemPengaturan,
} from "@/lib/sistem";

function FieldAngka({
  label,
  nilai,
  min,
  max,
  satuan,
  onUbah,
}: {
  label: string;
  nilai: number;
  min: number;
  max: number;
  satuan: string;
  onUbah: (nilai: number) => void;
}) {
  const [draft, setDraft] = useState(String(nilai));

  // Perbarui input jika nilai resmi berubah dari luar.
  const [nilaiTerakhir, setNilaiTerakhir] = useState(nilai);

  if (nilaiTerakhir !== nilai) {
    setNilaiTerakhir(nilai);
    setDraft(String(nilai));
  }

  const commit = () => {
    const angka = Number(draft);

    if (
      draft.trim() !== "" &&
      Number.isFinite(angka) &&
      Number.isInteger(angka) &&
      angka >= min &&
      angka <= max
    ) {
      onUbah(angka);
      setDraft(String(angka));
    } else {
      setDraft(String(nilai));
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800">
        {label}
      </label>

      <div className="relative">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-20 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
        />

        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-400">
          {satuan}
        </span>
      </div>

      <p className="text-xs text-slate-400">
        Nilai antara {min.toLocaleString("id-ID")} dan{" "}
        {max.toLocaleString("id-ID")} {satuan}.
      </p>
    </div>
  );
}

export default function PengaturanTemaPage() {
  const sistem = useSistem();
  const toast = useToast();
  const [kotor, setKotor] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const ubahSistem = (patch: Partial<SistemPengaturan>) => {
    terapkanSistem(patch);
    setKotor(true);
  };

  const simpan = async () => {
    if (menyimpan || !kotor) return;

    setMenyimpan(true);

    try {
      simpanSistem(sistem);

      const aktor = aktorSesi();

      catatJejak({
        aktor: aktor.nama,
        peran: aktor.peran,
        jenis: "sistem",
        aksi: "Pengaturan sirkulasi disimpan",
        objek: sistem.nama,
        detail:
          `Lama pinjam ${sistem.lamaPinjam} hari; ` +
          `maksimal ${sistem.maksPinjaman} buku; ` +
          `denda ${rupiah(sistem.dendaPerHari)}/hari`,
      });

      setKotor(false);
      toast.sukses("Pengaturan berhasil disimpan.");
    } catch {
      toast.gagal("Pengaturan gagal disimpan. Silakan coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <main className="min-h-full bg-[#f7f9f9] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Judul konten — header utama berasal dari layout admin */}
        

        {/* Kartu pengaturan utama */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
                  <path d="M4 5.5v16" />
                  <path d="M8 7h8" />
                  <path d="M8 11h7" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Pengaturan Sirkulasi &amp; Perpustakaan
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Konfigurasi batas waktu peminjaman dan denda operasional.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-6 md:grid-cols-2">
              <FieldAngka
                label="Durasi Peminjaman Standar"
                nilai={sistem.lamaPinjam}
                min={1}
                max={90}
                satuan="hari"
                onUbah={(nilai) => ubahSistem({ lamaPinjam: nilai })}
              />

              <FieldAngka
                label="Maksimal Judul per Anggota"
                nilai={sistem.maksPinjaman}
                min={1}
                max={50}
                satuan="buku"
                onUbah={(nilai) => ubahSistem({ maksPinjaman: nilai })}
              />

              <FieldAngka
                label="Denda Keterlambatan per Hari"
                nilai={sistem.dendaPerHari}
                min={0}
                max={1_000_000}
                satuan="rupiah"
                onUbah={(nilai) => ubahSistem({ dendaPerHari: nilai })}
              />
            </div>

            {/* Ringkasan aturan */}
            <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-teal-800">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 11v5" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-semibold text-teal-950">
                    Ringkasan aturan aktif
                  </p>
                  <p className="mt-1 text-sm leading-6 text-teal-900/80">
                    Peminjaman berlangsung selama{" "}
                    <strong>{sistem.lamaPinjam} hari</strong>, dengan batas{" "}
                    <strong>{sistem.maksPinjaman} buku per anggota</strong>{" "}
                    dan denda{" "}
                    <strong>{rupiah(sistem.dendaPerHari)} per hari</strong>{" "}
                    jika terlambat.
                  </p>
                </div>
              </div>
            </div>

            {/* Aksi */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-400">
                Perubahan diterapkan setelah disimpan.
              </p>

              <button
                type="button"
                onClick={simpan}
                disabled={!kotor || menyimpan}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900 focus:outline-none focus:ring-4 focus:ring-teal-800/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {menyimpan ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        opacity="0.25"
                      />
                      <path
                        d="M4 12a8 8 0 0 1 8-8"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                      <path d="M17 21v-8H7v8" />
                      <path d="M7 3v5h8" />
                    </svg>
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-xs text-slate-400">
          PustakaKu · Pengaturan operasional perpustakaan
        </p>
      </div>
    </main>
  );
}
