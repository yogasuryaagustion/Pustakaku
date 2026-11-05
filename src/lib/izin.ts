// Katalog Izin & Kebijakan Akses (RBAC) — MODUL PURA, tanpa React.
// Dipakai bersama oleh frontend (src/lib/akses.ts me-re-export modul ini) dan
// oleh Worker API (worker/index.ts) supaya matriks izin di server dan di layar
// selalu berasal dari SATU sumber — tidak pernah duplikasi yang bisa drift.

// Tiga peran aplikasi (+ tamu tanpa sesi). Nilai harus SAMA dengan isi kolom
// profiles.peran di database dan dengan kunci objek `izin` di tabel
// kebijakan_akses — public.boleh() di PostgreSQL membaca kunci persis ini.
export type PeranAkses = "tamu" | "user" | "admin" | "superadmin";

/** Urutan kolom matriks izin di layar Kontrol Akses. */
export const PERAN_AKSES: PeranAkses[] = ["tamu", "user", "admin", "superadmin"];

export const INFO_PERAN: Record<PeranAkses, { label: string; bantuan: string }> = {
  tamu: { label: "Tamu", bantuan: "Pengunjung yang belum masuk" },
  user: { label: "Anggota", bantuan: "Peran user — anggota terdaftar" },
  admin: { label: "Admin", bantuan: "Pustakawan — operasional perpustakaan" },
  superadmin: {
    label: "Super Admin",
    bantuan: "Pengelola sistem — operasional plus kelola akun, akses, & pengaturan",
  },
};

export interface DefinisiIzin {
  /** Kunci unik — dipakai di guard rute, tombol, dan mutasi data. */
  id: string;
  label: string;
  bantuan: string;
  grup: string;
  /** Nilai awal matriks; tersimpan sebagai titik mulai, bukan kebijakan tetap. */
  bawaan: Record<PeranAkses, boolean>;
}

// Katalog izin — satu-satunya tempat mendefinisikan izin baru.
// Super Admin selalu berada di atas Admin: bila tidak ditentukan eksplisit,
// nilainya mengikuti kolom Admin (kecuali izin sistem yang Admin tak punya).
const I = (
  id: string,
  label: string,
  bantuan: string,
  grup: string,
  tamu: boolean,
  user: boolean,
  admin: boolean,
  superadmin: boolean = admin
): DefinisiIzin => ({ id, label, bantuan, grup, bawaan: { tamu, user, admin, superadmin } });

//------|--------
// Helper untuk pengecekan kebijakan di sisi klien.
// Dipakai komponen React yang bukan di dalam aplikasi (AppShell, halaman
// publik, panel) untuk mengambil kebijakan dari store.
//
// Interface store: { kebijakan: Kebijakan; update(kebijakan: Kebijakan): void }
//
// @returns kebijakan yang aktif saat ini (dari store, bawaan bila belum ada)
export interface KebijakanStore {
  kebijakan: Kebijakan;
  update(kebijakan: Kebijakan): void;
}


export function ambilKebijakan(): Kebijakan {
  return KEBIJAKAN_BAWAAN;
}

export function useKebijakan(store: KebijakanStore): Kebijakan {
  return store.kebijakan;
}

export function bolehRute(kb: Kebijakan, peran: PeranAkses, path: string): boolean {
  // Rute publik (path tidak cocok dengan apapun di matriks) → boleh
  const publik = ["/", "/login", "/register", "/katalog", "/katalog/[id]", "/sirkulasi", "/laporan", "/dashboard", "/panel", "/panel/pinjaman", "/panel/profil", "/panel/riwayat", "/panel/bantuan", "/katalog/search", "/katalog/[id]", "/katalog/[id]/detail"];
  if (path === "/" || publik.includes(path)) return true;
  // Rute yang bersifat global (tidak terkait halaman tertentu) → boleh untuk
  // peran yang mengizinkan akses global (user, admin, superadmin)
  const globalRute = ["/katalog/search", "/katalog/[id]", "/katalog/[id]/detail", "/sirkulasi", "/laporan", "/dashboard", "/panel", "/panel/pinjaman", "/panel/profil", "/panel/riwayat", "/panel/bantuan", "/kunjungan", "/kunjungan/checkin", "/katalog/[id]", "/katalog/[id]/detail"];
  if (globalRute.includes(path)) {
    return peran !== "tamu";
  }
  // Rute institusional → hanya admin/superadmin
  return peran === "admin" || peran === "superadmin";
}

export function tujuanRumah(kb: Kebijakan, peran: PeranAkses): string {
  if (peran === "admin" || peran === "superadmin") return "/dashboard";
  if (peran === "user") return "/panel";
  return "/";
}

export const DAFTAR_IZIN: DefinisiIzin[] = [
  // Katalog & peminjaman
  I("katalog.lihat", "Lihat katalog", "Menjelajahi daftar & detail buku", "Katalog & Peminjaman", true, true, true),
  I("katalog.pinjam", "Ajukan peminjaman", "Meminjam buku dari katalog / panel", "Katalog & Peminjaman", false, true, false),
  I("katalog.kelola", "Kelola buku", "Tambah, ubah, dan hapus judul", "Katalog & Peminjaman", false, false, true),
  // Panel anggota
  I("panel.lihat", "Buka panel anggota", "Beranda panel pribadi", "Panel Anggota", false, true, false),
  I("panel.pinjaman", "Pinjaman saya", "Melihat & memperpanjang pinjaman sendiri", "Panel Anggota", false, true, false),
  I("panel.profil", "Ubah profil sendiri", "Edit profil & ganti kata sandi akun", "Panel Anggota", false, true, true),
  I("panel.bantuan", "Halaman bantuan", "Panduan singkat & FAQ layanan perpustakaan", "Panel Anggota", false, true, true),
  I("kartu.lihat", "Kartu anggota", "Melihat, mencetak, & mengunduh kartu keanggotaan pribadi", "Panel Anggota", false, true, true),
  // Operasional perpustakaan
  I("dashboard.lihat", "Dashboard", "Ringkasan operasional & aktivitas", "Operasional", false, false, true),
  I("sirkulasi.lihat", "Sirkulasi (lihat)", "Melihat data peminjaman", "Operasional", false, false, true),
  I("sirkulasi.kelola", "Sirkulasi (kelola)", "Catat pinjam, kembali, & perpanjang", "Operasional", false, false, true),
  I("anggota.lihat", "Data anggota (lihat)", "Melihat daftar kartu anggota", "Operasional", false, false, true),
  I("anggota.kelola", "Data anggota (kelola)", "Tambah, ubah, hapus, & status anggota", "Operasional", false, false, true),
  I("laporan.lihat", "Laporan", "Statistik & daftar tunggakan", "Operasional", false, false, true),
  I("laporan.ekspor", "Ekspor laporan", "Mengunduh laporan CSV", "Operasional", false, false, true),
  // Sistem & akun
  I("akun.daftar", "Pendaftaran publik", "Formulir daftar terbuka untuk tamu", "Sistem & Akun", true, false, false),
  // Kelola akun, akses, & pengaturan = kewenangan SUPER ADMIN saja.
  I("akun.kelola", "Kelola akun login", "Buat, reset sandi, & hapus akun", "Sistem & Akun", false, false, false, true),
  I("pengaturan.kelola", "Pengaturan sistem", "Tema, nama, lama pinjam, & denda", "Sistem & Akun", false, false, false, true),
  // Catatan: "akses.kelola" sengaja TIDAK ada di matriks — akses halaman
  // Kontrol Akses dijaga gerbang peran Super Admin (RUTE_PERAN), sehingga anggota
  // takkan pernah kena penolakan izin untuk halaman ini.
  I("sistem.reset", "Reset data demo", "Mengembalikan data ke seed bawaan", "Sistem & Akun", false, false, false, true),
];

/** Urutan grup tampil di matriks (mengikuti urutan kemunculan di katalog). */
export const GRUP_IZIN: string[] = Array.from(new Set(DAFTAR_IZIN.map((z) => z.grup)));

/**
 * Izin yang DIPAKSA aktif untuk peran tertentu (anti-lockout). Ditegakkan
 * saat memuat maupun menyimpan kebijakan. Saat ini kosong — mekanismenya
 * disiapkan untuk izin lain yang wajib melekat di peran tertentu.
 */
export const KUNCI_IZIN: Partial<Record<string, PeranAkses[]>> = {
  // Hak dasar Super Admin
  "anggota.lihat": ["superadmin"],

  // Hak khusus sistem Super Admin
  "akun.kelola": ["superadmin"],
  "pengaturan.kelola": ["superadmin"],
  "sistem.reset": ["superadmin"],
};

export interface Kebijakan {
  versi: number;
  izin: Record<PeranAkses, Record<string, boolean>>;
  diubahPada: string | null;
  diubahOleh: string | null;
}

function bangunBawaan(): Kebijakan {
  const izin = {} as Kebijakan["izin"];
  for (const peran of PERAN_AKSES) {
    const baris: Record<string, boolean> = {};
    for (const z of DAFTAR_IZIN) baris[z.id] = z.bawaan[peran];
    izin[peran] = baris;
  }
  return { versi: 1, izin, diubahPada: null, diubahOleh: null };
}

/** Matriks bawaan — titik mulai sebelum admin mengubah apa pun. */
export const KEBIJAKAN_BAWAAN: Kebijakan = bangunBawaan();

/**
 * Rapikan objek kebijakan mentah: id izin tak dikenal dibuang, yang hilang
 * diisi default katalog, nilai non-boolean jatuh ke default, lalu kunci
 * anti-lockout dipaksakan aktif. Data korup pun aman.
 */
export function normalisasiKebijakan(raw: unknown): Kebijakan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<Kebijakan>;
  const tersimpan = (o.izin ?? {}) as Partial<Record<PeranAkses, Record<string, unknown>>>;
  const hasil = {} as Kebijakan["izin"];
  for (const peran of PERAN_AKSES) {
    const baris: Record<string, boolean> = {};
    for (const z of DAFTAR_IZIN) {
      const v = tersimpan[peran]?.[z.id];
      baris[z.id] = typeof v === "boolean" ? v : z.bawaan[peran];
    }
    hasil[peran] = baris;
  }
  for (const [izinId, peranList] of Object.entries(KUNCI_IZIN)) {
    for (const peran of peranList ?? []) hasil[peran][izinId] = true;
  }
  return {
    versi: Number.isFinite(o.versi) ? (o.versi as number) : 1,
    izin: hasil,
    diubahPada: typeof o.diubahPada === "string" ? o.diubahPada : null,
    diubahOleh: typeof o.diubahOleh === "string" ? o.diubahOleh : null,
  };
}

/** Salin dangkal-per-peran untuk draf edit di layar Kontrol Akses. */
export function salinKebijakan(kb: Kebijakan): Kebijakan {
  const izin = {} as Kebijakan["izin"];
  for (const peran of PERAN_AKSES) izin[peran] = { ...kb.izin[peran] };
  return { ...kb, izin };
}

/** Daftar perubahan antar dua kebijakan — untuk ringkasan jejak aktivitas. */
export function bandingkanKebijakan(lama: Kebijakan, baru: Kebijakan): string[] {
  const out: string[] = [];
  for (const peran of PERAN_AKSES) {
    for (const z of DAFTAR_IZIN) {
      const a = lama.izin[peran]?.[z.id] === true;
      const b = baru.izin[peran]?.[z.id] === true;
      if (a !== b) out.push(`${INFO_PERAN[peran].label} · ${z.label} ${b ? "diizinkan" : "dicabut"}`);
    }
  }
  return out;
}

/**
 * Pusat pengecekan izin — DEFAULT-DENY: izin yang tidak dikenal atau tidak
 * dicentang selalu false, berapa pun panjangnya data tersimpan.
 */
export function cekIzin(kb: Kebijakan, peran: PeranAkses, izinId: string): boolean {
  return kb.izin[peran]?.[izinId] === true;
}

/** Peran efektif dari peran akun: tidak ada sesi = tamu. */
export function peranEfektif(peran: string | null | undefined): PeranAkses {
  return peran === "admin" || peran === "user" || peran === "superadmin"
    ? peran
    : "tamu";
}

/** Apakah peran ini petugas perpustakaan (Admin ATAU Super Admin)? */
export function petugas(peran: PeranAkses): boolean {
  return peran === "admin" || peran === "superadmin";
}
