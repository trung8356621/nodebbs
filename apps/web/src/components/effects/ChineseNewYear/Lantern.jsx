"use client";

import { usePbnTranslations } from "@/i18n/useTranslations";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
export const Lantern = ({
  size = 120,
  // default visible size
  delay = 0,
  duration = 4,
  className = "",
  swing = 8 // degrees - reduced for heavier feel
}) => {
  const pbnT = usePbnTranslations();
  return <div className={cn("relative select-none pointer-events-none", className)} style={{
    width: size,
    height: size * 1.6
  }}>
      <motion.div className="w-full h-full origin-top" initial={{
      rotate: -swing
    }} animate={{
      rotate: swing
    }} transition={{
      duration: duration,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      delay: delay
    }} style={{
      transformOrigin: "50% 0px"
    }}>
        <svg viewBox="0 0 200 300" className="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg" style={{
        filter: "drop-shadow(0 10px 20px rgba(185, 28, 28, 0.4))"
      }}>
          <defs>
            {/* Satin Red Gradient for Body */}
            <radialGradient id="lanternBody" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stopColor="#ff4d4d" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>

            {/* Gold Gradient for Caps/Accents */}
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fcd34d" />
              <stop offset="40%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#fffbeb" /> {/* Shine */}
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>

            {/* Inner Glow for Light */}
            <radialGradient id="innerGlow" cx="50%" cy="40%" r="35%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* --- String --- */}
          {/* Main Rope */}
          <line x1="100" y1="-50" x2="100" y2="20" stroke="#b45309" strokeWidth="2" />

          {/* --- Lantern Body Group --- */}
          <g transform="translate(0, 20)">
            
            {/* Top Cap (Gold) */}
            <path d="M70 0 H130 L135 15 H65 Z" fill="url(#goldGradient)" stroke="#b45309" strokeWidth="0.5" />
            {/* Top Decorative Ring */}
             <rect x="92" y="15" width="16" height="4" fill="#b91c1c" />

            {/* Main Body (Red) */}
            <ellipse cx="100" cy="85" rx="80" ry="70" fill="url(#lanternBody)" />
            
            {/* Inner Light Glow */}
            <ellipse cx="100" cy="80" rx="60" ry="50" fill="url(#innerGlow)" />

            {/* Ribs (Vertical Gold Lines) - Curved to follow shape */}
            <path d="M100 15 Q 100 85 100 155" stroke="#7f1d1d" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M60 25 Q 40 85 60 145" stroke="#7f1d1d" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M140 25 Q 160 85 140 145" stroke="#7f1d1d" strokeWidth="1" fill="none" opacity="0.3" />

            {/* Gold Diamond Container for Character */}
            <rect x="72" y="57" width="56" height="56" transform="rotate(45 100 85)" fill="#991b1b" stroke="url(#goldGradient)" strokeWidth="2" />

            {/* Character: 福 (Fu) - Prosperity - SVG Path */}
            {/* Character: 福 (Fu) - Prosperity - Text for better alignment */}
            <text x="100" y="85" textAnchor="middle" dominantBaseline="central" fontSize="40" fill="#fbbf24" fontWeight="bold" style={{
            fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", "SimKai", "Serif", serif'
          }}>{pbnT("m1497")}</text>
            
            {/* Optional inverted "Fu" (Dao Fu) for extra luck */}
            {/* transform="rotate(180 100 85)" */}

            {/* Bottom Cap (Gold) */}
            <path d="M75 155 H125 L120 165 H80 Z" fill="url(#goldGradient)" stroke="#b45309" strokeWidth="0.5" />

            {/* Tassel Knot (Red) */}
            <circle cx="100" cy="170" r="6" fill="#b91c1c" />

            {/* Tassel Threads */}
            {/* Center Thick Gold Thread */}
            <line x1="100" y1="170" x2="100" y2="240" stroke="url(#goldGradient)" strokeWidth="3" />
            
            {/* Side Red Threads - Flowing */}
            <path d="M100 170 Q 90 200 85 230" stroke="#dc2626" strokeWidth="2" fill="none" />
            <path d="M100 170 Q 110 200 115 230" stroke="#dc2626" strokeWidth="2" fill="none" />
            <path d="M100 170 Q 95 200 92 235" stroke="#ef4444" strokeWidth="1" fill="none" />
            <path d="M100 170 Q 105 200 108 235" stroke="#ef4444" strokeWidth="1" fill="none" />

          </g>
        </svg>
      </motion.div>
    </div>;
};
