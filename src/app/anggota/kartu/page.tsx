"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAuth, useBoleh } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Avatar } from "@/components/ui";
import { payloadQrAnggota, statusAnggota, UKURAN_KARTU } from "@/lib/kartu";
import type { Anggota } from "@/lib/types";

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function tanggal(iso: string): string {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : FORMAT_TANGGAL.format(date);
}

async function unduhPdf(kartu: Anggota, namaPerpustakaan: string, qr: string) {
  // jsPDF (~300 KB) hanya dimuat saat tombol Unduh ditekan — bukan sejak
  // halaman dibuka, karena pratinjau kartu tidak membutuhkannya.
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [UKURAN_KARTU.lebar, UKURAN_KARTU.tinggi],
    compress: true,
  });
  pdf.setFillColor(15, 118, 110);
  pdf.roundedRect(0, 0, UKURAN_KARTU.lebar, UKURAN_KARTU.tinggi, 2, 2, "F");
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(3, 3, UKURAN_KARTU.lebar - 6, UKURAN_KARTU.tinggi - 6, 2, 2, "F");
  pdf.setFillColor(15, 118, 110);
  pdf.rect(3, 3, 2, UKURAN_KARTU.tinggi - 6, "F");

  pdf.setTextColor(15, 118, 110);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(namaPerpustakaan.slice(0, 32), 9, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(90, 105, 118);
  pdf.text("KARTU KEANGGOTAAN", 9, 15);

  try {
    if (kartu.foto?.startsWith("data:image/")) {
      pdf.addImage(kartu.foto, "JPEG", 9, 19, 17, 17, undefined, "FAST");
    } else {
      pdf.setFillColor(226, 244, 240);
      pdf.circle(17.5, 27.5, 8.5, "F");
      pdf.setTextColor(15, 118, 110);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text(kartu.nama.trim().charAt(0).toUpperCase() || "?", 17.5, 30, { align: "center" });
    }
  } catch {
    pdf.setFillColor(226, 244, 240);
    pdf.circle(17.5, 27.5, 8.5, "F");
    pdf.setTextColor(15, 118, 110);
    pdf.setFontSize(14);
    pdf.text(kartu.nama.trim().charAt(0).toUpperCase() || "?", 17.5, 30, { align: "center" });
  }

  pdf.setTextColor(24, 34, 51);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(pdf.splitTextToSize(kartu.nama, 38).slice(0, 2), 30, 23);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(90, 105, 118);
  pdf.text("NOMOR ANGGOTA", 30, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(15, 118, 110);
  pdf.text(kartu.nomorAnggota, 30, 35);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(90, 105, 118);
  pdf.text(`Jenis: ${kartu.jenis}`, 30, 41);
  pdf.text(`Bergabung: ${tanggal(kartu.bergabungPada)}`, 30, 46);

  pdf.addImage(qr, "PNG", 67, 15, 14, 14, undefined, "FAST");
  pdf.setTextColor(15, 118, 110);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text(statusAnggota(kartu).toUpperCase(), 74, 34, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.setTextColor(90, 105, 118);
  pdf.text("Tunjukkan kartu kepada petugas", 74, 39, { align: "center", maxWidth: 24 });
  pdf.text("QR berisi nomor anggota; bukan bukti check-in", 74, 44, { align: "center", maxWidth: 25 });

  pdf.save(`kartu-${kartu.nomorAnggota.toLowerCase()}.pdf`);
}

export default function KartuAnggotaPage() {
  const { sedangMasuk, siap: authSiap } = useAuth();
  // Fitur kartu diatur admin lewat Kelola Akses (izin kartu.lihat); sakelar
  // yang sama menutup rute, menu, dan endpoint kartu di server.
  const bolehKartu = useBoleh("kartu.lihat");
  const [anggota, setAnggota] = useState<Anggota | null>(null);
  const [namaPerpustakaan, setNamaPerpustakaan] = useState("PustakaKu");
  const [dataSiap, setDataSiap] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pdfProses, setPdfProses] = useState(false);

  useEffect(() => {
    if (!authSiap || !sedangMasuk) return;
    let aktif = true;
    Promise.all([
      apiFetch<{ anggota: Anggota | null }>("/api/anggota/kartu"),
      apiFetch<{ pengaturan: { nama?: string } }>("/api/pengaturan"),
    ])
      .then(async ([kartuRes, pengaturan]) => {
        if (!aktif) return;
        const milikSaya = kartuRes.anggota;
        if (!milikSaya) {
          setAnggota(null);
          return;
        }
        setAnggota(milikSaya);
        if (!milikSaya.aktif) {
          setGalat("Keanggotaan Anda nonaktif. Hubungi pustakawan untuk bantuan.");
        }
        setNamaPerpustakaan(pengaturan.pengaturan?.nama || "PustakaKu");
        if (milikSaya.aktif) {
          try {
            const gambarQr = await QRCode.toDataURL(payloadQrAnggota(milikSaya.nomorAnggota), {
              errorCorrectionLevel: "M",
              margin: 1,
              width: 256,
              color: { dark: "#102a2a", light: "#ffffff" },
            });
            if (aktif) setQr(gambarQr);
          } catch {
            if (aktif) setGalat("QR kartu gagal dibuat. Muat ulang halaman untuk mencoba lagi.");
          }
        }
      })
      .catch((error: unknown) => {
        if (aktif) {
          setGalat(error instanceof Error ? error.message : "Kartu anggota gagal dimuat.");
        }
      })
      .finally(() => {
        if (aktif) {
          setDataSiap(true);
          setMemuat(false);
        }
      });
    return () => {
      aktif = false;
    };
  }, [authSiap, sedangMasuk, sedangMasuk?.anggotaId, sedangMasuk?.email]);

  const status = useMemo(() => (anggota ? statusAnggota(anggota) : "—"), [anggota]);

  async function unduh() {
    if (!anggota || !qr || !anggota.aktif) return;
    setPdfProses(true);
    try {
      await unduhPdf(anggota, namaPerpustakaan, qr);
    } catch {
      setGalat("PDF kartu gagal dibuat. Coba unduh kembali atau gunakan fitur cetak.");
    } finally {
      setPdfProses(false);
    }
  }

  if (!authSiap || (sedangMasuk && memuat)) {
    return <div className="card p-8 text-center text-sm text-[var(--muted)]">Memuat kartu anggota…</div>;
  }
  if (!sedangMasuk) {
    return <div className="card p-8 text-center text-sm text-[var(--muted)]">Silakan masuk dengan akun anggota untuk melihat kartu.</div>;
  }
  if (!bolehKartu) {
    return (
      <div className="card p-8 text-center" role="status">
        <h2 className="font-bold">Fitur Kartu Anggota Dinonaktifkan</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pengelola perpustakaan sedang menonaktifkan layanan kartu anggota.
          Silakan coba lagi nanti atau hubungi pustakawan.
        </p>
      </div>
    );
  }
  if (galat && !anggota) {
    return <div className="card border-rose-200 bg-rose-50 p-6 text-sm text-rose-700" role="alert">{galat}</div>;
  }
  if (!anggota) {
    return <div className="card p-8 text-center"><h2 className="font-bold">Kartu anggota belum tersedia</h2><p className="mt-2 text-sm text-[var(--muted)]">Hubungi pustakawan untuk menautkan kartu anggota Anda.</p></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div><h2 className="text-xl font-bold">Kartu Keanggotaan</h2><p className="mt-1 text-sm text-[var(--muted)]">Pratinjau kartu identitas anggota berukuran standar ID-1.</p></div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" type="button" onClick={() => window.print()} disabled={!dataSiap}>Cetak</button>
          <button className="btn btn-primary" type="button" onClick={unduh} disabled={!qr || pdfProses || !anggota.aktif}>{pdfProses ? "Membuat PDF…" : "Unduh PDF"}</button>
        </div>
      </div>

      {galat && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden" role="alert">{galat}</div>}

      <section className="mx-auto w-full max-w-[540px] print:w-[85.6mm] print:max-w-none" aria-label="Pratinjau kartu anggota">
        <article className={`membership-card ${anggota.aktif ? "" : "membership-card-inactive"}`}>
          {!anggota.aktif && <div className="membership-inactive-banner" role="status">NONAKTIF — BUKAN KARTU VALID</div>}
          <div className="membership-card-head">
            <div className="membership-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg></div>
            <div className="min-w-0"><div className="membership-library-name">{namaPerpustakaan}</div><div className="membership-caption">KARTU KEANGGOTAAN</div></div>
            <span className={`membership-status ${anggota.aktif ? "" : "membership-status-inactive"}`}>{status}</span>
          </div>
          <div className="membership-card-body">
            <Avatar nama={anggota.nama} foto={anggota.foto} className="membership-avatar" />
            <div className="membership-details">
              <div className="membership-name">{anggota.nama}</div>
              <div className="membership-label">NOMOR ANGGOTA</div>
              <div className="membership-number">{anggota.nomorAnggota}</div>
              <div className="membership-meta"><span>Jenis: {anggota.jenis}</span><span>Bergabung: {tanggal(anggota.bergabungPada)}</span></div>
            </div>
            <div className="membership-qr-wrap">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- QR generated as a local data URL.
                <img className="membership-qr" src={qr} alt="QR identifikasi nomor anggota" />
              ) : <div className="membership-qr-placeholder">{anggota.aktif ? "Membuat QR…" : "QR dinonaktifkan"}</div>}
              <span className="membership-qr-caption">Tunjukkan kepada petugas</span>
            </div>
          </div>
          <div className="membership-card-foot">QR berisi nomor anggota saja. Check-in tetap divalidasi oleh server.</div>
        </article>
      </section>
      <p className="text-center text-xs text-[var(--muted)] print:hidden">Saat mencetak, pilih skala 100% / ukuran aktual dan nonaktifkan header serta footer browser. QR hanya mengenali nomor anggota; kios saat ini meminta nomor secara manual, QR-scan belum diintegrasikan.</p>
    </div>
  );
}
