"use client";

import { useMemo, useState } from "react";
import { useAuth, useBoleh } from "@/lib/auth";
import { useLibrary, useHelper, hariTerlambat } from "@/lib/library-context";
import { useSistem } from "@/lib/sistem";
import { Badge, Modal, EmptyState, rupiah, tanggalPanjang, BadgeTone } from "@/components/ui";
import { useToast } from "@/components/toast";

type Tab = "Aktif" | "Riwayat" | "Semua";

// Sisa hari sampai jatuh tempo (negatif = sudah lewat).
function sisaHari(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function statusBadge(status: string, telat: number): { label: string; tone: BadgeTone } {
  if (status === "Dikembalikan") return { label: "Dikembalikan", tone: "green" };
  if (status === "Terlambat" || telat > 0)
    return { label: telat > 0 ? `Terlambat ${telat} hr` : "Terlambat", tone: "rose" };
  return { label: "Dipinjam", tone: "sky" };
}

export default function PinjamanSayaPage() {
  const { sedangMasuk } = useAuth();
  const { buku, siap, pinjamBuku, perpanjangPinjam } = useLibrary();
  const { cariBuku, stokTersedia, pinjamanAnggota } = useHelper();
  const sistem = useSistem();
  const toast = useToast();
  // Form pinjam cepat butuh izin katalog.pinjam — bisa dicabut via Kontrol Akses.
  const bolehPinjam = useBoleh("katalog.pinjam");

  const [tab, setTab] = useState<Tab>("Aktif");
  const [bukuDipilih, setBukuDipilih] = useState("");
  const [konfirmasi, setKonfirmasi] = useState<{ id: string; judul: string } | null>(null);

  // Peminjaman selalu dicatat hari ini (field tanggal dihapus dari form).
  // Memakai tanggal lokal (bukan toISOString) agar tidak bergeser satu hari
  // untuk zona waktu positif (UTC+7 s.d. UTC+9) dini hari; dikirim eksplisit
  // ke context supaya tanggal catatan sama dengan pratinjau jatuh tempo.
  const { hariIni, jatuhTempo } = useMemo(() => {
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const kini = new Date();
    const tempo = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + sistem.lamaPinjam);
    return { hariIni: iso(kini), jatuhTempo: iso(tempo) };
  }, [sistem.lamaPinjam]);

  const anggotaId = sedangMasuk?.anggotaId;

  const riwayat = useMemo(() => {
    if (!anggotaId) return [];
    return pinjamanAnggota(anggotaId);
  }, [anggotaId, pinjamanAnggota]);

  const daftar = useMemo(() => {
    if (tab === "Aktif") return riwayat.filter((p) => p.status === "Dipinjam");
    if (tab === "Riwayat") return riwayat.filter((p) => p.status !== "Dipinjam");
    return riwayat;
  }, [riwayat, tab]);

  const bukuTersedia = useMemo(
    () => buku.filter((b) => stokTersedia(b.id) > 0),
    [buku, stokTersedia]
  );

  if (!siap || !sedangMasuk) return <div className="text-[var(--muted)]">Memuat data…</div>;

  if (!anggotaId) {
    return (
      <EmptyState
        pesan="Akun ini tidak terikat kartu anggota"
        sub="Hubungi pustakawan untuk menghubungkan kartu anggota Anda."
      />
    );
  }

  const aktif = riwayat.filter((p) => p.status === "Dipinjam");
  const terlambat = aktif.filter((p) => hariTerlambat(p.tanggalKembali) > 0);
  const dendaBelum = riwayat
    .filter((p) => p.status === "Dipinjam")
    .reduce((s, p) => s + hariTerlambat(p.tanggalKembali) * sistem.dendaPerHari, 0);

  async function submitPinjam(e: React.FormEvent) {
    e.preventDefault();
    if (!anggotaId) return;
    const res = await pinjamBuku(bukuDipilih, anggotaId, hariIni);
    if (res.ok) {
      toast.sukses(res.pesan);
      setBukuDipilih("");
      setTab("Aktif");
    } else {
      toast.gagal(res.pesan);
    }
  }

  async function konfirmasiPerpanjang() {
    if (!konfirmasi) return;
    const hasil = await perpanjangPinjam(konfirmasi.id);
    if (hasil.ok)
      toast.sukses(`Pinjaman "${konfirmasi.judul}" diperpanjang ${sistem.lamaPinjam} hari.`);
    else toast.gagal(hasil.pesan);
    setKonfirmasi(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-raised p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Sedang Dipinjam</div>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-600">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
              </svg>
            </span>
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight">{aktif.length}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">dari maks. {sistem.maksPinjaman} buku</div>
        </div>
        <div className="card card-raised p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Terlambat</div>
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${terlambat.length ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              </svg>
            </span>
          </div>
          <div className={`mt-2 text-3xl font-bold tracking-tight ${terlambat.length ? "text-rose-600" : ""}`}>
            {terlambat.length}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {terlambat.length ? "segera kembalikan" : "semua tepat waktu"}
          </div>
        </div>
        <div className="card card-raised p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Denda Berjalan</div>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-600">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 1c-3 0-5 2-5 4.5S9 10 12 10s5 2 5 4.5S15 19 12 19s-5-2-5-4.5M12 1v3m0 14v3" />
              </svg>
            </span>
          </div>
          <div className={`mt-2 text-3xl font-bold tracking-tight ${dendaBelum ? "text-rose-600" : ""}`}>
            {rupiah(dendaBelum)}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">{rupiah(sistem.dendaPerHari)}/hari keterlambatan</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daftar pinjaman */}
        <div className="lg:col-span-2 card self-start">
          <div className="px-5 py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {(["Aktif", "Riwayat", "Semua"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    tab === t
                      ? "bg-white shadow-[var(--sh-1)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="text-xs text-[var(--muted)]">{daftar.length} transaksi</div>
          </div>

          {daftar.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--muted)]">
              {tab === "Aktif" ? "Tidak ada pinjaman aktif. Pinjam buku lewat form di samping." : "Belum ada riwayat."}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {daftar.map((p) => {
                const telat = hariTerlambat(p.tanggalKembali);
                const sb = statusBadge(p.status, telat);
                const b = cariBuku(p.bukuId);
                const sisa = sisaHari(p.tanggalKembali);
                return (
                  <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{b?.judul ?? "-"}</span>
                        <Badge tone={sb.tone}>{sb.label}</Badge>
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        {p.kodePinjam} · dipinjam {tanggalPanjang(p.tanggalPinjam)} · jatuh tempo{" "}
                        {tanggalPanjang(p.tanggalKembali)}
                        {p.status === "Dipinjam" &&
                          (sisa >= 0 ? (
                            <> · sisa {sisa} hari</>
                          ) : (
                            <span className="text-rose-600 font-semibold"> · telat {-sisa} hari</span>
                          ))}
                        {p.tanggalKembaliAktual && (
                          <> · kembali {tanggalPanjang(p.tanggalKembaliAktual)}</>
                        )}
                      </div>
                      {p.denda > 0 && (
                        <div className="text-xs text-rose-600 font-semibold mt-0.5">
                          Denda: {rupiah(p.denda)}
                        </div>
                      )}
                    </div>
                    {p.status === "Dipinjam" && (
                      <button
                        className="btn btn-ghost !py-1.5 shrink-0"
                        onClick={() => setKonfirmasi({ id: p.id, judul: b?.judul ?? p.kodePinjam })}
                      >
                        Perpanjang
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pinjam cepat — hanya bila izin katalog.pinjam aktif */}
        {bolehPinjam ? (
        <div className="card self-start">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-bold">Pinjam Buku</h2>
          </div>
          <div className="p-5">
            <form onSubmit={submitPinjam} className="space-y-3">
              <div>
                <label className="label">Pilih buku tersedia</label>
                <select
                  className="input"
                  value={bukuDipilih}
                  onChange={(e) => setBukuDipilih(e.target.value)}
                  required
                >
                  <option value="">— Pilih buku —</option>
                  {bukuTersedia.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.judul} (sisa {stokTersedia(b.id)})
                    </option>
                  ))}
                </select>
              </div>
              {jatuhTempo && (
                <p className="text-xs text-[var(--muted)]">
                  Dipinjam hari ini · jatuh tempo otomatis: <span className="font-semibold">{tanggalPanjang(jatuhTempo)}</span>
                </p>
              )}
              <button type="submit" className="btn btn-primary w-full" disabled={!bukuDipilih || aktif.length >= sistem.maksPinjaman}>
                Pinjam Sekarang
              </button>
              {aktif.length >= sistem.maksPinjaman && (
                <p className="text-xs text-rose-600">
                  Batas maksimal {sistem.maksPinjaman} buku sedang dipinjam. Kembalikan salah satu dulu.
                </p>
              )}
              <p className="text-xs text-[var(--muted)]">
                Lama pinjam {sistem.lamaPinjam} hari. Pengembalian diproses di perpustakaan oleh pustakawan.
              </p>
            </form>
          </div>
        </div>
        ) : (
          <div className="card self-start p-5 text-sm text-[var(--muted)]">
            Peminjaman mandiri dinonaktifkan oleh kebijakan akses. Ajukan peminjaman melalui
            pustakawan.
          </div>
        )}
      </div>

      {/* Konfirmasi perpanjangan */}
      <Modal
        open={!!konfirmasi}
        onClose={() => setKonfirmasi(null)}
        title="Perpanjang Pinjaman"
        width="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p>
            Perpanjang pinjaman <span className="font-semibold">{konfirmasi?.judul}</span> selama {sistem.lamaPinjam} hari
            tambahan?
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setKonfirmasi(null)}>Batal</button>
            <button className="btn btn-primary" onClick={konfirmasiPerpanjang}>
              Ya, Perpanjang
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
