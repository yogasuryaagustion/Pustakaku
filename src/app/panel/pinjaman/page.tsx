// Peminjaman Saya — anggota melihat pinjaman aktif & memperpanjangnya.
// Isi bersama dengan /panel/riwayat (lihat src/components/pinjaman-saya.tsx).
import { PinjamanSaya } from "@/components/pinjaman-saya";

export default function PinjamanSayaPage() {
  return <PinjamanSaya tabAwal="Aktif" />;
}
