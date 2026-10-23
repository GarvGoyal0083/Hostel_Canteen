"use client";

import React, { useState } from "react";
import { Lock, Store, AlertTriangle, CheckCircle2 } from "lucide-react";
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
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-lg overflow-hidden">
        <div className="bg-[#111827] px-6 py-6 text-white text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563EB] text-white">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Hostel Canteen POS
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            Complete Canteen Management System — Admin Sign In
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-[#111827] block mb-1">
              Select or Enter Admin Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-[#111827] focus:border-[#2563EB] focus:outline-none"
            />
            {availableAdmins.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {availableAdmins.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => setEmail(u.email)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium border transition cursor-pointer ${
                      email === u.email
                        ? "bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8]"
                        : "bg-[#F3F4F6] border-gray-200 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {u.full_name} ({u.role})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="font-semibold text-[#111827] block mb-1">
              Admin Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-[#111827] focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2563EB] py-3 px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Lock className="h-4 w-4" />
            {loading ? "Signing In..." : "Sign In to Hostel Canteen POS"}
          </button>

          <div className="rounded-lg bg-[#EFF6FF] border border-blue-200 p-3 text-[11px] text-[#111827] space-y-1">
            <div className="font-bold text-[#1D4ED8] flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Protected Admin Access
            </div>
            <p className="text-gray-600">
              All prices, quantities, discounts, stock deductions, and manual UPI references are validated on the server.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
