"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useLibrary, useHelper } from "@/lib/library-context";
import { useAuth, useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { Badge, Modal, SampulBuku } from "@/components/ui";
import { useToast } from "@/components/toast";

// Kutipan literer yang ditampilkan sebagai sentuhan di bawah sinopsis.
const KUTIPAN = [
  { teks: "Buku adalah jendela dunia. Dengan membaca, kita bisa melihat lebih jauh dari apa yang kita lihat.", sumber: "Andrea Hirata" },
  { teks: "Membaca adalah cara paling murah untuk bepergian ke banyak zaman dan tempat.", sumber: "Mario Vargas Llosa" },
  { teks: "Perpustakaan adalah ruang paling demokratis di masyarakat mana pun.", sumber: "Alberto Manguel" },
];

function kutipanUntuk(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) % 9973;
  return KUTIPAN[h % KUTIPAN.length];
}

export default function DetailBukuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { buku, siap, pinjamBuku } = useLibrary();
  const { stokTersedia } = useHelper();
  const { sedangMasuk } = useAuth();
  const sistem = useSistem();
  const toast = useToast();
  // Izin mengikuti kebijakan — tombol pinjam & daftar bisa dicabut tanpa ubah kode.
  const bolehPinjam = useBoleh("katalog.pinjam");
  const bolehDaftar = useBoleh("akun.daftar");

  const bukuDipilih = useMemo(() => buku.find((b) => b.id === id), [buku, id]);
  const anggotaIdUser = sedangMasuk?.anggotaId;

  const [openPinjam, setOpenPinjam] = useState(false);
  const [tanggalPinjam, setTanggalPinjam] = useState(() => new Date().toISOString().slice(0, 10));

  const jatuhTempo = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalPinjam)) return "";
    const d = new Date(tanggalPinjam + "T00:00:00");
    d.setDate(d.getDate() + sistem.lamaPinjam);
    return d.toISOString().slice(0, 10);
  }, [tanggalPinjam, sistem.lamaPinjam]);

  if (!siap) {
    return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;
  }

  if (!bukuDipilih) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <div className="text-4xl">🔍</div>
        <h1 className="mt-3 text-xl font-bold">Buku tidak ditemukan</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Buku dengan id <span className="font-mono">{id}</span> tidak ada di katalog.
        </p>
        <Link href="/katalog" className="btn btn-primary mt-5">Kembali ke Katalog</Link>
      </div>
    );
  }

  const tersedia = stokTersedia(bukuDipilih.id);
  const kutipan = kutipanUntuk(bukuDipilih.id);

  async function konfirmasiPinjam() {
    if (!bukuDipilih || !anggotaIdUser) return;
    const r = await pinjamBuku(bukuDipilih.id, anggotaIdUser, tanggalPinjam);
    if (r.ok) toast.sukses(r.pesan);
    else toast.gagal(r.pesan);
    setOpenPinjam(false);
    setTanggalPinjam(new Date().toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
        <Link href="/katalog" className="hover:text-[var(--brand)]">Katalog</Link>
        <span>/</span>
        <span className="font-medium text-[var(--foreground)] line-clamp-1">{bukuDipilih.judul}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Kolom utama: sampul + judul + sinopsis */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6 flex flex-col sm:flex-row gap-6">
            <SampulBuku
              buku={bukuDipilih}
              className="h-56 w-full sm:w-44 shrink-0 shadow-lg"
            />

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{bukuDipilih.judul}</h1>
              <div className="mt-1 text-[var(--muted)]">{bukuDipilih.penulis}</div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="sky">{bukuDipilih.kategori}</Badge>
                {tersedia > 0 ? (
                  <Badge tone="green">Tersedia ({tersedia} eksemplar)</Badge>
                ) : (
                  <Badge tone="rose">Habis dipinjam</Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {anggotaIdUser && bolehPinjam ? (
                  <button
                    className="btn btn-primary"
                    disabled={tersedia <= 0}
                    onClick={() => {
                      setTanggalPinjam(new Date().toISOString().slice(0, 10));
                      setOpenPinjam(true);
                    }}
                  >
                    {tersedia > 0 ? "Ajukan Peminjaman" : "Tidak Tersedia"}
                  </button>
                ) : anggotaIdUser ? (
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-[var(--muted)]">
                    Izin meminjam buku dinonaktifkan oleh kebijakan akses.
                  </span>
                ) : (
                  <>
                    <Link href="/login" className="btn btn-primary">Masuk untuk Meminjam</Link>
                    {bolehDaftar && <Link href="/register" className="btn btn-ghost">Daftar</Link>}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sinopsis */}
          <div className="card p-6">
            <h2 className="font-bold">Sinopsis</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {bukuDipilih.deskripsi || "Belum ada sinopsis untuk buku ini."}
            </p>

            <figure className="mt-5 rounded-xl bg-[var(--brand-soft)]/40 p-5">
              <div className="text-3xl leading-none text-[var(--brand)]">“</div>
              <blockquote className="mt-1 text-sm italic text-slate-700">{kutipan.teks}</blockquote>
              <figcaption className="mt-2 text-sm font-semibold text-[var(--brand)]">— {kutipan.sumber}</figcaption>
            </figure>
          </div>
        </div>

        {/* Panel kanan: Informasi Buku */}
        <div className="card h-fit p-6">
          <h2 className="font-bold">Informasi Buku</h2>
          <dl className="mt-3 divide-y divide-[var(--border)] text-sm">
            {[
              ["Penulis", bukuDipilih.penulis],
              ["Penerbit", bukuDipilih.penerbit || "-"],
              ["Tahun Terbit", String(bukuDipilih.tahun)],
              ["ISBN", bukuDipilih.isbn || "-"],
              ["Kategori", bukuDipilih.kategori],
              ["Rak", bukuDipilih.rak || "-"],
              ["Total Stok", `${bukuDipilih.stok} eksemplar`],
              ["Tersedia", `${tersedia} eksemplar`],
            ].map(([label, nilai]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="text-right font-medium">{nilai}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Modal peminjaman */}
      <Modal open={openPinjam} onClose={() => setOpenPinjam(false)} title="Ajukan Peminjaman">
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-semibold">{bukuDipilih.judul}</div>
            <div className="text-[var(--muted)]">{bukuDipilih.penulis}</div>
          </div>
          <div>
            <label className="label">Tanggal Peminjaman</label>
            <input
              type="date"
              className="input"
              value={tanggalPinjam}
              onChange={(e) => setTanggalPinjam(e.target.value)}
            />
            {jatuhTempo && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Jatuh tempo: <span className="font-medium text-[var(--foreground)]">{jatuhTempo}</span> ({sistem.lamaPinjam} hari)
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setOpenPinjam(false)}>Batal</button>
            <button className="btn btn-primary" onClick={konfirmasiPinjam}>Konfirmasi Pinjam</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
