"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Clean & Minimal Smooth Cursor Effect
 * 
 * Simple, elegant, and non-intrusive:
 * - Crisp precision pointer dot at the exact cursor position
 * - Smooth floating follower ring with gentle spring easing
 * - Subtle expansion & glow when hovering over buttons, cards & links
 * - Crisp tactile press animation on click
 * - 100% pointer-events: none (zero obstruction or interference)
 * - Auto-disabled on mobile touchscreens
 * - Toggleable via localStorage ("hc_glass_cursor")
 */
export function LiquidGlassCursor() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const mouse = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only enable on desktop devices with fine mouse pointer
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isFinePointer || prefersReducedMotion) {
      setEnabled(false);
      return;
    }

    const saved = localStorage.getItem("hc_glass_cursor");
    if (saved !== null) {
      setEnabled(saved === "true");
    }

    setMounted(true);

    const handleToggle = (e: CustomEvent<{ enabled: boolean }>) => {
      const next = e.detail ? e.detail.enabled : !enabled;
      setEnabled(next);
      localStorage.setItem("hc_glass_cursor", String(next));
    };

    window.addEventListener(
      "hc_toggle_glass_cursor" as unknown as keyof WindowEventMap,
      handleToggle as EventListener
    );

    return () => {
      window.removeEventListener(
        "hc_toggle_glass_cursor" as unknown as keyof WindowEventMap,
        handleToggle as EventListener
      );
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !mounted) return;

    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      if (!isVisible) setIsVisible(true);

      // Direct position update for the inner precision dot (instant 1:1 response)
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }

      // Check hover on interactive elements
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = Boolean(
          target.closest("button, a, input, select, textarea, [role='button'], .cursor-pointer")
        );
        setIsHovering(interactive);
      }
    };

    const onMouseDown = () => setIsClicking(true);
    const onMouseUp = () => setIsClicking(false);
    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // Smooth follower ring animation loop
    const render = () => {
      // Gentle spring lerp factor (0.18 = smooth and responsive without sluggish lag)
      ring.current.x += (mouse.current.x - ring.current.x) * 0.18;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.18;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;
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
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [enabled, mounted, isVisible]);

  if (!enabled || !mounted) return null;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      {/* Smooth Trailing Follower Ring */}
      <div
        ref={ringRef}
        className={`fixed top-0 left-0 rounded-full pointer-events-none will-change-transform transition-[width,height,border-color,background-color] duration-150 ease-out flex items-center justify-center ${
          isClicking
            ? "w-6 h-6 border border-blue-600 bg-blue-600/20 dark:border-blue-400 dark:bg-blue-400/25"
            : isHovering
            ? "w-10 h-10 border border-blue-500/70 bg-blue-500/10 dark:border-blue-400/80 dark:bg-blue-400/15 shadow-[0_0_12px_rgba(59,130,246,0.25)]"
            : "w-8 h-8 border border-slate-400/50 bg-slate-400/5 dark:border-slate-300/40 dark:bg-slate-300/5"
        }`}
      />

      {/* Crisp Precision Center Dot */}
      <div
        ref={dotRef}
        className={`fixed top-0 left-0 rounded-full pointer-events-none will-change-transform transition-all duration-100 ${
          isHovering
            ? "w-2 h-2 bg-blue-600 dark:bg-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
            : "w-1.5 h-1.5 bg-blue-600/90 dark:bg-blue-400/90"
        }`}
      />
    </div>
  );
}

/**
 * Helper to dispatch cursor toggle from settings / theme toggle
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
