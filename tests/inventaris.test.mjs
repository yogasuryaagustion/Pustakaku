// Uji aturan ringkasan inventaris: dasar angka selisih yang dipakai halaman
// "Perbaiki Selisih". Yang dijaga di sini adalah perbedaan perlakuan salinan
// rusak (masih ada di rak) dan salinan hilang (tidak ada di rak).
//
// Node menjalankan berkas .ts yang diimpor secara langsung (type stripping),
// jadi uji ini tidak butuh build atau kerangka uji tambahan.
//
// Jalankan: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import { ringkasInventaris } from "../src/lib/supabase/inventaris.ts";

/** Baris view v_inventaris_per_buku dengan nilai bawaan yang wajar. */
function baris(ubah = {}) {
  return {
    buku_id: "buku-uji",
    judul: "Buku Uji",
    penulis: "Penulis",
    penerbit: "Penerbit",
    tahun: 2020,
    isbn: "",
    kategori: "Lainnya",
    rak: "A-01",
    stok: 0,
    total_eksemplar: 0,
    tersedia: 0,
    dipinjam: 0,
    rusak: 0,
    hilang: 0,
    ...ubah,
  };
}

test("salinan rusak dihitung sebagai barang di rak sehingga selisih 0", () => {
  const r = ringkasInventaris(baris({ stok: 3, total_eksemplar: 3, tersedia: 2, rusak: 1 }));

  assert.equal(r.fisik, 3);
  assert.equal(r.selisih, 0);
  assert.equal(r.status_sistem, "sesuai");
  assert.equal(r.keterangan, "2 tersedia · 0 dipinjam · 1 rusak");
});

test("salinan hilang tidak dihitung sebagai barang di rak sehingga stok tampak lebih", () => {
  const r = ringkasInventaris(baris({ stok: 4, total_eksemplar: 4, tersedia: 3, hilang: 1 }));

  assert.equal(r.fisik, 3);
  assert.equal(r.selisih, 1);
  assert.equal(r.status_sistem, "stok-lebih");
  assert.equal(r.keterangan, "3 tersedia · 0 dipinjam · 1 hilang");
});

test("rusak dan hilang dihitung terpisah saat keduanya ada", () => {
  const r = ringkasInventaris(
    baris({ stok: 5, total_eksemplar: 5, tersedia: 2, dipinjam: 1, rusak: 1, hilang: 1 }),
  );

  // Fisik = total - hilang = 4; stok tercatat 5 sehingga selisih +1.
  assert.equal(r.fisik, 4);
  assert.equal(r.selisih, 1);
  assert.equal(r.keterangan, "2 tersedia · 1 dipinjam · 1 rusak · 1 hilang");
});

test("stok tercatat lebih kecil daripada barang fisik dilaporkan sebagai stok kurang", () => {
  const r = ringkasInventaris(baris({ stok: 2, total_eksemplar: 3, tersedia: 3 }));

  assert.equal(r.fisik, 3);
  assert.equal(r.selisih, -1);
  assert.equal(r.status_sistem, "stok-kurang");
});

test("judul tanpa eksemplar tidak dianggap menyimpang", () => {
  const r = ringkasInventaris(baris({ stok: 7, total_eksemplar: 0 }));

  assert.equal(r.selisih, 0);
  assert.equal(r.status_sistem, "tanpa-eksemplar");
  assert.equal(r.keterangan, "Belum ada eksemplar tercatat");
});

test("semua salinan hilang membuat fisik nol tanpa nilai negatif", () => {
  const r = ringkasInventaris(baris({ stok: 2, total_eksemplar: 2, hilang: 2 }));

  assert.equal(r.fisik, 0);
  assert.equal(r.selisih, 2);
  assert.equal(r.status_sistem, "stok-lebih");
});
