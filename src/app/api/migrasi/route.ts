// Migrasi data lama dari localStorage → Supabase (sekali jalan, idempoten).
//
// Aturan main:
//   * Klien mengirim data hasil pembacaan key lama; server memvalidasi ulang
//     SEMUA baris sebelum menyentuh database.
//   * Idempoten: baris yang sudah ada (kunci alami) DIHITUNG "dilewati",
//     bukan diduplikasi — aman dijalankan berulang.
//   * Kata sandi lama TIDAK pernah diimpor: hash SHA-256 bukan milik Supabase
//     Auth. Akun lama hanya dibuat ulang bila admin mengisi sandi sementara.
//   * Data localStorage TIDAK dihapus oleh server (penghapusan sepenuhnya
//     urusan browser, dan dilakukan manual oleh pengguna).

import {
  bacaBody,
  GalatApi,
  jalankan,
  json,
  konteksRoute,
} from "@/lib/supabase/konteks";
import { createSupabaseAdmin, createSupabaseAnon } from "@/lib/supabase/server";
import { envSupabase } from "@/lib/supabase/config";
import { dariBuku, dariAnggota, type BarisAnggota, type BarisBuku } from "@/lib/supabase/peta";
import { sahkanBukuBody, sahkanAnggotaBody, emailSah, sahkanSandi } from "@/lib/supabase/validasi";
import { normalisasiKebijakan, type Kebijakan } from "@/lib/izin";
import { sahkanSistem, type SistemPengaturan } from "@/lib/sistem-nilai";
import { catatJejakServer } from "@/lib/supabase/jejak";

interface Kelompok {
  berhasil: number;
  dilewati: number;
  gagal: number;
  catatan: string[];
}

function kelompokBaru(): Kelompok {
  return { berhasil: 0, dilewati: 0, gagal: 0, catatan: [] };
}

function catat(k: Kelompok, pesan: string) {
  if (k.catatan.length < 20) k.catatan.push(pesan);
}

function daftar(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
}

function teks(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  return jalankan(async () => {
    const k = await konteksRoute({ wajibMasuk: true, wajibAdmin: true });
    const body = (await bacaBody(request)) as Record<string, unknown> | null;
    if (!body) throw new GalatApi("Payload migrasi tidak valid.");
    const pratinjau = body.pratinjau === true;

    const hasil = {
      buku: kelompokBaru(),
      anggota: kelompokBaru(),
      peminjaman: kelompokBaru(),
      pengguna: { ...kelompokBaru(), perluSandiBaru: [] as string[] },
      pengaturan: "tidak-ada" as "ok" | "dilewati" | "gagal" | "tidak-ada",
      kebijakan: "tidak-ada" as "ok" | "dilewati" | "gagal" | "tidak-ada",
    };

    // ---------- 1. Buku ----------
    const barisBuku = daftar(body.buku);
    const { data: bukuLama, error: errBukuLama } = await k.supabase
      .from("buku")
      .select("id, isbn, judul, penulis");
    if (errBukuLama) throw new GalatApi("Gagal membaca katalog yang sudah ada.");
    const adaBuku = (bukuLama ?? []) as Pick<BarisBuku, "id" | "isbn" | "judul" | "penulis">[];
    const kunciBuku = new Map<string, string>();
    for (const b of adaBuku) {
      kunciBuku.set(kunciBuku_(b.isbn, b.judul, b.penulis), b.id);
      if (b.isbn) kunciBuku.set(`isbn:${b.isbn.toLowerCase()}`, b.id);
    }
    const petaBuku = new Map<string, string>(); // id lama → id baru

    for (const raw of barisBuku) {
      const idLama = teks(raw.id);
      try {
        const isi = sahkanBukuBody(raw, { wajibSemua: true });
        const kunci =
          kunciBuku_(String(isi.isbn ?? ""), String(isi.judul ?? ""), String(isi.penulis ?? "")) ||
          (isi.isbn ? `isbn:${isi.isbn.toLowerCase()}` : "");
        const sudah = kunci ? kunciBuku.get(kunci) : undefined;
        if (sudah) {
          hasil.buku.dilewati++;
          if (idLama) petaBuku.set(idLama, sudah);
          continue;
        }
        if (idLama && petaBuku.has(idLama)) {
          hasil.buku.dilewati++;
          continue;
        }
        if (pratinjau) {
          hasil.buku.berhasil++;
          if (idLama) petaBuku.set(idLama, `preview:${idLama}`);
          continue;
        }
        const { data, error } = await k.supabase
          .from("buku")
          .insert(dariBuku(isi))
          .select("id")
          .single();
        if (error) throw error;
        hasil.buku.berhasil++;
        if (idLama) petaBuku.set(idLama, (data as { id: string }).id);
        kunciBuku.set(kunci, (data as { id: string }).id);
      } catch (e) {
        hasil.buku.gagal++;
        catat(hasil.buku, `buku "${teks(raw.judul) || idLama}": ${pesan(e)}`);
      }
    }

    // ---------- 2. Anggota ----------
    const barisAnggota = daftar(body.anggota);
    const { data: anggotaLama, error: errAnggotaLama } = await k.supabase
      .from("anggota")
      .select("id, email, nomor_anggota, nama");
    if (errAnggotaLama) throw new GalatApi("Gagal membaca data anggota yang sudah ada.");
    const adaAnggota = (anggotaLama ?? []) as Pick<
      BarisAnggota,
      "id" | "email" | "nomor_anggota" | "nama"
    >[];
    const kunciAnggota = new Map<string, string>();
    for (const a of adaAnggota) {
      if (a.email) kunciAnggota.set(`email:${a.email.toLowerCase()}`, a.id);
      kunciAnggota.set(`nomor:${a.nomor_anggota.toLowerCase()}`, a.id);
    }
    const petaAnggota = new Map<string, string>();

    for (const raw of barisAnggota) {
      const idLama = teks(raw.id);
      try {
        const isi = sahkanAnggotaBody(raw, { wajibSemua: true });
        const kunciEmail = isi.email ? `email:${isi.email.toLowerCase()}` : "";
        const kunciNomor = isi.nomorAnggota ? `nomor:${isi.nomorAnggota.toLowerCase()}` : "";
        const sudah = kunciAnggota.get(kunciEmail) ?? kunciAnggota.get(kunciNomor);
        if (sudah) {
          hasil.anggota.dilewati++;
          if (idLama) petaAnggota.set(idLama, sudah);
          continue;
        }
        if (pratinjau) {
          hasil.anggota.berhasil++;
          if (idLama) petaAnggota.set(idLama, `preview:${idLama}`);
          continue;
        }
        const { data, error } = await k.supabase
          .from("anggota")
          .insert(dariAnggota(isi))
          .select("id")
          .single();
        if (error) throw error;
        const baru = (data as { id: string }).id;
        hasil.anggota.berhasil++;
        if (idLama) petaAnggota.set(idLama, baru);
        if (kunciEmail) kunciAnggota.set(kunciEmail, baru);
        if (kunciNomor) kunciAnggota.set(kunciNomor, baru);
      } catch (e) {
        hasil.anggota.gagal++;
        catat(hasil.anggota, `anggota "${teks(raw.nama) || idLama}": ${pesan(e)}`);
      }
    }

    // ---------- 3. Peminjaman ----------
    const barisPinjam = daftar(body.peminjaman);
    const { data: pinjamLama, error: errPinjamLama } = await k.supabase
      .from("peminjaman")
      .select("kode_pinjam");
    if (errPinjamLama) throw new GalatApi("Gagal membaca data peminjaman yang sudah ada.");
    const kodeAda = new Set(
      ((pinjamLama ?? []) as { kode_pinjam: string }[]).map((p) => p.kode_pinjam.toLowerCase())
    );

    for (const raw of barisPinjam) {
      const kode = teks(raw.kodePinjam) || teks(raw.kode_pinjam);
      try {
        if (!kode) throw new GalatApi("Kode pinjam kosong.");
        if (kodeAda.has(kode.toLowerCase())) {
          hasil.peminjaman.dilewati++;
          continue;
        }
        const bukuIdLama = teks(raw.bukuId) || teks(raw.buku_id);
        const anggotaIdLama = teks(raw.anggotaId) || teks(raw.anggota_id);
        const bukuId = petaBuku.get(bukuIdLama);
        const anggotaId = petaAnggota.get(anggotaIdLama);
        if (!bukuId) throw new GalatApi(`Buku "${bukuIdLama}" tidak ikut terimpor.`);
        if (!anggotaId) throw new GalatApi(`Anggota "${anggotaIdLama}" tidak ikut terimpor.`);

        const tglPinjam = tanggalISO(raw.tanggalPinjam ?? raw.tanggal_pinjam);
        const tglKembali = tanggalISO(raw.tanggalKembali ?? raw.tanggal_kembali);
        let aktual = raw.tanggalKembaliAktual ?? raw.tanggal_kembali_aktual ?? null;
        aktual = typeof aktual === "string" && /^\d{4}-\d{2}-\d{2}$/.test(aktual) ? aktual : null;
        let status = teks(raw.status) || "Dipinjam";
        if (!["Dipinjam", "Dikembalikan", "Terlambat"].includes(status)) status = "Dipinjam";
        if (status === "Dipinjam") aktual = null;
        else if (!aktual) aktual = tglKembali; // data lama tanpa tanggal aktual
        if (tglKembali < tglPinjam) throw new GalatApi("Tanggal jatuh tempo sebelum tanggal pinjam.");

        const denda = Math.max(0, Math.round(Number(raw.denda ?? 0) || 0));
        const baris = {
          kode_pinjam: kode,
          buku_id: bukuId,
          anggota_id: anggotaId,
          tanggal_pinjam: tglPinjam,
          tanggal_kembali: tglKembali,
          tanggal_kembali_aktual: aktual,
          status,
          denda,
          catatan: teks(raw.catatan).slice(0, 500),
        };

        if (pratinjau) {
          hasil.peminjaman.berhasil++;
          kodeAda.add(kode.toLowerCase());
          continue;
        }
        const { error } = await k.supabase.from("peminjaman").insert(baris);
        if (error) throw error;
        hasil.peminjaman.berhasil++;
        kodeAda.add(kode.toLowerCase());
      } catch (e) {
        hasil.peminjaman.gagal++;
        catat(hasil.peminjaman, `peminjaman "${kode || teks(raw.id)}": ${pesan(e)}`);
      }
    }

    // ---------- 4. Pengaturan sistem ----------
    if (body.pengaturan && typeof body.pengaturan === "object") {
      const s: SistemPengaturan = sahkanSistem(body.pengaturan);
      if (pratinjau) hasil.pengaturan = "ok";
      else {
        const { error } = await k.supabase
          .from("pengaturan_sistem")
          .upsert(
            {
              id: true,
              nama: s.nama,
              tagline: s.tagline,
              lama_pinjam: s.lamaPinjam,
              denda_per_hari: s.dendaPerHari,
              maks_pinjaman: s.maksPinjaman,
              diubah_pada: new Date().toISOString(),
              diubah_oleh: "impor-data-lama",
            },
            { onConflict: "id" }
          );
        hasil.pengaturan = error ? "gagal" : "ok";
      }
    }

    // ---------- 5. Kebijakan akses ----------
    if (body.kebijakan && typeof body.kebijakan === "object") {
      const kb: Kebijakan = normalisasiKebijakan(body.kebijakan);
      kb.diubahOleh = "impor-data-lama";
      kb.diubahPada = new Date().toISOString();
      if (pratinjau) hasil.kebijakan = "ok";
      else {
        const { error } = await k.supabase.from("kebijakan_akses").upsert(
          { id: true, versi: kb.versi, izin: kb.izin, diubah_pada: kb.diubahPada, diubah_oleh: kb.diubahOleh },
          { onConflict: "id" }
        );
        hasil.kebijakan = error ? "gagal" : "ok";
      }
    }

    // ---------- 6. Akun lama (TANPA kata sandi) ----------
    const barisPengguna = daftar(body.pengguna);
    const sandiSementara =
      typeof body.sandiSementara === "string" && body.sandiSementara.length > 0
        ? sahkanSandi(body.sandiSementara, "Sandi sementara")
        : null;
    const { serviceKey } = envSupabase();

    for (const raw of barisPengguna) {
      const email = teks(raw.email).toLowerCase();
      try {
        emailSah(email, { wajib: true });
        const nama = teks(raw.nama);
        const peran = teks(raw.peran) === "admin" ? "admin" : "user";
        const anggotaId = petaAnggota.get(teks(raw.anggotaId) || teks(raw.anggota_id)) ?? null;

        if (!sandiSementara) {
          if (!hasil.pengguna.perluSandiBaru.includes(email)) {
            hasil.pengguna.perluSandiBaru.push(email);
          }
          hasil.pengguna.dilewati++;
          continue;
        }
        if (pratinjau) {
          hasil.pengguna.berhasil++;
          continue;
        }

        let uid: string | null = null;
        if (serviceKey) {
          const admin = createSupabaseAdmin();
          const { data, error } = await admin.auth.admin.createUser({
            email,
            password: sandiSementara,
            email_confirm: true,
            user_metadata: { nama },
          });
          if (error) {
            if (/already/i.test(error.message ?? "")) {
              hasil.pengguna.dilewati++;
              continue;
            }
            throw new GalatApi(error.message || "Akun gagal dibuat.");
          }
          uid = data.user?.id ?? null;
        } else {
          const anon = createSupabaseAnon();
          const { data, error } = await anon.auth.signUp({
            email,
            password: sandiSementara,
            options: { data: { nama } },
          });
          if (error) {
            if (/already/i.test(error.message ?? "")) {
              hasil.pengguna.dilewati++;
              continue;
            }
            throw new GalatApi(error.message || "Akun gagal dibuat.");
          }
          uid = data.user?.id ?? null;
        }
        if (!uid) throw new GalatApi("Akun gagal dibuat (tanpa id).");

        const { error: errProfil } = await k.supabase
          .from("profiles")
          .update({ peran, anggota_id: anggotaId })
          .eq("id", uid);
        if (errProfil) catat(hasil.pengguna, `${email}: peran gagal diset (${errProfil.message})`);

        hasil.pengguna.berhasil++;
      } catch (e) {
        hasil.pengguna.gagal++;
        catat(hasil.pengguna, `${email || teks(raw.id)}: ${pesan(e)}`);
      }
    }

    // ---------- 7. Sinkronkan sekuens & catat jejak ----------
    if (!pratinjau && (hasil.anggota.berhasil > 0 || hasil.peminjaman.berhasil > 0)) {
      const { error } = await k.supabase.rpc("sinkron_sekuens");
      if (error) console.warn("[migrasi] sinkron sekuens:", error.message);
    }
    // Baris yang benar-benar diproses (masuk / dilewati / gagal). Impor tanpa
    // baris sama sekali TIDAK dicatat — riwayat tidak dipenuhi entri "Migrasi"
    // yang tidak melakukan apa pun.
    const diproses =
      hasil.buku.berhasil + hasil.buku.dilewati + hasil.buku.gagal +
      hasil.anggota.berhasil + hasil.anggota.dilewati + hasil.anggota.gagal +
      hasil.peminjaman.berhasil + hasil.peminjaman.dilewati + hasil.peminjaman.gagal +
      hasil.pengguna.berhasil + hasil.pengguna.dilewati + hasil.pengguna.gagal +
      (hasil.pengaturan === "ok" ? 1 : 0) +
      (hasil.kebijakan === "ok" ? 1 : 0);

    if (!pratinjau && diproses > 0) {
      await catatJejakServer(k, {
        jenis: "sistem",
        aksi: "Migrasi data localStorage",
        objek: "Impor data lama",
        detail:
          `buku ${hasil.buku.berhasil}/${hasil.buku.dilewati}/${hasil.buku.gagal} · ` +
          `anggota ${hasil.anggota.berhasil}/${hasil.anggota.dilewati}/${hasil.anggota.gagal} · ` +
          `peminjaman ${hasil.peminjaman.berhasil}/${hasil.peminjaman.dilewati}/${hasil.peminjaman.gagal} ` +
          `(berhasil/dilewati/gagal)`,
      });
    }

    const total = {
      berhasil:
        hasil.buku.berhasil + hasil.anggota.berhasil + hasil.peminjaman.berhasil + hasil.pengguna.berhasil,
      dilewati:
        hasil.buku.dilewati + hasil.anggota.dilewati + hasil.peminjaman.dilewati + hasil.pengguna.dilewati,
      gagal: hasil.buku.gagal + hasil.anggota.gagal + hasil.peminjaman.gagal + hasil.pengguna.gagal,
    };

    return json({
      pratinjau,
      ...hasil,
      total,
      pesan: pratinjau
        ? `Pratinjau: ${total.berhasil} akan masuk, ${total.dilewati} dilewati, ${total.gagal} tidak valid.`
        : `Impor selesai: ${total.berhasil} masuk, ${total.dilewati} dilewati, ${total.gagal} gagal.`,
    });
  });
}

// ---- pembantu --------------------------------------------------------------
function kunciBuku_(isbn: string, judul: string, penulis: string): string {
  const i = isbn.trim().toLowerCase();
  if (i) return `isbn:${i}`;
  return `judul:${judul.trim().toLowerCase()}|${penulis.trim().toLowerCase()}`;
}

function tanggalISO(v: unknown): string {
  const s = teks(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  throw new GalatApi("Tanggal tidak valid (butuh YYYY-MM-DD).");
}

function pesan(e: unknown): string {
  if (e instanceof GalatApi) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
