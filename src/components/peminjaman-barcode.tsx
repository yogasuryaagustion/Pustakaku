"use client";

import { useEffect, useRef, useState } from "react";
import type { Anggota, Peminjaman } from "@/lib/types";
import { useLibrary, useHelper } from "@/lib/library-context";
import { useSistem } from "@/lib/sistem";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { Modal, rupiah, tanggalPanjang } from "@/components/ui";
import { Stepper, type TahapStepper } from "@/components/stepper";
import { totalDendaTertunggak } from "@/lib/denda";

type LangkahTransaksi = "anggota" | "buku" | "ringkasan" | "bukti";

// Empat tahap form pinjam; dipakai Stepper di atas isi modal agar status
// langkah (selesai / aktif / belum) terbaca seragam.
const TAHAPAN: Array<TahapStepper<LangkahTransaksi>> = [
  { id: "anggota", label: "Anggota" },
  { id: "buku", label: "Buku" },
  { id: "ringkasan", label: "Ringkasan" },
  { id: "bukti", label: "Bukti" },
];

type Item = {
  eksemplarId: string;
  nomorInventaris: string;
  bukuId: string;
  judul: string;
};

type Pesan = { nada: "ok" | "galat"; teks: string };

type Receipt = {
  kode: string;
  judul: string;
  nomor: string | null;
  kembali: string;
};

function pesanApi(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
    return (e as Error).message;
  }
  return "Tidak bisa terhubung ke server. Periksa koneksi Anda.";
}

export function PeminjamanBarcode({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { anggota: daftarAnggota, peminjaman, segarkanData } = useLibrary();
  const { cariAnggota } = useHelper();
  const sistem = useSistem();
  const toast = useToast();

  const [langkah, setLangkah] = useState<LangkahTransaksi>("anggota");
  const [kodeKartu, setKodeKartu] = useState("");
  const [anggotaId, setAnggotaId] = useState("");
  const [anggota, setAnggota] = useState<Anggota | null>(null);
  const [pesanAnggota, setPesanAnggota] = useState<Pesan | null>(null);
  const [cart, setCart] = useState<Item[]>([]);
  const [kodeBuku, setKodeBuku] = useState("");
  const [pesanBuku, setPesanBuku] = useState<Pesan | null>(null);
  const [sedangScanBuku, setSedangScanBuku] = useState(false);
  const [kameraBuka, setKameraBuka] = useState(false);
  const [kameraAnggota, setKameraAnggota] = useState(false);
  const [lamaPinjam, setLamaPinjam] = useState(sistem.lamaPinjam);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt[]>([]);
  const [errorSubmit, setErrorSubmit] = useState<string | null>(null);


  const anggotaAktif = daftarAnggota.filter((a) => a.aktif);

  // Validasi anggota saat dipilih.
  function pilihAnggota(id: string) {
    setAnggotaId(id);
    setPesanAnggota(null);
    const a = cariAnggota(id);
    if (!a) {
      setAnggota(null);
      return;
    }
    if (!a.aktif) {
      setAnggota(null);
      setPesanAnggota({
        nada: "galat",
        teks: `Anggota ${a.nama} (${a.nomorAnggota}) nonaktif — peminjaman tidak bisa dicatat.`,
      });
      return;
    }
    const tertunggak = totalDendaTertunggak(peminjaman, a.id);
    if (tertunggak > 0) {
      setAnggota(null);
      setPesanAnggota({
        nada: "galat",
        teks: `Anggota ini masih memiliki denda tertunggak ${rupiah(tertunggak)}. Lunasi denda terlebih dahulu.`,
      });
      return;
    }
    setAnggota(a);
    setPesanAnggota({ nada: "ok", teks: `${a.nama} · ${a.nomorAnggota}` });
  }

  // Pindai kartu anggota (nomor anggota dari barcode/QR).
  function pindaiKartu(kodeInput?: string) {
    const kode = (kodeInput ?? kodeKartu).trim().toUpperCase();
    if (!kode) return;
    const cocok = daftarAnggota.find(
      (a) => a.nomorAnggota.trim().toUpperCase() === kode,
    );
    if (!cocok) {
      setPesanAnggota({
        nada: "galat",
        teks: `Kartu "${kode}" tidak dikenal. Periksa kartu atau pilih anggota secara manual.`,
      });
      setKodeKartu("");
      return;
    }
    pilihAnggota(cocok.id);
    setKodeKartu("");
  }

  // Pindai barcode eksemplar.
  async function pindaiBuku(kodeRaw?: string) {
    const kode = (kodeRaw ?? kodeBuku).trim().toUpperCase();
    if (!kode || sedangScanBuku) return;
    setSedangScanBuku(true);
    setPesanBuku(null);
    try {
      const hasil = await apiFetch<{
        eksemplar: {
          id: string;
          bukuId: string;
          nomorInventaris: string;
          status: string;
          kondisiFisik: string;
        };
        buku: { id: string; judul: string };
      }>(`/api/eksemplar/cari?kode=${encodeURIComponent(kode)}`);

      if (
        hasil.eksemplar.status !== "tersedia" ||
        hasil.eksemplar.kondisiFisik === "hilang"
      ) {
        setPesanBuku({
          nada: "galat",
          teks: `Salinan ${hasil.eksemplar.nomorInventaris} berstatus ${hasil.eksemplar.status} — tidak bisa dipinjam.`,
        });
        return;
      }

      if (cart.some((c) => c.eksemplarId === hasil.eksemplar.id)) {
        setPesanBuku({
          nada: "galat",
          teks: `Salinan ${hasil.eksemplar.nomorInventaris} sudah ada di daftar peminjaman.`,
        });
        return;
      }

      setCart((prev) => [
        ...prev,
        {
          eksemplarId: hasil.eksemplar.id,
          nomorInventaris: hasil.eksemplar.nomorInventaris,
          bukuId: hasil.buku.id,
          judul: hasil.buku.judul,
        },
      ]);
      setKodeBuku("");
      setPesanBuku({
        nada: "ok",
        teks: `${hasil.buku.judul} · ${hasil.eksemplar.nomorInventaris} ditambahkan.`,
      });
    } catch (error) {
      setPesanBuku({
        nada: "galat",
        teks: error instanceof Error ? error.message : "Barcode gagal dibaca.",
      });
    } finally {
      setSedangScanBuku(false);
    }
    return;
  }

  // Hitung pinjaman aktif anggota.
  const aktifAnggota = anggota
    ? peminjaman.filter(
        (p) => p.anggotaId === anggota.id && p.status === "Dipinjam",
      ).length
    : 0;
  const maksPinjam = sistem.maksPinjaman ?? 3;
  const melebihiBatas = anggota
    ? aktifAnggota + cart.length > maksPinjam
    : false;

  async function konfirmasi() {
    if (!anggota || cart.length === 0) return;
    if (melebihiBatas) {
      toast.gagal(
        `Batas pinjaman ${maksPinjam} buku akan terlampaui (${aktifAnggota} aktif + ${cart.length} baru).`,
      );
      return;
    }
    setSubmitting(true);
    setErrorSubmit(null);
    const hasil: Receipt[] = [];
    const errors: string[] = [];
    for (const item of cart) {
      try {
        const res = await apiFetch<{ peminjaman: Peminjaman }>(
          "/api/peminjaman",
          {
            method: "POST",
            body: {
              bukuId: item.bukuId,
              anggotaId: anggota.id,
              lamaHari: lamaPinjam,
              eksemplarId: item.eksemplarId,
            },
          },
        );
        const p = res.peminjaman;
        hasil.push({
          kode: p.kodePinjam,
          judul: item.judul,
          nomor: item.nomorInventaris,
          kembali: p.tanggalKembali,
        });
      } catch (e) {
        errors.push(`${item.judul} (${item.nomorInventaris}): ${pesanApi(e)}`);
      }
    }
    setReceipt(hasil);
    if (errors.length > 0) setErrorSubmit(errors.join("\n"));
    setSubmitting(false);
    // Segarkan di latar belakang: memakai muatUlang akan mengosongkan cache,
    // halaman induk menampilkan layar memuat, dan modal (beserta bukti pinjam)
    // ikut hilang sebelum petugas membacanya.
    segarkanData(["buku", "peminjaman"]);
    if (hasil.length > 0) setLangkah("bukti");
  }

  const jatuhTempo = (() => {
    const tanggal = new Date();
    tanggal.setDate(tanggal.getDate() + (lamaPinjam || 0));
    return tanggal.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <Modal open={open} onClose={onClose} title="Transaksi Peminjaman" width="max-w-2xl">
      {/* Tahapan transaksi memakai komponen bersama: satu sumber status
          langkah, lengkap dengan garis progres dan penanda aria-current. */}
      <Stepper
        className="mb-4"
        tahap={TAHAPAN}
        aktif={langkah}
        bolehPilih={(id) =>
          id === "anggota" ||
          (id === "buku" && Boolean(anggota)) ||
          (id === "ringkasan" && Boolean(anggota) && cart.length > 0)
        }
        onPilih={(id) => setLangkah(id)}
      />

      {langkah === "anggota" && (
        <div className="space-y-4">          <div className="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)]/40 p-3">
            <label className="label" htmlFor="scan-kartu-anggota-barcode">
              Scan kartu anggota
            </label>
            <div className="flex gap-2">
              <input
                id="scan-kartu-anggota-barcode"
                className="input w-full font-mono uppercase"
                value={kodeKartu}
                onChange={(e) => setKodeKartu(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    pindaiKartu(e.currentTarget.value);
                  }
                }}
                placeholder="AGT-0001"
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-ghost shrink-0"
                onClick={() => pindaiKartu()}
              >
                Scan
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Arahkan scanner USB ke barcode pada kartu anggota, atau gunakan
              kamera browser.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => setKameraAnggota((v) => !v)}
              >
                {kameraAnggota ? "Tutup Kamera" : "Gunakan Kamera"}
              </button>
            </div>
            {kameraAnggota && (
              <PemindaiKamera onDeteksi={(kode) => pindaiKartu(kode)} />
            )}
          </div>

          {pesanAnggota && (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                pesanAnggota.nada === "ok"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {pesanAnggota.nada === "ok" ? "Terpilih: " : ""}
              {pesanAnggota.teks}
            </p>
          )}

          <div>
            <label className="label">Atau pilih anggota manual</label>
            <select
              className="input"
              value={anggotaId}
              onChange={(e) => pilihAnggota(e.target.value)}
            >
              <option value="">— Pilih anggota —</option>
              {anggotaAktif.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nomorAnggota} — {a.nama}
                </option>
              ))}
            </select>
          </div>

          {anggota && (
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm">
              <p className="font-semibold text-teal-900">{anggota.nama}</p>
              <p className="text-xs text-teal-800">
                {anggota.nomorAnggota} · {anggota.jenis} ·{" "}
                {aktifAnggota} buku sedang dipinjam
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!anggota}
              onClick={() => setLangkah("buku")}
            >
              Lanjut ke Buku
            </button>
          </div>
        </div>
      )}

      {langkah === "buku" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)]/40 p-3">
            <label className="label" htmlFor="scan-barcode-buku-barcode">
              Scan barcode buku
            </label>
            <div className="flex gap-2">
              <input
                id="scan-barcode-buku-barcode"
                className="input w-full font-mono uppercase"
                value={kodeBuku}
                onChange={(e) => setKodeBuku(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void pindaiBuku(e.currentTarget.value);
                  }
                }}
                placeholder="INV-2026-0001"
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-ghost shrink-0"
                onClick={() => void pindaiBuku()}
                disabled={sedangScanBuku}
              >
                {sedangScanBuku ? "..." : "Scan"}
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Arahkan scanner USB ke label nomor inventaris, atau gunakan kamera
              browser.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => setKameraBuka((v) => !v)}
              >
                {kameraBuka ? "Tutup Kamera" : "Gunakan Kamera"}
              </button>
            </div>
            {kameraBuka && (
              <PemindaiKamera onDeteksi={(kode) => void pindaiBuku(kode)} />
            )}
          </div>

          {pesanBuku && (
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                pesanBuku.nada === "ok"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {pesanBuku.nada === "ok" ? "Ditambahkan: " : ""}
              {pesanBuku.teks}
            </p>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Daftar peminjaman sementara ({cart.length})
            </p>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-400">
                Belum ada buku. Pindai barcode untuk menambahkan.
              </p>
            ) : (
              <ul className="space-y-2">
                {cart.map((c, i) => (
                  <li
                    key={c.eksemplarId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {c.judul}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {c.nomorInventaris}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600 hover:underline"
                      onClick={() =>
                        setCart((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setLangkah("anggota")}
            >
              Kembali
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={cart.length === 0}
                onClick={() => setLangkah("ringkasan")}
              >
                Ringkasan
              </button>
            </div>
          </div>
        </div>
      )}

      {langkah === "ringkasan" && anggota && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{anggota.nama}</p>
            <p className="text-xs text-slate-500">
              {anggota.nomorAnggota} · {aktifAnggota} buku aktif · batas{" "}
              {maksPinjam}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="lama-pinjam-barcode">
              Lama pinjam (hari)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="lama-pinjam-barcode"
                type="number"
                className="input"
                min={1}
                max={90}
                step={1}
                required
                value={lamaPinjam}
                onChange={(e) => {
                  const nilai = Number(e.target.value);
                  setLamaPinjam(Number.isFinite(nilai) ? nilai : 0);
                }}
              />
              <div className="flex shrink-0 gap-1">
                {[7, 14, 30].map((hari) => (
                  <button
                    key={hari}
                    type="button"
                    className="btn btn-ghost px-2.5 py-1.5 text-xs"
                    onClick={() => setLamaPinjam(hari)}
                  >
                    {hari} hr
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Standar dari pengaturan: {sistem.lamaPinjam} hari. Jatuh tempo:{" "}
              <strong>{jatuhTempo}</strong>
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Ringkasan transaksi ({cart.length} buku)
            </p>
            <ul className="space-y-2">
              {cart.map((c) => (
                <li
                  key={c.eksemplarId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {c.judul}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {c.nomorInventaris}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {melebihiBatas && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Batas pinjaman {maksPinjam} buku akan terlampaui (
              {aktifAnggota} aktif + {cart.length} baru).
            </div>
          )}

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
            <p>
              Jatuh tempo: <strong>{jatuhTempo}</strong>
            </p>
            <p className="mt-1">
              Denda keterlambatan:{" "}
              <strong>{rupiah(sistem.dendaPerHari)}/hari</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setLangkah("buku")}
              disabled={submitting}
            >
              Kembali
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void konfirmasi()}
                disabled={submitting || melebihiBatas || cart.length === 0}
              >
                {submitting ? "Menyimpan..." : "Konfirmasi Peminjaman"}
              </button>
            </div>
          </div>
        </div>
      )}

      {langkah === "bukti" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-semibold">Transaksi berhasil dicatat.</p>
            <p className="mt-1 text-xs">
              Simpan bukti ini untuk anggota. Tanggal pengembalian berlaku
              untuk setiap buku yang dipinjam.
            </p>
          </div>

          <ul className="space-y-2">
            {receipt.map((r) => (
              <li
                key={r.kode}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-slate-700">
                    {r.kode}
                  </p>
                  <p className="text-xs text-slate-500">
                    Kembali: {tanggalPanjang(r.kembali)}
                  </p>
                </div>
                <p className="mt-1 truncate font-semibold text-slate-900">
                  {r.judul}
                </p>
                {r.nomor && (
                  <p className="font-mono text-xs text-slate-500">
                    Inv. {r.nomor}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {errorSubmit && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-semibold">Sebagian transaksi gagal:</p>
              <pre className="mt-1 whitespace-pre-wrap text-xs">{errorSubmit}</pre>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Selesai
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// === Kamera browser (BarcodeDetector) ===
function PemindaiKamera({ onDeteksi }: { onDeteksi: (kode: string) => void }) {
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
        Arahkan kamera ke barcode/QR pada label buku.
      </p>
    </div>
  );
}
