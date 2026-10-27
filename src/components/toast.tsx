"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Notifikasi toast terpusat untuk umpan balik aksi (berhasil/gagal/info).
// Konvensi aplikasi: aksi mutasi memakai toast, kesalahan formulir/tetap
// memakai pesan inline di halaman (login, register, profil).

type JenisToast = "sukses" | "gagal" | "info";

interface Toast {
  id: number;
  jenis: JenisToast;
  teks: string;
}

interface ToastState {
  sukses: (teks: string) => void;
  gagal: (teks: string) => void;
  info: (teks: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

let berikutnya = 0;

const GAYA: Record<JenisToast, { chip: string; ring: string; svg: string }> = {
  sukses: {
    chip: "bg-emerald-100 text-emerald-700",
    ring: "border-emerald-200",
    svg: "M5 13l4 4L19 7",
  },
  gagal: {
    chip: "bg-rose-100 text-rose-700",
    ring: "border-rose-200",
    svg: "M6 6l12 12M18 6L6 18",
  },
  info: {
    chip: "bg-sky-100 text-sky-700",
    ring: "border-sky-200",
    svg: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);

  const tutup = useCallback((id: number) => {
    setList((l) => l.filter((t) => t.id !== id));
  }, []);

  const dorong = useCallback(
    (jenis: JenisToast, teks: string) => {
      const id = ++berikutnya;
      // Simpan maksimal 3 toast sekaligus; hilangkan otomatis setelah 4 detik.
      setList((l) => [...l.slice(-2), { id, jenis, teks }]);
      window.setTimeout(() => tutup(id), 4000);
    },
    [tutup]
  );

  const value = useMemo<ToastState>(
    () => ({
      sukses: (t) => dorong("sukses", t),
      gagal: (t) => dorong("gagal", t),
      info: (t) => dorong("info", t),
    }),
    [dorong]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[70] flex w-[min(21rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {list.map((t) => {
          const g = GAYA[t.jenis];
          return (
            <div
              key={t.id}
              className={`toast-masuk card flex items-start gap-3 border px-4 py-3 shadow-lg ${g.ring}`}
            >
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${g.chip}`}
                aria-hidden
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={g.svg} />
                </svg>
              </span>
              <p className="flex-1 text-sm font-medium leading-snug text-[var(--foreground)]">
                {t.teks}
              </p>
              <button
                onClick={() => tutup(t.id)}
                aria-label="Tutup notifikasi"
                className="-mr-1 rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}
