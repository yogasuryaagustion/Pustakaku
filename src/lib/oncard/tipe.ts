// Bentuk data anggota dari sistem OnCard (kartu elektronik pelajar).
//
// Sengaja HANYA memuat identitas. Saldo dompet, transaksi kantin, dan tagihan
// tidak ikut ditarik: bukan kebutuhan perpustakaan, dan setiap field tambahan
// berarti data pribadi yang harus dijaga tanpa manfaat langsung.

/** Satu pelajar/pengguna kartu seperti yang dikirim API OnCard. */
export interface AnggotaOnCard {
  /** ID internal OnCard — kunci pemetaan lintas sistem. */
  id: string;
  /** Nomor Induk Siswa (NIS) lokal sekolah. */
  nis: string;
  nama: string;
  email?: string | null;
  telepon?: string | null;
  alamat?: string | null;
  /** Kelas/rombel, mis. "XI IPA 2". Belum ada kolomnya di tabel anggota. */
  kelas?: string | null;
  /** Peran di OnCard: "Pelajar", "Guru", "Staf", dsb. */
  jenis?: string | null;
  /** URL foto dari OnCard — BUKAN data URL seperti kolom anggota.foto. */
  foto?: string | null;
  /** UID kartu fisik (QR/RFID) bila vendor mengirimkannya. */
  uidKartu?: string | null;
  aktif: boolean;
  /** Waktu perubahan terakhir di OnCard (ISO 8601). */
  diperbaruiPada?: string | null;
}

/** Satu halaman hasil tarikan dari API OnCard. */
export interface HalamanOnCard {
  anggota: AnggotaOnCard[];
  /** true bila masih ada halaman berikutnya. */
  adaLagi: boolean;
  total?: number;
}

/** Nasib satu baris OnCard. Dipakai mode pratinjau maupun hasil sinkron nanti. */
export type StatusSinkron = "baru" | "diperbarui" | "sama" | "bentrok" | "gagal";

export interface BarisPratinjau {
  oncardId: string;
  nis: string;
  nama: string;
  status: StatusSinkron;
  /** Anggota lokal yang cocok (null bila belum ada). */
  anggotaId?: string | null;
  nomorAnggota?: string | null;
  /** Nama field yang akan berubah, mis. ["nama", "jenis"]. */
  ubah?: string[];
  /** Penjelasan singkat untuk status bentrok/gagal. */
  alasan?: string;
}

export interface RingkasanSinkron {
  /** Selalu true selama route belum menulis apa pun ke database. */
  pratinjau: true;
  sumber: "oncard" | "mock";
  diambilPada: string;
  total: number;
  /** true bila daftar baris dipotong agar respons tetap ringan. */
  terpotong: boolean;
  ringkasan: Record<StatusSinkron, number>;
  baris: BarisPratinjau[];
  catatan: string[];
}
