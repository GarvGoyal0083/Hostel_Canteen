"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Database,
  Download,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  AlertTriangle,
  History,
  Store,
  Clock,
  SunMedium,
  CheckCircle2,
  Camera,
  Sparkles,
  PackageCheck,
  Eye,
  Trash2,
} from "lucide-react";
import { AdminUser, AuditLogRecord, CanteenStatus } from "@/types/pos";
import {
  downloadCSV,
  downloadRawCSV,
  escapeCSVCell,
  formatIST,
} from "@/lib/format";
import { CommissionRateCard } from "@/components/views/CommissionRateCard";
import { AdminThemeSettingsCard } from "@/components/ThemeToggle";

interface SettingsViewProps {
  admin: AdminUser;
  supabaseConfigured: boolean;
  supabaseCloudSynced?: boolean;
  supabaseSyncError?: string | null;
  environmentMode: "development_sample" | "production_clean";
  auditLogs: AuditLogRecord[];
  canteenStatus?: CanteenStatus;
  onOpenStatusModal?: () => void;
  onRefresh: () => void;
}

export function SettingsView({
  admin,
  supabaseConfigured,
  supabaseCloudSynced,
  supabaseSyncError,
  environmentMode,
  auditLogs,
  canteenStatus,
  onOpenStatusModal,
  onRefresh,
}: SettingsViewProps) {
  const [switching, setSwitching] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const SQL_MIGRATION_SNIPPET = `-- Run this in Supabase Dashboard -> SQL Editor
CREATE TABLE IF NOT EXISTS public.canteen_store (
    id TEXT PRIMARY KEY DEFAULT 'main',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.canteen_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to canteen_store"
ON public.canteen_store FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleTestSupabaseConnection = async () => {
    setTestingSupabase(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/supabase-status");
      const data = await res.json();
      if (data.persisting) {
        setTestResult({
          status: "success",
          message: "🎉 Success! Supabase Cloud Persistence is active and saving permanently across all browsers and devices.",
        });
        onRefresh();
      } else {
        setTestResult({
          status: "error",
          message: data.error || "Table 'canteen_store' was not detected in Supabase.",
        });
      }
    } catch (err) {
      setTestResult({
        status: "error",
        message: err instanceof Error ? err.message : "Connection test failed.",
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleDownloadFullBackup = async () => {
    try {
      const res = await fetch("/api/analytics?backup=true");
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Hostel-Canteen-Full-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleSwitchMode = async (
    targetMode: "production_clean" | "development_sample"
  ) => {
    const label =
      targetMode === "production_clean"
        ? "Clean Production Mode (0 sample records — ready for real hostel canteen transactions)"
        : "Development Sample Mode (loads realistic Kurkure/Maggi/Cold Drinks sample records for testing)";

    if (
      !window.confirm(
        `Are you sure you want to reset the database to:\n\n${label}?\n\nTip: Export a Full JSON Backup first if you want to save current records.`
      )
    ) {
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch_mode", mode: targetMode }),
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setSwitching(false);
    }
  };

  const [recovering, setRecovering] = useState(false);
  const [photoCandidates, setPhotoCandidates] = useState<
    Array<{
      product_id: string;
      image_row_id: string;
      image_url: string;
      size?: number;
      updated_at?: string;
      already_in_catalog: boolean;
      existing_name: string | null;
      default_name: string;
      default_sku: string;
      default_category: string;
      default_selling_price: number;
      default_purchase_price: number;
      default_stock: number;
    }>
  >([]);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);

  const fetchPhotoRecoveryData = async () => {
    try {
      const res = await fetch("/api/recovery");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.photo_candidates)) {
          setPhotoCandidates(data.photo_candidates);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPhotoRecoveryData();
  }, []);

  const handleRestoreFromPhotos = async () => {
    if (
      !window.confirm(
        `Auto-create/restore ${photoCandidates.length} products using your photos stored in Supabase Cloud? Your snack pictures will be directly linked to your catalog.`
      )
    ) {
      return;
    }
    setRecovering(true);
    try {
      const res = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_from_photos" }),
      });
      if (res.status === 401) {
        alert("Your admin login session has expired. Redirecting to login page...");
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (res.ok) {
        alert(
          `🎉 Successfully restored ${data.result?.restored_photos || 0} products from your uploaded photos!\nTotal products now: ${data.result?.total_products || 0}`
        );
        await fetchPhotoRecoveryData();
        onRefresh();
      } else {
        alert(data.error || "Failed to restore products from photos.");
      }
    } finally {
      setRecovering(false);
    }
  };

  const handleClearDemoProducts = async () => {
    if (
      !window.confirm(
        "Remove all 12 sample demo products (Kurkure, Lay's, Oreo, etc.), link your uploaded snack photos, and ensure all existing student details (Aarav, Rohit, Kabir, Devansh) are active in your canteen?"
      )
    ) {
      return;
    }
    setRecovering(true);
    try {
      const res = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_demo_and_add_students" }),
      });
      if (res.status === 401) {
        alert("Your admin login session has expired. Redirecting to login page...");
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (res.ok) {
        alert(
          `✅ Store Updated Successfully!\n• Removed ${data.result?.removed_demo_products || 0} sample demo products\n• Linked ${data.result?.restored_photos || 0} products from your uploaded photos\n• Total catalog items: ${data.result?.total_products || 0}\n• Total active students: ${data.result?.total_students || 0}`
        );
        await fetchPhotoRecoveryData();
        onRefresh();
      } else {
        alert(data.error || "Failed to update store.");
      }
    } finally {
      setRecovering(false);
    }
  };

  const handleRestoreAuditProducts = async () => {
    setRecovering(true);
    try {
      const res = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_from_audit" }),
      });
      if (res.status === 401) {
        alert("Your admin login session has expired. Redirecting to login page...");
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (res.ok) {
        alert(`Restored ${data.result?.restored || 0} products from audit history! Total products: ${data.result?.total_products || 0}`);
        onRefresh();
      } else {
        alert(data.error || "Failed to restore products.");
      }
    } finally {
      setRecovering(false);
    }
  };

  const handleExportAuditCSV = () => {
    const timestamp = formatIST(new Date().toISOString());
    const headers = [
      "Audit Timestamp (IST)",
      "Entity Affected",
      "Entity ID",
      "Action Type",
      "Audit Summary & Diff",
      "Performed By Admin",
    ];

    const lines: string[] = [
      "HOSTEL CANTEEN - SYSTEM SECURITY AUDIT TRAIL REPORT",
      `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
      `"Total Records Count",${auditLogs.length}`,
      "",
      headers.map(escapeCSVCell).join(","),
    ];

    if (auditLogs.length > 0) {
      auditLogs.forEach((a) => {
        const row = [
          formatIST(a.created_at, true),
          a.entity_type,
          a.entity_id,
          a.action,
          a.summary,
          a.performed_by,
        ];
        lines.push(row.map(escapeCSVCell).join(","));
      });
    } else {
      lines.push(
        headers
          .map((_, i) => (i === 0 ? '"No security audit logs found"' : '""'))
          .join(",")
      );
    }

    downloadRawCSV("Hostel-Canteen-Audit-Logs.csv", lines.join("\r\n"));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#0F172A] p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
        <h1 className="text-xl font-bold text-[#111827] dark:text-[#F1F5F9]">
          System Settings, Security, Backup &amp; Audit Trail
        </h1>
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
          Manage appearance themes, database environment separation, full data backups, Supabase PostgreSQL configuration, and immutable audit logs.
        </p>
      </div>

      {/* Theme Appearance Mode Setting Card */}
      <AdminThemeSettingsCard />

      {/* Cloud Photo Recovery Center Card */}
      {photoCandidates.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/90 dark:to-indigo-950/50 p-5 border border-blue-200 dark:border-indigo-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                  <span>Cloud Photo Recovery</span>
                  <span className="rounded-full bg-[#2563EB] text-white text-[10px] px-2 py-0.5 font-bold">
                    {photoCandidates.length} Photos Found
                  </span>
                </h2>
                <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                  All {photoCandidates.length} product photos you uploaded are safely stored in Supabase. You can auto-generate products with 1 click without re-uploading anything.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowPhotoPreview(!showPhotoPreview)}
                className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{showPhotoPreview ? "Hide Photos" : "Preview Saved Photos"}</span>
              </button>
              <button
                type="button"
                disabled={recovering}
                onClick={handleClearDemoProducts}
                className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-2 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Clears 12 demo items, activates your uploaded photos, and keeps students"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove Demo &amp; Keep Students</span>
              </button>
              <button
                type="button"
                disabled={recovering}
                onClick={handleRestoreFromPhotos}
                className="rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {recovering
                    ? "Restoring..."
                    : `Restore All ${photoCandidates.length} Products`}
                </span>
              </button>
            </div>
          </div>

          {/* Photo Gallery Preview */}
          {showPhotoPreview && (
            <div className="pt-3 border-t border-blue-100 dark:border-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto p-1">
                {photoCandidates.map((photo, i) => (
                  <div
                    key={photo.product_id}
                    className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs"
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.image_url}
                        alt={`Item ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-1.5 text-[10px]">
                      <div className="font-bold truncate text-[#111827] dark:text-slate-200">
                        {photo.existing_name || `Item ${i + 1}`}
                      </div>
                      <div className="text-gray-400 font-mono text-[9px] truncate">
                        {photo.product_id.slice(0, 12)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card 0: Shop Operating Status & Customer Sync */}
        <div className="card-3d p-5 rounded-2xl space-y-3 text-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-sm font-black text-[#111827]">
                  Shop Operating Status
                </h2>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  canteenStatus?.is_open === false
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                {canteenStatus?.is_open === false ? "CLOSED" : "OPEN"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Live Status:</span>
                <span className="font-extrabold text-[#111827]">
                  {canteenStatus?.is_open === false ? "Closed for Orders" : "Open for Orders"}
                </span>
              </div>
              {canteenStatus?.is_open === false && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Closure Type:</span>
                    <span className="font-bold text-amber-700 uppercase">
                      {canteenStatus.closure_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reopen Time:</span>
                    <span className="font-bold text-slate-900">
                      {canteenStatus.reopen_at || "Not Specified"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-[11px] text-red-800">
                    <strong>Customer Notice:</strong> {canteenStatus.closure_reason}
                  </div>
                </>
              )}
              {canteenStatus?.is_open !== false && (
                <p className="text-[11px] text-slate-500">
                  Customers can currently browse all snacks, check stock levels, and place counter orders.
                </p>
              )}
            </div>
          </div>

          {onOpenStatusModal && (
            <button
              type="button"
              onClick={onOpenStatusModal}
              className={`w-full rounded-xl py-2.5 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition ${
                canteenStatus?.is_open === false ? "btn-3d-primary" : "btn-3d-secondary"
              }`}
            >
              {canteenStatus?.is_open === false ? (
                <span>Re-Open Canteen Counter</span>
              ) : (
                <>
                  <SunMedium className="h-4 w-4 text-amber-500" />
                  <span>Set Shop Closed (Today / Custom Time)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Card 1: Admin & Security Status */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Authentication &amp; Security
            </h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Logged-In Admin:</span>
              <span className="font-bold text-[#111827]">{admin.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Admin Email:</span>
              <span className="font-mono text-[#111827]">{admin.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role:</span>
              <span className="uppercase font-bold text-[#2563EB]">
                {admin.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Display Timezone:</span>
              <span className="font-semibold text-[#111827]">
                Indian Standard Time (Asia/Kolkata)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Gateway API Keys:</span>
              <span className="font-semibold text-emerald-700">
                None Required (100% Manual Entry)
              </span>
            </div>
          </div>
        </div>

        <CommissionRateCard />

        {/* Card 2: Database Mode & Production Separation */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Database className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Database &amp; Sample Data Control
            </h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Current Data State:</span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-bold ${
                  environmentMode === "production_clean"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-amber-50 text-amber-900 border border-amber-200"
                }`}
              >
                {environmentMode === "production_clean"
                  ? "Clean Production Mode"
                  : "Development Sample Mode"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Supabase Cloud Env:</span>
              <span className="font-semibold text-[#111827]">
                {supabaseConfigured
                  ? "Connected to Supabase"
                  : "Local Persistent ACID Store"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500">Multi-Device Sync:</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  supabaseCloudSynced
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : supabaseConfigured
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-slate-100 text-slate-700 border border-slate-300"
                }`}
              >
                {supabaseCloudSynced
                  ? "ACTIVE (ALL BROWSERS SYNCED)"
                  : supabaseConfigured
                  ? "RUN SQL TABLE MIGRATION"
                  : "LOCAL ONLY"}
              </span>
            </div>

            {/* Cloud Persistence Warning & 1-Click Fix */}
            {supabaseConfigured && !supabaseCloudSynced && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[11px] text-red-900 space-y-2">
                <div className="font-extrabold flex items-center gap-1.5 text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>ACTION REQUIRED: Permanent Cloud Storage Not Yet Active</span>
                </div>
                <p className="text-[11px] leading-relaxed text-red-700">
                  Your products, sales, and registered students are currently saving to <strong>temporary serverless memory</strong>. To prevent data from disappearing when Vercel restarts, run this 10-second setup:
                </p>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700">
                      Step 1: Copy this SQL script
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="rounded bg-[#2563EB] text-white px-2 py-0.5 text-[10px] font-bold hover:bg-blue-700 transition cursor-pointer"
                    >
                      {copiedSql ? "✓ Copied!" : "Copy SQL Code"}
                    </button>
                  </div>
                  <pre className="rounded-lg bg-slate-900 text-slate-100 p-2 font-mono text-[9.5px] overflow-x-auto select-all leading-tight">
{SQL_MIGRATION_SNIPPET}
                  </pre>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <a
                    href="https://supabase.com/dashboard/project/_/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-center text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Step 2: Open Supabase SQL Editor &rarr;</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleTestSupabaseConnection}
                    disabled={testingSupabase}
                    className="flex-1 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-800 py-2 text-center text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${testingSupabase ? "animate-spin" : ""}`} />
                    <span>{testingSupabase ? "Verifying..." : "Step 3: Test & Verify Sync"}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`rounded-lg p-2.5 text-xs font-bold flex items-start gap-2 ${
                      testResult.status === "success"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-red-100 text-red-900 border border-red-300"
                    }`}
                  >
                    {testResult.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <div>{testResult.message}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* When Cloud Persistence is Verified Active */}
            {supabaseConfigured && supabaseCloudSynced && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-900 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Cloud Persistence Verified Active ✅</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  All products, counter sales, and registered students are permanently stored in your Supabase PostgreSQL cloud database and stay synchronized across all devices in real time.
                </p>
                <button
                  type="button"
                  onClick={handleTestSupabaseConnection}
                  disabled={testingSupabase}
                  className="rounded bg-white border border-emerald-300 text-emerald-800 px-2 py-1 text-[10px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                >
                  <RefreshCw className={`inline h-3 w-3 mr-1 ${testingSupabase ? "animate-spin" : ""}`} />
                  {testingSupabase ? "Checking..." : "Re-test Connection"}
                </button>
              </div>
            )}

            <div className="rounded-lg bg-[#F3F4F6] p-2.5 text-[11px] text-gray-700">
              <AlertTriangle className="inline h-3.5 w-3.5 text-amber-600 mr-1" />
              Never mix development sample records with real production sales.
              Before starting live canteen operations, switch to{" "}
              <strong>Clean Production Mode</strong>.
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={switching || recovering}
                onClick={() => handleSwitchMode("production_clean")}
                className="flex-1 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
              >
                Switch to Clean Production (0 Records)
              </button>
              <button
                disabled={switching || recovering}
                onClick={handleClearDemoProducts}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition cursor-pointer"
                title="Clears only sample products while keeping students & real data"
              >
                Clear Demo Products
              </button>
              <button
                disabled={switching || recovering}
                onClick={handleRestoreAuditProducts}
                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                title="Restores previously created products from audit history"
              >
                Restore Products from Audit
              </button>
              <button
                disabled={switching || recovering}
                onClick={() => handleSwitchMode("development_sample")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-gray-100 transition cursor-pointer"
              >
                <RefreshCw className="inline h-3 w-3 mr-1" />
                Load Dev Sample
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Backup & Export Guidance */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <Download className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Backup &amp; Data Export
            </h2>
          </div>

          <p className="text-gray-600">
            Download a complete snapshot of all products, stock movements, customers, bills, manual payments, expenses, and audit logs.
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={handleDownloadFullBackup}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download Full JSON Backup Snapshot
            </button>

            <button
              onClick={handleExportAuditCSV}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-gray-50 transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#2563EB]" />
              Export Security Audit Trail (.CSV)
            </button>
          </div>

          <div className="pt-1 text-[11px] text-gray-600">
            External docs:{" "}
            <a
              href="https://supabase.com/docs/guides/platform/backups"
              target="_blank"
              rel="noopener noreferrer"
              className="pos-link inline-flex items-center gap-0.5"
            >
              Supabase PostgreSQL Backups Guide
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Audit Logs Viewer */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Immutable System &amp; Financial Audit Trail ({auditLogs.length}{" "}
              recent events)
            </h2>
          </div>
          <button
            onClick={handleExportAuditCSV}
            className="pos-link text-xs cursor-pointer"
          >
            Export Audit CSV
          </button>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600 sticky top-0">
                <th className="px-4 py-2.5 font-semibold">Timestamp (IST)</th>
                <th className="px-4 py-2.5 font-semibold">Module</th>
                <th className="px-4 py-2.5 font-semibold">Action</th>
                <th className="px-4 py-2.5 font-semibold">Summary</th>
                <th className="px-4 py-2.5 font-semibold">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">
                    {formatIST(log.created_at, true)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                      {log.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-[#111827]">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{log.summary}</td>
                  <td className="px-4 py-2.5 font-medium text-[#111827]">
                    {log.performed_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
