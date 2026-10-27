// Foto profil — validasi & resize thumbnail (dipakai halaman Daftar dan
// Edit Profil). Data URL asli bisa ber-megabyte dan membuat localStorage
// penuh, jadi foto selalu dikecilkan ke thumbnail 256px (JPEG) sebelum disimpan.

export interface HasilFoto {
  ok: boolean;
  /** Data URL JPEG hasil crop center-square — hanya bila ok. */
  dataUrl?: string;
  /** Pesan galat ramah pengguna — hanya bila !ok. */
  pesan?: string;
}

const BATAS_UKURAN = 5 * 1024 * 1024; // 5 MB
const SISI_THUMBNAIL = 256; // px

/**
 * Baca berkas gambar menjadi data URL thumbnail 256×256 (crop center-square,
 * JPEG kualitas 0.82) agar proporsi bulat rapi di UI avatar dan hemat kuota.
 * Bila berkas bukan gambar, terlalu besar, atau gagal dibaca, mengembalikan
 * { ok: false, pesan } — pemanggil boleh melanjutkan tanpa foto.
 */
export function keThumbnailFoto(file: File): Promise<HasilFoto> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve({ ok: false, pesan: "Berkas foto harus berupa gambar (JPG/PNG)." });
      return;
    }
    if (file.size > BATAS_UKURAN) {
      resolve({ ok: false, pesan: "Ukuran foto maksimal 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = SISI_THUMBNAIL;
        canvas.height = SISI_THUMBNAIL;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ ok: false, pesan: "Foto tidak bisa dibaca — coba berkas lain." });
          return;
        }
        // Crop center-square: ambil sisi tengah gambar berapa pun orientasinya.
        const sisiAsli = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - sisiAsli) / 2,
          (img.height - sisiAsli) / 2,
          sisiAsli,
          sisiAsli,
          0,
          0,
          SISI_THUMBNAIL,
          SISI_THUMBNAIL
        );
        resolve({ ok: true, dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
      };
      img.onerror = () => resolve({ ok: false, pesan: "Foto tidak bisa dibaca — coba berkas lain." });
      img.src = String(reader.result);
    };
    reader.onerror = () => resolve({ ok: false, pesan: "Foto tidak bisa dibaca — coba berkas lain." });
    reader.readAsDataURL(file);
  });
}
