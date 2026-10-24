"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { AdminUser, AuditLogRecord, CanteenStatus } from "@/types/pos";
import { downloadCSV, formatIST } from "@/lib/format";

interface SettingsViewProps {
  admin: AdminUser;
  supabaseConfigured: boolean;
  environmentMode: "development_sample" | "production_clean";
  auditLogs: AuditLogRecord[];
  canteenStatus?: CanteenStatus;
  onOpenStatusModal?: () => void;
  onRefresh: () => void;
}

export function SettingsView({
  admin,
  supabaseConfigured,
  environmentMode,
  auditLogs,
  canteenStatus,
  onOpenStatusModal,
  onRefresh,
}: SettingsViewProps) {
  const [switching, setSwitching] = useState(false);

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

  const handleExportAuditCSV = () => {
    const rows = auditLogs.map((a) => ({
      "Timestamp (IST)": formatIST(a.created_at, true),
      Entity: a.entity_type,
      "Entity ID": a.entity_id,
      Action: a.action,
      Summary: a.summary,
      "Performed By Admin": a.performed_by,
    }));
    downloadCSV("Hostel-Canteen-Audit-Logs.csv", rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <h1 className="text-xl font-bold text-[#111827]">
          System Settings, Security, Backup &amp; Audit Trail
        </h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Manage database environment separation, full data backups, Supabase PostgreSQL configuration, and immutable audit logs.
        </p>
      </div>

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

            <div className="rounded-lg bg-[#F3F4F6] p-2.5 text-[11px] text-gray-700">
              <AlertTriangle className="inline h-3.5 w-3.5 text-amber-600 mr-1" />
              Never mix development sample records with real production sales.
              Before starting live canteen operations, switch to{" "}
              <strong>Clean Production Mode</strong>.
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={switching}
                onClick={() => handleSwitchMode("production_clean")}
                className="flex-1 rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
              >
                Switch to Clean Production (0 Records)
              </button>
              <button
                disabled={switching}
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
