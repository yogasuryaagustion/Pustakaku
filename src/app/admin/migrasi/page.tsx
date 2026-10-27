"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog, EmptyState, StatCard } from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api";
import { KEY_TEMA } from "@/lib/theme";
import { KATEGORI_LIST, type Buku } from "@/lib/types";

// === Migrasi data lama (localStorage → Supabase) =============================
// Halaman ini adalah satu-satunya pemakai endpoint POST /api/migrasi.
//
// Alurnya:
//   1. Pindai localStorage BROWSER INI lalu tebak isi tiap key (nama + bentuk
//      data) — nama key lama tidak diketahui aplikasi, jadi admin memastikan
//      lewat tabel pemetaan.
//   2. Pratinjau (pratinjau: true) — server memvalidasi seluruh baris TANPA
//      menulis apa pun, lalu menghitung berapa yang akan masuk/dilewati/gagal.
//   3. Impor — server menulis ke database; idempoten (kunci alami), aman
//      dijalankan berulang.
//
// Prinsip yang dipegang endpoint:
//   * Kata sandi lama TIDAK dipindahkan (hash SHA-256 bukan milik Supabase
//     Auth) — akun lama hanya dibuat bila admin mengisi sandi sementara.
//   * Data browser TIDAK dihapus server; penghapusan urusan pengguna.
//   * Aktor jejak diambil dari sesi admin di server.
//
// Halaman ini hanya di-mount setelah AppShell memastikan sesi admin (gerbang
// peran RUTE_PERAN di lib/akses.ts), sehingga membaca localStorage saat mount
// aman — sama seperti /admin/pengaturan dan /admin/akses.

type JenisData =
  | "buku"
  | "anggota"
  | "peminjaman"
  | "pengguna"
  | "pengaturan"
  | "kebijakan";

const JENIS_LABEL: Record<JenisData, string> = {
  buku: "Buku (katalog)",
  anggota: "Anggota",
  peminjaman: "Peminjaman",
  pengguna: "Akun lama",
  pengaturan: "Pengaturan sistem",
  kebijakan: "Kebijakan akses",
};

/** Batas payload impor (byte) — dijaga di klien sebelum dikirim. */
const BATAS_PAYLOAD = 5 * 1024 * 1024;

const JENIS_DAFTAR: JenisData[] = [
  "buku",
  "anggota",
  "peminjaman",
  "pengguna",
  "pengaturan",
  "kebijakan",
];

interface SumberKunci {
  key: string;
  tipe: "array" | "objek" | "teks";
  jumlah: number;
  contoh: string;
  isi: unknown;
}

interface Kelompok {
  berhasil: number;
  dilewati: number;
  gagal: number;
  catatan: string[];
}

interface HasilMigrasi {
  pratinjau: boolean;
  buku: Kelompok;
  anggota: Kelompok;
  peminjaman: Kelompok;
  pengguna: Kelompok & { perluSandiBaru: string[] };
  pengaturan: "ok" | "dilewati" | "gagal" | "tidak-ada";
  kebijakan: "ok" | "dilewati" | "gagal" | "tidak-ada";
  total: { berhasil: number; dilewati: number; gagal: number };
  pesan: string;
}

// ---- Deteksi otomatis: nama key + bentuk isi -------------------------------
function deteksi(key: string, isi: unknown): JenisData | null {
  const k = key.toLowerCase();

  if (Array.isArray(isi)) {
    const contoh = isi.find(
      (x) => x && typeof x === "object"
    ) as Record<string, unknown> | undefined;
    const ada = (...nama: string[]) =>
      !!contoh && nama.some((n) => n in (contoh as Record<string, unknown>));

    if (ada("judul", "penulis", "isbn")) return "buku";
    if (ada("nomorAnggota", "nomor_anggota")) return "anggota";
    if (
      ada(
        "kodePinjam",
        "kode_pinjam",
        "tanggalKembaliAktual",
        "tanggal_kembali_aktual"
      )
    )
      return "peminjaman";
    if (ada("sandi", "sandiHash", "peran") && ada("email")) return "pengguna";

    if (/buku|book|katalog|catalog/.test(k)) return "buku";
    if (/anggota|member/.test(k)) return "anggota";
    if (/peminjam|pinjam|loan|sirkulasi|circulation/.test(k)) return "peminjaman";
    if (/pengguna|user|akun|account|login/.test(k)) return "pengguna";
    return null;
  }

  if (isi && typeof isi === "object") {
    const o = isi as Record<string, unknown>;
    if ("izin" in o) return "kebijakan";
    if (
      "lamaPinjam" in o ||
      "lama_pinjam" in o ||
      "dendaPerHari" in o ||
      "denda_per_hari" in o ||
      "maksPinjaman" in o ||
      "maks_pinjaman" in o
    )
      return "pengaturan";
    if (/kebijakan|izin|akses|access|permission|rbac/.test(k)) return "kebijakan";
    if (/pengaturan|setting|sistem|system|konfigurasi|config/.test(k))
      return "pengaturan";
    return null;
  }

  return null;
}

function hitungArray(v: unknown): number {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object").length : 0;
}

function objek(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

// ---- Penyiapan payload (menutup celah validasi server) ---------------------
// Server menolak kategori/jenis di luar daftar; data lama sering belum punya
// keduanya, jadi nilai kosong/tak dikenal dilengkapi di sini agar baris tidak
// sekadar gagal semua.
function siapkanBuku(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  const out: Record<string, unknown>[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const b = { ...(raw as Record<string, unknown>) };
    if (typeof b.judul !== "string" || !b.judul.trim()) continue;
    b.judul = b.judul.trim();
    if (
      typeof b.kategori !== "string" ||
      !KATEGORI_LIST.includes(b.kategori as Buku["kategori"])
    ) {
      b.kategori = "Lainnya";
    }
    out.push(b);
  }
  return out;
}

function siapkanAnggota(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  const out: Record<string, unknown>[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const a = { ...(raw as Record<string, unknown>) };
    if (typeof a.nama !== "string" || a.nama.trim().length < 3) continue;
    a.nama = a.nama.trim();
    if (!["Pelajar", "Umum", "Staf"].includes(String(a.jenis ?? ""))) {
      a.jenis = "Umum";
    }
    out.push(a);
  }
  return out;
}

function siapkanDaftar(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
}

// Kata sandi/hash lama TIDAK dikirim ke server: hash SHA-256 bukan milik
// Supabase Auth dan tidak perlu menyeberangi jaringan (lihat catatan di
// src/app/api/migrasi/route.ts).
const KUNCI_SANDI = [
  "sandi",
  "sandiHash",
  "sandi_hash",
  "kataSandi",
  "kata_sandi",
  "password",
  "passwordHash",
  "password_hash",
];

function siapkanPengguna(v: unknown): Record<string, unknown>[] {
  return siapkanDaftar(v).map((p) => {
    const o = { ...p };
    for (const k of KUNCI_SANDI) delete o[k];
    return o;
  });
}

// ---- Pemindai localStorage (dipanggil saat initializer state & tombol muat ulang)
function bacaSumber(): SumberKunci[] {
  if (typeof window === "undefined") return [];
  const daftar: SumberKunci[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || key === KEY_TEMA) continue; // tema dikelola terpisah, bukan data
    const mentah = window.localStorage.getItem(key);
    if (mentah === null) continue;

    let isi: unknown = mentah;
    let tipe: SumberKunci["tipe"] = "teks";
    try {
      isi = JSON.parse(mentah);
      tipe = Array.isArray(isi) ? "array" : isi && typeof isi === "object" ? "objek" : "teks";
    } catch {
      isi = mentah;
      tipe = "teks";
    }

    const contoh =
      tipe === "array"
        ? `${hitungArray(isi)} baris`
        : tipe === "objek"
          ? `${Object.keys(isi as object).length} field`
          : String(mentah).slice(0, 60);

    daftar.push({ key, tipe, jumlah: hitungArray(isi), contoh, isi });
  }
  return daftar;
}

/** Tebak pemetaan: key pertama yang cocok untuk tiap jenis data. */
function tebakPeta(daftar: SumberKunci[]): Partial<Record<JenisData, string>> {
  const p: Partial<Record<JenisData, string>> = {};
  for (const s of daftar) {
    const j = s.tipe === "teks" ? null : deteksi(s.key, s.isi);
    if (j && !p[j]) p[j] = s.key;
  }
  return p;
}

export default function MigrasiDataPage() {
  const toast = useToast();

  // Dibaca sekali saat komponen pertama kali di-render di klien (halaman ini
  // tidak ikut di-server-render: Shell menahan konten privat sampai sesi
  // terbaca), sehingga tidak ada beda hasil saat hydration.
  const [sumber, setSumber] = useState<SumberKunci[]>(() => bacaSumber());
  const [peta, setPeta] = useState<Partial<Record<JenisData, string>>>(() =>
    tebakPeta(bacaSumber())
  );
  const [sandiSementara, setSandiSementara] = useState("");
  const [hasil, setHasil] = useState<HasilMigrasi | null>(null);
  const [proses, setProses] = useState(false);
  const [tanyaImpor, setTanyaImpor] = useState(false);

  // Pindai ulang localStorage (tombol "Muat Ulang Daftar").
  function pindai() {
    const daftar = bacaSumber();
    setSumber(daftar);
    setPeta(tebakPeta(daftar));
  }

  const terpakai = useMemo(
    () => new Set(Object.values(peta).filter(Boolean) as string[]),
    [peta]
  );
  const jumlahBaris = useMemo(
    () =>
      ({
        buku: siapkanBuku(ambil("buku")).length,
        anggota: siapkanAnggota(ambil("anggota")).length,
        peminjaman: siapkanDaftar(ambil("peminjaman")).length,
        pengguna: siapkanPengguna(ambil("pengguna")).length,
        pengaturan: objek(ambil("pengaturan")) ? 1 : 0,
        kebijakan: objek(ambil("kebijakan")) ? 1 : 0,
      }) as Record<JenisData, number>,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ambil() membaca peta & sumber yang sama
    [peta, sumber]
  );

  const kandidatAkun = jumlahBaris.pengguna;
  const perluSandi = kandidatAkun > 0 && sandiSementara.trim().length < 6;

  function ambil(jenis: JenisData): unknown {
    const key = peta[jenis];
    if (!key) return null;
    return sumber.find((s) => s.key === key)?.isi ?? null;
  }

  function bangunPayload(pratinjau: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      pratinjau,
      buku: siapkanBuku(ambil("buku")),
      anggota: siapkanAnggota(ambil("anggota")),
      peminjaman: siapkanDaftar(ambil("peminjaman")),
      pengguna: siapkanPengguna(ambil("pengguna")),
    };
    const pengaturan = objek(ambil("pengaturan"));
    const kebijakan = objek(ambil("kebijakan"));
    if (pengaturan) payload.pengaturan = pengaturan;
    if (kebijakan) payload.kebijakan = kebijakan;
    const sandi = sandiSementara.trim();
    if (sandi.length >= 6) payload.sandiSementara = sandi;
    return payload;
  }

  async function jalankan(pratinjau: boolean) {
    const payload = bangunPayload(pratinjau);

    // Batasi ukuran kiriman: data lama bisa membawa foto base64 ber-megabyte,
    // sedangkan route handler Next.js tidak membatasi ukuran body secara bawaan.
    const ukuran = new Blob([JSON.stringify(payload)]).size;
    if (ukuran > BATAS_PAYLOAD) {
      toast.gagal(
        `Data terlalu besar (${(ukuran / 1_048_576).toFixed(1)} MB, batas ${BATAS_PAYLOAD / 1_048_576} MB). ` +
          "Pindahkan bertahap (mis. matikan penyertaan foto lama) lalu jalankan impor lagi."
      );
      return;
    }

    const totalBaris =
      (payload.buku as unknown[]).length +
      (payload.anggota as unknown[]).length +
      (payload.peminjaman as unknown[]).length +
      (payload.pengguna as unknown[]).length +
      (payload.pengaturan ? 1 : 0) +
      (payload.kebijakan ? 1 : 0);

    if (totalBaris === 0) {
      toast.gagal("Tidak ada data yang dipetakan — pilih key localStorage dulu.");
      return;
    }

    setProses(true);
    try {
      const res = await apiFetch<HasilMigrasi>("/api/migrasi", {
        method: "POST",
        body: payload,
      });
      setHasil(res);
      if (pratinjau) {
        toast.info(res.pesan);
      } else if (res.total.gagal > 0) {
        toast.gagal(res.pesan);
      } else {
        toast.sukses(res.pesan);
      }
    } catch (e) {
      const pesan =
        e && typeof e === "object" && "message" in e
          ? String((e as Error).message)
          : "Migrasi gagal dijalankan.";
      toast.gagal(pesan);
    } finally {
      setProses(false);
    }
  }

  function selesaiImpor() {
    setTanyaImpor(false);
    void jalankan(false);
  }

  if (sumber.length === 0) {
    return (
      <div className="space-y-4">
        <KepalaMigrasi jumlahKunci={0} />
        <EmptyState
          pesan="Tidak ada data lama di browser ini"
          sub="Data lama (buku, anggota, peminjaman, akun) tersimpan di localStorage browser tempat aplikasi lama dijalankan. Buka halaman ini dari browser tersebut, lalu tekan Muat Ulang."
        />
        <div className="card flex items-center justify-between gap-3 p-4">
          <span className="text-xs text-[var(--muted)]">
            Tema tampilan (key <span className="font-mono">{KEY_TEMA}</span>) sengaja tidak
            ikut dimigrasikan — dikelola terpisah di /admin/pengaturan.
          </span>
          <button className="btn btn-ghost" onClick={pindai}>
            Muat Ulang Daftar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KepalaMigrasi jumlahKunci={sumber.length} />

      {/* Ringkasan data terdeteksi */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Buku"
          value={jumlahBaris.buku}
          sub="baris siap impor"
          tone="brand"
        />
        <StatCard label="Anggota" value={jumlahBaris.anggota} sub="kartu" tone="sky" />
        <StatCard
          label="Peminjaman"
          value={jumlahBaris.peminjaman}
          sub="transaksi"
          tone="amber"
        />
        <StatCard
          label="Akun Lama"
          value={jumlahBaris.pengguna}
          sub={kandidatAkun > 0 ? "butuh sandi sementara" : "opsional"}
          tone="rose"
        />
      </div>

      {/* Pemetaan key localStorage */}
      <div className="card overflow-hidden">
        <div className="border-b [var(--border)] px-5 py-4">
          <h2 className="font-bold">Sumber Data (localStorage)</h2>
          <p className="text-xs text-[var(--muted)]">
            Setiap key di browser ini dipetakan ke satu jenis data. Tebakan otomatis sudah
            terpasang — periksa lalu ubah bila salah.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Key localStorage</th>
                <th>Isi</th>
                <th className="w-56">Dipakai sebagai</th>
              </tr>
            </thead>
            <tbody>
              {sumber.map((s) => {
                const dipakai = terpakai.has(s.key);
                const jenisSekarang =
                  JENIS_DAFTAR.find((j) => peta[j] === s.key) ?? "";
                return (
                  <tr key={s.key}>
                    <td>
                      <div className="font-mono text-sm">{s.key}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {s.tipe === "array"
                          ? "daftar"
                          : s.tipe === "objek"
                            ? "objek"
                            : "teks"}
                        {dipakai ? " · terpakai" : ""}
                      </div>
                    </td>
                    <td className="text-sm text-[var(--muted)]">{s.contoh}</td>
                    <td>
                      <select
                        className="input"
                        aria-label={`Pemetaan ${s.key}`}
                        value={jenisSekarang}
                        disabled={s.tipe === "teks"}
                        onChange={(e) => {
                          const nilai = e.target.value as JenisData | "";
                          setPeta((p) => {
                            const next = { ...p };
                            // Satu jenis hanya boleh punya satu sumber.
                            if (nilai) next[nilai] = s.key;
                            for (const j of JENIS_DAFTAR) {
                              if (next[j] === s.key && j !== nilai) delete next[j];
                            }
                            return next;
                          });
                        }}
                      >
                        <option value="">— abaikan —</option>
                        {JENIS_DAFTAR.map((j) => (
                          <option key={j} value={j}>
                            {JENIS_LABEL[j]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t [var(--border)] px-5 py-3 text-right">
          <button className="btn btn-ghost" onClick={pindai}>
            Muat Ulang Daftar
          </button>
        </div>
      </div>

      {/* Opsi akun lama */}
      <div className="card p-5">
        <h2 className="font-bold">Akun Lama</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Kata sandi lama TIDAK bisa dipindahkan (hash lama bukan milik Supabase Auth).
          Isi sandi sementara bila ingin akun lama dibuat ulang sekaligus — semua akun
          impor memakai sandi ini dan wajib diganti setelah masuk pertama kali.
        </p>
        <label className="label mt-4" htmlFor="sandi-sementara">
          Sandi sementara (opsional, minimal 6 karakter)
        </label>
        <input
          id="sandi-sementara"
          className="input mt-1 sm:w-80"
          type="password"
          autoComplete="new-password"
          placeholder="Kosongkan bila tidak membuat akun"
          value={sandiSementara}
          onChange={(e) => setSandiSementara(e.target.value)}
        />
        {perluSandi && (
          <p className="mt-2 text-xs font-semibold text-amber-600">
            {kandidatAkun} akun lama terdeteksi — tanpa sandi sementara mereka hanya
            dicatat sebagai “perlu sandi baru”, tidak dibuat.
          </p>
        )}
        {jumlahBaris.pengguna > 0 && !perluSandi && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {jumlahBaris.pengguna} akun akan dibuat dengan sandi sementara di atas
            (peran mengikuti data lama, dikunci ulang oleh pemicu database).
          </p>
        )}
      </div>

      {/* Aksi */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-xs text-[var(--muted)]">
          {hasil
            ? hasil.pesan
            : "Pratinjau tidak menulis apa pun ke database — jalankan dulu untuk memeriksa validasi."}
        </span>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost"
            disabled={proses}
            onClick={() => void jalankan(true)}
          >
            {proses ? "Memproses…" : "Pratinjau"}
          </button>
          <button
            className="btn btn-primary"
            disabled={proses}
            onClick={() => setTanyaImpor(true)}
          >
            Jalankan Impor
          </button>
        </div>
      </div>

      {/* Hasil */}
      {hasil && (
        <div className="card overflow-hidden">
          <div className="border-b [var(--border)] px-5 py-4">
            <h2 className="font-bold">
              {hasil.pratinjau ? "Hasil Pratinjau" : "Hasil Impor"}
            </h2>
            <p className="text-xs text-[var(--muted)]">{hasil.pesan}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="text-right">Masuk</th>
                  <th className="text-right">Dilewati</th>
                  <th className="text-right">Gagal</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Buku", hasil.buku],
                    ["Anggota", hasil.anggota],
                    ["Peminjaman", hasil.peminjaman],
                    ["Akun", hasil.pengguna],
                  ] as [string, Kelompok][]
                ).map(([label, g]) => (
                  <tr key={label}>
                    <td className="font-medium">{label}</td>
                    <td className="text-right">{g.berhasil}</td>
                    <td className="text-right">{g.dilewati}</td>
                    <td
                      className={`text-right ${g.gagal > 0 ? "font-semibold text-rose-600" : ""}`}
                    >
                      {g.gagal}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="font-medium">Pengaturan sistem</td>
                  <td colSpan={3} className="text-right">
                    {hasil.pengaturan}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">Kebijakan akses</td>
                  <td colSpan={3} className="text-right">
                    {hasil.kebijakan}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {hasil.pengguna.perluSandiBaru.length > 0 && (
            <div className="border-t [var(--border)] bg-amber-50 px-5 py-3 text-xs text-amber-800">
              <span className="font-semibold">
                {hasil.pengguna.perluSandiBaru.length} akun belum dibuat
              </span>{" "}
              (butuh sandi sementara):{" "}
              <span className="font-mono">
                {hasil.pengguna.perluSandiBaru.slice(0, 5).join(", ")}
                {hasil.pengguna.perluSandiBaru.length > 5
                  ? `, +${hasil.pengguna.perluSandiBaru.length - 5} lainnya`
                  : ""}
              </span>
            </div>
          )}

          {(hasil.buku.catatan.length > 0 ||
            hasil.anggota.catatan.length > 0 ||
            hasil.peminjaman.catatan.length > 0 ||
            hasil.pengguna.catatan.length > 0) && (
            <div className="border-t [var(--border)] px-5 py-3">
              <div className="text-xs font-semibold text-[var(--muted)]">
                Catatan galat (maksimal 20 per jenis)
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {[
                  ...hasil.buku.catatan,
                  ...hasil.anggota.catatan,
                  ...hasil.peminjaman.catatan,
                  ...hasil.pengguna.catatan,
                ].map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={tanyaImpor}
        onClose={() => setTanyaImpor(false)}
        onConfirm={selesaiImpor}
        title="Jalankan impor sekarang?"
        message={`${jumlahBaris.buku} buku, ${jumlahBaris.anggota} anggota, ${jumlahBaris.peminjaman} peminjaman, dan ${jumlahBaris.pengguna} akun akan diproses. Impor idempoten — baris yang sudah ada dilewati, tidak diduplikasi. Data lama di browser tidak dihapus.`}
        confirmLabel="Jalankan Impor"
      />
    </div>
  );
}

function KepalaMigrasi({ jumlahKunci }: { jumlahKunci: number }) {
  return (
    <div className="card p-6">
      <h1 className="text-2xl font-bold tracking-tight">Migrasi Data</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
        Memindahkan data lama dari localStorage browser ini ke Supabase lewat{" "}
        <span className="font-mono">POST /api/migrasi</span>. Aman dijalankan berulang:
        server memvalidasi ulang seluruh baris dan melewati data yang sudah ada.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand)]">
          Halaman khusus admin (gerbang peran)
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
          Pratinjau dulu, impor belakangan
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
          Kata sandi lama tidak dipindahkan
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
          {jumlahKunci} key localStorage terdeteksi
        </span>
      </div>
    </div>
  );
}