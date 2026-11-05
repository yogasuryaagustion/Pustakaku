
"use client";

import { PanelLeftClose as PanelLeftCloseIcon } from "lucide-react";
import { motion } from "motion/react";

interface PanelLeftCloseProps {
  size?: number;
  className?: string;
}

export function PanelLeftClose({
  size = 21,
  className,
}: PanelLeftCloseProps) {
  return (
    <motion.div
      initial={false}
      animate={{ rotate: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      <PanelLeftCloseIcon size={size} />
    </motion.div>
  );
}
