// Penulis berkas .xlsx TANPA dependensi pihak ketiga.
// Cara kerja: menyusun ZIP "stored" (tanpa kompresi) berisi berkas-berkas
// Office Open XML — cukup untuk laporan tabel agar dibuka normal di Excel,
// LibreOffice, dan Google Sheets. Baris = array sel (string/angka).

export type SelXlsx = string | number;

export interface LembarXlsx {
  /** Nama sheet — maks 31 karakter, tanpa karakter terlarang Excel. */
  nama: string;
  baris: SelXlsx[][];
}

const teks = new TextEncoder();

// === CRC32 (lookup table) — diperlukan struktur ZIP. =======================
const TABEL_CRC: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABEL_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// === ZIP stored (tanpa kompresi) ============================================
function stampDOS(d: Date): { waktu: number; tanggal: number } {
  const waktu = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const tanggal = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { waktu, tanggal };
}

function tulisZip(entri: { nama: string; isi: Uint8Array }[]): Uint8Array {
  const { waktu, tanggal } = stampDOS(new Date());
  const potongan: Uint8Array[] = [];
  const headerPusat: Uint8Array[] = [];
  let offset = 0;

  for (const e of entri) {
    const nama = teks.encode(e.nama);
    const crc = crc32(e.isi);

    // Local file header (PK\x03\x04) + nama + data.
    const lokal = new Uint8Array(30 + nama.length);
    const lv = new DataView(lokal.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // versi minimum (2.0)
    lv.setUint16(6, 0, true); // flag
    lv.setUint16(8, 0, true); // metode: 0 = stored
    lv.setUint16(10, waktu, true);
    lv.setUint16(12, tanggal, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, e.isi.length, true);
    lv.setUint32(22, e.isi.length, true);
    lv.setUint16(26, nama.length, true);
    lv.setUint16(28, 0, true); // panjang extra
    lokal.set(nama, 30);
    potongan.push(lokal, e.isi);

    // Central directory header (PK\x01\x02).
    const pusat = new Uint8Array(46 + nama.length);
    const pv = new DataView(pusat.buffer);
    pv.setUint32(0, 0x02014b50, true);
    pv.setUint16(4, 20, true); // versi dibuat
    pv.setUint16(6, 20, true); // versi minimum
    pv.setUint16(8, 0, true); // flag
    pv.setUint16(10, 0, true); // metode
    pv.setUint16(12, waktu, true);
    pv.setUint16(14, tanggal, true);
    pv.setUint32(16, crc, true);
    pv.setUint32(20, e.isi.length, true);
    pv.setUint32(24, e.isi.length, true);
    pv.setUint16(28, nama.length, true);
    pv.setUint16(30, 0, true); // extra
    pv.setUint16(32, 0, true); // komentar
    pv.setUint16(34, 0, true); // disk
    pv.setUint16(36, 0, true); // atribut internal
    pv.setUint32(38, 0, true); // atribut eksternal
    pv.setUint32(42, offset, true); // offset header lokal
    pusat.set(nama, 46);
    headerPusat.push(pusat);

    offset += lokal.length + e.isi.length;
  }

  const totalPusat = headerPusat.reduce((s, p) => s + p.length, 0);

  // End of central directory (PK\x05\x06).
  const akhir = new Uint8Array(22);
  const av = new DataView(akhir.buffer);
  av.setUint32(0, 0x06054b50, true);
  av.setUint16(8, entri.length, true);
  av.setUint16(10, entri.length, true);
  av.setUint32(12, totalPusat, true);
  av.setUint32(16, offset, true);
  av.setUint16(20, 0, true); // panjang komentar

  const hasil = new Uint8Array(offset + totalPusat + 22);
  let pos = 0;
  for (const p of [...potongan, ...headerPusat, akhir]) {
    hasil.set(p, pos);
    pos += p.length;
  }
  return hasil;
}

// === SpreadsheetML ==========================================================
function eskapXML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Huruf kolom Excel dari indeks 0-based: 0 → A, 25 → Z, 26 → AA. */
function kolomHuruf(indeks: number): string {
  let s = "";
  let i = indeks + 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function lembarXml(baris: SelXlsx[][]): string {
  const isi = baris
    .map((sel, ri) => {
      const selXml = sel
        .map((v, ci) => {
          const ref = kolomHuruf(ci) + (ri + 1);
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
          const t = String(v ?? "");
          if (!t) return "";
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${eskapXML(t)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${selXml}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${isi}</sheetData></worksheet>`
  );
}

/** Nama sheet aman: maks 31 karakter, tanpa karakter terlarang Excel. */
function namaSheetAman(nama: string, nomor: number): string {
  const bersih = nama.replace(/[*?:/\\[\]]/g, "-").trim().slice(0, 31);
  return bersih || `Sheet${nomor}`;
}

/** Susun berkas .xlsx (bytes) dari beberapa sheet. */
export function buatXlsx(lembar: LembarXlsx[]): Uint8Array {
  const daftar = lembar.map((l, i) => ({
    nama: namaSheetAman(l.nama, i + 1),
    baris: l.baris,
  }));

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    daftar
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    daftar
      .map(
        (l, i) =>
          `<sheet name="${eskapXML(l.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join("") +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    daftar
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join("") +
    `</Relationships>`;

  const entri: { nama: string; isi: Uint8Array }[] = [
    { nama: "[Content_Types].xml", isi: teks.encode(contentTypes) },
    { nama: "_rels/.rels", isi: teks.encode(rels) },
    { nama: "xl/workbook.xml", isi: teks.encode(workbook) },
    { nama: "xl/_rels/workbook.xml.rels", isi: teks.encode(workbookRels) },
    ...daftar.map((l, i) => ({
      nama: `xl/worksheets/sheet${i + 1}.xml`,
      isi: teks.encode(lembarXml(l.baris)),
    })),
  ];

  return tulisZip(entri);
}

/** Unduh lembar kerja sebagai berkas .xlsx. */
export function unduhXlsx(namaFile: string, lembar: LembarXlsx[]) {
  const bytes = buatXlsx(lembar);
  // bytes selalu Uint8Array atas ArrayBuffer biasa (hasil new Uint8Array).
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile.endsWith(".xlsx") ? namaFile : `${namaFile}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
