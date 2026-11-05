
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_BOOKS_API =
  "https://www.googleapis.com/books/v1/volumes";

const OPEN_LIBRARY_API =
  "https://openlibrary.org/search.json";

type BukuHasil = {
  googleBooksId: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: string;
  isbn: string;
  deskripsi: string;
  bahasa: string;
  kategori: string;
  sampul: string;
  sumber: "Google Books" | "Open Library";
};

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    language?: string;
    categories?: string[];
    industryIdentifiers?: {
      type?: string;
      identifier?: string;
    }[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  isbn?: string[];
  subject?: string[];
  cover_i?: number;
  language?: string[];
};

function ambilISBN(
  identifiers?: GoogleVolume["volumeInfo"] extends infer T
    ? T extends { industryIdentifiers?: infer U }
      ? U
      : never
    : never
): string {
  if (!Array.isArray(identifiers)) return "";

  const isbn13 = identifiers.find(
    (item) => item.type === "ISBN_13"
  );

  const isbn10 = identifiers.find(
    (item) => item.type === "ISBN_10"
  );

  return isbn13?.identifier || isbn10?.identifier || "";
}

function formatGoogleBooks(
  item: GoogleVolume
): BukuHasil | null {
  const info = item.volumeInfo;

  if (!info?.title) return null;

  const gambar =
    info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    "";

  return {
    googleBooksId: item.id || "",
    judul: info.title,
    penulis: info.authors?.join(", ") || "",
    penerbit: info.publisher || "",
    tahun: info.publishedDate?.slice(0, 4) || "",
    isbn: ambilISBN(info.industryIdentifiers),
    deskripsi: info.description || "",
    bahasa: info.language || "",
    kategori: info.categories?.[0] || "",
    sampul: gambar
      ? gambar.replace(/^http:/, "https:")
      : "",
    sumber: "Google Books",
  };
}

function formatOpenLibrary(
  item: OpenLibraryDoc
): BukuHasil | null {
  if (!item.title) return null;

  const isbn13 = item.isbn?.find(
    (isbn) => isbn.length === 13
  );

  const isbn10 = item.isbn?.find(
    (isbn) => isbn.length === 10
  );

  return {
    googleBooksId: item.key || "",
    judul: item.title,
    penulis: item.author_name?.join(", ") || "",
    penerbit: item.publisher?.[0] || "",
    tahun: item.first_publish_year
      ? String(item.first_publish_year)
      : "",
    isbn: isbn13 || isbn10 || "",
    deskripsi: "",
    bahasa: item.language?.[0] || "",
    kategori: item.subject?.[0] || "",
    sampul: item.cover_i
      ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`
      : "",
    sumber: "Open Library",
  };
}

function ambilVolumeId(input: string): string | null {
  try {
    const url = new URL(input);

    if (!url.hostname.toLowerCase().includes("google.")) {
      return null;
    }

    const bagian = url.pathname
      .split("/")
      .filter(Boolean);

    const id = bagian[bagian.length - 1];

    return id && /^[a-zA-Z0-9_-]{10,}$/.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

function kataDariLink(input: string): string {
  try {
    const url = new URL(input);
    const bagian = url.pathname
      .split("/")
      .filter(Boolean);

    const judul = bagian.find((item) =>
      item.toLowerCase().includes("jelajah")
    ) || bagian[bagian.length - 2] || "";

    return decodeURIComponent(judul)
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .trim();
  } catch {
    return input;
  }
}

async function cariGoogleBooks(
  input: string,
  volumeId: string | null
): Promise<BukuHasil[]> {
  let url: string;

  if (volumeId) {
    url = `${GOOGLE_BOOKS_API}/${encodeURIComponent(volumeId)}`;
  } else {
    const query = /^\d{10,13}$/.test(input)
      ? `isbn:${input}`
      : input;

    const params = new URLSearchParams({
      q: query,
      maxResults: "10",
      printType: "books",
      projection: "full",
    });

    url = `${GOOGLE_BOOKS_API}?${params.toString()}`;
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Google Books Error:", {
      status: response.status,
      detail,
    });

    return [];
  }

  const data = await response.json();

  if (volumeId) {
    const buku = formatGoogleBooks(data);
    return buku ? [buku] : [];
  }

  const items: GoogleVolume[] = Array.isArray(data.items)
    ? data.items
    : [];

  return items
    .map(formatGoogleBooks)
    .filter((item): item is BukuHasil => item !== null);
}

async function cariOpenLibrary(
  input: string
): Promise<BukuHasil[]> {
  const params = new URLSearchParams({
    q: /^\d{10,13}$/.test(input)
      ? `isbn:${input}`
      : input,
    limit: "10",
    fields:
      "key,title,author_name,publisher,first_publish_year,isbn,subject,cover_i,language",
  });

  const response = await fetch(
    `${OPEN_LIBRARY_API}?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "PustakaKu/1.0",
      },
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    console.error(
      "Open Library Error:",
      response.status,
      await response.text()
    );

    return [];
  }

  const data = await response.json();

  const items: OpenLibraryDoc[] = Array.isArray(data.docs)
    ? data.docs
    : [];

  return items
    .map(formatOpenLibrary)
    .filter((item): item is BukuHasil => item !== null);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get("q")?.trim();

    if (!input) {
      return NextResponse.json(
        {
          sukses: false,
          pesan: "Masukkan judul, ISBN, atau link Google Books.",
          buku: [],
        },
        { status: 400 }
      );
    }

    if (input.length > 300) {
      return NextResponse.json(
        {
          sukses: false,
          pesan: "Kata pencarian terlalu panjang.",
          buku: [],
        },
        { status: 400 }
      );
    }

    const volumeId = ambilVolumeId(input);

    // Jika input berupa link Google Books,
    // gunakan bagian judul link untuk pencarian alternatif.
    const queryAlternatif = volumeId
      ? kataDariLink(input)
      : input;

    // 1. Coba Google Books terlebih dahulu.
    let buku: BukuHasil[] = [];

    try {
      buku = await cariGoogleBooks(input, volumeId);
    } catch (error) {
      console.error("Google Books tidak dapat diakses:", error);
    }

    // 2. Jika Google gagal atau tidak menemukan hasil,
    // gunakan Open Library.
    if (buku.length === 0) {
      try {
        buku = await cariOpenLibrary(queryAlternatif);
      } catch (error) {
        console.error("Open Library tidak dapat diakses:", error);
      }
    }

    // 3. Kirim hasil pencarian.
    return NextResponse.json({
      sukses: true,
      total: buku.length,
      pesan: buku.length
        ? `Berhasil menemukan ${buku.length} buku.`
        : "Buku tidak ditemukan pada kedua sumber.",
      sumber: buku.length
        ? [...new Set(buku.map((item) => item.sumber))]
        : [],
      buku,
    });
  } catch (error) {
    console.error("Pencarian Buku Error:", error);

    return NextResponse.json(
      {
        sukses: false,
        pesan: "Terjadi kesalahan pada layanan pencarian buku.",
        buku: [],
      },
      { status: 500 }
    );
  }
}
