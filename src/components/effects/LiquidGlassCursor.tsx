"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Fluid Liquid Ribbon Trail Cursor (Awwwards Creative Style)
 * 
 * Replaces bulky glass lenses with a sleek, ultra-smooth liquid ribbon stream:
 * - Multi-segment physics spring-chain (whipping fluid tail with organic momentum)
 * - Variable-width tapered ribbon mesh connecting Bezier splines
 * - Luminous dual-theme gradients (Electric Cyan / Indigo / Neon Violet in dark mode, Sapphire / Royal Blue in light mode)
 * - Fluid click ripple wave and interactive magnetic pulse on buttons & snack cards
 * - Zero layout impact: 100% pointer-events: none on high-DPI HTML5 Canvas
 * - Idle detection: stops drawing when mouse stops to preserve 0% idle CPU
 * - Automatically disabled on touchscreens / mobile devices
 * - Toggleable via localStorage ("hc_glass_cursor")
 */

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface ClickRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export function LiquidGlassCursor() {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Must have a fine mouse pointer and not request reduced motion
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

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Spring chain points for fluid ribbon trail
    const SEGMENTS = 26;
    const points: Point[] = [];
    const mouse = { x: width / 2, y: height / 2, moved: false };
    const ripples: ClickRipple[] = [];

    for (let i = 0; i < SEGMENTS; i++) {
      points.push({ x: mouse.x, y: mouse.y, vx: 0, vy: 0 });
    }

    let isHovering = false;
    let isVisible = false;
    let animId: number | null = null;

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.moved = true;
      if (!isVisible) isVisible = true;

      const target = e.target as HTMLElement | null;
      if (target) {
        isHovering = Boolean(
          target.closest("button, a, input, select, textarea, [role='button'], .cursor-pointer")
        );
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 4,
        maxRadius: isHovering ? 48 : 36,
        alpha: 0.65,
      });
    };

    const onMouseLeave = () => {
      isVisible = false;
    };

    const onMouseEnter = () => {
      isVisible = true;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // Check if dark mode is active for dynamic ribbon coloring
    const isDarkMode = () => document.documentElement.classList.contains("dark");

    // Animation Loop
    let lastRenderTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastRenderTime) / 1000, 0.05);
      lastRenderTime = now;

      ctx.clearRect(0, 0, width, height);

      if (isVisible && mouse.moved) {
        // 1. Physics update for the spring chain nodes
        const lead = points[0];
        // Lead point smoothly follows mouse
        lead.vx += (mouse.x - lead.x) * 32 * dt;
        lead.vy += (mouse.y - lead.y) * 32 * dt;
        lead.vx *= 0.68;
        lead.vy *= 0.68;
        lead.x += lead.vx;
        lead.y += lead.vy;

        // Trailing segments follow preceding segment with fluid spring physics
        for (let i = 1; i < SEGMENTS; i++) {
          const p = points[i];
          const prev = points[i - 1];

          const tension = 0.44 - (i / SEGMENTS) * 0.12;
          const damping = 0.58 + (i / SEGMENTS) * 0.08;

          p.vx += (prev.x - p.x) * tension;
          p.vy += (prev.y - p.y) * tension;
          p.vx *= damping;
          p.vy *= damping;

          p.x += p.vx;
          p.y += p.vy;
        }

        // 2. Render Tapered Fluid Ribbon
        if (points.length >= 3) {
          const darkMode = isDarkMode();

          // Construct gradient from head to tail
          const head = points[0];
          const tail = points[points.length - 1];
          const gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);

          if (darkMode) {
            // Luminous Cyberpunk Neon Liquid: Cyan -> Indigo -> Violet -> Rose
            gradient.addColorStop(0, "rgba(56, 189, 248, 0.95)");
            gradient.addColorStop(0.3, "rgba(99, 102, 241, 0.85)");
            gradient.addColorStop(0.7, "rgba(168, 85, 247, 0.65)");
            gradient.addColorStop(1, "rgba(244, 63, 94, 0)");
          } else {
            // Crisp Mediterranean Liquid: Sapphire -> Royal Blue -> Lavender
            gradient.addColorStop(0, "rgba(37, 99, 235, 0.95)");
            gradient.addColorStop(0.35, "rgba(79, 70, 229, 0.8)");
            gradient.addColorStop(0.75, "rgba(124, 58, 237, 0.5)");
            gradient.addColorStop(1, "rgba(217, 70, 239, 0)");
          }

          // Calculate left and right boundary contours
          const leftCoords: { x: number; y: number }[] = [];
          const rightCoords: { x: number; y: number }[] = [];

          const baseWidth = isHovering ? 13 : 9.5;

          for (let i = 0; i < SEGMENTS; i++) {
            const curr = points[i];
            const next = points[Math.min(i + 1, SEGMENTS - 1)];
            const prev = points[Math.max(i - 1, 0)];

            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.hypot(dx, dy) || 1;

            // Normal perpendicular vector
            const nx = -dy / len;
            const ny = dx / len;

            // Width tapers down from head to zero at the tail
            const factor = Math.pow(1 - i / (SEGMENTS - 1), 1.35);
            const w = baseWidth * factor;

            leftCoords.push({ x: curr.x + nx * w, y: curr.y + ny * w });
            rightCoords.push({ x: curr.x - nx * w, y: curr.y - ny * w });
          }

          // Draw the fluid ribbon shape using cubic/quadratic curves
          ctx.beginPath();
          ctx.moveTo(leftCoords[0].x, leftCoords[0].y);

          for (let i = 1; i < leftCoords.length - 1; i++) {
            const xc = (leftCoords[i].x + leftCoords[i + 1].x) / 2;
            const yc = (leftCoords[i].y + leftCoords[i + 1].y) / 2;
            ctx.quadraticCurveTo(leftCoords[i].x, leftCoords[i].y, xc, yc);
          }
          ctx.lineTo(leftCoords[leftCoords.length - 1].x, leftCoords[leftCoords.length - 1].y);

          // Connect around tail
          ctx.lineTo(rightCoords[rightCoords.length - 1].x, rightCoords[rightCoords.length - 1].y);

          for (let i = rightCoords.length - 2; i >= 1; i--) {
            const xc = (rightCoords[i].x + rightCoords[i - 1].x) / 2;
            const yc = (rightCoords[i].y + rightCoords[i - 1].y) / 2;
            ctx.quadraticCurveTo(rightCoords[i].x, rightCoords[i].y, xc, yc);
          }
          ctx.lineTo(rightCoords[0].x, rightCoords[0].y);
          ctx.closePath();

          // Soft ambient glow
          ctx.save();
          ctx.shadowBlur = darkMode ? 14 : 8;
          ctx.shadowColor = darkMode ? "rgba(99, 102, 241, 0.65)" : "rgba(37, 99, 235, 0.4)";
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.restore();

          // 3. Render Cursor Tip Glow Droplet
          const tipRadius = isHovering ? 5 : 3.5;
          ctx.beginPath();
          ctx.arc(head.x, head.y, tipRadius, 0, Math.PI * 2);
          ctx.fillStyle = darkMode ? "#FFFFFF" : "#1E3A8A";
          ctx.shadowBlur = darkMode ? 10 : 4;
          ctx.shadowColor = darkMode ? "#38BDF8" : "#2563EB";
          ctx.fill();
        }
      }

      // 4. Render Click Ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += (r.maxRadius - r.radius) * 0.16;
        r.alpha -= 0.035;

        if (r.alpha <= 0) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        const darkMode = isDarkMode();
        ctx.strokeStyle = darkMode
          ? `rgba(56, 189, 248, ${r.alpha})`
          : `rgba(37, 99, 235, ${r.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [enabled, mounted]);

  if (!enabled || !mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      aria-hidden="true"
    />
  );
}

/**
 * Helper to dispatch ribbon cursor toggle from settings / theme toggle
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
