// Tipe data inti sistem perpustakaan

export type Kategori = "Fiksi" | "Non-Fiksi" | "Sains" | "Sejarah" | "Teknologi" | "Anak" | "Agama" | "Lainnya";

export interface Buku {
  id: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: number;
  isbn: string;
  kategori: Kategori;
  rak: string;
  stok: number;
  deskripsi: string;
  /** URL gambar sampul (opsional). Bila kosong/gagal dimuat, UI memakai
   *  sampul otomatis yang mencetak judul buku (lihat SampulBuku di ui.tsx). */
  gambar?: string | null;
  ditambahkanPada: string; // ISO date
}

export interface Anggota {
  id: string;
  nomorAnggota: string;
  nama: string;
  email: string;
  telepon: string;
  alamat: string;
  jenis: "Pelajar" | "Mahasiswa" | "Umum" | "Staf";
  bergabungPada: string; // ISO date
  aktif: boolean;
  /** Foto profil anggota (data URL hasil unggahan, sudah dikecilkan).
   *  Opsional — bila kosong, UI memakai inisial nama. */
  foto?: string | null;
}

export type StatusPinjam = "Dipinjam" | "Dikembalikan" | "Terlambat";

/** Satu penerimaan pembayaran denda (bisa sebagian/cicilan). */
export interface PembayaranDenda {
  id: string;
  nominal: number; // rupiah
  catatan: string;
  dibuatPada: string; // ISO datetime
}

export interface Peminjaman {
  id: string;
  kodePinjam: string;
  bukuId: string;
  anggotaId: string;
  tanggalPinjam: string; // ISO date
  tanggalKembali: string; // ISO date (target)
  tanggalKembaliAktual: string | null; // ISO date
  status: StatusPinjam;
  denda: number; // rupiah per pinjaman
  /** Bagian denda yang sudah dilunasi; 0 berarti belum dibayar. */
  dendaDibayar: number;
  /** Waktu pelunasan denda (ISO datetime), null selama masih ada sisa. */
  dendaDibayarPada: string | null;
  /** Riwayat penerimaan denda, terbaru lebih dulu. */
  pembayaranDenda?: PembayaranDenda[];
  catatan: string;
  /** Eksemplar fisik yang dipinjam (null bila judul belum didata fisiknya). */
  eksemplarId?: string | null;
  nomorInventaris?: string | null;
}

/** Pengajuan pengembalian dari anggota yang menunggu pemeriksaan petugas. */
export type StatusAjuanKembali = "menunggu" | "disetujui" | "ditolak";

export interface AjuanKembali {
  id: string;
  peminjamanId: string;
  anggotaId: string;
  status: StatusAjuanKembali;
  /** Kondisi yang ditetapkan petugas saat memvalidasi. */
  kondisiDivalidasi:
    | "layak"
    | "rusak_ringan"
    | "rusak_beda"
    | "hilang"
    | null;
  catatan: string;
  dibuatPada: string; // ISO timestamp
  diprosesPada: string | null; // ISO timestamp
}

export const KATEGORI_LIST: Kategori[] = [
  "Fiksi",
  "Non-Fiksi",
  "Sains",
  "Sejarah",
  "Teknologi",
  "Anak",
  "Agama",
  "Lainnya",
];

export const DENDA_PER_HARI = 2000; // rupiah per hari keterlambatan
export const LAMA_PINJAM_HARI = 14;
