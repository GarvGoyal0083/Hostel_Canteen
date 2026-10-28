"use client";

import React, { useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  AlertCircle,
  X,
  Send,
  Copy,
  Info,
  ShieldAlert,
} from "lucide-react";
import { useFcmNotifications } from "@/lib/firebase/useFcmNotifications";

interface StudentFcmNotificationButtonProps {
  customerId?: string | null;
  customerName?: string | null;
  compact?: boolean;
}

export function StudentFcmNotificationButton({
  customerId,
  customerName,
  compact = false,
}: StudentFcmNotificationButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const {
    isSupportedBrowser,
    permission,
    fcmToken,
    loading,
    error,
    configured,
    foregroundMessage,
    dismissForegroundMessage,
    requestPermissionAndToken,
    showTestNotification,
  } = useFcmNotifications({ customerId, customerName });

  const handleSubscribe = async () => {
    const token = await requestPermissionAndToken();
    if (token) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  const handleTest = async () => {
    await showTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  };

  const handleCopyToken = () => {
    if (!fcmToken) return;
    navigator.clipboard.writeText(fcmToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 3000);
  };

  // State 1: Unsupported Browser State
  if (!isSupportedBrowser) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold"
        title="Web push notifications are not supported in this browser."
      >
        <AlertCircle className="h-4 w-4 text-slate-400" />
        <span>Push Unsupported</span>
      </div>
    );
  }

  return (
    <>
      {/* Foreground Notification In-App Toast (Handles foreground updates without duplicate OS alert) */}
      {foregroundMessage && (
        <div className="fixed top-4 right-4 z-70 max-w-sm w-full bg-white rounded-2xl p-4 shadow-2xl border border-blue-200 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <BellRing className="h-4 w-4" />
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-900">{foregroundMessage.title}</h5>
                <p className="text-xs text-slate-600 mt-0.5">{foregroundMessage.body}</p>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">
                  Just now ({foregroundMessage.receivedAt})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissForegroundMessage}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Notification Button in Student Dashboard */}
      <button
        type="button"
        onClick={() => {
          if (permission !== "granted") {
            handleSubscribe();
          } else {
            setShowModal(true);
          }
        }}
        disabled={loading}
        className={`rounded-xl transition cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
          compact ? "p-2" : "px-3.5 py-2 text-xs font-bold"
        } ${
          permission === "granted"
            ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            : permission === "denied"
            ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
            : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:scale-102 active:scale-95"
        }`}
        title={
          permission === "granted"
            ? "FCM Push Notifications Active"
            : permission === "denied"
            ? "Notifications Blocked in Browser Settings"
            : "Enable Push Notifications"
        }
      >
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {!compact && <span>Connecting...</span>}
          </>
        ) : permission === "granted" ? (
          <>
            <BellRing className="h-4 w-4 text-emerald-600" />
            {!compact && <span>FCM Alerts Active</span>}
          </>
        ) : permission === "denied" ? (
          <>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            {!compact && <span>Alerts Blocked</span>}
          </>
        ) : (
          <>
            <Bell className="h-4 w-4 text-blue-600 animate-bounce" />
            {!compact && <span>Enable Push Alerts</span>}
          </>
        )}
      </button>

      {/* Modal View for Token details, Test Button & Troubleshooting */}
      {showModal && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-xs">
                <BellRing className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-black text-slate-900">
                  FCM Push Notifications
                </h3>
                <p className="text-xs text-slate-500">
                  Firebase Cloud Messaging Configuration
                </p>
              </div>
            </div>

            {/* Missing Env Variables Warning State */}
            {!configured && (
              <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-left">
                  <strong>Firebase Keys Missing:</strong> Please set your Firebase environment variables in Vercel to receive cloud push messages.
                </div>
              </div>
            )}

            {/* Permission Denied State Notice */}
            {permission === "denied" && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="text-left">
                  <strong>Notifications Blocked:</strong> Click the padlock/tune icon in the Chrome address bar, change <em>Notifications</em> to <strong>Allow</strong>, and reload this page.
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left font-medium">
                {error}
              </div>
            )}

            {/* FCM Token Display */}
            {fcmToken && (
              <div className="mb-4 text-left">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Device Registration Token</span>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Token</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700 break-all max-h-20 overflow-y-auto">
                  {fcmToken}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 mt-4">
              {permission === "granted" ? (
                <button
                  type="button"
                  onClick={handleTest}
                  className="btn-3d-primary w-full py-2.5 px-4 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Show Test Notification</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="btn-3d-primary w-full py-2.5 px-4 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span>{loading ? "Requesting..." : "Enable Notification Permission"}</span>
                </button>
              )}
            </div>

            {testSent && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Test notification triggered! Check your desktop notification tray.</span>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="h-3 w-3" /> Chrome FCM Web Push
              </span>
              <span>Hostel Canteen</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
