"use client";

import { useMemo, useState } from "react";
import { useLibrary, useHelper, hariTerlambat } from "@/lib/library-context";
import { useBoleh } from "@/lib/auth";
import type { Anggota } from "@/lib/types";
import { Modal, ConfirmDialog, Badge, EmptyState, tanggalPanjang, BadgeTone } from "@/components/ui";
import { useToast } from "@/components/toast";

const KOSONG = {
  nama: "",
  email: "",
  telepon: "",
  alamat: "",
  jenis: "Umum" as Anggota["jenis"],
  aktif: true,
};

export default function AnggotaPage() {
  const { anggota, siap, tambahAnggota, ubahAnggota, hapusAnggota } = useLibrary();
  const toast = useToast();
  const { pinjamanAnggota } = useHelper();
  // Kelola data anggota butuh izin anggota.kelola (kebijakan di Kontrol Akses).
  const bolehKelola = useBoleh("anggota.kelola");

  const [q, setQ] = useState("");
  const [filterJenis, setFilterJenis] = useState("Semua");
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...KOSONG });
  const [hapusTarget, setHapusTarget] = useState<Anggota | null>(null);
  const [riwayat, setRiwayat] = useState<Anggota | null>(null);

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return anggota.filter((a) => {
      const cocokKata =
        !kata ||
        a.nama.toLowerCase().includes(kata) ||
        a.nomorAnggota.toLowerCase().includes(kata) ||
        a.email.toLowerCase().includes(kata);
      const cocokJenis = filterJenis === "Semua" || a.jenis === filterJenis;
      return cocokKata && cocokJenis;
    });
  }, [anggota, q, filterJenis]);

  function bukaTambah() {
    setEditId(null);
    setForm({ ...KOSONG });
    setOpenForm(true);
  }
  function bukaEdit(a: Anggota) {
    setEditId(a.id);
    setForm({ nama: a.nama, email: a.email, telepon: a.telepon, alamat: a.alamat, jenis: a.jenis, aktif: a.aktif });
    setOpenForm(true);
  }
  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      nama: form.nama.trim(),
      email: form.email.trim(),
      telepon: form.telepon.trim(),
      alamat: form.alamat.trim(),
      jenis: form.jenis,
      aktif: form.aktif,
    };
    if (!data.nama) return;
    const hasil = editId ? await ubahAnggota(editId, data) : await tambahAnggota(data);
    if (!hasil.ok) {
      toast.gagal(hasil.pesan);
      return;
    }
    toast.sukses(
      editId ? `Data anggota "${data.nama}" diperbarui.` : `Anggota "${data.nama}" ditambahkan.`
    );
    setOpenForm(false);
  }

  if (!siap) return <div className="p-6 text-[var(--muted)]">Memuat data…</div>;

  return (
    <div className="space-y-4">
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
            placeholder="Cari nama, nomor anggota, atau email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input lg:w-44" value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}>
          <option value="Semua">Semua Jenis</option>
          <option value="Pelajar">Pelajar</option>
          <option value="Umum">Umum</option>
          <option value="Staf">Staf</option>
        </select>
        {bolehKelola && (
          <button className="btn btn-primary" onClick={bukaTambah}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Tambah Anggota
          </button>
        )}
      </div>

      {hasil.length === 0 ? (
        <EmptyState pesan="Tidak ada anggota yang cocok" sub="Coba ubah kata kunci atau filter." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>No. Anggota</th>
                  <th>Nama</th>
                  <th>Kontak</th>
                  <th>Jenis</th>
                  <th>Dipinjam</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {hasil.map((a) => {
                  const pinjamAktif = pinjamanAnggota(a.id).filter((p) => p.status === "Dipinjam").length;
                  return (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.nomorAnggota}</td>
                      <td className="font-medium">{a.nama}</td>
                      <td className="text-[var(--muted)]">
                        <div>{a.email}</div>
                        <div className="text-xs">{a.telepon}</div>
                      </td>
                      <td><Badge tone="slate">{a.jenis}</Badge></td>
                      <td>
                        {pinjamAktif > 0 ? <Badge tone="sky">{pinjamAktif} aktif</Badge> : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td>
                        {bolehKelola ? (
                          <button
                            onClick={async () => {
                              const hasil = await ubahAnggota(a.id, { aktif: !a.aktif });
                              if (hasil.ok)
                                toast.sukses(`Status "${a.nama}" → ${a.aktif ? "Nonaktif" : "Aktif"}.`);
                              else toast.gagal(hasil.pesan);
                            }}
                            title="Klik untuk mengubah status"
                          >
                            <Badge tone={a.aktif ? "green" : "rose"}>{a.aktif ? "Aktif" : "Nonaktif"}</Badge>
                          </button>
                        ) : (
                          <Badge tone={a.aktif ? "green" : "rose"}>{a.aktif ? "Aktif" : "Nonaktif"}</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button className="btn btn-ghost !py-1.5 !px-2.5" onClick={() => setRiwayat(a)}>
                            Riwayat
                          </button>
                          {bolehKelola && (
                            <>
                              <button className="btn btn-ghost !py-1.5 !px-2.5" onClick={() => bukaEdit(a)}>
                                Edit
                              </button>
                              <button className="btn btn-danger !py-1.5 !px-2.5" onClick={() => setHapusTarget(a)}>
                                Hapus
                              </button>
                            </>
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

      {/* Form */}
      <Modal open={openForm} onClose={() => setOpenForm(false)} title={editId ? "Edit Anggota" : "Tambah Anggota"}>
        <form onSubmit={simpan} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Nama Lengkap *</label>
            <input className="input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Telepon</label>
            <input className="input" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
          </div>
          <div>
            <label className="label">Jenis</label>
            <select className="input" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value as Anggota["jenis"] })}>
              <option value="Pelajar">Pelajar</option>
              <option value="Umum">Umum</option>
              <option value="Staf">Staf</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.aktif ? "aktif" : "nonaktif"}
              onChange={(e) => setForm({ ...form, aktif: e.target.value === "aktif" })}
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Alamat</label>
            <textarea className="input" rows={2} value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenForm(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">{editId ? "Simpan" : "Tambah"}</button>
          </div>
        </form>
      </Modal>

      {/* Riwayat */}
      <Modal open={!!riwayat} onClose={() => setRiwayat(null)} title={`Riwayat — ${riwayat?.nama ?? ""}`} width="max-w-2xl">
        {riwayat && <RiwayatAnggota anggotaId={riwayat.id} />}
      </Modal>

      <ConfirmDialog
        open={!!hapusTarget}
        onClose={() => setHapusTarget(null)}
        onConfirm={async () => {
          if (!hapusTarget) return;
          const hasil = await hapusAnggota(hapusTarget.id);
          if (hasil.ok) toast.sukses(`Anggota "${hapusTarget.nama}" dihapus.`);
          else toast.gagal(hasil.pesan);
        }}
        title="Hapus Anggota"
        message={`Anggota "${hapusTarget?.nama}" (${hapusTarget?.nomorAnggota}) akan dihapus permanen. Lanjutkan?`}
      />
    </div>
  );
}

function RiwayatAnggota({ anggotaId }: { anggotaId: string }) {
  const { cariBuku } = useHelper();
  const { peminjaman } = useLibrary();
  const daftar = useMemo(
    () => peminjaman.filter((p) => p.anggotaId === anggotaId),
    [peminjaman, anggotaId]
  );

  if (daftar.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Belum ada peminjaman untuk anggota ini.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Buku</th>
            <th>Jatuh Tempo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((p) => {
            const telat = hariTerlambat(p.tanggalKembali);
            const tone: BadgeTone =
              p.status === "Dikembalikan" ? "green" : telat > 0 || p.status === "Terlambat" ? "rose" : "sky";
            const label =
              p.status === "Dikembalikan" ? "Dikembalikan" : telat > 0 ? `Terlambat ${telat} hr` : "Dipinjam";
            return (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.kodePinjam}</td>
                <td className="font-medium">{cariBuku(p.bukuId)?.judul ?? "-"}</td>
                <td className="text-[var(--muted)]">{tanggalPanjang(p.tanggalKembali)}</td>
                <td><Badge tone={tone}>{label}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
