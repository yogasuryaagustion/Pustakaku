"use client";

import { useRef, useState } from "react";
import { ConfirmDialog, rupiah } from "@/components/ui";
import { useToast } from "@/components/toast";
import { catatJejak } from "@/lib/audit";
import { aktorSesi } from "@/lib/auth";
import {
  SISTEM_DEFAULT,
  useSistem,
  terapkanSistem,
  simpanSistem,
  sahkanSistem,
  type SistemPengaturan,
} from "@/lib/sistem";
import {
  TEMA_DEFAULT,
  PRESET,
  bacaTema,
  simpanTema,
  bangunVars,
  applyVars,
  deriveTema,
  hexValid,
  turunanBrand,
  sahkanTema,
  type TemaForm,
} from "@/lib/theme";

// Pengaturan situs (khusus admin):
//   1. Warna situs — dasar sampai gradien (dipratinjau via CSS variable).
//   2. Sistem perpustakaan — nama/tagline, lama pinjam, denda, batas pinjaman.
// "Simpan" menyimpan aturan sistem ke DATABASE Supabase (berlaku untuk semua
// pengguna), sedangkan warna situs tetap di localStorage browser ini
// (preferensi tampilan per perangkat).

function PilihWarna({
  label,
  nilai,
  onPilih,
}: {
  label: string;
  nilai: string;
  onPilih: (hex: string) => void;
}) {
  // Input teks tanpa state React: DOM menyimpan teks yang sedang diketik
  // (sebagian), nilai baru hanya diteruskan bila sudah hex valid. `key` membuat
  // field me-remount saat nilai resmi berubah (picker/preset), jadi tidak perlu
  // sinkronisasi lewat useEffect.
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-[var(--border)] bg-white p-0.5"
          value={nilai}
          onChange={(e) => onPilih(e.target.value)}
        />
        <input
          key={nilai}
          type="text"
          className="input !w-28 font-mono !text-xs"
          defaultValue={nilai}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (hexValid(v)) onPilih(v);
          }}
          onBlur={(e) => {
            if (!hexValid(e.target.value.trim())) e.target.value = nilai;
          }}
        />
      </div>
    </div>
  );
}

function HentikanGradien({
  label,
  nilai,
  onPilih,
}: {
  label: string;
  nilai: string;
  onPilih: (hex: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <PilihWarna label={label} nilai={nilai} onPilih={onPilih} />
      <div className="mt-2 h-6 rounded-md border border-black/5" style={{ background: nilai }} />
    </div>
  );
}

function IsianTeks({
  label,
  nilai,
  max = 60,
  onUbah,
}: {
  label: string;
  nilai: string;
  max?: number;
  onUbah: (v: string) => void;
}) {
  // Input tanpa state React: commit saat blur saja, jadi mengetik bebas tanpa
  // remount; `key` me-remount setelah nilai resmi berubah (commit/reset).
  return (
    <div>
      <span className="label">{label}</span>
      <input
        key={nilai}
        type="text"
        className="input"
        defaultValue={nilai}
        maxLength={max}
        onBlur={(e) => {
          const v = e.target.value.trim().slice(0, max);
          if (v && v !== nilai) onUbah(v);
          else e.target.value = nilai;
        }}
      />
    </div>
  );
}

function IsianAngka({
  label,
  nilai,
  min,
  max,
  langkah = 1,
  satuan,
  onUbah,
}: {
  label: string;
  nilai: number;
  min: number;
  max: number;
  langkah?: number;
  satuan?: string;
  onUbah: (n: number) => void;
}) {
  // Pola sama seperti IsianTeks: commit + clamp saat blur.
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          key={nilai}
          type="number"
          className="input !w-28"
          defaultValue={nilai}
          min={min}
          max={max}
          step={langkah}
          onBlur={(e) => {
            const n = Math.round(Number(e.target.value));
            if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) {
              if (n !== nilai) onUbah(n);
              else e.target.value = String(nilai);
            } else {
              e.target.value = String(nilai);
            }
          }}
        />
        {satuan && <span className="text-xs text-[var(--muted)]">{satuan}</span>}
      </div>
    </div>
  );
}

export default function PengaturanTemaPage() {
  // Halaman ini hanya di-mount di klien (AppShell menahan konten privat sampai
  // sesi terbaca), jadi membaca localStorage saat inisialisasi aman — tidak
  // pernah ikut hidrasi SSR. Kunci variable sudah ditanam script di layout.
  const sistem = useSistem();
  const toast = useToast();
  const [form, setForm] = useState<TemaForm | null>(
    () => (typeof window === "undefined" ? null : bacaTema())
  );
  const [kotor, setKotor] = useState(false);
  const [tanyaReset, setTanyaReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const beritahu = (teks: string, ok = true) => {
    if (ok) toast.sukses(teks);
    else toast.gagal(teks);
  };

  if (!form) {
    return <div className="p-6 text-[var(--muted)]">Memuat pengaturan…</div>;
  }

  const tur = turunanBrand(form.brand);

  const terapkan = (next: TemaForm) => {
    setForm(next);
    setKotor(true);
    applyVars(bangunVars(next));
  };

  // Ganti warna dasar → turunkan ulang seluruh gradien agar tetap serasi.
  // Warna netral TIDAK ikut di-reset (dipertahankan apa adanya).
  const ubahBrand = (brand: string) => terapkan(deriveTema(brand, form.netral));

  const ubahStop = (
    grup: "aksen" | "latar" | "cta",
    idx: number,
    hex: string
  ) => {
    const trio = [...form[grup]] as [string, string, string];
    trio[idx] = hex;
    terapkan({ ...form, [grup]: trio });
  };

  const ubahNetral = (k: keyof TemaForm["netral"], hex: string) =>
    terapkan({ ...form, netral: { ...form.netral, [k]: hex } });

  // Aturan sistem: terapkan langsung (pratinjau), persist saat "Simpan".
  const ubahSistem = (patch: Partial<SistemPengaturan>) => {
    terapkanSistem(patch);
    setKotor(true);
  };

  const simpan = () => {
    simpanTema(form);
    simpanSistem(sistem);
    setKotor(false);
    const a = aktorSesi();
    catatJejak({
      aktor: a.nama,
      peran: a.peran,
      jenis: "sistem",
      aksi: "Pengaturan disimpan",
      objek: sistem.nama,
      detail: `lama ${sistem.lamaPinjam} hr · denda Rp${sistem.dendaPerHari.toLocaleString("id-ID")}/hari`,
    });
    beritahu("Pengaturan tersimpan — berlaku untuk semua halaman di browser ini.");
  };

  const kembalikan = () => {
    simpanTema(TEMA_DEFAULT);
    simpanSistem(SISTEM_DEFAULT);
    setForm(TEMA_DEFAULT);
    setKotor(false);
    const a = aktorSesi();
    catatJejak({
      aktor: a.nama,
      peran: a.peran,
      jenis: "sistem",
      aksi: "Pengaturan dikembalikan ke bawaan",
      objek: "Tema & sistem",
      detail: "seluruh nilai default dipulihkan",
    });
    beritahu("Tema dan aturan sistem dikembalikan ke bawaan.");
  };

  // Ekspor/impor seluruh pengaturan (tema + sistem) sebagai file JSON.
  const ekspor = () => {
    const isi = JSON.stringify(
      { versi: 1, dieksporPada: new Date().toISOString(), tema: form, sistem },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([isi], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pengaturan-siperpu.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    beritahu("Pengaturan diekspor ke pengaturan-siperpu.json.");
  };

  const imporFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { tema?: unknown; sistem?: unknown } | null;
      const obj = data && typeof data === "object" ? data : null;
      const temaImpor = obj ? sahkanTema(obj.tema) : null;
      const sistemImpor =
        obj && obj.sistem && typeof obj.sistem === "object" ? sahkanSistem(obj.sistem) : null;
      if (!temaImpor && !sistemImpor) {
        beritahu("File tidak valid — tidak berisi tema atau pengaturan sistem yang dikenali.", false);
        return;
      }
      if (temaImpor) {
        setForm(temaImpor);
        simpanTema(temaImpor);
      }
      if (sistemImpor) simpanSistem(sistemImpor);
      setKotor(false);
      const a = aktorSesi();
      catatJejak({
        aktor: a.nama,
        peran: a.peran,
        jenis: "sistem",
        aksi: "Pengaturan diimpor",
        objek: file.name,
        detail: [temaImpor ? "tema" : null, sistemImpor ? "sistem" : null].filter(Boolean).join(" + "),
      });
      beritahu("Pengaturan dari file diterapkan dan tersimpan.");
    } catch {
      beritahu("File tidak bisa dibaca — gunakan file JSON hasil Ekspor.", false);
    }
  };

  const isianStop = (grup: "aksen" | "latar" | "cta") =>
    form[grup].map((c, i) => (
      <HentikanGradien
        key={i}
        label={["Stop 1 (kiri/atas)", "Stop 2 (tengah)", "Stop 3 (kanan/bawah)"][i]}
        nilai={c}
        onPilih={(hex) => ubahStop(grup, i, hex)}
      />
    ));

  return (
    <div className="max-w-4xl space-y-5">
      {/* Pembuka */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Pengaturan Situs</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Atur warna situs dan aturan sistem perpustakaan — pratinjau langsung, lalu simpan.
          </p>
        </div>      {kotor && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Perubahan belum disimpan
        </span>
      )}
      </div>

      {/* Aturan sistem perpustakaan */}
      <section className="card p-5">
        <div className="label !text-sm !text-[var(--foreground)] font-bold">
          Sistem Perpustakaan
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Aturan main yang dipakai seluruh halaman: sirkulasi, katalog, panel anggota,
          dashboard, dan laporan — pratinjau langsung, lalu simpan.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <IsianTeks label="Nama perpustakaan" nilai={sistem.nama} onUbah={(v) => ubahSistem({ nama: v })} />
          <IsianTeks label="Tagline (di bawah nama)" nilai={sistem.tagline} onUbah={(v) => ubahSistem({ tagline: v })} />
          <IsianAngka label="Lama pinjam standar" nilai={sistem.lamaPinjam} min={1} max={90} satuan="hari" onUbah={(n) => ubahSistem({ lamaPinjam: n })} />
          <IsianAngka label="Denda per hari keterlambatan" nilai={sistem.dendaPerHari} min={0} max={1_000_000} langkah={500} satuan="rupiah" onUbah={(n) => ubahSistem({ dendaPerHari: n })} />
          <IsianAngka label="Maks buku dipinjam / anggota" nilai={sistem.maksPinjaman} min={1} max={50} satuan="buku" onUbah={(n) => ubahSistem({ maksPinjaman: n })} />
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Contoh yang berlaku: pinjaman baru jatuh tempo {sistem.lamaPinjam} hari sejak tanggal
          pinjam, denda {rupiah(sistem.dendaPerHari)}/hari, maksimal {sistem.maksPinjaman} buku per
          anggota, logo &amp; judul memakai “{sistem.nama}”.
        </p>
      </section>

      {/* Preset */}
      <section className="card p-5">
        <div className="label">Palet cepat</div>
        <div className="flex flex-wrap gap-2">
          {PRESET.map((p) => (
            <button
              key={p.brand}
              className="btn btn-ghost !py-1.5"
              onClick={() => ubahBrand(p.brand)}
              title={`Terapkan palet ${p.nama}`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ background: p.brand }}
              />
              {p.nama}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Memilih palet (atau mengganti warna dasar) akan menurunkan ulang seluruh
          gradien agar tetap satu keluarga; Anda bisa mengaturnya manual setelahnya.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Warna dasar */}
        <section className="card p-5">
          <div className="label !text-sm !text-[var(--foreground)] font-bold">Warna dasar</div>
          <div className="mt-3">
            <PilihWarna label="Warna utama (brand)" nilai={form.brand} onPilih={ubahBrand} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { l: "Lembut (latar aksen)", v: tur.soft },
              { l: "Gelap (hover tombol)", v: tur.hover },
              { l: "Terang (gradien logo)", v: tur.light },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-[var(--border)] bg-white p-2">
                <div className="mx-auto h-8 w-full rounded-md border border-black/5" style={{ background: s.v }} />
                <div className="mt-1.5 font-mono text-[10px] text-[var(--muted)]">{s.v}</div>
                <div className="text-[10px] leading-tight text-[var(--muted)]">{s.l}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Turunan (lembut/gelap/terang) selalu mengikuti warna utama secara otomatis.
          </p>
        </section>

        {/* Pratinjau */}
        <section className="card p-5">
          <div className="label !text-sm !text-[var(--foreground)] font-bold">Pratinjau langsung</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="grad-hero flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="grad-brand h-7 w-7 rounded-md text-white grid place-items-center text-xs font-bold">{sistem.nama.charAt(0)}</div>
                <span className="text-sm font-bold">{sistem.nama}</span>
              </div>
              <span className="grad-teks bg-clip-text text-transparent text-sm font-extrabold">Favoritmu</span>
            </div>
            <div className="flex items-center gap-2 bg-[var(--card)] px-4 py-3">
              <span className="btn btn-primary !py-1.5">Tombol Aksi</span>
              <span
                className="h-7 w-7 rounded-md border border-black/5"
                style={{ backgroundImage: "var(--g1)" }}
              />
              <span
                className="h-7 w-7 rounded-md border border-black/5"
                style={{ backgroundImage: "var(--g4)" }}
              />
              <span
                className="h-7 w-7 rounded-md border border-black/5"
                style={{ backgroundImage: "var(--g6)" }}
              />
            </div>
            <div className="grad-cta px-4 py-3 text-xs font-semibold text-white">
              Panel CTA &amp; halaman masuk
            </div>
          </div>
        </section>
      </div>

      {/* Warna dasar netral */}
      <section className="card p-5">
        <div className="label !text-sm !text-[var(--foreground)] font-bold">
          Warna dasar halaman (netral)
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Latar halaman, teks utama, permukaan kartu, teks sekunder, dan garis pemisah —
          dipakai di seluruh halaman panel maupun katalog.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <PilihWarna label="Latar halaman" nilai={form.netral.background} onPilih={(h) => ubahNetral("background", h)} />
          <PilihWarna label="Teks utama" nilai={form.netral.foreground} onPilih={(h) => ubahNetral("foreground", h)} />
          <PilihWarna label="Kartu / kotak" nilai={form.netral.card} onPilih={(h) => ubahNetral("card", h)} />
          <PilihWarna label="Teks lembut" nilai={form.netral.muted} onPilih={(h) => ubahNetral("muted", h)} />
          <PilihWarna label="Garis (border)" nilai={form.netral.border} onPilih={(h) => ubahNetral("border", h)} />
        </div>
      </section>

      {/* Gradien kartu */}
      <section className="card p-5">
        <div className="label !text-sm !text-[var(--foreground)] font-bold">
          Gradien kartu, sampul &amp; ikon
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Tiga jangkar ini menghasilkan 6 variasi halus (selalu satu keluarga) untuk kartu fitur,
          sampul buku, avatar testimoni, dan ikon.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">{isianStop("aksen")}</div>
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-9 flex-1 rounded-md border border-black/5"
              style={{ backgroundImage: `var(--g${n})` }}
            />
          ))}
        </div>
      </section>

      {/* Gradien latar */}
      <section className="card p-5">
        <div className="label !text-sm !text-[var(--foreground)] font-bold">
          Gradien latar section landing
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Dipakai hero, koleksi populer, dan testimoni (sudut gradien berbeda per section).
        </p>
        <div className="grid gap-3 sm:grid-cols-3">{isianStop("latar")}</div>
        <div className="grad-hero mt-3 h-14 rounded-md border border-black/5" />
      </section>

      {/* Gradien CTA */}
      <section className="card p-5">
        <div className="label !text-sm !text-[var(--foreground)] font-bold">
          Gradien CTA &amp; panel masuk
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Dipakai panel branding halaman masuk/daftar, footer landing, dan kartu demo.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">{isianStop("cta")}</div>
        <div className="grad-cta mt-3 h-14 rounded-md" />
      </section>

      {/* Aksi */}
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <button className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed" onClick={simpan} disabled={!kotor}>
          Simpan Pengaturan
        </button>
        <button className="btn btn-ghost" onClick={() => setTanyaReset(true)}>
          Kembalikan ke Bawaan
        </button>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" aria-hidden />
        <button className="btn btn-ghost" onClick={ekspor}>
          Ekspor JSON
        </button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          Impor JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={imporFile}
        />
        <span className="text-xs text-[var(--muted)]">
          Warna situs disimpan di browser ini; aturan sistem (nama, lama pinjam,
          denda, batas pinjaman) disimpan di database Supabase — berlaku untuk
          semua pengguna.
        </span>
      </div>

      <ConfirmDialog
        open={tanyaReset}
        onClose={() => setTanyaReset(false)}
        onConfirm={kembalikan}
        title="Kembalikan ke bawaan?"
        message="Seluruh warna, gradien, dan aturan sistem perpustakaan akan dikembalikan ke bawaan dan langsung disimpan."
        confirmLabel="Kembalikan"
      />
    </div>
  );
}
