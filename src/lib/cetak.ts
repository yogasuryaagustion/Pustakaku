"use client";

export function eskapHTML(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GAYA_CETAK = `
@page {
  size: A4;
  margin: 14mm;
}

* {
  box-sizing: border-box;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  color: #172b35;
  font-size: 11px;
  margin: 0;
}

h1 {
  font-size: 18px;
  margin: 0 0 12px;
  color: #005f56;
}

h2 {
  font-size: 13px;
  margin: 18px 0 7px;
  color: #005f56;
  page-break-after: avoid;
}

.meta {
  color: #64748b;
  font-size: 10px;
  margin-bottom: 12px;
  line-height: 1.6;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9px;
  margin-bottom: 12px;
}

th,
td {
  border: 1px solid #d8e2e5;
  padding: 5px 6px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

th {
  background: #eaf5f2;
  color: #164e46;
  font-weight: 700;
}

tr {
  page-break-inside: avoid;
}

thead {
  display: table-header-group;
}

tfoot {
  display: table-footer-group;
}

table.ringkas {
  font-size: 10px;
}

table.ringkas td:first-child {
  font-weight: 700;
  background: #f4f8f7;
  width: 42%;
}

.kaki {
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid #d8e2e5;
  color: #64748b;
  font-size: 9px;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

// `gayaTambahan` dimuat setelah gaya dasar: dokumen dengan tata letak sendiri
// (mis. lembar label A4) bisa menimpa ukuran @page dan gaya dasar tanpa
// menggandakan seluruh aturan cetak.
export function cetakHTML(bodyHtml: string, judul: string, gayaTambahan = "") {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");

  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Pratinjau dokumen cetak");

  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:794px",
    "height:1123px",
    "border:0",
  ].join(";");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  const win = iframe.contentWindow;

  if (!doc || !win) {
    iframe.remove();
    return;
  }

  let sudahDibersihkan = false;

  const bersihkan = () => {
    if (sudahDibersihkan) return;

    sudahDibersihkan = true;
    iframe.remove();
  };

  win.addEventListener("afterprint", bersihkan, { once: true });

  try {
    doc.open();

    doc.write(
      `<!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          <title>${eskapHTML(judul)}</title>
          <style>${GAYA_CETAK}</style>
          ${gayaTambahan ? `<style>${gayaTambahan}</style>` : ""}
        </head>
        <body>${bodyHtml}</body>
      </html>`
    );

    doc.close();

    window.setTimeout(() => {
      if (sudahDibersihkan) return;

      try {
        win.focus();
        win.print();
      } catch (error) {
        console.error("Gagal membuka dialog cetak:", error);
        bersihkan();
      }
    }, 500);

    // Pengaman jika event afterprint tidak dijalankan browser.
    window.setTimeout(bersihkan, 60000);
  } catch (error) {
    console.error("Gagal menyiapkan dokumen cetak:", error);
    bersihkan();
  }
}