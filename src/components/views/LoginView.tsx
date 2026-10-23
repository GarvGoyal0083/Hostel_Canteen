"use client";

import React, { useState } from "react";
import {
  Lock,
  Mail,
  Store,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Users,
  Boxes,
  Clock,
  Sparkles,
} from "lucide-react";
import { AdminUser } from "@/types/pos";

interface LoginViewProps {
  availableAdmins: Array<{ email: string; full_name: string; role: string }>;
  onLoginSuccess: (admin: AdminUser) => void;
}

export function LoginView({
  availableAdmins,
  onLoginSuccess,
}: LoginViewProps) {
  const [email, setEmail] = useState(
    availableAdmins[0]?.email || "admin@hostelcanteen.local"
  );
  const [password, setPassword] = useState("ChangeThisStrongPassword!2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid credentials.");
      }
      onLoginSuccess(data.admin);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white text-[#111827]">
      {/* Left Pane: Full-height Hero & Features Showcase */}
      <div className="relative w-full lg:w-[52%] bg-[#0B0F17] text-white p-8 lg:p-14 flex flex-col justify-between overflow-hidden">
        {/* Subtle background ambient gradients */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-[#2563EB]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-[#1D4ED8]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-white">
                  Hostel Canteen POS
                </span>
                <span className="rounded-full bg-[#2563EB]/25 border border-[#2563EB]/40 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Snacks, Cold Drinks &amp; Late-Night Management
              </p>
            </div>
          </div>
        </div>

        {/* Hero Middle Content */}
        <div className="relative z-10 my-10 lg:my-14 space-y-8 max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-gray-300">
              <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
              <span>Full-Stack Canteen Operations Terminal</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Manage your hostel canteen with speed &amp; financial clarity.
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Track every Kurkure packet, cold drink bottle, hostel student udhaar balance, manual UPI reference, and real net profit from one unified dashboard.
            </p>
          </div>

          {/* Quick Metrics Showcase Preview */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 backdrop-blur-xs">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-[#2563EB]" />
                  Fast POS Billing
                </span>
                <span className="text-emerald-400 font-semibold text-[11px]">
                  1-Click
                </span>
              </div>
              <div className="text-xl font-bold text-white">HC-YYYYMMDD</div>
              <p className="text-[11px] text-gray-400 mt-1">
                Unique server-generated bill IDs with printable receipts.
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 backdrop-blur-xs">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-amber-400" />
                  Hostel Udhaar
                </span>
                <span className="text-amber-400 font-semibold text-[11px]">
                  Room-Wise
                </span>
              </div>
              <div className="text-xl font-bold text-white">Zero Debt Loss</div>
              <p className="text-[11px] text-gray-400 mt-1">
                Chronological student credit ledgers &amp; repayment records.
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 backdrop-blur-xs">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                <span className="flex items-center gap-1.5">
                  <Boxes className="h-4 w-4 text-blue-400" />
                  Stock Engine
                </span>
                <span className="text-blue-400 font-semibold text-[11px]">
                  Atomic Lock
                </span>
              </div>
              <div className="text-xl font-bold text-white">Live Stock Value</div>
              <p className="text-[11px] text-gray-400 mt-1">
                Deduct sales, track purchases, waste, and low-stock alerts.
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 backdrop-blur-xs">
              <div className="flex items-center justify-between text-gray-400 text-xs mb-2">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Profit &amp; P&amp;L
                </span>
                <span className="text-emerald-400 font-semibold text-[11px]">
                  Real COGS
                </span>
              </div>
              <div className="text-xl font-bold text-white">True Net Margin</div>
              <p className="text-[11px] text-gray-400 mt-1">
                Gross sales, discounts, expenses, and net profit breakdown.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Hero Footer */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-[#2563EB]" />
            <span>IST Timezone Standard (Asia/Kolkata)</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Bank-Free Manual UPI &amp; Cash Entry</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Full-height Modern Login Form */}
      <div className="w-full lg:w-[48%] bg-white flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#1D4ED8] border border-blue-200">
              <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
              Secure Admin Terminal
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              Sign in with your authorized admin or manager account to access billing, stock, and reports.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick 1-Click Account Switcher */}
          {availableAdmins.length > 0 && (
            <div className="rounded-xl bg-[#F3F4F6] p-3.5 border border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600">
                <span>Select Admin Account:</span>
                <span className="text-[10px] text-gray-400">1-Click autofill</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableAdmins.map((u) => {
                  const isSelected = email === u.email;
                  return (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setEmail(u.email);
                        setPassword("ChangeThisStrongPassword!2026");
                        setErrorMsg(null);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                          : "bg-white text-[#111827] border-gray-300 hover:border-[#2563EB]"
                      }`}
                    >
                      <span>{u.full_name}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-bold ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {u.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#111827] block">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hostelcanteen.local"
                  className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#111827] placeholder:text-gray-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[#111827]">
                  Password
                </label>
                <span className="text-[11px] text-gray-500">
                  Default: ChangeThisStrongPassword!2026
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#111827] placeholder:text-gray-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-0.5 text-gray-400 hover:text-[#111827] cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2563EB] py-3.5 px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <span>{loading ? "Verifying Credentials..." : "Sign In to Terminal"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Security Features Callout */}
          <div className="rounded-xl border border-blue-200 bg-[#EFF6FF] p-4 text-[11px] text-[#111827] space-y-2">
            <div className="font-bold text-[#1D4ED8] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#2563EB]" />
              Enterprise Financial Integrity Protection
            </div>
            <ul className="text-gray-600 space-y-1 list-disc list-inside">
              <li>Server-side price, discount, and quantity validation.</li>
              <li>Atomic row-locking mutex prevents concurrent stock discrepancies.</li>
              <li>Dual mode: Supabase PostgreSQL Cloud or Local Persistent Store.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-500 gap-2 max-w-md w-full mx-auto">
          <span>&copy; 2026 Hostel Canteen POS. All rights reserved.</span>
          <span className="text-[#2563EB] font-medium">Room Canteen Management</span>
        </div>
      </div>
    </div>
  );
}
