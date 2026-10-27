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
  jenis: "Pelajar" | "Umum" | "Staf";
  bergabungPada: string; // ISO date
  aktif: boolean;
  /** Foto profil anggota (data URL hasil unggahan, sudah dikecilkan).
   *  Opsional — bila kosong, UI memakai inisial nama. */
  foto?: string | null;
}

export type StatusPinjam = "Dipinjam" | "Dikembalikan" | "Terlambat";

export interface Peminjaman {
  id: string;
  kodePinjam: string;
  bukuId: string;
  anggotaId: string;
  tanggalPinjam: string; // ISO date
  tanggalKembali: string; // ISO date (target)
  tanggalKembaliAktual: string | null; // ISO date
  status: StatusPinjam;
  denda: number; // rupiah
  catatan: string;
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
