"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  BookOpen,
  Calendar,
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Check,
  RotateCcw,
  Printer,
  Users,
  QrCode,
} from "lucide-react";

type HasilCheckIn = {
  kunjungan?: {
    status?: "baru" | "sudah-tercatat";
    nama?: string;
    nomorAnggota?: string;
    tanggal?: string;
    waktuMasuk?: string;
  };
  pesan?: string;
};

function pesanGalat(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Check-in belum berhasil. Silakan coba kembali.";
}

function waktuWIB(iso?: string): string {
  if (!iso) return "";

  const tanggal = new Date(iso);

  if (Number.isNaN(tanggal.getTime())) return "";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(tanggal);
}

export default function CheckInKunjunganPage() {
  // Navigasi lewat router agar kios tetap berada di aplikasi Next (bukan reload
  // penuh), sesuai aturan no-location-assign-relative-destination.
  const router = useRouter();

  // Nilai awal harus konsisten antara server dan browser.
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const [nomorAnggota, setNomorAnggota] = useState("");
  const [sedangProses, setSedangProses] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<HasilCheckIn | null>(null);
  const [countdown, setCountdown] = useState(8);
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [kodeScan, setKodeScan] = useState("");
  const [kameraBuka, setKameraBuka] = useState(false);

  const sudahTercatat = hasil?.kunjungan?.status === "sudah-tercatat";

  // Jam baru dimulai setelah komponen aktif di browser.
  useEffect(() => {
    const perbaruiWaktu = () => {
      setCurrentTime(new Date());
    };

    perbaruiWaktu();

    const timer = window.setInterval(perbaruiWaktu, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Countdown setelah check-in berhasil.
  useEffect(() => {
    if (!hasil) return;

    if (countdown <= 0) {
      resetKiosk();
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [hasil, countdown]);

  // Sinkronisasi status fullscreen browser.
  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, []);

  function playChime() {
    if (!soundEnabled) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(587.33, context.currentTime);
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.15);

      gain.gain.setValueAtTime(0.15, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.55);

      oscillator.onended = () => {
        void context.close();
      };
    } catch {
      // Audio bersifat opsional.
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setGalat("Mode layar penuh tidak tersedia pada browser ini.");
    }
  }

  async function prosesCheckIn(nomorInput?: string) {
    const nomor = (nomorInput ?? nomorAnggota).trim().toUpperCase();

    if (!nomor || sedangProses) return;

    setNomorAnggota(nomor);

    setSedangProses(true);
    setGalat("");
    setHasil(null);

    try {
      const response = await apiFetch<HasilCheckIn>("/api/kunjungan", {
        method: "POST",
        body: {
          nomorAnggota: nomor,
        },
      });

      if (!response?.kunjungan?.nama) {
        throw new Error(
          response?.pesan || "Respons check-in tidak dapat dibaca.",
        );
      }

      setHasil(response);
      setCountdown(8);
      playChime();
    } catch (error) {
      setGalat(pesanGalat(error));
    } finally {
      setSedangProses(false);
    }
  }

  async function lakukanCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await prosesCheckIn();
  }

  function resetKiosk() {
    setHasil(null);
    setNomorAnggota("");
    setGalat("");
    setCountdown(8);
  }

  const tanggalSekarang = currentTime
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(currentTime)
    : "Memuat tanggal...";

  const jamSekarang = currentTime
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(currentTime)
    : "--:--:--";

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--background)] font-sans text-slate-800">
      {/* HEADER */}
      <header className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-3 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 px-5 py-3.5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              title="Kembali ke Beranda"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-solid)] text-white shadow-md transition hover:scale-105"
            >
              <BookOpen className="h-5 w-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-slate-900">
                  PustakaKu
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  KIOSK AKTIF
                </span>
              </div>

              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Kios Presensi Mandiri Pengunjung Perpustakaan
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-100/80 px-4 py-1.5 font-mono text-xs md:flex">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />

            <span className="font-semibold text-slate-700">
              {tanggalSekarang}
            </span>

            <span className="text-slate-300">|</span>

            <Clock className="h-3.5 w-3.5 text-[var(--brand-solid)]" />

            <span className="text-sm font-bold text-slate-900">
              {jamSekarang}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? "Matikan suara" : "Aktifkan suara"}
              className={`rounded-xl p-2 transition ${
                soundEnabled
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title="Layar penuh"
              className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-5 sm:px-6">
        {!hasil ? (
          <div className="animate-in space-y-6 fade-in zoom-in-95 duration-300">
            {/* BRANDING */}
            <div className="space-y-2 text-center">
              <div className="mb-1 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-solid)] text-white shadow-xl shadow-[var(--brand-solid)]/20 ring-4 ring-[var(--brand-solid)]/10">
                <BookOpen className="h-7 w-7" />
              </div>

              <p className="text-xs font-black uppercase tracking-[0.25em] text-[var(--brand-solid)]">
                PUSTAKAKU
              </p>

              <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                Check-in Pengunjung
              </h2>

              <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600 sm:text-sm">
                Selamat datang di perpustakaan. Masukkan nomor anggota untuk
                mencatat kunjungan Anda.
              </p>
            </div>

            {/* MODE */}
            <div className="mx-auto flex max-w-xl items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold shadow-sm transition ${
                  mode === "manual"
                    ? "bg-[var(--brand-solid)] text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Nomor Anggota</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("scan")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold shadow-sm transition ${
                  mode === "scan"
                    ? "bg-[var(--brand-solid)] text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <QrCode className="h-4 w-4" />
                <span>Scan Barcode</span>
              </button>
            </div>

            {/* ERROR */}
            {galat && (
              <div
                role="alert"
                className="mx-auto flex max-w-xl items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{galat}</span>
              </div>
            )}

            {/* FORM / SCAN */}
            {mode === "manual" ? (
            <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
              <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-[var(--brand-solid-hover)] via-[var(--brand-solid)] to-[var(--brand)]" />

              <form onSubmit={lakukanCheckIn} className="space-y-5">
                <div>
                  <label
                    htmlFor="nomor-anggota"
                    className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-800"
                  >
                    Nomor Anggota
                  </label>

                  <input
                    id="nomor-anggota"
                    type="text"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={30}
                    required
                    value={nomorAnggota}
                    onChange={(event) => {
                      setNomorAnggota(event.target.value.toUpperCase());
                      setGalat("");
                    }}
                    disabled={sedangProses}
                    placeholder="Contoh: AGT-0001"
                    className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-center font-mono text-lg font-black tracking-wider text-slate-900 outline-none transition placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-solid)]/10 disabled:bg-slate-100 sm:text-left"
                  />

                  <p className="mt-2 text-[11px] text-slate-500">
                    Pastikan nomor anggota sudah benar dan terdaftar sebagai
                    anggota aktif.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={sedangProses || !nomorAnggota.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-solid)] px-6 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-[var(--brand-solid)]/20 transition hover:bg-[var(--brand-solid-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
                >
                  {sedangProses ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Memproses check-in...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Check-in Sekarang
                    </>
                  )}
                </button>
              </form>
            </div>
            ) : (
            <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
              <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-[var(--brand-solid-hover)] via-[var(--brand-solid)] to-[var(--brand)]" />

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-800">
                    Scan Barcode Kartu Anggota
                  </label>
                  <input
                    type="text"
                    autoFocus
                    autoComplete="off"
                    value={kodeScan}
                    onChange={(e) => setKodeScan(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const kode = e.currentTarget.value.trim();
                        setKodeScan("");
                        void prosesCheckIn(kode);
                      }
                    }}
                    placeholder="Arahkan scanner USB ke barcode kartu..."
                    disabled={sedangProses}
                    className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3.5 text-center font-mono text-lg font-black tracking-wider text-slate-900 outline-none transition placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand-solid)]/10 disabled:bg-slate-100 sm:text-left"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Arahkan scanner USB ke barcode pada kartu anggota, atau gunakan
                    kamera browser.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => setKameraBuka((v) => !v)}
                  >
                    {kameraBuka ? "Tutup Kamera" : "Gunakan Kamera"}
                  </button>
                </div>

                {kameraBuka && (
                  <PemindaiKameraCheckin
                    onDeteksi={(kode) => {
                      setKodeScan("");
                      void prosesCheckIn(kode);
                    }}
                  />
                )}

                {sedangProses && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand-solid)]" />
                    Memproses check-in...
                  </div>
                )}
              </div>
            </div>
            )}

            <div className="space-y-1 pt-2 text-center text-xs font-medium text-slate-500">
              <p>
                Data kunjungan dicatat secara otomatis oleh sistem PustakaKu.
              </p>
              <p>
                Jika mengalami kendala, silakan hubungi petugas perpustakaan.
              </p>
            </div>
          </div>
        ) : (
          /* SUCCESS PASS */
          <div className="mx-auto w-full max-w-md animate-in space-y-5 zoom-in-95 duration-300">
            <div
              className={`flex items-center gap-4 rounded-3xl p-4 text-white shadow-xl ${
                sudahTercatat ? "bg-amber-600" : "bg-emerald-600"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                {sudahTercatat ? (
                  <Clock className="h-7 w-7" />
                ) : (
                  <Check className="h-7 w-7" />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-white/80">
                  {sudahTercatat
                    ? "Kunjungan Sudah Tercatat"
                    : "Presensi Berhasil Dicatat"}
                </p>

                <h3 className="truncate text-lg font-black">
                  Selamat Datang, {hasil.kunjungan?.nama}!
                </h3>
              </div>
            </div>

            <div className="relative space-y-5 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brand-solid)] text-white">
                    <BookOpen className="h-4 w-4" />
                  </div>

                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-900">
                      PustakaKu Perpustakaan
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Digital Visitor Pass
                    </p>
                  </div>
                </div>

                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  {sudahTercatat ? "TERCATAT" : "BERHASIL"}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Nama Pengunjung
                </span>

                <p className="mt-1 text-base font-black text-slate-900">
                  {hasil.kunjungan?.nama}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    No. Anggota
                  </span>

                  <p className="mt-1 break-all font-mono text-xs font-bold text-slate-800">
                    {hasil.kunjungan?.nomorAnggota || nomorAnggota}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Waktu Check-in
                  </span>

                  <p className="mt-1 text-xs font-bold text-slate-800">
                    {waktuWIB(hasil.kunjungan?.waktuMasuk) || jamSekarang} WIB
                  </p>
                </div>
              </div>

              {hasil.kunjungan?.tanggal && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Tanggal Kunjungan
                  </span>

                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {hasil.kunjungan.tanggal}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-900">
                      Status Kunjungan
                    </p>
                    <p className="text-xs font-semibold text-emerald-800">
                      {hasil.pesan || "Data kunjungan telah diproses."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  <Printer className="h-4 w-4" />
                  Cetak Slip
                </button>

                <button
                  type="button"
                  onClick={resetKiosk}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-solid)] py-2.5 text-xs font-bold text-white transition hover:bg-[var(--brand-solid-hover)]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Selesai
                </button>
              </div>

              <p className="text-center text-[10px] text-slate-400">
                Kembali ke layar utama dalam {countdown} detik...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/70 p-3 text-xs shadow-sm backdrop-blur-md md:flex-row sm:px-5">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <Users className="h-3.5 w-3.5 text-[var(--brand-solid)]" />
            <span>
              Sistem Presensi Pengunjung
              <strong className="ml-1 font-mono text-slate-900">
                PustakaKu
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Sistem Check-in Aktif
          </div>
        </div>
      </footer>

      {/* PRINT STYLE */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          header,
          footer,
          button,
          main > div > div:first-child {
            display: none !important;
          }

          main {
            max-width: 100% !important;
            padding: 0 !important;
          }

          main > div {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

// === Kamera browser (BarcodeDetector) untuk check-in ===
function PemindaiKameraCheckin({ onDeteksi }: { onDeteksi: (kode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [didukung, setDidukung] = useState(true);
  const terakhirRef = useRef<{ kode: string; waktu: number } | null>(null);

  useEffect(() => {
    let batal = false;
    let berjalan = true;
    let stream: MediaStream | null = null;

    async function mulai() {
      if (!("BarcodeDetector" in window)) {
        setDidukung(false);
        setGalat(
          "Browser ini tidak mendukung pemindai kamera. Gunakan scanner USB atau input manual.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (batal) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const BarcodeDetectorCtor = (
          window as unknown as {
            BarcodeDetector: new (o: { formats: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<
                Array<{ rawValue: string }>
              >;
            };
          }
        ).BarcodeDetector;
        const detector = new BarcodeDetectorCtor({
          formats: ["code_128", "qr_code", "ean_13", "code_39", "upc_a"],
        });
        const loop = async () => {
          if (!berjalan || batal) return;
          try {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const kode = String(barcodes[0].rawValue ?? "").trim();
                if (kode) {
                  const now = Date.now();
                  const terakhir = terakhirRef.current;
                  if (
                    !terakhir ||
                    terakhir.kode !== kode ||
                    now - terakhir.waktu > 2000
                  ) {
                    terakhirRef.current = { kode, waktu: now };
                    onDeteksi(kode);
                  }
                }
              }
            }
          } catch {
            // Abaikan error deteksi per-frame.
          }
          if (berjalan) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      } catch (e) {
        setGalat(
          "Tidak bisa mengakses kamera: " +
            (e instanceof Error ? e.message : String(e)),
        );
      }
    }

    void mulai();

    return () => {
      batal = true;
      berjalan = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDeteksi]);

  if (!didukung) {
    return (
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {galat}
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
        <video ref={videoRef} className="h-48 w-full object-cover" playsInline muted />
      </div>
      {galat && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {galat}
        </p>
      )}
      <p className="text-xs text-[var(--text-secondary)]">
        Arahkan kamera ke barcode/QR pada kartu anggota.
      </p>
    </div>
  );
}
