"use client";

import React, { useId } from "react";

interface CanteenLogoProps {
  className?: string;
  size?: number;
}

export function CanteenLogo({ className = "h-10 w-10", size = 40 }: CanteenLogoProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bgGradId = `hc-bg-${reactId}`;
  const accentGradId = `hc-accent-${reactId}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="Hostel Canteen Logo"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={accentGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Solid Fallback Base + Gradient Layer */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#2563EB" />
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${bgGradId})`} />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="15.5"
        fill="none"
        stroke="#93C5FD"
        strokeWidth="1.5"
        strokeOpacity="0.8"
      />

      {/* Canteen Store Canopy */}
      <path d="M15 23 L49 23 L46 16 L18 16 Z" fill="#FFFFFF" opacity="0.95" />
      <path
        d="M15 23 C15 26.5 19 26.5 19 23 C19 26.5 24 26.5 24 23 C24 26.5 29 26.5 29 23 C29 26.5 35 26.5 35 23 C35 26.5 40 26.5 40 23 C40 26.5 45 26.5 45 23 C45 26.5 49 26.5 49 23"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Hot Snack Steam (Warm Gold) */}
      <path
        d="M26 31 C26 27 28 26 28 23"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M32 30 C32 26 34 25 34 21"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M38 31 C38 27 40 26 40 23"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Meal / Snack Bowl Base */}
      <path d="M18 35 C18 46 46 46 46 35 Z" fill="#FFFFFF" />

      {/* Stand Base */}
      <rect x="25" y="47" width="14" height="3" rx="1.5" fill="#BFDBFE" />
    </svg>
  );
}
