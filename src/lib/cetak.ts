"use client";

// Cetak PDF tanpa dependensi: menyusun dokumen HTML bergaya A4 ke dalam
// iframe tersembunyi lalu memanggil dialog print browser — pengguna memilih
// "Simpan sebagai PDF" untuk menghasilkan berkas PDF.

export function eskapHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GAYA_CETAK = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; font-size: 12px; margin: 0; }
h1 { font-size: 17px; margin: 0 0 2px; }
h2 { font-size: 13px; margin: 16px 0 6px; }
.meta { color: #475569; font-size: 11px; margin-bottom: 12px; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #f1f5f9; font-weight: 600; }
tr { page-break-inside: avoid; }
table.ringkas td:first-child { font-weight: 600; background: #f8fafc; width: 45%; }
.kaki { margin-top: 14px; padding-top: 6px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 10px; }
`;

/**
 * Cetak isi HTML (sudah memakai elemen sederhana: h1/h2/table) lewat dialog
 * print browser — pilih "Simpan sebagai PDF" untuk menyimpan sebagai PDF.
 */
export function cetakHTML(bodyHtml: string, judul: string) {
  if (typeof window === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Posisikan di luar layar (bukan display:none) agar kontennya tetap dirender.
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html lang="id"><head><meta charSet="utf-8"/>` +
      `<title>${eskapHTML(judul)}</title><style>${GAYA_CETAK}</style></head>` +
      `<body>${bodyHtml}</body></html>`
  );
  doc.close();

  // Beri jarak sebentar agar layout selesai dirender sebelum dialog print.
  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Bersihkan iframe setelah dialog print tertutup.
    window.setTimeout(() => iframe.remove(), 1000);
  }, 250);
}
