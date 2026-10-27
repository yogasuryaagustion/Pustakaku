"use client";

import { useMemo, useState } from "react";
import { useLibrary, useHelper, hariTerlambat } from "@/lib/library-context";
import { useBoleh } from "@/lib/auth";
import type { Peminjaman } from "@/lib/types";
import { useSistem } from "@/lib/sistem";
import { Modal, Badge, EmptyState, rupiah, tanggalPanjang, BadgeTone } from "@/components/ui";
import { useToast } from "@/components/toast";

type Tab = "Dipinjam" | "Riwayat" | "Semua";

function statusBadge(p: Peminjaman): { label: string; tone: BadgeTone } {
  const telat = hariTerlambat(p.tanggalKembali);
  if (p.status === "Dikembalikan") return { label: "Dikembalikan", tone: "green" };
  if (p.status === "Terlambat" || telat > 0)
    return { label: telat > 0 ? `Terlambat ${telat} hr` : "Terlambat", tone: "rose" };
  return { label: "Dipinjam", tone: "sky" };
}

export default function SirkulasiPage() {
  const { buku, anggota, peminjaman, siap, pinjamBuku, kembalikanBuku, perpanjangPinjam } = useLibrary();
  const { cariBuku, cariAnggota, stokTersedia } = useHelper();
  const sistem = useSistem();
  const toast = useToast();
  // Aksi sirkulasi (catat pinjam/kembali/perpanjang) butuh izin sirkulasi.kelola.
  const bolehKelola = useBoleh("sirkulasi.kelola");

  const [tab, setTab] = useState<Tab>("Dipinjam");
  const [q, setQ] = useState("");
  const [openPinjam, setOpenPinjam] = useState(false);
  const [formPinjam, setFormPinjam] = useState({ bukuId: "", anggotaId: "" });
  const [konfirmasiKembali, setKonfirmasiKembali] = useState<Peminjaman | null>(null);

  const bukuTersedia = useMemo(() => buku.filter((b) => stokTersedia(b.id) > 0), [buku, stokTersedia]);
  const anggotaAktif = useMemo(() => anggota.filter((a) => a.aktif), [anggota]);

  const daftar = useMemo(() => {
    let list = peminjaman.slice();
    if (tab === "Dipinjam") list = list.filter((p) => p.status === "Dipinjam" || p.status === "Terlambat");
    if (tab === "Riwayat") list = list.filter((p) => p.status === "Dikembalikan" || p.status === "Terlambat");

    const kata = q.trim().toLowerCase();
    if (kata) {
      list = list.filter((p) => {
        const b = cariBuku(p.bukuId);
        const a = cariAnggota(p.anggotaId);
        return (
          p.kodePinjam.toLowerCase().includes(kata) ||
          (b?.judul.toLowerCase().includes(kata) ?? false) ||
          (a?.nama.toLowerCase().includes(kata) ?? false)
        );
      });
    }
    // Urutkan: yang belum kembali & terlambat di atas.
    return list.sort((a, b) => {
      const skA = a.status === "Dipinjam" || a.status === "Terlambat" ? 0 : 1;
      const skB = b.status === "Dipinjam" || b.status === "Terlambat" ? 0 : 1;
      if (skA !== skB) return skA - skB;
      return a.tanggalKembali < b.tanggalKembali ? -1 : 1;
    });
  }, [peminjaman, tab, q, cariBuku, cariAnggota]);

  async function submitPinjam(e: React.FormEvent) {
    e.preventDefault();
    const res = await pinjamBuku(formPinjam.bukuId, formPinjam.anggotaId);
    if (res.ok) {
      toast.sukses(res.pesan);
      setOpenPinjam(false);
      setFormPinjam({ bukuId: "", anggotaId: "" });
      setTab("Dipinjam");
    } else {
      toast.gagal(res.pesan);
    }
  }

  if (!siap) return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;

  const totalDendaBelum = peminjaman
    .filter((p) => p.status === "Dipinjam")
    .reduce((s, p) => s + hariTerlambat(p.tanggalKembali) * sistem.dendaPerHari, 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(["Dipinjam", "Riwayat", "Semua"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                tab === t ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <input
            className="input"
            placeholder="Cari kode, judul, atau nama anggota…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {totalDendaBelum > 0 && (
          <div className="text-sm text-[var(--muted)]">
            Potensi denda: <span className="font-bold text-rose-600">{rupiah(totalDendaBelum)}</span>
          </div>
        )}
        {bolehKelola && (
          <button className="btn btn-primary" onClick={() => setOpenPinjam(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Pinjam Buku
          </button>
        )}
      </div>

      {daftar.length === 0 ? (
        <EmptyState pesan="Tidak ada data peminjaman" sub="Tekan “Pinjam Buku” untuk mencatat peminjaman baru." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Buku</th>
                  <th>Anggota</th>
                  <th>Pinjam</th>
                  <th>Jatuh Tempo</th>
                  <th>Denda</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((p) => {
                  const b = cariBuku(p.bukuId);
                  const a = cariAnggota(p.anggotaId);
                  const telat = hariTerlambat(p.tanggalKembali);
                  const sb = statusBadge(p);
                  const masihAktif = p.status === "Dipinjam";
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.kodePinjam}</td>
                      <td className="font-medium">{b?.judul ?? "-"}</td>
                      <td>{a?.nama ?? "-"}</td>
                      <td className="text-[var(--muted)]">{tanggalPanjang(p.tanggalPinjam)}</td>
                      <td className="text-[var(--muted)]">
                        {tanggalPanjang(p.tanggalKembali)}
                        {masihAktif && telat > 0 && (
                          <div className="text-xs text-rose-600">+{telat} hari</div>
                        )}
                        {p.tanggalKembaliAktual && (
                          <div className="text-xs">kembali: {tanggalPanjang(p.tanggalKembaliAktual)}</div>
                        )}
                      </td>
                      <td>
                        {p.denda > 0 ? (
                          <span className="text-rose-600 font-semibold">{rupiah(p.denda)}</span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td><Badge tone={sb.tone}>{sb.label}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {masihAktif && bolehKelola && (
                            <>
                              <button
                                className="btn btn-ghost !py-1.5 !px-2.5"
                                onClick={async () => {
                                  const hasil = await perpanjangPinjam(p.id);
                                  if (hasil.ok)
                                    toast.sukses(
                                      `Pinjaman "${b?.judul ?? p.kodePinjam}" diperpanjang ${sistem.lamaPinjam} hari.`
                                    );
                                  else toast.gagal(hasil.pesan);
                                }}
                              >
                                Perpanjang
                              </button>
                              <button className="btn btn-primary !py-1.5 !px-2.5" onClick={() => setKonfirmasiKembali(p)}>
                                Kembalikan
                              </button>
                            </>
                          )}
                          {masihAktif && !bolehKelola && (
                            <span className="text-xs text-[var(--muted)]">Tanpa izin kelola</span>
                          )}
                          {!masihAktif && <span className="text-xs text-[var(--muted)]">Selesai</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal pinjam */}
      <Modal open={openPinjam} onClose={() => setOpenPinjam(false)} title="Pinjam Buku">
        <form onSubmit={submitPinjam} className="space-y-4">
          <div>
            <label className="label">Buku (yang tersedia)</label>
            <select
              className="input"
              required
              value={formPinjam.bukuId}
              onChange={(e) => setFormPinjam({ ...formPinjam, bukuId: e.target.value })}
            >
              <option value="">— Pilih buku —</option>
              {bukuTersedia.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.judul} (sisa {stokTersedia(b.id)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Anggota</label>
            <select
              className="input"
              required
              value={formPinjam.anggotaId}
              onChange={(e) => setFormPinjam({ ...formPinjam, anggotaId: e.target.value })}
            >
              <option value="">— Pilih anggota —</option>
              {anggotaAktif.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nomorAnggota} — {a.nama}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Lama pinjam standar {sistem.lamaPinjam} hari. Denda keterlambatan {rupiah(sistem.dendaPerHari)}/hari.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenPinjam(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Catat Peminjaman</button>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi pengembalian */}
      <Modal
        open={!!konfirmasiKembali}
        onClose={() => setKonfirmasiKembali(null)}
        title="Konfirmasi Pengembalian"
        width="max-w-md"
      >
        {konfirmasiKembali && (
          <div className="space-y-3 text-sm">
            <p>
              Kembalikan <span className="font-semibold">{cariBuku(konfirmasiKembali.bukuId)?.judul}</span> milik{" "}
              <span className="font-semibold">{cariAnggota(konfirmasiKembali.anggotaId)?.nama}</span>?
            </p>
            {(() => {
              const telat = hariTerlambat(konfirmasiKembali.tanggalKembali);
              return telat > 0 ? (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-700">
                  Terlambat {telat} hari → denda{" "}
                  <span className="font-bold">{rupiah(telat * sistem.dendaPerHari)}</span>.
                </div>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-700">
                  Tepat waktu, tanpa denda.
                </div>
              );
            })()}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-ghost" onClick={() => setKonfirmasiKembali(null)}>Batal</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const judul = cariBuku(konfirmasiKembali.bukuId)?.judul ?? konfirmasiKembali.kodePinjam;
                  const hasil = await kembalikanBuku(konfirmasiKembali.id);
                  setKonfirmasiKembali(null);
                  if (hasil.ok) toast.sukses(`Pengembalian "${judul}" dicatat.`);
                  else toast.gagal(hasil.pesan);
                }}
              >
                Ya, Kembalikan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
