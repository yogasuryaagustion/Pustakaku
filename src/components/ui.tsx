"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Buku } from "@/lib/types";

// Komponen UI kecil yang dipakai lintas halaman.

// === Animasi reveal-on-scroll =============================================
// Membungkus konten yang mulai samar lalu muncul halus saat masuk viewport
// (sekali jalan). Variasi jeda per kartu lewat prop `delay` (dalam detik).
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Jeda animasi setelah terlihat (detik) — untuk efek berjenjang. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tampil, setTampil] = useState(false);

  // Catatan: reduced-motion ditangani murni di CSS (.reveal { transition: none })
  // sehingga tidak perlu setState dari effect.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setTampil(true);
          obs.disconnect();
        }
      },
      // Picu saat ~15% elemen masuk viewport — terasa natural, tidak terlalu awal.
      { threshold: 0.15 },
    );
    obs.observe(el);
    // Jaring pengaman: bila observer tak pernah fire (tab tersembunyi,
    // lingkungan tanpa frame), tampilkan juga — konten tak boleh hilang.
    const jaring = window.setTimeout(() => setTampil(true), 1600);
    return () => {
      obs.disconnect();
      window.clearTimeout(jaring);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${tampil ? "tampil" : ""} ${className}`}
      style={delay ? { "--reveal-delay": `${delay}s` } as React.CSSProperties : undefined}
    >
      {children}
    </div>
  );
}

// === Angka menghitung naik ================================================
// Nilai naik dari 0 ke target saat terlihat — sentuhan hidup pada statistik.
const kurangGerak = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Angka({ nilai, durasi = 900 }: { nilai: number; durasi?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tampil, setTampil] = useState(false);
  // Reduced-motion: state awal sudah nilai akhir (tampilan tetap 0 sampai
  // `tampil` — lihat render — jadi tidak ada mismatch hydration).
  const [angka, setAngka] = useState(() => (kurangGerak() ? nilai : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setTampil(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    // Jaring pengaman sama seperti Reveal — konten tidak boleh tersangkut.
    const jaring = window.setTimeout(() => setTampil(true), 1600);
    return () => {
      obs.disconnect();
      window.clearTimeout(jaring);
    };
  }, []);

  useEffect(() => {
    if (!tampil || kurangGerak()) return; // nilai sudah final dari state awal
    let raf = 0;
    const mulai = performance.now();
    const langkah = (t: number) => {
      // Ease-out kuat: cepat di awal, melandai menyentuh target.
      const p = Math.min(1, (t - mulai) / durasi);
      const eased = 1 - Math.pow(1 - p, 3);
      setAngka(Math.round(nilai * eased));
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    // Jaring pengaman rAF: pastikan nilai akhir tetap tercapai meski frame
    // tidak dijadwalkan (tab di background, lingkungan tanpa compositor).
    const jaring = window.setTimeout(() => setAngka(nilai), durasi + 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(jaring);
    };
  }, [tampil, nilai, durasi]);

  return <span ref={ref}>{tampil ? angka : 0}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "brand",
  ikon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "brand" | "amber" | "rose" | "sky" | "slate";
  /** Path stroke SVG (viewBox 24) — ikon opsional di sudut kanan atas. */
  ikon?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    sky: "bg-sky-100 text-sky-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="card card-raised relative overflow-hidden p-5">
      {/* Aksen warna tipis di kiri kartu — hierarki visual antar metrik. */}
      <div aria-hidden className={`absolute left-0 top-0 h-full w-1 ${tones[tone]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
          {label}
        </div>
        {ikon && (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ikon} />
            </svg>
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-[var(--muted)]">{sub}</div>}
      </div>
    </div>
  );
}

export type BadgeTone = "green" | "amber" | "rose" | "sky" | "slate";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    sky: "bg-sky-100 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16 tirai-masuk">
      <div className={`card modal-masuk w-full ${width} shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-slate-100"
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Hapus",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function EmptyState({ pesan, sub }: { pesan: string; sub?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-slate-100 grid place-items-center text-[var(--muted)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      </div>
      <div className="font-semibold">{pesan}</div>
      {sub && <div className="mt-1 text-sm text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

// === Input berikon (halaman masuk & daftar) ================================
const IKON_MATA =
  "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
const IKON_MATA_TUTUP =
  "M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22";
const IKON_KUNCI =
  "M7 11V7a5 5 0 0110 0v4 M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z";

/** Input `.input` dengan ikon kiri (path SVG) — dipakai form masuk/daftar. */
export function InputIkon({
  ikon,
  className = "",
  ...props
}: { ikon: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ikon} />
        </svg>
      </span>
      <input className={`input pl-10 ${className}`} {...props} />
    </div>
  );
}

/** Varian kata sandi: ikon kunci kiri + tombol lihat/sembunyi di kanan. */
export function InputSandi({
  ikon = IKON_KUNCI,
  className = "",
  ...props
}: { ikon?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [lihat, setLihat] = useState(false);
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ikon} />
        </svg>
      </span>
      <input
        {...props}
        type={lihat ? "text" : "password"}
        className={`input pl-10 pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-600"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={lihat ? IKON_MATA_TUTUP : IKON_MATA} />
        </svg>
      </button>
    </div>
  );
}

// === Avatar (foto profil / inisial) ========================================
// Satu sumber tampilan avatar lintas panel: foto profil bila tersedia,
// fallback inisial grad-brand. Ukuran/bentuk diatur lewat className.
export function Avatar({
  nama,
  foto,
  className = "",
}: {
  nama: string;
  foto?: string | null;
  /** Kelas ukuran & bentuk, mis. "h-8 w-8 rounded-lg text-sm". */
  className?: string;
}) {
  const inisial = nama.trim().charAt(0).toUpperCase() || "?";
  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL kecil hasil resize lokal
      <img src={foto} alt={`Foto ${nama}`} className={`shrink-0 object-cover ${className}`} />
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center grad-brand font-bold text-white ${className}`}
      aria-hidden
    >
      {inisial}
    </span>
  );
}

export function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function tanggalPanjang(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// === Sampul buku ==========================================================
// Gambar sampul per buku, dengan dua lapis:
// 1. `buku.gambar` (URL dari admin) — dipasang apa adanya; bila gagal dimuat
//    (offline / URL mati) otomatis jatuh ke lapis 2.
// 2. Sampul generatif yang MENCETAK JUDUL buku di atas gradien bertema
//    (--g1..--g6, ikut warna pilihan admin di /admin/pengaturan) — jadi
//    setiap buku tetap punya gambar "sesuai judulnya" tanpa file eksternal.
//    Gradien dipilih deterministik dari hash judul, konsisten antar-halaman.

const IKON_BUKU_SAMPUL =
  "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z";

function hashJudul(judul: string): number {
  let h = 0;
  for (let i = 0; i < judul.length; i++) h = (h * 31 + judul.charCodeAt(i)) % 9973;
  return (h % 6) + 1;
}

export function SampulBuku({
  buku,
  className = "",
  rounded = "rounded-xl",
  tampilkanJudul = true,
}: {
  buku: Pick<Buku, "judul" | "penulis"> & { gambar?: string | null };
  className?: string;
  /** Sudut membulat; pakai "" bila wadah induk sudah mengatur sendiri. */
  rounded?: string;
  /** Cetak judul+penulis pada sampul generatif (nonaktifkan untuk thumbnail kecil). */
  tampilkanJudul?: boolean;
}) {
  const [gagal, setGagal] = useState(false);
  const sumber = buku.gambar?.trim();

  if (sumber && !gagal) {
    return (
      <div className={`relative overflow-hidden ${rounded} bg-slate-100 ${className}`}>
        <Image
          src={sumber}
          alt={`Sampul ${buku.judul}`}
          fill
          unoptimized
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          onError={() => setGagal(true)}
        />
      </div>
    );
  }

  // Sampul generatif: gradien tema + judul tercetak + punggung buku.
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden text-white ${rounded} ${className}`}
      style={{ backgroundImage: `var(--g${hashJudul(buku.judul)})` }}
      role="img"
      aria-label={`Sampul ${buku.judul}`}
    >
      {/* Punggung buku di tepi kiri. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[6px] bg-black/15" />
      {/* Kilau halus diagonal. */}
      <span
        aria-hidden
        className="absolute -right-8 -top-10 h-24 w-24 rotate-12 rounded-2xl bg-white/10"
      />
      {tampilkanJudul ? (
        <div className="relative z-10 flex h-full flex-col justify-between p-3 pl-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-80" aria-hidden>
            <path d={IKON_BUKU_SAMPUL} />
          </svg>
          <div className="min-w-0">
            <div className="line-clamp-3 text-[11px] font-bold leading-tight [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">
              {buku.judul}
            </div>
            <div className="mt-0.5 truncate text-[9px] font-medium text-white/80">
              {buku.penulis}
            </div>
          </div>
        </div>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="absolute inset-0 m-auto opacity-80" aria-hidden>
          <path d={IKON_BUKU_SAMPUL} />
        </svg>
      )}
    </div>
  );
}
