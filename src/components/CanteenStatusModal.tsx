"use client";

import React, { useState } from "react";
import {
  Store,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Calendar,
  Coffee,
  Power,
  SunMedium,
} from "lucide-react";
import { CanteenStatus } from "@/types/pos";

interface CanteenStatusModalProps {
  currentStatus: CanteenStatus;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (updated: CanteenStatus) => void;
}

export function CanteenStatusModal({
  currentStatus,
  isOpen,
  onClose,
  onStatusUpdated,
}: CanteenStatusModalProps) {
  const [mode, setMode] = useState<"reopen" | "today" | "custom_time" | "break">(
    currentStatus.is_open ? "today" : "reopen"
  );
  const [reason, setReason] = useState(
    currentStatus.closure_reason ||
      "Canteen is closed for today. Reopening tomorrow morning."
  );
  const [reopenAt, setReopenAt] = useState(
    currentStatus.reopen_at || "Tomorrow at 8:00 AM"
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: "today" | "custom_time" | "break") => {
    setMode(preset);
    if (preset === "today") {
      setReason("Canteen is closed for today. Reopening tomorrow morning.");
      setReopenAt("Tomorrow at 8:00 AM");
    } else if (preset === "break") {
      setReason("Short 30-minute restock break. Counter will reopen shortly.");
      const target = new Date(Date.now() + 30 * 60 * 1000);
      const timeStr = target.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setReopenAt(`Today at ${timeStr}`);
    } else if (preset === "custom_time") {
      setReason("Canteen temporarily closed. Counter will reopen soon.");
      const target = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeStr = target.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setReopenAt(`Today at ${timeStr}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const willBeOpen = mode === "reopen";
      const res = await fetch("/api/canteen-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_open: willBeOpen,
          closure_type: willBeOpen ? "open" : mode,
          closure_reason: willBeOpen ? "" : reason.trim(),
          reopen_at: willBeOpen ? null : reopenAt.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update canteen status.");
      }

      onStatusUpdated(data.canteen_status);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to update canteen status."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="card-3d-static w-full max-w-lg rounded-2xl p-6 sm:p-7 space-y-5 bg-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white ${
                currentStatus.is_open ? "orb-3d-emerald" : "orb-3d-red"
              }`}
            >
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#111827]">
                Shop Operating Status
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">Current:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black ${
                    currentStatus.is_open
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      currentStatus.is_open
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-red-500"
                    }`}
                  />
                  {currentStatus.is_open ? "OPEN FOR ORDERS" : "CURRENTLY CLOSED"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Quick Mode Options */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Choose Shop Action:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("reopen")}
                className={`rounded-xl p-3 text-left transition cursor-pointer flex items-center gap-2.5 ${
                  mode === "reopen"
                    ? "btn-3d-primary font-bold"
                    : "btn-3d-secondary"
                }`}
              >
                <Power className="h-4 w-4 text-emerald-400" />
                <div>
                  <div className="font-extrabold text-xs">Re-Open Shop</div>
                  <div className="text-[10px] opacity-80">Available now</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("today")}
                className={`rounded-xl p-3 text-left transition cursor-pointer flex items-center gap-2.5 ${
                  mode === "today"
                    ? "btn-3d-primary font-bold"
                    : "btn-3d-secondary"
                }`}
              >
                <SunMedium className="h-4 w-4 text-amber-400" />
                <div>
                  <div className="font-extrabold text-xs">Closed for Today</div>
                  <div className="text-[10px] opacity-80">Until tomorrow</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("break")}
                className={`rounded-xl p-3 text-left transition cursor-pointer flex items-center gap-2.5 ${
                  mode === "break"
                    ? "btn-3d-primary font-bold"
                    : "btn-3d-secondary"
                }`}
              >
                <Coffee className="h-4 w-4 text-blue-400" />
                <div>
                  <div className="font-extrabold text-xs">Short Break (30m)</div>
                  <div className="text-[10px] opacity-80">Restock / Lunch</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("custom_time")}
                className={`rounded-xl p-3 text-left transition cursor-pointer flex items-center gap-2.5 ${
                  mode === "custom_time"
                    ? "btn-3d-primary font-bold"
                    : "btn-3d-secondary"
                }`}
              >
                <Clock className="h-4 w-4 text-indigo-400" />
                <div>
                  <div className="font-extrabold text-xs">Custom Time</div>
                  <div className="text-[10px] opacity-80">Specify reopen time</div>
                </div>
              </button>
            </div>
          </div>

          {mode !== "reopen" && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              {/* Notice / Reason */}
              <div className="space-y-1">
                <label className="font-extrabold text-[#111827] block">
                  Announcement Message (Shown to Customers):
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Canteen closed for today. Reopening tomorrow."
                  className="input-3d w-full rounded-xl px-3.5 py-2.5 text-xs text-[#111827]"
                />
              </div>

              {/* Reopen Time */}
              <div className="space-y-1">
                <label className="font-extrabold text-[#111827] block">
                  Expected Reopen Time / Date:
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={reopenAt}
                    onChange={(e) => setReopenAt(e.target.value)}
                    placeholder="e.g. Tomorrow at 8:00 AM or Today at 7:30 PM"
                    className="input-3d w-full rounded-xl pl-10 pr-3.5 py-2 text-xs text-[#111827]"
                  />
                </div>
              </div>

              {/* Quick Time Adders */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-bold text-slate-500">
                  Quick Set Reopen:
                </span>
                {[
                  { label: "+15m", mins: 15 },
                  { label: "+30m", mins: 30 },
                  { label: "+1h", mins: 60 },
                  { label: "+2h", mins: 120 },
                  { label: "Tomorrow 8 AM", text: "Tomorrow at 8:00 AM" },
                  { label: "Tomorrow 10 AM", text: "Tomorrow at 10:00 AM" },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.text) {
                        setReopenAt(item.text);
                      } else if (item.mins) {
                        const target = new Date(Date.now() + item.mins * 60 * 1000);
                        const timeStr = target.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        });
                        setReopenAt(`Today at ${timeStr}`);
                      }
                    }}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2 py-1 text-[10px] font-extrabold text-slate-700 cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer Impact Note */}
          <div className="rounded-xl bg-[#EFF6FF] border border-blue-200 p-3 text-[11px] text-slate-700 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <strong>Instant Customer Sync:</strong> When you mark the shop as
              closed, the student portal immediately displays a prominent 3D
              closed banner, updates live counters, and notifies students of the
              reopening time.
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary rounded-xl px-4 py-2.5 text-xs font-extrabold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`rounded-xl px-5 py-2.5 text-xs font-extrabold flex items-center gap-2 text-white cursor-pointer ${
                mode === "reopen" ? "btn-3d-primary" : "btn-3d-dark"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {submitting
                  ? "Updating Shop Status..."
                  : mode === "reopen"
                    ? "Open Shop Now"
                    : "Save & Close Shop"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
