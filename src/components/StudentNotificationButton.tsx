"use client";

import React, { useState } from "react";
import { Bell, BellRing, Check, X, AlertCircle, Sparkles, Send } from "lucide-react";
import { usePushNotifications } from "@/lib/push/usePushNotifications";

interface StudentNotificationButtonProps {
  customerId?: string | null;
  customerName?: string | null;
  compact?: boolean;
}

export function StudentNotificationButton({
  customerId,
  customerName,
  compact = false,
}: StudentNotificationButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [testSent, setTestSent] = useState(false);

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
    role: "customer",
    customerId,
    userName: customerName,
  });

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  const handleTest = async () => {
    const ok = await sendTestNotification();
    if (ok) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  if (!isSupported) {
    return null; // Don't clutter UI if device doesn't support Web Push
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={`rounded-xl transition cursor-pointer flex items-center gap-1.5 border ${
          compact ? "p-2" : "px-3 py-2 text-xs font-bold"
        } ${
          isSubscribed
            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
            : permission === "denied"
            ? "bg-slate-50 text-slate-500 border-slate-200"
            : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-2xs hover:scale-102 active:scale-95"
        }`}
        title={isSubscribed ? "Order push notifications are enabled" : "Enable live order alerts"}
      >
        {isSubscribed ? (
          <>
            <BellRing className="h-4 w-4 text-emerald-600" />
            {!compact && <span>Alerts On</span>}
          </>
        ) : (
          <>
            <Bell className="h-4 w-4 text-blue-600 animate-pulse" />
            {!compact && <span>Enable Alerts</span>}
          </>
        )}
      </button>

      {/* Notification Preferences Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150 relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs border border-blue-200">
              <BellRing className="h-6 w-6" />
            </div>

            <h3 className="text-base font-black text-slate-900">
              {isSubscribed ? "Order Notifications Active" : "Get Live Order Updates"}
            </h3>

            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {isSubscribed
                ? "You will get immediate sound & popup notifications on this phone/laptop when your canteen snacks are ready or out for room delivery."
                : "Never miss your food! Receive alerts the instant canteen staff accepts your order, prepares it, or delivers it to your room."}
            </p>

            {/* iOS Tip */}
            {isIosWithoutPwa && (
              <div className="mt-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] text-left flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>iPhone Note:</strong> In Safari, tap the <strong>Share</strong> button (bottom bar) &rarr; tap <strong>Add to Home Screen</strong>. Then open from home screen to turn on push notifications!
                </div>
              </div>
            )}

            {/* Permission Denied Notice */}
            {permission === "denied" && (
              <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-left flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>
                  Notifications are blocked by your browser settings. Please allow notifications for this site to receive order updates.
                </span>
              </div>
            )}

            {error && (
              <div className="mt-3.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 space-y-2">
              {!isSubscribed ? (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="btn-3d-primary w-full py-3 px-4 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <BellRing className="h-4 w-4" />
                  <span>{loading ? "Activating Alerts..." : "Turn On Live Order Alerts"}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={loading}
                    className="btn-3d-secondary w-full py-2.5 px-4 rounded-xl text-xs font-black text-blue-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{loading ? "Sending..." : "Test Notification On My Device"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={unsubscribe}
                    disabled={loading}
                    className="w-full py-2 px-3 text-xs font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    Turn Off Alerts
                  </button>
                </>
              )}
            </div>

            {testSent && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Alert sent! Check your notification shade.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
