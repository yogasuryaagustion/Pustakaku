"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Badge, type BadgeTone } from "@/components/ui";
import { LABEL_KONDISI, LABEL_STATUS } from "@/lib/supabase/inventaris";

// Kerangka bersama halaman inventaris: navigasi antar sub-halaman, judul, dan
// lencana status/kondisi — supaya warna & istilahnya seragam di semua halaman.

export const TAB_INVENTARIS = [
  { href: "/inventaris", label: "Inventaris Buku" },
  { href: "/inventaris/eksemplar", label: "Data Eksemplar" },
  { href: "/inventaris/opname", label: "Stock Opname" },
  { href: "/inventaris/rekonsiliasi", label: "Hasil Sinkronisasi" },
  { href: "/inventaris/riwayat", label: "Riwayat Opname" },
];

export function NavigasiInventaris() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Navigasi inventaris">
      {TAB_INVENTARIS.map((t) => {
        const aktif = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aktif ? "page" : undefined}
            className={
              aktif
                ? "rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Muat satu endpoint inventaris. Setiap perubahan state terjadi di dalam
 * callback promise (bukan langsung dari body effect), sehingga tidak memicu
 * render berantai saat effect berjalan. Naikkan `segar` untuk memuat ulang.
 */
export function useMuatApi<T>(path: string, segar = 0) {
  const [data, setData] = useState<T | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    apiFetch<T>(path)
      .then((res) => {
        if (batal) return;
        setData(res);
        setGalat("");
      })
      .catch((e: unknown) => {
        if (batal) return;
        setData(null);
        setGalat(pesanGalat(e));
      })
      .finally(() => {
        if (!batal) setMemuat(false);
      });
    return () => {
      batal = true;
    };
  }, [path, segar]);

  return { data, memuat, galat };
}

export function KepalaInventaris({
  judul,
  sub,
  aksi,
}: {
  judul: string;
  sub: string;
  aksi?: React.ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{judul}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{sub}</p>
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </section>
  );
}

export function toneStatus(status: string): BadgeTone {
  switch (status) {
    case "tersedia":
      return "green";
    case "dipinjam":
      return "sky";
    case "rusak":
      return "amber";
    case "hilang":
      return "rose";
    default:
      return "slate";
  }
}

export function BadgeStatus({ status }: { status: string }) {
  return <Badge tone={toneStatus(status)}>{LABEL_STATUS[status] ?? status}</Badge>;
}

export function toneKondisi(kondisi: string): BadgeTone {
  switch (kondisi) {
    case "layak":
      return "green";
    case "rusak_ringan":
      return "amber";
    case "rusak_beda":
      return "rose";
    case "hilang":
      return "slate";
    default:
      return "slate";
  }
}

export function BadgeKondisi({ kondisi }: { kondisi: string }) {
  return <Badge tone={toneKondisi(kondisi)}>{LABEL_KONDISI[kondisi] ?? kondisi}</Badge>;
}

export function pesanGalat(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
    return (e as Error).message;
  }
  return "Terjadi kesalahan tak terduga.";
}

export function tanggalSingkat(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

export function waktuSingkat(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${tanggalSingkat(iso)} · ${d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })}`;
}
