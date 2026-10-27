"use client";

import { useMemo, useState } from "react";
import { useAuth, type Peran, type Pengguna } from "@/lib/auth";
import { useLibrary } from "@/lib/library-context";
import { Modal, ConfirmDialog, Badge, EmptyState, tanggalPanjang } from "@/components/ui";
import { useToast } from "@/components/toast";

const KOSONG = { nama: "", email: "", sandi: "", peran: "user" as Peran, anggotaId: "" };

export default function HalamanAkun() {
  const { pengguna, sedangMasuk, buatAkun, resetSandi, hapusAkun } = useAuth();
  const { anggota } = useLibrary();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [openBuat, setOpenBuat] = useState(false);
  const [form, setForm] = useState({ ...KOSONG });
  const [resetTarget, setResetTarget] = useState<Pengguna | null>(null);
  const [sandiBaru, setSandiBaru] = useState("");
  const [hapusTarget, setHapusTarget] = useState<Pengguna | null>(null);

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return pengguna.filter(
      (u) => !kata || u.nama.toLowerCase().includes(kata) || u.email.toLowerCase().includes(kata)
    );
  }, [pengguna, q]);

  // Anggota yang belum punya akun login (untuk dipautkan saat membuat akun).
  const anggotaTanpaAkun = useMemo(
    () => anggota.filter((a) => !pengguna.some((u) => u.anggotaId === a.id)),
    [anggota, pengguna]
  );

  const jumlahAdmin = pengguna.filter((u) => u.peran === "admin").length;

  async function submitBuat(e: React.FormEvent) {
    e.preventDefault();
    const res = await buatAkun({
      nama: form.nama,
      email: form.email,
      sandi: form.sandi,
      peran: form.peran,
      anggotaId: form.peran === "user" && form.anggotaId ? form.anggotaId : undefined,
    });
    if (res.ok) {
      toast.sukses(res.pesan);
      setOpenBuat(false);
      setForm({ ...KOSONG });
    } else {
      toast.gagal(res.pesan);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    const res = await resetSandi(resetTarget.id, sandiBaru);
    if (res.ok) {
      toast.sukses(res.pesan);
      setResetTarget(null);
      setSandiBaru("");
    } else {
      toast.gagal(res.pesan);
    }
  }

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
            placeholder="Cari nama atau email akun…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setOpenBuat(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Buat Akun
        </button>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Akun login tidak dibuat lewat pendaftaran publik untuk peran admin — kelola di sini.{" "}
        {jumlahAdmin} akun admin aktif.
      </p>

      {hasil.length === 0 ? (
        <EmptyState pesan="Tidak ada akun yang cocok" sub="Coba kata kunci lain." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Terhubung</th>
                  <th>Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {hasil.map((u) => {
                  const kartu = u.anggotaId ? anggota.find((a) => a.id === u.anggotaId) : undefined;
                  const sendiri = u.id === sedangMasuk?.id;
                  return (
                    <tr key={u.id} className={sendiri ? "bg-[var(--brand-soft)]/30" : ""}>
                      <td>
                        <div className="font-medium">{u.nama}</div>
                        {sendiri && <div className="text-xs text-[var(--brand)]">Anda</div>}
                      </td>
                      <td className="text-[var(--muted)]">{u.email}</td>
                      <td>
                        <Badge tone={u.peran === "admin" ? "amber" : "sky"}>
                          {u.peran === "admin" ? "Admin" : "Anggota"}
                        </Badge>
                      </td>
                      <td className="text-[var(--muted)] text-xs">
                        {u.peran === "admin" ? "—" : kartu ? kartu.nomorAnggota : "Tanpa kartu"}
                      </td>
                      <td className="text-[var(--muted)] text-xs">{tanggalPanjang(u.dibuatPada)}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="btn btn-ghost !py-1.5 !px-2.5"
                            onClick={() => {
                              setResetTarget(u);
                              setSandiBaru("");
                            }}
                          >
                            Reset Sandi
                          </button>
                          <button
                            className="btn btn-danger !py-1.5 !px-2.5"
                            disabled={sendiri}
                            title={sendiri ? "Tidak bisa menghapus akun sendiri" : undefined}
                            onClick={() => setHapusTarget(u)}
                          >
                            Hapus
                          </button>
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

      {/* Modal buat akun */}
      <Modal open={openBuat} onClose={() => setOpenBuat(false)} title="Buat Akun Baru">
        <form onSubmit={submitBuat} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Nama Lengkap *</label>
            <input
              className="input"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Sandi Awal * (min. 6)</label>
            <input
              className="input"
              type="text"
              value={form.sandi}
              onChange={(e) => setForm({ ...form, sandi: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Peran</label>
            <select
              className="input"
              value={form.peran}
              onChange={(e) => setForm({ ...form, peran: e.target.value as Peran })}
            >
              <option value="user">Anggota</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.peran === "user" && (
            <div className="sm:col-span-2">
              <label className="label">Pautkan ke Kartu Anggota (opsional)</label>
              <select
                className="input"
                value={form.anggotaId}
                onChange={(e) => setForm({ ...form, anggotaId: e.target.value })}
              >
                <option value="">— Tanpa kartu —</option>
                {anggotaTanpaAkun.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nomorAnggota} — {a.nama}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Anggota terdaftar lewat pendaftaran publik sudah otomatis terpaut.
              </p>
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenBuat(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">Buat Akun</button>
          </div>
        </form>
      </Modal>

      {/* Modal reset sandi */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset Sandi — ${resetTarget?.nama ?? ""}`}
        width="max-w-md"
      >
        <form onSubmit={submitReset} className="space-y-4">
          <div>
            <label className="label">Sandi Baru (min. 6 karakter)</label>
            <input
              className="input"
              type="text"
              value={sandiBaru}
              onChange={(e) => setSandiBaru(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">Simpan Sandi Baru</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!hapusTarget}
        onClose={() => setHapusTarget(null)}
        onConfirm={async () => {
          if (!hapusTarget) return;
          const res = await hapusAkun(hapusTarget.id);
          if (res.ok) toast.sukses(res.pesan);
          else toast.gagal(res.pesan);
          setHapusTarget(null);
        }}
        title="Hapus Akun"
        message={`Akun "${hapusTarget?.nama}" (${hapusTarget?.email}) akan dihapus permanen. Kartu anggota (bila ada) tidak ikut terhapus. Lanjutkan?`}
      />
    </div>
  );
}
