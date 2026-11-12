#!/usr/bin/env node
// Server tiruan API OnCard — untuk menguji jalur HTTP sungguhan.
//
// Berbeda dari ONCARD_MOCK=1 (data di memori, tanpa jaringan), server ini
// membalas lewat HTTP sehingga timeout, retry, dan paginasi di
// src/lib/oncard/klien.ts ikut teruji.
//
// Pakai:
//   node scripts/mock-oncard.mjs
//   # lalu di .env.local
//   ONCARD_BASE_URL=http://localhost:4010
//   ONCARD_API_KEY=uji-123            (opsional; lihat MOCK_ONCARD_KEY)
//   ONCARD_MOCK=                      (kosongkan agar memakai HTTP)
//
// Kunci sederhana: setel MOCK_ONCARD_KEY pada server tiruan agar request tanpa
// header "Authorization: Bearer <kunci>" ditolak 401.

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_ONCARD_PORT ?? 4010);
const KUNCI = (process.env.MOCK_ONCARD_KEY ?? "").trim();

// Data contoh — cermin dari src/lib/oncard/mock.ts (berkas .mjs tidak bisa
// mengimpor TypeScript). Jumlahnya sengaja sedikit; tujuan server ini menguji
// jalur HTTP, bukan kelengkapan kasus.
const DATA = [
  {
    id: "oc-2001",
    nis: "2025001",
    nama: "Hasan Basri",
    email: "hasan.basri@example.sch.id",
    telepon: "0813-2222-0001",
    kelas: "X IPA 1",
    jenis: "Pelajar",
    uid_kartu: "RF-2001",
    aktif: true,
    updated_at: "2026-11-10T02:20:00Z",
  },
  {
    id: "oc-2002",
    nis: "2025002",
    nama: "Fatimah Az-Zahra",
    email: "fatimah@example.sch.id",
    kelas: "X IPA 2",
    jenis: "Pelajar",
    uid_kartu: "RF-2002",
    aktif: true,
    updated_at: "2026-11-10T02:21:00Z",
  },
  {
    id: "oc-2003",
    nis: "2025003",
    nama: "Umar Faruq",
    email: null,
    kelas: "XI IPS 1",
    jenis: "Pelajar",
    uid_kartu: "RF-2003",
    aktif: true,
  },
  {
    id: "oc-2004",
    nis: "2020001",
    nama: "Guru Pembina",
    email: "pembina@example.sch.id",
    jenis: "Guru",
    aktif: false,
    updated_at: "2026-06-30T09:00:00Z",
  },
];

function kirim(res, status, isi) {
  const badan = JSON.stringify(isi);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(badan),
  });
  res.end(badan);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  console.log(`${req.method} ${url.pathname}${url.search}`);

  if (url.pathname === "/health") {
    return kirim(res, 200, { ok: true, jumlah: DATA.length });
  }

  if (url.pathname !== "/v1/members") {
    return kirim(res, 404, { pesan: "Endpoint tidak ada di server tiruan." });
  }

  if (KUNCI) {
    const header = req.headers.authorization ?? "";
    if (header !== `Bearer ${KUNCI}`) {
      return kirim(res, 401, { pesan: "Kunci API salah." });
    }
  }

  const halaman = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const batas = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 100) || 100));
  const sejak = url.searchParams.get("updated_since");

  // Filter delta: entri tanpa updated_at dianggap berubah (sama seperti banyak
  // API nyata yang hanya mengirim objek lengkap saat pertama kali).
  const tersaring = sejak
    ? DATA.filter((d) => !d.updated_at || d.updated_at >= sejak)
    : DATA;

  const mulai = (halaman - 1) * batas;
  const potong = tersaring.slice(mulai, mulai + batas);

  return kirim(res, 200, {
    data: potong,
    meta: {
      total: tersaring.length,
      has_more: mulai + potong.length < tersaring.length,
      page: halaman,
    },
  });
});

server.listen(PORT, () => {
  console.log(`Mock OnCard berjalan di http://localhost:${PORT}`);
  console.log(`  GET /health`);
  console.log(`  GET /v1/members?page=1&limit=100${KUNCI ? " (butuh Bearer)" : ""}`);
  console.log("Hentikan dengan Ctrl+C.");
});
