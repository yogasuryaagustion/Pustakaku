"use client";

// Kumpulan pembungkus animasi bersama (Motion / Framer Motion).
//
// Aturan yang dijaga di sini:
//   * Durasi pendek (≈0,3 dtk) dan easing lembut — animasi tidak boleh
//     memperlambat pekerjaan petugas.
//   * `prefers-reduced-motion` selalu dihormati: bila pengguna mematikannya,
//     elemen langsung tampil tanpa gerak.
//   * Pembungkus tidak menambah gaya layout; kelas pemanggil tetap berlaku.

import { Children, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/** Kurva & durasi bersama untuk seluruh animasi masuk. */
export const TRANSISI_GERAK = {
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1] as const,
};

/** Satu blok masuk: samar + naik sedikit. */
export function Naik({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const kurangi = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={kurangi ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSISI_GERAK, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Beberapa blok masuk berurutan; setiap anak dibungkus satu lapis. */
export function NaikBertahap({
  children,
  className,
  jeda = 0.07,
}: {
  children: ReactNode;
  className?: string;
  jeda?: number;
}) {
  const kurangi = useReducedMotion();

  const induk: Variants = {
    sembunyi: {},
    tampil: { transition: { staggerChildren: kurangi ? 0 : jeda } },
  };
  const anak: Variants = {
    sembunyi: kurangi ? {} : { opacity: 0, y: 16 },
    tampil: { opacity: 1, y: 0, transition: TRANSISI_GERAK },
  };

  return (
    <motion.div
      className={className}
      variants={induk}
      initial="sembunyi"
      animate="tampil"
    >
      {Children.map(children, (isi, i) => (
        <motion.div key={i} variants={anak}>
          {isi}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Panel yang bisa dibuka-tutup dengan lipatan tinggi yang halus. */
export function Lipat({
  tunjuk,
  children,
  className,
}: {
  tunjuk: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {tunjuk && (
        <motion.div
          key="isi"
          className={className}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
