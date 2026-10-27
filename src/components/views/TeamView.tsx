"use client";

import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, KeyRound, Power, Users } from "lucide-react";
import { AdminUser } from "@/types/pos";
import { formatINR } from "@/lib/format";

type Period = "today" | "week" | "month" | "all";

interface PerformanceRow {
  user: AdminUser;
  bills: number;
  total_sales: number;
  profit_generated: number;
  commission_owed: number;
  total_discount_given: number;
}

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

export function TeamView() {
  const [period, setPeriod] = useState<Period>("today");
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [ratePercent, setRatePercent] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.executives);
        setRatePercent(json.commission_rate_percent);
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
    okText: string
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");
      setMessage({ ok: true, text: okText });
      await load();
      return true;
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Action failed." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await call("POST", form, `Sales Executive "${form.full_name}" added.`);
    if (ok) setForm({ full_name: "", email: "", password: "" });
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetFor) return;
    const ok = await call(
      "PATCH",
      { action: "reset_password", id: resetFor.id, password: resetPassword },
      `Password reset for ${resetFor.full_name}.`
    );
    if (ok) {
      setResetFor(null);
      setResetPassword("");
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-xs";

  return (
    <div className="space-y-5">
      <div className="card-3d-static rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <UserPlus className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-slate-900">Add Sales Executive</h2>
        </div>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-4 items-end">
          <input
            required
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className={inputClass}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Password (min 8 characters)"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-3d-primary rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            Add Executive
          </button>
        </form>
        {message && (
          <div
            className={
              message.ok
                ? "text-xs font-semibold text-emerald-700"
                : "text-xs font-semibold text-red-600"
            }
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="card-3d-static rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-slate-900">
              Sales Executives &amp; Performance
            </h2>
            <span className="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
              Commission {ratePercent}%
            </span>
          </div>
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`rounded-lg px-3 py-1 text-[11px] font-bold cursor-pointer ${
                  period === p.id ? "btn-3d-primary" : "btn-3d-secondary text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-xs font-bold text-slate-500">Loading team...</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-slate-500">No Sales Executives yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Executive</th>
                  <th className="py-2 pr-3 text-right">Bills</th>
                  <th className="py-2 pr-3 text-right">Total Sales</th>
                  <th className="py-2 pr-3 text-right">Profit Generated</th>
                  <th className="py-2 pr-3 text-right">Discount Given</th>
                  <th className="py-2 pr-3 text-right">Commission Owed</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-3">
                      <div className="font-bold text-slate-900">{row.user.full_name}</div>
                      <div className="text-[10px] text-slate-500">{row.user.email}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{row.bills}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">
                      {formatINR(row.total_sales)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold">
                      {formatINR(row.profit_generated)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold">
                      {formatINR(row.total_discount_given)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-black text-[#1D4ED8]">
                      {formatINR(row.commission_owed)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          row.user.is_active
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}
                      >
                        {row.user.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setResetFor(row.user);
                          setResetPassword("");
                        }}
                        className="btn-3d-secondary rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 mr-1.5 cursor-pointer"
                      >
                        <KeyRound className="inline h-3 w-3 mr-1" />
                        Reset Password
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          call(
                            "PATCH",
                            {
                              action: "set_active",
                              id: row.user.id,
                              is_active: !row.user.is_active,
                            },
                            `${row.user.full_name} ${row.user.is_active ? "deactivated" : "activated"}.`
                          )
                        }
                        className="btn-3d-secondary rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 cursor-pointer"
                      >
                        <Power className="inline h-3 w-3 mr-1" />
                        {row.user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleReset}
            className="card-3d-static rounded-2xl bg-white p-5 w-full max-w-sm space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-900">
              Reset password for {resetFor.full_name}
            </h3>
            <input
              required
              type="password"
              minLength={8}
              autoFocus
              autoComplete="new-password"
              placeholder="New password (min 8 characters)"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className={inputClass}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetFor(null)}
                className="btn-3d-secondary rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-3d-primary rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                Reset Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
