// Helper fetch ke API Worker (/api/*) — semua data aplikasi lewat sini.
// Respons gagal non-2xx melempar ApiError berisi pesan server supaya halaman
// bisa menampilkan toast yang sama seperti alur localStorage lama.

export class ApiError extends Error {
  status: number;
  constructor(status: number, pesan: string) {
    super(pesan);
    this.status = status;
    this.name = "ApiError";
  }
}

interface Opsi {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function apiFetch<T = unknown>(path: string, opsi: Opsi = {}): Promise<T> {
  const { method = "GET", body } = opsi;
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const tipe = res.headers.get("content-type") ?? "";
  let data: unknown = null;
  if (tipe.includes("application/json")) {
    data = await res.json().catch(() => null);
  }
  if (!res.ok) {
    const pesan =
      data && typeof data === "object" && typeof (data as { pesan?: unknown }).pesan === "string"
        ? ((data as { pesan: string }).pesan)
        : `Permintaan gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, pesan);
  }
  return data as T;
}
