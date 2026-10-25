"use client";

import React from "react";

interface CanteenLogoProps {
  className?: string;
  size?: number;
}

export function CanteenLogo({ className = "h-10 w-10", size = 40 }: CanteenLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="Hostel Canteen Logo"
    >
      <defs>
        <linearGradient id="hc-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="hc-logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Squircle Base */}
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#hc-logo-bg)" />
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="15"
        fill="none"
        stroke="#60A5FA"
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />

      {/* Canteen Store Canopy */}
      <path d="M15 24 L49 24 L46 17 L18 17 Z" fill="#FFFFFF" opacity="0.95" />
      <path
        d="M15 24 C15 27 19 27 19 24 C19 27 24 27 24 24 C24 27 29 27 29 24 C29 27 35 27 35 24 C35 27 40 27 40 24 C40 27 45 27 45 24 C45 27 49 27 49 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Hot Snack Steam */}
      <path
        d="M26 30 C26 26 28 25 28 22"
        fill="none"
        stroke="url(#hc-logo-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M32 29 C32 25 34 24 34 20"
        fill="none"
        stroke="url(#hc-logo-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M38 30 C38 26 40 25 40 22"
        fill="none"
        stroke="url(#hc-logo-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Meal / Snack Bowl Base */}
      <path d="M18 34 C18 45 46 45 46 34 Z" fill="#FFFFFF" />
      {/* Stand */}
      <rect x="25" y="46" width="14" height="3" rx="1.5" fill="#BFDBFE" />
    </svg>
  );
}
