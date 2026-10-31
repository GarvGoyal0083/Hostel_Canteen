"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  BellRing,
  Check,
  Send,
  AlertCircle,
  X,
  ShieldCheck,
  Trash2,
  Clock,
  Inbox,
} from "lucide-react";
import { usePushNotifications } from "@/lib/push/usePushNotifications";

interface StaffNotificationBellProps {
  userName?: string;
  role?: "staff" | "admin";
}

function formatNotificationTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function StaffNotificationBell({ userName, role = "staff" }: StaffNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [clearedFeedback, setClearedFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    isIosWithoutPwa,
    notifications,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refreshNotifications,
    clearNotifications,
  } = usePushNotifications({
    role,
    userName,
  });

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      refreshNotifications();
    }
  };

  const handleTest = async () => {
    setTestSuccess(false);
    const ok = await sendTestNotification();
    if (ok) {
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 5000);
    }
  };

  const handleClearAll = async () => {
    await clearNotifications();
    setClearedFeedback(true);
    setTimeout(() => setClearedFeedback(false), 3000);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        title="Web Push Notifications for New Orders"
        className={`relative p-2 rounded-xl transition cursor-pointer border focus:outline-none ${
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

        {/* Notification Count Badge or Status Dot */}
        {notifications.length > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
            {notifications.length}
          </span>
        ) : (
          <span
            className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
              isSubscribed
                ? "bg-emerald-500 ring-2 ring-white"
                : permission === "denied"
                ? "bg-rose-500"
                : "bg-amber-400"
            }`}
          />
        )}
      </button>

      {/* Clean Anchored Popover Dropdown (No Header-Dimming Backdrop) */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2.5 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150 max-h-[82vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
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
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto pr-0.5 space-y-3.5 mt-3.5">
            {/* Browser Support Warning */}
            {!isSupported && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>Web Push is not supported by your current browser. Try Chrome, Edge, or Firefox.</span>
              </div>
            )}

            {/* iOS Standalone Requirement Tip */}
            {isIosWithoutPwa && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <span>
                  On iPhone (iOS), tap <strong>Share</strong> &rarr; <strong>Add to Home Screen</strong> to receive push alerts even when the app is closed.
                </span>
              </div>
            )}

            {/* Permission Denied Notice */}
            {permission === "denied" && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>
                  Notifications are blocked in your browser settings. Please click the lock icon in the address bar to allow notifications.
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            {/* Status & Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
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

            {/* Recent Pushed Notifications (Up to 5) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Recent Pushed Notifications ({notifications.length}/5)
                </span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer focus:outline-none"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="py-4 text-center text-slate-400 flex flex-col items-center gap-1">
                  <Inbox className="h-5 w-5 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No pushed notifications yet</p>
                  <p className="text-[11px] text-slate-400">
                    Up to 5 recent order &amp; test push alerts will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      className="rounded-lg bg-white p-2.5 border border-slate-200/90 shadow-2xs text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-extrabold text-slate-900 leading-snug">
                          {notif.title}
                        </p>
                        {notif.created_at && (
                          <span className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatNotificationTime(notif.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed break-words">
                        {notif.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Clear All Notifications Button */}
              <button
                type="button"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
                className="mt-2.5 w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All Notifications</span>
              </button>
            </div>

            {/* Cleared Feedback */}
            {clearedFeedback && (
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>All notifications cleared!</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {isSubscribed ? (
                <>
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={loading}
                    className="btn-3d-primary w-full py-2.5 px-3 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{loading ? "Sending..." : "Send Test Notification"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={unsubscribe}
                    disabled={loading}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200 cursor-pointer focus:outline-none"
                  >
                    Turn Off Push Alerts
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={loading || !isSupported}
                  className="btn-3d-primary w-full py-2.5 px-3 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 focus:outline-none"
                >
                  <BellRing className="h-4 w-4" />
                  <span>{loading ? "Enabling..." : "Enable Order Push Alerts"}</span>
                </button>
              )}
            </div>

            {/* Success Feedback */}
            {testSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Test notification sent! Check your notification shade.</span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" /> Web Push VAPID Secured
            </span>
            <span>Hostel Canteen POS</span>
          </div>
        </div>
      )}
    </div>
  );
}
