"use client";

import React, { useState } from "react";
import { Bell, BellOff, BellRing, Check, Send, AlertCircle, X, ShieldCheck, Sparkles } from "lucide-react";
import { usePushNotifications } from "@/lib/push/usePushNotifications";

interface StaffNotificationBellProps {
  userName?: string;
  role?: "staff" | "admin";
}

export function StaffNotificationBell({ userName, role = "staff" }: StaffNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    isIosWithoutPwa,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications({
    role,
    userName,
  });

  const handleTest = async () => {
    setTestSuccess(false);
    const ok = await sendTestNotification();
    if (ok) {
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 5000);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Web Push Notifications for New Orders"
        className={`relative p-2 rounded-xl transition cursor-pointer border ${
          isSubscribed
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            : permission === "denied"
            ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
        }`}
      >
        {isSubscribed ? (
          <BellRing className="h-5 w-5 animate-bounce text-emerald-600" />
        ) : (
          <Bell className="h-5 w-5" />
        )}

        {/* Status Indicator Dot */}
        <span
          className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
            isSubscribed
              ? "bg-emerald-500 ring-2 ring-white"
              : permission === "denied"
              ? "bg-rose-500"
              : "bg-amber-400"
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/25 backdrop-blur-2xs" onClick={() => setIsOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150 mt-14"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                    isSubscribed ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  <BellRing className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Order Push Alerts</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Instant sound &amp; popup alerts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Browser Support Warning */}
            {!isSupported && (
              <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Web Push is not supported by your current browser. Try Chrome, Edge, or Firefox.</span>
              </div>
            )}

            {/* iOS Standalone Requirement Tip */}
            {isIosWithoutPwa && (
              <div className="mt-3.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <span>
                  On iPhone (iOS), tap <strong>Share</strong> &rarr; <strong>Add to Home Screen</strong> to receive push alerts even when the app is closed.
                </span>
              </div>
            )}

            {/* Permission Denied Notice */}
            {permission === "denied" && (
              <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>
                  Notifications are blocked in your browser settings. Please click the lock icon in the address bar to allow notifications.
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            {/* Status & Toggle */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSubscribed ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span>{isSubscribed ? "Push Alerts Enabled" : "Alerts Turned Off"}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isSubscribed
                    ? "You will receive live sound alerts when students order."
                    : "Turn on alerts to never miss a student order."}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 space-y-2">
              {isSubscribed ? (
                <>
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={loading}
                    className="btn-3d-primary w-full py-2.5 px-3 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{loading ? "Sending..." : "Send Test Notification"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={unsubscribe}
                    disabled={loading}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200 cursor-pointer"
                  >
                    Turn Off Push Alerts
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={loading || !isSupported}
                  className="btn-3d-primary w-full py-2.5 px-3 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <BellRing className="h-4 w-4" />
                  <span>{loading ? "Enabling..." : "Enable Order Push Alerts"}</span>
                </button>
              )}
            </div>

            {/* Success Feedback */}
            {testSuccess && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Test notification sent! Check your notification shade.</span>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Web Push VAPID Secured
              </span>
              <span>Hostel Canteen POS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
