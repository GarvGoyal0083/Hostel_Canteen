"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Liquid Glass Cursor Effect
 * 
 * Recreates the viral 3D liquid glass refraction lens & floating chromatic orb cursor:
 * - Fluid spring inertia & physics momentum
 * - Dynamic velocity-based squashing & stretching along the movement angle
 * - Prismatic chromatic dispersion rim (rainbow specular edge)
 * - Refractive lens magnification effect via backdrop-filter
 * - Trailing satellite liquid bubbles (warm amber & cyan glass droplets)
 * - Interactive hover reactions on clickable elements & active bounce on click
 * - 100% pointer-events: none (zero interference with clicks or forms)
 * - Auto-disabled on mobile touchscreens & respect for prefers-reduced-motion
 * - Toggleable via localStorage ("hc_glass_cursor") and custom window event
 */
export function LiquidGlassCursor() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Main Orb ref & satellite droplet refs
  const mainOrbRef = useRef<HTMLDivElement>(null);
  const droplet1Ref = useRef<HTMLDivElement>(null);
  const droplet2Ref = useRef<HTMLDivElement>(null);
  const droplet3Ref = useRef<HTMLDivElement>(null);

  // Position state (mouse target vs interpolated current)
  const mouse = useRef({ x: -200, y: -200 });
  const mainPos = useRef({ x: -200, y: -200, vx: 0, vy: 0 });
  const drop1Pos = useRef({ x: -200, y: -200 });
  const drop2Pos = useRef({ x: -200, y: -200 });
  const drop3Pos = useRef({ x: -200, y: -200 });

  // State flags for interactive feedback
  const isHovering = useRef(false);
  const isClicking = useRef(false);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Only run in client browser
    if (typeof window === "undefined") return;

    // Check device capabilities (must have precise mouse pointer)
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isFinePointer || prefersReducedMotion) {
      setEnabled(false);
      return;
    }

    // Check user preference in localStorage
    const saved = localStorage.getItem("hc_glass_cursor");
    if (saved !== null) {
      setEnabled(saved === "true");
    }

    setMounted(true);

    // Listen for toggle events from settings / theme toggle
    const handleToggle = (e: CustomEvent<{ enabled: boolean }>) => {
      const next = e.detail ? e.detail.enabled : !enabled;
      setEnabled(next);
      localStorage.setItem("hc_glass_cursor", String(next));
    };

    window.addEventListener("hc_toggle_glass_cursor" as unknown as keyof WindowEventMap, handleToggle as EventListener);

    return () => {
      window.removeEventListener("hc_toggle_glass_cursor" as unknown as keyof WindowEventMap, handleToggle as EventListener);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !mounted) return;

    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      if (!isVisible) setIsVisible(true);

      // Check if hovering over clickable or interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = Boolean(
          target.closest("button, a, input, select, textarea, [role='button'], [tabindex='0'], .cursor-pointer")
        );
        isHovering.current = interactive;
      }
    };

    const onMouseDown = () => {
      isClicking.current = true;
    };

    const onMouseUp = () => {
      isClicking.current = false;
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    const onMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // Physics Animation Loop
    let time = 0;
    const render = () => {
      time += 0.035;

      // Lerp factors
      const targetX = mouse.current.x;
      const targetY = mouse.current.y;

      // 1. Calculate velocity & physics for main orb
      const dx = targetX - mainPos.current.x;
      const dy = targetY - mainPos.current.y;
      
      mainPos.current.vx = dx * 0.16;
      mainPos.current.vy = dy * 0.16;
      mainPos.current.x += mainPos.current.vx;
      mainPos.current.y += mainPos.current.vy;

      const speed = Math.hypot(mainPos.current.vx, mainPos.current.vy);
      const angle = Math.atan2(mainPos.current.vy, mainPos.current.vx);

      // Calculate squashing / stretching based on movement velocity
      const stretch = Math.min(speed * 0.015, 0.28);
      let scaleX = 1 + stretch;
      let scaleY = 1 - stretch * 0.75;

      // Apply interactive scales
      if (isClicking.current) {
        scaleX *= 0.88;
        scaleY *= 0.88;
      } else if (isHovering.current) {
        scaleX *= 1.15;
        scaleY *= 1.15;
      }

      // Update Main Orb DOM transform
      if (mainOrbRef.current) {
        const mx = mainPos.current.x;
        const my = mainPos.current.y;
        mainOrbRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%) rotate(${angle}rad) scale(${scaleX}, ${scaleY})`;
      }

      // 2. Satellite Droplet 1 (Amber / Peach Liquid Bubble)
      // Follows with delayed momentum + harmonic liquid floating wave
      const wave1X = Math.cos(time * 1.8) * 14;
      const wave1Y = Math.sin(time * 1.8) * 14;
      drop1Pos.current.x += (mainPos.current.x - 36 + wave1X - drop1Pos.current.x) * 0.09;
      drop1Pos.current.y += (mainPos.current.y + 40 + wave1Y - drop1Pos.current.y) * 0.09;

      if (droplet1Ref.current) {
        const d1Speed = Math.min(speed * 0.02, 0.2);
        droplet1Ref.current.style.transform = `translate3d(${drop1Pos.current.x}px, ${drop1Pos.current.y}px, 0) translate(-50%, -50%) scale(${1 + d1Speed}, ${1 - d1Speed})`;
      }

      // 3. Satellite Droplet 2 (Cyan / Crystal Liquid Bubble)
      const wave2X = Math.sin(time * 2.1 + 1.2) * 10;
      const wave2Y = Math.cos(time * 2.1 + 1.2) * 10;
      drop2Pos.current.x += (mainPos.current.x + 42 + wave2X - drop2Pos.current.x) * 0.065;
      drop2Pos.current.y += (mainPos.current.y + 28 + wave2Y - drop2Pos.current.y) * 0.065;

      if (droplet2Ref.current) {
        droplet2Ref.current.style.transform = `translate3d(${drop2Pos.current.x}px, ${drop2Pos.current.y}px, 0) translate(-50%, -50%)`;
      }

      // 4. Satellite Droplet 3 (Micro Dewdrop)
      const wave3X = Math.cos(time * 2.6 + 2.5) * 8;
      const wave3Y = Math.sin(time * 2.6 + 2.5) * 8;
      drop3Pos.current.x += (mainPos.current.x - 22 + wave3X - drop3Pos.current.x) * 0.045;
      drop3Pos.current.y += (mainPos.current.y - 42 + wave3Y - drop3Pos.current.y) * 0.045;

      if (droplet3Ref.current) {
        droplet3Ref.current.style.transform = `translate3d(${drop3Pos.current.x}px, ${drop3Pos.current.y}px, 0) translate(-50%, -50%)`;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [enabled, mounted, isVisible]);

  if (!enabled || !mounted) return null;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      {/* =========================================================================
          1. MAIN 3D LIQUID GLASS REFRACTION ORB (~140px diameter)
         ========================================================================= */}
      <div
        ref={mainOrbRef}
        className="fixed top-0 left-0 w-[138px] h-[138px] rounded-full pointer-events-none will-change-transform"
        style={{
          // Refractive convex glass body
          background:
            "radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.12) 35%, rgba(147, 197, 253, 0.15) 60%, rgba(244, 114, 182, 0.18) 85%, rgba(59, 130, 246, 0.28) 100%)",
          backdropFilter: "blur(1.6px) contrast(115%) brightness(108%) saturate(145%)",
          WebkitBackdropFilter: "blur(1.6px) contrast(115%) brightness(108%) saturate(145%)",
          // Chromatic prismatic edge reflections & caustic specular glow
          boxShadow: `
            inset 0 0 32px rgba(255, 255, 255, 0.48),
            inset 3px 3px 14px rgba(255, 255, 255, 0.75),
            inset -3px -3px 20px rgba(96, 165, 250, 0.45),
            inset 0 0 12px rgba(236, 72, 153, 0.35),
            0 24px 48px -12px rgba(15, 23, 42, 0.35),
            0 0 24px rgba(59, 130, 246, 0.22)
          `,
          border: "1px solid rgba(255, 255, 255, 0.55)",
        }}
      >
        {/* Prismatic Rainbow Dispersion Rim (Chromatic Aberration Effect) */}
        <div
          className="absolute inset-0 rounded-full opacity-65 mix-blend-overlay pointer-events-none"
          style={{
            background:
              "conic-gradient(from 135deg at 50% 50%, rgba(244, 63, 94, 0.45), rgba(251, 146, 60, 0.45), rgba(250, 204, 21, 0.4), rgba(52, 211, 153, 0.45), rgba(56, 189, 248, 0.55), rgba(168, 85, 247, 0.5), rgba(244, 63, 94, 0.45))",
            filter: "blur(1.5px)",
          }}
        />

        {/* Curved Glass Crescent Specular Highlight (Top-Left Light Reflection) */}
        <div
          className="absolute top-2 left-2.5 w-[72px] h-[36px] rounded-full -rotate-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 55%, transparent 85%)",
            filter: "blur(0.8px)",
          }}
        />

        {/* Sharp Studio Light Glint / Reflection Dot */}
        <div className="absolute top-4 left-6 w-3 h-2.5 rounded-full bg-white/95 blur-[0.4px] shadow-[0_0_8px_rgba(255,255,255,0.9)]" />

        {/* Secondary Soft Caustic Gleam (Bottom-Right) */}
        <div
          className="absolute bottom-2.5 right-3 w-[52px] h-[26px] rounded-full rotate-25 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 70%, rgba(147, 197, 253, 0.55) 0%, rgba(244, 114, 182, 0.3) 60%, transparent 90%)",
            filter: "blur(1.2px)",
          }}
        />
      </div>

      {/* =========================================================================
          2. SATELLITE DROPLET 1: Warm Amber / Peach Liquid Bubble (~44px)
         ========================================================================= */}
      <div
        ref={droplet1Ref}
        className="fixed top-0 left-0 w-[44px] h-[44px] rounded-full pointer-events-none will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.7) 0%, rgba(251, 146, 60, 0.38) 40%, rgba(234, 88, 12, 0.28) 75%, rgba(255, 255, 255, 0.45) 100%)",
          backdropFilter: "blur(1.2px) contrast(110%) brightness(105%)",
          WebkitBackdropFilter: "blur(1.2px) contrast(110%) brightness(105%)",
          boxShadow: `
            inset 1.5px 1.5px 6px rgba(255, 255, 255, 0.85),
            inset -1.5px -1.5px 8px rgba(194, 65, 12, 0.45),
            0 10px 20px -6px rgba(0, 0, 0, 0.25),
            0 0 12px rgba(251, 146, 60, 0.3)
          `,
          border: "1px solid rgba(255, 255, 255, 0.6)",
        }}
      >
        <div className="absolute top-1.5 left-2 w-2.5 h-1.5 rounded-full bg-white/90 blur-[0.3px]" />
      </div>

      {/* =========================================================================
          3. SATELLITE DROPLET 2: Cyan Crystal Liquid Bubble (~32px)
         ========================================================================= */}
      <div
        ref={droplet2Ref}
        className="fixed top-0 left-0 w-[32px] h-[32px] rounded-full pointer-events-none will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.75) 0%, rgba(56, 189, 248, 0.35) 45%, rgba(255, 255, 255, 0.45) 100%)",
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
          boxShadow: `
            inset 1.2px 1.2px 5px rgba(255, 255, 255, 0.85),
            inset -1.2px -1.2px 6px rgba(2, 132, 199, 0.4),
            0 8px 16px -4px rgba(0, 0, 0, 0.2),
            0 0 10px rgba(56, 189, 248, 0.25)
          `,
          border: "1px solid rgba(255, 255, 255, 0.55)",
        }}
      >
        <div className="absolute top-1 left-1.5 w-2 h-1 rounded-full bg-white/90 blur-[0.2px]" />
      </div>

      {/* =========================================================================
          4. SATELLITE DROPLET 3: Micro Floating Dewdrop (~20px)
         ========================================================================= */}
      <div
        ref={droplet3Ref}
        className="fixed top-0 left-0 w-[20px] h-[20px] rounded-full pointer-events-none will-change-transform"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9) 0%, rgba(147, 197, 253, 0.3) 60%, rgba(255, 255, 255, 0.5) 100%)",
          backdropFilter: "blur(0.8px)",
          WebkitBackdropFilter: "blur(0.8px)",
          boxShadow: `
            inset 1px 1px 3px rgba(255, 255, 255, 0.95),
            inset -1px -1px 3px rgba(59, 130, 246, 0.35),
            0 4px 10px -2px rgba(0, 0, 0, 0.18)
          `,
          border: "0.8px solid rgba(255, 255, 255, 0.65)",
        }}
      >
        <div className="absolute top-0.5 left-1 w-1.5 h-0.8 rounded-full bg-white/95" />
      </div>
    </div>
  );
}

/**
 * Helper to dispatch glass cursor toggle from settings / theme toggle
 */
export function toggleLiquidGlassCursor(enabled?: boolean) {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem("hc_glass_cursor") !== "false";
  const next = enabled !== undefined ? enabled : !current;
  localStorage.setItem("hc_glass_cursor", String(next));
  window.dispatchEvent(
    new CustomEvent("hc_toggle_glass_cursor", { detail: { enabled: next } })
  );
  return next;
}
