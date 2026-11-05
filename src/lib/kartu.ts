import type { Anggota } from "./types";

/** ID-1 dimensions in millimeters (ISO/IEC 7810). */
export const UKURAN_KARTU = { lebar: 85.6, tinggi: 53.98 } as const;

/**
 * QR payload deliberately contains only the opaque public membership number.
 * The kiosk validates this identifier and membership status on the server;
 * it is not an authorization token and contains no personal information.
 */
export function normalisasiNomorAnggota(nomorAnggota: string): string {
  const nomor = nomorAnggota.trim().toUpperCase();
  if (!/^AGT-[0-9]{4,}$/.test(nomor)) {
    throw new Error("Nomor anggota tidak valid.");
  }
  return nomor;
}

export function payloadQrAnggota(nomorAnggota: string): string {
  // ID hanya cocok untuk permintaan check-in backend; nama, email, dan status
  // tidak disematkan ke QR. RPC kios mengecek ulang status di database.
  return normalisasiNomorAnggota(nomorAnggota);
}

export function statusAnggota(anggota: Pick<Anggota, "aktif">): string {
  return anggota.aktif ? "Aktif" : "Nonaktif";
}
