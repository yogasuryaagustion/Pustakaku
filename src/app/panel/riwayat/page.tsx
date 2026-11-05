// Riwayat Peminjaman — seluruh pinjaman anggota (tab "Riwayat") beserta
// status pengembalian & dendanya. Isi bersama dengan /panel/pinjaman
// (lihat src/components/pinjaman-saya.tsx).
import { PinjamanSaya } from "@/components/pinjaman-saya";

export default function RiwayatPeminjamanPage() {
  return <PinjamanSaya tabAwal="Riwayat" />;
}
