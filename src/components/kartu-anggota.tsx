"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";
import { payloadQrAnggota, statusAnggota } from "@/lib/kartu";
import { svgCode128 } from "@/lib/barcode-kartu";

/** Data minimal yang dibutuhkan pratinjau kartu keanggotaan. */
export type DataKartuAnggota = {
  nama: string;
  nomorAnggota: string;
  jenis: string;
  bergabungPada?: string;
  aktif: boolean;
  foto?: string | null;
};

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function tanggal(iso?: string): string {
  if (!iso) return "—";

  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);

  return Number.isNaN(date.getTime()) ? iso : FORMAT_TANGGAL.format(date);
}

/**
 * Pratinjau kartu identitas anggota berukuran ID-1, dipakai popup kelola
 * anggota. QR dibuat di klien dan hanya memuat nomor anggota; pustaka `qrcode`
 * dimuat saat kartu tampil agar tidak membebani halaman lain.
 */
export function PratinjauKartuAnggota({
  anggota,
  namaPerpustakaan = "PustakaKu",
}: {
  anggota: DataKartuAnggota;
  namaPerpustakaan?: string;
}) {
  // QR disimpan bersama nomor asalnya: kartu yang nomornya berganti tidak
  // sempat menampilkan QR anggota lain sebelum QR baru selesai dibuat, dan
  // tidak perlu setState sinkron di dalam effect.
  const [qr, setQr] = useState<{ nomor: string; gambar: string } | null>(null);
  // Barcode 1D nomor anggota — untuk barcode gun, di samping QR.
  const [barcode, setBarcode] = useState<{ nomor: string; svg: string } | null>(
    null
  );

  let nomorAktif: string | null = null;

  try {
    nomorAktif = payloadQrAnggota(anggota.nomorAnggota);
  } catch {
    // Nomor belum berformat AGT-xxxx (mis. masih berupa id): tampilkan
    // placeholder, bukan galat halaman.
    nomorAktif = null;
  }

  const gambarQr = nomorAktif && qr?.nomor === nomorAktif ? qr.gambar : null;
  const gambarBarcode =
    nomorAktif && barcode?.nomor === nomorAktif ? barcode.svg : null;

  useEffect(() => {
    // Anggota nonaktif tidak diberi kode aktif — kartunya ditandai bukan kartu valid.
    if (!anggota.aktif) return;

    let nomor: string;

    try {
      nomor = payloadQrAnggota(anggota.nomorAnggota);
    } catch {
      return;
    }

    let aktif = true;

    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(nomor, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 256,
          color: { dark: "#102a2a", light: "#ffffff" },
        })
      )
      .then((gambar) => {
        if (aktif) setQr({ nomor, gambar });
      })
      .catch(() => {
        // Gagal membuat QR: placeholder tetap tampil.
      });

    svgCode128(nomor)
      .then((svg) => {
        if (aktif) setBarcode({ nomor, svg });
      })
      .catch(() => {
        // Gagal membuat barcode: QR di atas tetap bisa dipakai.
      });

    return () => {
      aktif = false;
    };
  }, [anggota.nomorAnggota, anggota.aktif]);

  return (
    <article
      className={`membership-card ${anggota.aktif ? "" : "membership-card-inactive"}`}
      aria-label={`Kartu keanggotaan ${anggota.nama}`}
    >
      {!anggota.aktif && (
        <div className="membership-inactive-banner" role="status">
          NONAKTIF — BUKAN KARTU VALID
        </div>
      )}

      <div className="membership-card-head">
        <div className="membership-logo" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
        </div>

        <div className="min-w-0">
          <div className="membership-library-name">{namaPerpustakaan}</div>
          <div className="membership-caption">KARTU KEANGGOTAAN</div>
        </div>

        <span
          className={`membership-status ${anggota.aktif ? "" : "membership-status-inactive"}`}
        >
          {statusAnggota(anggota)}
        </span>
      </div>

      <div className="membership-card-body">
        <Avatar
          nama={anggota.nama}
          foto={anggota.foto}
          className="membership-avatar"
        />

        <div className="membership-details">
          <div className="membership-name">{anggota.nama}</div>
          <div className="membership-label">NOMOR ANGGOTA</div>
          <div className="membership-number">{anggota.nomorAnggota}</div>
          <div className="membership-meta">
            <span>Jenis: {anggota.jenis}</span>
            <span>Bergabung: {tanggal(anggota.bergabungPada)}</span>
          </div>
        </div>

        <div className="membership-qr-wrap">
          {gambarQr ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR dibuat sebagai data URL lokal.
            <img
              className="membership-qr"
              src={gambarQr}
              alt="QR identifikasi nomor anggota"
            />
          ) : (
            <div className="membership-qr-placeholder">
              {anggota.aktif ? "Membuat QR…" : "QR dinonaktifkan"}
            </div>
          )}
          <span className="membership-qr-caption">
            Tunjukkan kepada petugas
          </span>
        </div>
      </div>

      <div className="membership-card-foot">
        <span className="membership-foot-note">
          QR &amp; barcode berisi nomor anggota saja. Check-in tetap divalidasi
          oleh server.
        </span>

        {gambarBarcode && (
          <span
            className="membership-barcode"
            role="img"
            aria-label={`Barcode nomor anggota ${anggota.nomorAnggota}`}
            dangerouslySetInnerHTML={{ __html: gambarBarcode }}
          />
        )}
      </div>
    </article>
  );
}
