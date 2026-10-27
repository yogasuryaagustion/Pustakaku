"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";

// === Kios Check-in Kunjungan ================================================
// Halaman untuk KOMPUTER PERPUSTAKAAN (tablet di pintu masuk dsb.):
//   * Tanpa sesi login — siapa pun bisa mencatat kunjungan dengan nomor
//     anggota (keputusan desain kios publik). Batas keamanan ada di server:
//     tabel kunjungan default-deny (RLS) dan hanya bisa DITULIS lewat fungsi
//     `catat_kunjungan` yang menolak nomor tak dikenal/nonaktif.
//   * TANPA AKSES ADMIN: halaman ini masuk daftar "polos" di AppShell — tanpa
//     sidebar, tanpa menu, tanpa tautan ke /admin/*.
//   * TIDAK MENINGGALKAN DATA: hasil membersihkan dirinya sendiri setelah
//     beberapa detik, bisa ditutup dengan Esc/tombol Selesai, input tidak
//     menyimpan riwayat (autoComplete off), dan tidak ada penyimpanan lokal.
//
// Rekap kunjungan hanya bisa dibaca admin lewat /laporan (izin laporan.lihat).

const DETIK_BERSIH = 8; // layar otomatis bersih setelah ini

interface Hasil {
  sukses: boolean;
  judul: string;
  rincian?: string;
  waktu?: string;
}

function pesanApi(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
    return (e as Error).message;
  }
  return "Tidak bisa terhubung ke server. Periksa koneksi Anda.";
}

export default function KiosKunjunganPage() {
  const router = useRouter();
  const { keluar } = useAuth();
  const sistem = useSistem();

  const [nomor, setNomor] = useState("");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [proses, setProses] = useState(false);

  function bersihkan() {
    setNomor("");
    setHasil(null);
  }

  // Layar otomatis bersih — tidak menyisakan nama/jejak anggota sebelumnya.
  useEffect(() => {
    if (!hasil) return;
    const t = window.setTimeout(bersihkan, DETIK_BERSIH * 1000);
    return () => window.clearTimeout(t);
  }, [hasil]);

  // Esc = tombol Selesai fisik di kios.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") bersihkan();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (proses) return;
    const isi = nomor.trim();
    if (!isi) {
      setHasil({ sukses: false, judul: "Nomor anggota wajib diisi." });
      return;
    }
    setProses(true);
    try {
      const res = await apiFetch<{
        kunjungan: { status: string; nama: string; nomorAnggota: string; waktuMasuk: string };
        pesan: string;
      }>("/api/kunjungan", { method: "POST", body: { nomorAnggota: isi } });

      const waktu = new Date(res.kunjungan.waktuMasuk).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });
      setHasil({
        sukses: true,
        judul: res.pesan,
        rincian:
          res.kunjungan.status === "baru"
            ? "Kunjungan hari ini tercatat."
            : "Kunjungan hari ini sudah tercatat sebelumnya.",
        waktu,
      });
    } catch (err) {
      setHasil({ sukses: false, judul: pesanApi(err) });
    } finally {
      setProses(false);
      setNomor(""); // input tidak pernah menyimpan nomor setelah diproses
    }
  }

  function keluarDariKios() {
    bersihkan();
    keluar();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Kepala: identitas perpustakaan + tombol keluar untuk petugas */}
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grad-brand text-white grid place-items-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="font-bold">{sistem.nama}</div>
              <div className="text-xs text-[var(--muted)]">Check-in Kunjungan</div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={keluarDariKios} title="Akhiri sesi petugas pada komputer ini">
            Keluar
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-3xl space-y-5">
          {/* Form check-in */}
          <form onSubmit={submit} className="card p-6 sm:p-8">
            <label htmlFor="nomor-anggota" className="label">
              Scan atau ketik nomor anggota
            </label>
            <input
              id="nomor-anggota"
              className="input mt-2 w-full text-2xl sm:text-3xl tracking-wider"
              placeholder="AGT-0001"
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              disabled={proses}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[var(--muted)]">
                Tekan Enter setelah memindai kartu.
              </span>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost" onClick={bersihkan}>
                  Selesai (Esc)
                </button>
                <button type="submit" className="btn btn-primary" disabled={proses}>
                  {proses ? "Memeriksa…" : "Check-in"}
                </button>
              </div>
            </div>
          </form>

          {/* Hasil check-in */}
          {hasil && (
            <div
              role="status"
              aria-live="polite"
              className={`card p-6 sm:p-8 ${
                hasil.sukses
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                    hasil.sukses ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {hasil.sukses ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8v5M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <div
                    className={`text-xl font-bold tracking-tight ${
                      hasil.sukses ? "text-emerald-900" : "text-rose-900"
                    }`}
                  >
                    {hasil.judul}
                  </div>
                  {(hasil.rincian || hasil.waktu) && (
                    <div className="mt-1 text-sm text-slate-700">
                      {hasil.rincian}
                      {hasil.waktu && <> · pukul {hasil.waktu} WIB</>}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-4 text-xs text-[var(--muted)]">
                Layar membersihkan diri otomatis dalam beberapa detik — tidak perlu menekan apa pun.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-[var(--muted)]">
            Bila kartu tidak bisa dipindai atau berstatus tidak aktif, silakan hubungi petugas
            perpustakaan.
          </p>
        </div>
      </main>
    </div>
  );
}