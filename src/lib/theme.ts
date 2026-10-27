// Sistem tema situs — WARNA DASAR + GRADIEN.
//
// Admin mengatur tema di /admin/pengaturan. Form disimpan (beserta map CSS
// variable hasil generate) di localStorage — konsisten dengan data demo
// lain yang juga lokal. Saat halaman dibuka, script inline di layout
// (INIT_SCRIPT) menanam variable ke :root SEBELUM paint pertama (tanpa FOUC),
// dan applyVars() dipakai untuk pratinjau langsung saat admin menggeser warna.
//
// PENTING: nilai default di TEMA_DEFAULT harus sinkron dengan blok `:root`
// di src/app/globals.css (dipakai sebagai fallback bila script belum/jalan).

export type NetralTema = {
  /** Latar halaman (body). */
  background: string;
  /** Teks utama. */
  foreground: string;
  /** Permukaan kartu/kotak. */
  card: string;
  /** Teks sekunder/label. */
  muted: string;
  /** Garis pemisah & border. */
  border: string;
};

export type TemaForm = {
  /** Warna dasar/utama situs (brand). */
  brand: string;
  /** Jangkar gradien kartu, sampul buku, ikon fitur, avatar (3 stop). */
  aksen: [string, string, string];
  /** Jangkar gradien latar section landing (hero/koleksi/testimoni). */
  latar: [string, string, string];
  /** Jangkar gradien CTA penutup & panel branding masuk/daftar. */
  cta: [string, string, string];
  /** Warna dasar netral halaman (latar, teks, kartu, muted, border). */
  netral: NetralTema;
};

export const KEY_TEMA = "siperpu-tema";

// ---------------------------------------------------------------------------
// Util warna (hex ↔ hsl) — cukup untuk kebutuhan derivasi tema.
// ---------------------------------------------------------------------------

function hexKeRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexKeHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexKeRgb(hex);
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslKeHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const dua = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${dua(r)}${dua(g)}${dua(b)}`;
}

export function hexValid(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

// ---------------------------------------------------------------------------
// Default tema — warna yang berlaku sebelum admin mengubah apa pun.
// (Sinkron dengan :root di globals.css.)
// ---------------------------------------------------------------------------

export const TEMA_DEFAULT: TemaForm = {
  brand: "#0f766e",
  aksen: ["#5eead4", "#14b8a6", "#059669"],
  latar: ["#f0fdfa", "#ffffff", "#ecfeff"],
  cta: ["#0f766e", "#14b8a6", "#38bdf8"],
  netral: {
    background: "#f6f7f9",
    foreground: "#1a2233",
    card: "#ffffff",
    muted: "#64748b",
    border: "#e2e8f0",
  },
};

// Palet preset — mengganti warna dasar SEKALIGUS menurunkan seluruh gradien
// secara harmonis (satu keluarga analog di sekitar warna dasar).
export const PRESET: { nama: string; brand: string }[] = [
  { nama: "Teal (baku)", brand: "#0f766e" },
  { nama: "Biru", brand: "#2563eb" },
  { nama: "Hijau", brand: "#15803d" },
  { nama: "Ungu", brand: "#7c3aed" },
  { nama: "Jingga", brand: "#ea580c" },
];

// ---------------------------------------------------------------------------
// Derivasi dari warna dasar: turunan brand + seluruh jangkar gradien.
// ---------------------------------------------------------------------------

/** Turunan langsung warna dasar (selalu ikut berubah mengikuti brand). */
export function turunanBrand(brand: string) {
  const { h, s, l } = hexKeHsl(brand);
  return {
    soft: hslKeHex(h, s, 90),
    hover: hslKeHex(h, s, Math.max(12, l * 0.7)),
    light: hslKeHex(h, s * 0.95, Math.min(70, Math.max(45, l + 20))),
    teksMid: hslKeHex(h + 2, s, 42),
    teksEnd: hslKeHex(h + 14, Math.min(95, s + 10), 46),
  };
}

/**
 * Susun tema utuh dari satu warna dasar: jangkar gradien kartu/latar/CTA
 * dibuat tetap satu keluarga analog (pergeseran hue kecil + variasi
 * lightness), sehingga hasilnya selalu serasi — bukan warna acak.
 */
export function deriveTema(brand: string, netral: NetralTema = TEMA_DEFAULT.netral): TemaForm {
  const { h, s, l } = hexKeHsl(brand);
  return {
    brand,
    netral,
    aksen: [
      hslKeHex(h - 4, s * 0.9, 68),
      hslKeHex(h - 1, s, Math.min(50, Math.max(35, l))),
      hslKeHex(h - 15, Math.min(95, s + 8), 30),
    ],
    latar: [
      hslKeHex(h - 5, Math.min(70, s), 97),
      "#ffffff",
      hslKeHex(h + 12, Math.min(65, s), 95),
    ],
    cta: [
      brand,
      hslKeHex(h, Math.min(95, s + 5), 44),
      hslKeHex(h + 22, Math.min(95, s + 10), 60),
    ],
  };
}

// Pergeseran hue/lightness untuk 6 variasi gradien kartu. Dibatasi ≤ ~30°
// agar seluruh variasi tetap satu keluarga analog (tidak pernah tabrakan).
const ROTASI = [0, 16, 30, 8, -12, 22];
const CERAH = [0, -4, -8, 6, 4, -6];

function varianStop(hex: string, i: number): string {
  const { h, s, l } = hexKeHsl(hex);
  return hslKeHex(h + ROTASI[i], Math.min(100, s), Math.min(96, Math.max(8, l + CERAH[i])));
}

// ---------------------------------------------------------------------------
// Pembangun CSS variable
// ---------------------------------------------------------------------------

/**
 * Generate seluruh CSS variable dari form tema:
 * - warna dasar: --brand, --brand-soft, --brand-hover, --brand-light, teks
 * - jangkar: --latar-1..3, --cta-1..3 (dipakai util gradien di globals.css)
 * - --g1..--g6: gradien kartu/sampul utuh (6 variasi halus dari jangkar aksen)
 */
export function bangunVars(f: TemaForm): Record<string, string> {
  const tur = turunanBrand(f.brand);
  const vars: Record<string, string> = {
    "--background": f.netral.background,
    "--foreground": f.netral.foreground,
    "--card": f.netral.card,
    "--muted": f.netral.muted,
    "--border": f.netral.border,
    "--brand": f.brand,
    "--brand-soft": tur.soft,
    "--brand-hover": tur.hover,
    "--brand-light": tur.light,
    "--teks-mid": tur.teksMid,
    "--teks-end": tur.teksEnd,
    "--latar-1": f.latar[0],
    "--latar-2": f.latar[1],
    "--latar-3": f.latar[2],
    "--cta-1": f.cta[0],
    "--cta-2": f.cta[1],
    "--cta-3": f.cta[2],
  };
  for (let i = 0; i < 6; i++) {
    const [a, b, c] = f.aksen;
    vars[`--g${i + 1}`] =
      `linear-gradient(to bottom right, ${varianStop(a, i)}, ${varianStop(b, i)}, ${varianStop(c, i)})`;
  }
  return vars;
}

/** Tanam map variable ke :root (aman dipanggil di server: no-op). */
export function applyVars(vars: Record<string, string>): void {
  if (typeof document === "undefined") return;
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v);
  }
}

// ---------------------------------------------------------------------------
// Persistensi (localStorage)
// ---------------------------------------------------------------------------

type SimpananTema = { form: TemaForm; vars: Record<string, string> };

function valid(f: unknown): f is TemaForm {
  if (!f || typeof f !== "object") return false;
  const t = f as TemaForm;
  const trio = (x?: unknown) =>
    Array.isArray(x) && x.length === 3 && x.every(hexValid);
  return hexValid(t.brand) && trio(t.aksen) && trio(t.latar) && trio(t.cta);
}

/** Isi bagian netral yang belum ada/invalid (tema tersimpan lama) dengan default. */
function normalisasiNetral(n?: Partial<NetralTema>): NetralTema {
  const d = TEMA_DEFAULT.netral;
  const ambil = (v: unknown, def: string) => (hexValid(v) ? v : def);
  return {
    background: ambil(n?.background, d.background),
    foreground: ambil(n?.foreground, d.foreground),
    card: ambil(n?.card, d.card),
    muted: ambil(n?.muted, d.muted),
    border: ambil(n?.border, d.border),
  };
}

/** Sahkan objek tema dari luar (mis. file impor); null bila tidak valid. */
export function sahkanTema(f: unknown): TemaForm | null {
  if (!valid(f)) return null;
  return {
    brand: f.brand,
    aksen: f.aksen,
    latar: f.latar,
    cta: f.cta,
    netral: normalisasiNetral(f.netral),
  };
}

/** Baca form tema tersimpan; kembali ke default bila belum ada/corrupt. */
export function bacaTema(): TemaForm {
  if (typeof window === "undefined") return TEMA_DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY_TEMA);
    if (!raw) return TEMA_DEFAULT;
    const s = JSON.parse(raw) as SimpananTema;
    if (!valid(s?.form)) return TEMA_DEFAULT;
    // Tema yang disimpan sebelum field netral ada tetap sah → lengkapi default.
    return { ...s.form, netral: normalisasiNetral(s.form.netral) };
  } catch {
    return TEMA_DEFAULT;
  }
}

/** Simpan form + variable hasil generate, lalu tanam ke :root. */
export function simpanTema(f: TemaForm): Record<string, string> {
  const vars = bangunVars(f);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY_TEMA, JSON.stringify({ form: f, vars } satisfies SimpananTema));
  }
  applyVars(vars);
  return vars;
}

// ---------------------------------------------------------------------------
// Script init anti-FOUC — diekspor sebagai string dan dipasang sebagai
// <script dangerouslySetInnerHTML> pertama di dalam <body> pada layout.
// ISI HARUS SINKRON dengan KEY_TEMA + format SimpananTema di atas.
// ---------------------------------------------------------------------------

export const INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${KEY_TEMA}")||"null");if(!s||!s.vars)return;var v=s.vars;for(var k in v){if(k.indexOf("--")===0){document.documentElement.style.setProperty(k,String(v[k]));}}}catch(e){}})();`;
