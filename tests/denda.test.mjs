// Uji aturan denda: sisa per pinjaman dan total tunggakan anggota.
// Aturan ini yang tampil di form pinjam dan tombol "Lunasi", jadi harus sama
// dengan pengecekan `pinjam_buku` di database.
//
// Jalankan: npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sisaDenda,
  totalDendaTertunggak,
  belumLunas,
  pesanNominalDenda,
} from "../src/lib/denda.ts";

test("sisa denda = denda dikurangi pembayaran", () => {
  assert.equal(sisaDenda(10000, 0), 10000);
  assert.equal(sisaDenda(10000, 4000), 6000);
});

test("sisa denda tidak pernah negatif walau data berlebih", () => {
  assert.equal(sisaDenda(5000, 9000), 0);
  assert.equal(sisaDenda(0, 0), 0);
});

test("pembayaran penuh dianggap lunas", () => {
  assert.equal(belumLunas({ anggotaId: "a1", denda: 4000, dendaDibayar: 4000 }), false);
  assert.equal(belumLunas({ anggotaId: "a1", denda: 4000 }), true);
});

test("total tunggakan hanya menghitung milik anggota itu", () => {
  const daftar = [
    { anggotaId: "a1", denda: 10000, dendaDibayar: 0 },
    { anggotaId: "a1", denda: 4000, dendaDibayar: 4000 },
    { anggotaId: "a2", denda: 8000, dendaDibayar: 0 },
  ];
  assert.equal(totalDendaTertunggak(daftar, "a1"), 10000);
  assert.equal(totalDendaTertunggak(daftar, "a2"), 8000);
});

test("nominal cicilan sah bila > 0 dan tidak melebihi sisa", () => {
  assert.equal(pesanNominalDenda(4000, 10000), null);
  assert.equal(pesanNominalDenda(10000, 10000), null);
});

test("nominal nol, negatif, pecahan, atau melebihi sisa ditolak", () => {
  assert.match(pesanNominalDenda(0, 10000), /lebih dari 0/);
  assert.match(pesanNominalDenda(-500, 10000), /lebih dari 0/);
  assert.match(pesanNominalDenda(2500.5, 10000), /bulat/);
  assert.match(pesanNominalDenda(12000, 10000), /melebihi sisa/);
});

test("anggota tanpa denda tidak punya tunggakan", () => {
  assert.equal(totalDendaTertunggak([], "a1"), 0);
  assert.equal(
    totalDendaTertunggak(
      [{ anggotaId: "a1", denda: 0, dendaDibayar: 0 }],
      "a1",
    ),
    0,
  );
});
