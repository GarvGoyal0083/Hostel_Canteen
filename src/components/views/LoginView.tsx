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
  GraduationCap,
  ShoppingBag,
  DoorOpen,
} from "lucide-react";
import { AdminUser, Customer } from "@/types/pos";
import { formatINR } from "@/lib/format";
import { CanteenLogo } from "@/components/CanteenLogo";

interface LoginViewProps {
  availableAdmins: Array<{ email: string; full_name: string; role: string }>;
  availableCustomers?: Array<{
    id: string;
    name: string;
    room_number?: string | null;
    outstanding_dues: number;
  }>;
  onLoginSuccess: (admin: AdminUser) => void;
  onCustomerLoginSuccess?: (customer: Customer | null) => void;
}

export function LoginView({
  availableAdmins,
  availableCustomers = [],
  onLoginSuccess,
  onCustomerLoginSuccess,
}: LoginViewProps) {
  const [portalMode, setPortalMode] = useState<"admin" | "customer">("customer");

  // Admin state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Student / Customer state
  const [studentAuthMode, setStudentAuthMode] = useState<"signin" | "register">("signin");
  const [studentIdentifier, setStudentIdentifier] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // New Student Registration state
  const [regName, setRegName] = useState("");
  const [regRoom, setRegRoom] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdminSubmit = async (e: React.FormEvent) => {
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

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const payload =
        studentAuthMode === "register"
          ? {
              action: "register",
              name: regName.trim(),
              room_number: regRoom.trim(),
              phone: regMobile.trim(),
              password: regPassword.trim(),
            }
          : {
              action: "login",
              name: studentIdentifier.trim(),
              password: studentPassword.trim(),
            };

      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not sign in to student portal.");
      }
      if (onCustomerLoginSuccess) {
        onCustomerLoginSuccess(data.customer);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Customer portal login failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F1F5F9] text-[#111827]">
      {/* Left Pane: Full-height 3D Hero & Features Showcase */}
      <div className="relative w-full lg:w-[52%] bg-[#090D16] text-white p-8 lg:p-14 flex flex-col justify-between overflow-hidden">
        {/* Ambient 3D depth spheres */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-[#2563EB]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <CanteenLogo className="h-12 w-12 shadow-md" size={48} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">
                  Hostel Canteen POS
                </span>
                <span className="rounded-full bg-[#2563EB]/30 border border-blue-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-300">
                  3D Edition
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Admin Terminal &amp; Student Self-Service Portal
              </p>
            </div>
          </div>
        </div>

        {/* Hero Middle Content */}
        <div className="relative z-10 my-10 lg:my-12 space-y-8 max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/15 px-3.5 py-1 text-xs font-semibold text-blue-300 shadow-inner">
              <Sparkles className="h-3.5 w-3.5 text-[#3B82F6]" />
              <span>
                {portalMode === "admin"
                  ? "Full-Stack Canteen Operations Terminal"
                  : "Hostel Student Passbook & Live Snack Menu"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              {portalMode === "admin"
                ? "Manage your hostel canteen with 3D speed & clarity."
                : "Check live snack stock & track your room purchases."}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {portalMode === "admin"
                ? "Track every Kurkure packet, cold drink bottle, hostel student udhaar balance, manual UPI reference, and real net profit from one unified 3D command center."
                : "See whether your favorite chips, biscuits, or cold drinks are in stock right from your hostel room, review your past bills, and check your udhaar balance."}
            </p>
          </div>

          {/* 3D Feature Cards Showcase */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 pt-2">
            <div className="card-3d-dark rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-300 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <Receipt className="h-4 w-4 text-blue-400" />
                  Fast POS &amp; Bills
                </span>
                <span className="text-emerald-400 font-extrabold text-[10px] uppercase">
                  1-Click
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white">
                HC-YYYYMMDD
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Instant receipts for both canteen admin and hostel students.
              </p>
            </div>

            <div className="card-3d-dark rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-300 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <Users className="h-4 w-4 text-amber-400" />
                  Student Passbook
                </span>
                <span className="text-amber-400 font-extrabold text-[10px] uppercase">
                  Room-Wise
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white">
                Transparent Udhaar
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Students can log in anytime to view their bills &amp; dues.
              </p>
            </div>

            <div className="card-3d-dark rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-300 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <Boxes className="h-4 w-4 text-blue-400" />
                  Live Stock Grid
                </span>
                <span className="text-blue-400 font-extrabold text-[10px] uppercase">
                  Real-Time
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white">
                Instant Availability
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Live stock counts update automatically after every sale.
              </p>
            </div>

            <div className="card-3d-dark rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-300 text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Profit &amp; P&amp;L
                </span>
                <span className="text-emerald-400 font-extrabold text-[10px] uppercase">
                  Admin Only
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white">
                True Net Margin
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Purchase costs &amp; profits stay private to the admin panel.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Hero Footer */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>IST Timezone Standard (Asia/Kolkata)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Manual Cash &amp; UPI Verification</span>
          </div>
        </div>
      </div>

      {/* Right Pane: Full-height 3D Login & Portal Switcher */}
      <div className="w-full lg:w-[48%] flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          {/* Clean Segmented Control: Admin vs Student */}
          <div className="bg-slate-200/70 p-1 rounded-xl grid grid-cols-2 gap-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setPortalMode("customer");
                setErrorMsg(null);
              }}
              className={`rounded-lg py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                portalMode === "customer"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              <span>Student Portal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode("admin");
                setErrorMsg(null);
              }}
              className={`rounded-lg py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                portalMode === "admin"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Admin Terminal</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="card-3d-static rounded-xl bg-red-50 border-red-300 p-3.5 flex items-start gap-2.5 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {portalMode === "admin" ? (
            /* ================================================================
               ADMIN LOGIN FORM
               ================================================================ */
            <div className="card-3d-static rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-[11px] font-extrabold text-[#1D4ED8] border border-blue-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                  Canteen Owner &amp; Manager Access
                </div>
                <h2 className="text-2xl font-black text-[#111827] tracking-tight">
                  Admin Sign In
                </h2>
                <p className="text-xs text-slate-500">
                  Sign in to manage POS billing, stock inventory, expenses, and profit reports.
                </p>
              </div>

              <form onSubmit={handleAdminSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-extrabold text-[#111827] block">
                    Admin Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="input-3d w-full rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#111827]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-[#111827]">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      className="input-3d w-full rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#111827]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-[#111827] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-3d-primary w-full rounded-xl py-3.5 px-4 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {loading ? "Opening 3D Terminal..." : "Sign In to Admin POS"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : (
            /* ================================================================
               STUDENT / CUSTOMER PORTAL LOGIN & REGISTRATION
               ================================================================ */
            <div className="card-3d-static rounded-2xl p-6 sm:p-7 space-y-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700 border border-emerald-200">
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                  Hostel Resident Portal
                </div>
                <h2 className="text-2xl font-black text-[#111827] tracking-tight">
                  {studentAuthMode === "signin"
                    ? "Student Canteen Sign In"
                    : "Register as New Student"}
                </h2>
                <p className="text-xs text-slate-500">
                  {studentAuthMode === "signin"
                    ? "Check your purchases, download bills, and track room udhaar securely."
                    : "Create your student canteen account to maintain personal bills and counter udhaar."}
                </p>
              </div>

              {/* Mode Toggle: Sign In vs Register */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStudentAuthMode("signin");
                    setErrorMsg(null);
                  }}
                  className={`py-2 text-xs font-black rounded-lg transition cursor-pointer ${
                    studentAuthMode === "signin"
                      ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentAuthMode("register");
                    setErrorMsg(null);
                  }}
                  className={`py-2 text-xs font-black rounded-lg transition cursor-pointer ${
                    studentAuthMode === "register"
                      ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + New Student Register
                </button>
              </div>

              {/* Sign In / Register Form */}
              <form onSubmit={handleCustomerSubmit} className="space-y-4 text-xs">
                {studentAuthMode === "signin" ? (
                  /* ================= EXISTING STUDENT SIGN IN ================= */
                  <div className="space-y-3">
                    <div>
                      <label className="font-bold text-[#111827] block mb-1">
                        Student Name or Room Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={studentIdentifier}
                        onChange={(e) => setStudentIdentifier(e.target.value)}
                        placeholder="e.g. Aarav Sharma or B-204"
                        className="input-3d w-full rounded-xl px-3.5 py-2.5 text-xs text-[#111827]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-[#111827]">
                          Password *
                        </label>
                        <span className="text-[10px] text-blue-600 font-semibold">
                          🔒 Portal password
                        </span>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type={showStudentPassword ? "text" : "password"}
                          required
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          placeholder="Enter your custom password"
                          maxLength={30}
                          className="input-3d w-full rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#111827]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStudentPassword(!showStudentPassword)}
                          className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-[#111827] cursor-pointer"
                        >
                          {showStudentPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ================= NEW STUDENT REGISTRATION ================= */
                  <div className="space-y-3">
                    <div>
                      <label className="font-bold text-[#111827] block mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Rohan Sharma"
                        className="input-3d w-full rounded-xl px-3.5 py-2.5 text-xs text-[#111827]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#111827] block mb-1">
                          Hostel Room No. *
                        </label>
                        <div className="relative">
                          <DoorOpen className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={regRoom}
                            onChange={(e) => setRegRoom(e.target.value)}
                            placeholder="e.g. B-204"
                            className="input-3d w-full rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#111827]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-[#111827] block mb-1">
                          Mobile Number (Optional)
                        </label>
                        <input
                          type="tel"
                          value={regMobile}
                          onChange={(e) => setRegMobile(e.target.value)}
                          placeholder="10-digit mobile (optional)"
                          maxLength={10}
                          className="input-3d w-full rounded-xl px-3.5 py-2.5 text-xs text-[#111827]"
                        />
                      </div>
                    </div>

                    {/* Create Custom Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-[#111827]">
                          Create Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          {showRegPassword ? "Hide Password" : "Show Password"}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type={showRegPassword ? "text" : "password"}
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Create a private password (min 3 chars)"
                          minLength={3}
                          maxLength={30}
                          className="input-3d w-full rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#111827]"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800">
                      <strong>Security Note:</strong> You will use your Name/Room and this custom password to sign in to your passbook. Other students cannot access your account without it.
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-3d-primary w-full rounded-xl py-3.5 px-4 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>
                    {loading
                      ? "Verifying..."
                      : studentAuthMode === "signin"
                      ? "Sign In to Student Passbook"
                      : "Register & Open Passbook"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                {/* Switch helper link */}
                <div className="text-center pt-1">
                  {studentAuthMode === "signin" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentAuthMode("register");
                        setErrorMsg(null);
                      }}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      New hostel student? Register your account here &rarr;
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentAuthMode("signin");
                        setErrorMsg(null);
                      }}
                      className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Already have an account? Sign In &rarr;
                    </button>
                  )}
                </div>

                {onCustomerLoginSuccess && (
                  <button
                    type="button"
                    onClick={() => onCustomerLoginSuccess(null)}
                    className="btn-3d-secondary w-full rounded-xl py-2.5 px-4 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Browse Live Snack Stock as Guest
                  </button>
                )}
              </form>
            </div>
          )}

          {/* Bottom Info Box */}
          <div className="card-3d-static rounded-2xl p-4 text-[11px] text-[#111827] space-y-1.5">
            <div className="font-extrabold text-[#1D4ED8] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#2563EB]" />
              {portalMode === "admin"
                ? "Enterprise Financial & Inventory Protection"
                : "Instant Live Sync with Canteen Counter"}
            </div>
            <p className="text-slate-600 leading-relaxed">
              {portalMode === "admin"
                ? "All sales, stock movements, discounts, and manual Cash/UPI payments are atomically locked and saved to your persistent database."
                : "Stock quantities and student passbook balances update the moment a bill or payment is recorded at the canteen counter."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 max-w-md w-full mx-auto">
          <span>&copy; 2026 Hostel Canteen POS.</span>
          <span className="text-[#2563EB] font-bold">
            3D Admin &amp; Student Edition
          </span>
        </div>
      </div>
    </div>
  );
}
