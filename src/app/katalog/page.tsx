"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLibrary, useHelper } from "@/lib/library-context";
import { useAuth, useBoleh } from "@/lib/auth";
import { useSistem } from "@/lib/sistem";
import { KATEGORI_LIST, type Buku, type Kategori } from "@/lib/types";
import { Modal, ConfirmDialog, Badge, EmptyState, SampulBuku, tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";

const KOSONG_FORM = {
  judul: "",
  penulis: "",
  penerbit: "",
  tahun: new Date().getFullYear().toString(),
  isbn: "",
  kategori: "Fiksi" as Kategori,
  rak: "",
  stok: "1",
  deskripsi: "",
  gambar: "",
};

function KatalogKonten() {
  const { buku, siap, tambahBuku, ubahBuku, hapusBuku, pinjamBuku } = useLibrary();
  const { stokTersedia } = useHelper();
  const { sedangMasuk } = useAuth();
  const sistem = useSistem();
  const toast = useToast();
  // Izin mengikuti kebijakan (default: admin katalog.kelola, anggota katalog.pinjam).
  const bolehKelolaBuku = useBoleh("katalog.kelola");
  const bolehPinjam = useBoleh("katalog.pinjam");
  const bolehDaftar = useBoleh("akun.daftar");
  const anggotaIdUser = sedangMasuk?.anggotaId;
  const params = useSearchParams();

  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [filterKategori, setFilterKategori] = useState<string>("Semua");
  const [filterStok, setFilterStok] = useState<string>("Semua");

  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...KOSONG_FORM });
  const [hapusTarget, setHapusTarget] = useState<Buku | null>(null);
  // Quick-pinjam: tampilkan modal agar pengguna bisa memilih tanggal peminjaman.
  const [pinjamTarget, setPinjamTarget] = useState<Buku | null>(null);
  const [tanggalPinjam, setTanggalPinjam] = useState(() => new Date().toISOString().slice(0, 10));

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return buku.filter((b) => {
      const cocokKata =
        !kata ||
        b.judul.toLowerCase().includes(kata) ||
        b.penulis.toLowerCase().includes(kata) ||
        b.isbn.toLowerCase().includes(kata) ||
        b.penerbit.toLowerCase().includes(kata);
      const cocokKategori = filterKategori === "Semua" || b.kategori === filterKategori;
      const tersedia = stokTersedia(b.id);
      const cocokStok =
        filterStok === "Semua" ||
        (filterStok === "Tersedia" && tersedia > 0) ||
        (filterStok === "Habis" && tersedia <= 0);
      return cocokKata && cocokKategori && cocokStok;
    });
  }, [buku, q, filterKategori, filterStok, stokTersedia]);

  function bukaTambah() {
    setEditId(null);
    setForm({ ...KOSONG_FORM });
    setOpenForm(true);
  }

  function bukaEdit(b: Buku) {
    setEditId(b.id);
    setForm({
      judul: b.judul,
      penulis: b.penulis,
      penerbit: b.penerbit,
      tahun: String(b.tahun),
      isbn: b.isbn,
      kategori: b.kategori,
      rak: b.rak,
      stok: String(b.stok),
      deskripsi: b.deskripsi,
      gambar: b.gambar ?? "",
    });
    setOpenForm(true);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      judul: form.judul.trim(),
      penulis: form.penulis.trim(),
      penerbit: form.penerbit.trim(),
      tahun: Number(form.tahun) || new Date().getFullYear(),
      isbn: form.isbn.trim(),
      kategori: form.kategori,
      rak: form.rak.trim(),
      stok: Math.max(0, Number(form.stok) || 0),
      deskripsi: form.deskripsi.trim(),
      gambar: form.gambar.trim() || null,
    };
    if (!data.judul) return;
    const hasil = editId ? await ubahBuku(editId, data) : await tambahBuku(data);
    if (!hasil.ok) {
      toast.gagal(hasil.pesan);
      return;
    }
    toast.sukses(
      editId ? `Buku "${data.judul}" diperbarui.` : `Buku "${data.judul}" ditambahkan ke katalog.`
    );
    setOpenForm(false);
  }

  const jatuhTempo = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalPinjam)) return "";
    const d = new Date(tanggalPinjam + "T00:00:00");
    d.setDate(d.getDate() + sistem.lamaPinjam);
    return d.toISOString().slice(0, 10);
  }, [tanggalPinjam, sistem.lamaPinjam]);

  async function konfirmasiPinjam() {
    if (!pinjamTarget || !anggotaIdUser) return;
    const r = await pinjamBuku(pinjamTarget.id, anggotaIdUser, tanggalPinjam);
    if (r.ok) toast.sukses(r.pesan);
    else toast.gagal(r.pesan);
    setPinjamTarget(null);
    setTanggalPinjam(new Date().toISOString().slice(0, 10));
  }

  if (!siap) return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;

  // Pengunjung yang belum masuk: tampil kartu grid read-only (konsep "Katalog Buku").
  if (!sedangMasuk) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Katalog Buku</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Temukan buku yang kamu cari dari koleksi kami.
          </p>
        </div>

        <div className="card p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              className="input pl-9"
              placeholder="Cari judul, penulis, atau ISBN…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="input lg:w-44" value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
            <option value="Semua">Semua Kategori</option>
            {KATEGORI_LIST.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <select className="input lg:w-40" value={filterStok} onChange={(e) => setFilterStok(e.target.value)}>
            <option value="Semua">Semua Status</option>
            <option value="Tersedia">Tersedia</option>
            <option value="Habis">Habis</option>
          </select>
        </div>

        {hasil.length === 0 ? (
          <EmptyState pesan="Tidak ada buku yang cocok" sub="Coba ubah kata kunci atau filter." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {hasil.map((b) => {
              const tersedia = stokTersedia(b.id);
              return (
                <div key={b.id} className="card overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                  <SampulBuku buku={b} className="h-40 w-full" rounded="" />
                  <div className="p-3 flex flex-col flex-1">
                    <div className="font-semibold text-sm leading-tight">{b.judul}</div>
                    <div className="text-xs text-[var(--muted)] truncate">{b.penulis}</div>
                    <div className="mt-1"><Badge tone="slate">{b.kategori}</Badge></div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`font-semibold ${tersedia > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {tersedia > 0 ? `Tersedia (${tersedia})` : "Habis"}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border)] flex-1 flex items-end">
                      <Link href={`/katalog/${b.id}`} className="btn btn-ghost w-full !py-1.5">Detail</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--brand-soft)]/40 border-[var(--brand)]/30">
          <div className="text-sm">
            <span className="font-semibold">Ingin meminjam buku?</span>{" "}
            <span className="text-[var(--muted)]">Masuk atau daftar untuk mengajukan peminjaman.</span>
          </div>
          <div className="flex gap-2">
            <Link href="/login" className="btn btn-ghost">Masuk</Link>
            {bolehDaftar && <Link href="/register" className="btn btn-primary">Daftar</Link>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Cari judul, penulis, ISBN, penerbit…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input lg:w-44" value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
          <option value="Semua">Semua Kategori</option>
          {KATEGORI_LIST.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select className="input lg:w-40" value={filterStok} onChange={(e) => setFilterStok(e.target.value)}>
          <option value="Semua">Semua Status</option>
          <option value="Tersedia">Tersedia</option>
          <option value="Habis">Habis</option>
        </select>
        {bolehKelolaBuku && (
          <button className="btn btn-primary" onClick={bukaTambah}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Tambah Buku
          </button>
        )}
      </div>

      {/* Daftar */}
      {hasil.length === 0 ? (
        <EmptyState pesan="Tidak ada buku yang cocok" sub="Coba ubah kata kunci atau filter." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Penulis</th>
                  <th>Kategori</th>
                  <th>Rak</th>
                  <th>Tersedia</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {hasil.map((b) => {
                  const tersedia = stokTersedia(b.id);
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <SampulBuku buku={b} className="h-12 w-9 shrink-0" tampilkanJudul={false} />
                          <div className="min-w-0">
                            <div className="font-medium">{b.judul}</div>
                            <div className="text-xs text-[var(--muted)]">{b.penerbit} · {b.tahun}</div>
                          </div>
                        </div>
                      </td>
                      <td>{b.penulis}</td>
                      <td><Badge tone="slate">{b.kategori}</Badge></td>
                      <td className="text-[var(--muted)]">{b.rak || "-"}</td>
                      <td>
                        <Badge tone={tersedia > 0 ? "green" : "rose"}>
                          {tersedia} / {b.stok}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <Link
                            href={`/katalog/${b.id}`}
                            className="btn btn-ghost !py-1.5 !px-2.5"
                          >
                            Detail
                          </Link>
                          {bolehKelolaBuku ? (
                            <>
                              <button className="btn btn-ghost !py-1.5 !px-2.5" onClick={() => bukaEdit(b)}>
                                Edit
                              </button>
                              <button className="btn btn-danger !py-1.5 !px-2.5" onClick={() => setHapusTarget(b)}>
                                Hapus
                              </button>
                            </>
                          ) : anggotaIdUser && bolehPinjam ? (
                            <button
                              className="btn btn-primary !py-1.5 !px-2.5"
                              disabled={tersedia <= 0}
                              onClick={() => {
                                setPinjamTarget(b);
                                setTanggalPinjam(new Date().toISOString().slice(0, 10));
                              }}
                            >
                              {tersedia > 0 ? "Pinjam" : "Habis"}
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">
                              {anggotaIdUser ? "Izin meminjam dinonaktifkan" : "Hanya lihat"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form tambah/edit */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editId ? "Edit Buku" : "Tambah Buku"} width="max-w-2xl">
        <form onSubmit={simpan} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Judul *</label>
            <input className="input" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} required />
          </div>
          <div>
            <label className="label">Penulis</label>
            <input className="input" value={form.penulis} onChange={(e) => setForm({ ...form, penulis: e.target.value })} />
          </div>
          <div>
            <label className="label">Penerbit</label>
            <input className="input" value={form.penerbit} onChange={(e) => setForm({ ...form, penerbit: e.target.value })} />
          </div>
          <div>
            <label className="label">Tahun</label>
            <input className="input" type="number" value={form.tahun} onChange={(e) => setForm({ ...form, tahun: e.target.value })} />
          </div>
          <div>
            <label className="label">ISBN</label>
            <input className="input" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
          </div>
          <div>
            <label className="label">Kategori</label>
            <select className="input" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value as Kategori })}>
              {KATEGORI_LIST.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Rak</label>
            <input className="input" placeholder="cth. A-1" value={form.rak} onChange={(e) => setForm({ ...form, rak: e.target.value })} />
          </div>
          <div>
            <label className="label">Jumlah Stok</label>
            <input className="input" type="number" min="0" value={form.stok} onChange={(e) => setForm({ ...form, stok: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Deskripsi</label>
            <textarea className="input" rows={3} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Gambar Sampul (URL)</label>
            <div className="flex items-start gap-3">
              <SampulBuku
                buku={{ judul: form.judul || "Judul buku", penulis: form.penulis, gambar: form.gambar }}
                className="h-24 w-[68px] shrink-0"
                tampilkanJudul={false}
              />
              <div className="flex-1">
                <input
                  className="input"
                  type="url"
                  placeholder="https://…/sampul-buku.jpg"
                  value={form.gambar}
                  onChange={(e) => setForm({ ...form, gambar: e.target.value })}
                />
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  Kosongkan untuk memakai sampul otomatis sesuai judul. Bisa tempel URL gambar dari Open Library (ISBN), dsb.
                </p>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenForm(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">{editId ? "Simpan Perubahan" : "Tambah Buku"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal konfirmasi pinjam + tanggal */}
      <Modal
        open={!!pinjamTarget}
        onClose={() => setPinjamTarget(null)}
        title="Ajukan Peminjaman"
        width="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p>
            Pinjam <span className="font-semibold">{pinjamTarget?.judul}</span> selama {sistem.lamaPinjam} hari?
          </p>
          <div>
            <label className="label">Tanggal Peminjaman</label>
            <input
              className="input"
              type="date"
              value={tanggalPinjam}
              onChange={(e) => setTanggalPinjam(e.target.value)}
            />
          </div>
          {jatuhTempo && (
            <p className="text-xs text-[var(--muted)]">
              Jatuh tempo otomatis: <span className="font-semibold">{tanggalPanjang(jatuhTempo)}</span>
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-ghost" onClick={() => setPinjamTarget(null)}>Batal</button>
            <button className="btn btn-primary" onClick={konfirmasiPinjam}>Ajukan Pinjaman</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!hapusTarget}
        onClose={() => setHapusTarget(null)}
        onConfirm={async () => {
          if (!hapusTarget) return;
          const hasil = await hapusBuku(hapusTarget.id);
          if (hasil.ok) toast.sukses(`Buku "${hapusTarget.judul}" dihapus dari katalog.`);
          else toast.gagal(hasil.pesan);
        }}
        title="Hapus Buku"
        message={`Buku "${hapusTarget?.judul}" akan dihapus permanen dari katalog. Lanjutkan?`}
      />
    </div>
  );
}

// useSearchParams wajib dibungkus Suspense.
export default function KatalogPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--muted)]">Memuat…</div>}>
      <KatalogKonten />
    </Suspense>
  );
}
