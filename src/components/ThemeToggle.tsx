"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Laptop, Check, ChevronDown, Sparkles } from "lucide-react";
import { useTheme, ThemeMode } from "@/lib/theme";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

/**
 * Compact Theme Toggle for Navigation Bars (Customer Portal Top Bar & Header)
 */
export function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
    );
  }

  const currentIcon =
    theme === "system" ? (
      <Laptop className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    ) : resolvedTheme === "dark" ? (
      <Moon className="h-4 w-4 text-indigo-400" />
    ) : (
      <Sun className="h-4 w-4 text-amber-500" />
    );

  const currentLabel =
    theme === "system" ? "Auto (System)" : theme === "dark" ? "Dark Mode" : "Light Mode";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className={`rounded-xl border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
          compact ? "p-2" : "px-3 py-2 text-xs font-bold"
        } ${
          resolvedTheme === "dark"
            ? "bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-100"
            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
        }`}
        title={`Theme: ${currentLabel} (Click to switch)`}
        aria-label="Toggle display theme"
      >
        {currentIcon}
        {!compact && (
          <>
            <span className="hidden sm:inline">{currentLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
          </>
        )}
      </button>

      {dropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 text-xs"
          role="menu"
        >
          <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Appearance
          </div>

          {/* Light Mode Option */}
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-bold transition cursor-pointer ${
              theme === "light"
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Light Mode</span>
            </div>
            {theme === "light" && <Check className="h-3.5 w-3.5 text-amber-600" />}
          </button>

          {/* Dark Mode Option */}
          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-bold transition cursor-pointer ${
              theme === "dark"
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-indigo-500" />
              <span>Dark Mode</span>
            </div>
            {theme === "dark" && <Check className="h-3.5 w-3.5 text-indigo-600" />}
          </button>

          {/* System Mode Option */}
          <button
            type="button"
            onClick={() => {
              setTheme("system");
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left font-bold transition cursor-pointer ${
              theme === "system"
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-blue-500" />
              <span>System (Auto)</span>
            </div>
            {theme === "system" && <Check className="h-3.5 w-3.5 text-blue-600" />}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Full Settings Card for Admin Portal (Placed under Settings tab)
 */
export function AdminThemeSettingsCard() {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className="card-3d p-5 rounded-2xl space-y-3 animate-pulse bg-slate-100 dark:bg-slate-800 h-48" />
    );
  }

  const options: Array<{
    id: ThemeMode;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "light",
      label: "Light Mode",
      sublabel: "Crisp white clean layout",
      icon: <Sun className="h-5 w-5 text-amber-500" />,
    },
    {
      id: "dark",
      label: "Dark Mode",
      sublabel: "Easy on eyes in night canteen",
      icon: <Moon className="h-5 w-5 text-indigo-400" />,
    },
    {
      id: "system",
      label: "System Preference",
      sublabel: `Auto-detect (${resolvedTheme === "dark" ? "Dark currently" : "Light currently"})`,
      icon: <Laptop className="h-5 w-5 text-blue-500" />,
    },
  ];

  return (
    <div className="card-3d p-5 rounded-2xl space-y-3.5 text-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Appearance &amp; Theme Mode
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Choose Light, Dark, or sync automatically with device settings
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
            theme === "system"
              ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
              : theme === "dark"
              ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700"
              : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
          }`}
        >
          {theme === "system" ? "Auto Sync" : theme}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {options.map((opt) => {
          const isSelected = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer relative flex flex-col justify-between gap-2 ${
                isSelected
                  ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                  : "bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {opt.icon}
                </div>
                {isSelected && (
                  <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </div>

              <div>
                <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                  {opt.label}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {opt.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>Active display mode: <strong className="text-slate-800 dark:text-slate-200 capitalize">{resolvedTheme}</strong></span>
        <span>Saved locally in browser</span>
      </div>
    </div>
  );
}
