import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIPERPU — Sistem Perpustakaan",
  description:
    "Sistem informasi perpustakaan: katalog buku, sirkulasi peminjaman, data anggota, dan laporan.",
};

// Keterlambatan/denda dihitung relatif waktu sekarang, sehingga halaman
// harus dirender tiap permintaan, bukan di-prerender statis.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: script INIT_SCRIPT menanam CSS variable ke
    // <html> sebelum React hydration — ini disengaja, bukan bug.
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        {/* Tanam tema tersimpan (warna dasar + gradien) sebelum paint pertama. */}
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
