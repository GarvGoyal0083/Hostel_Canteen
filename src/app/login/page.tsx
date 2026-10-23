"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginView } from "@/components/views/LoginView";
import { AdminUser } from "@/types/pos";

export default function LoginPage() {
  const router = useRouter();
  const [availableAdmins, setAvailableAdmins] = useState<
    Array<{ email: string; full_name: string; role: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          setAvailableAdmins(data.available_admins || []);
          if (data.authenticated && data.admin) {
            router.push("/");
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] text-xs font-semibold text-gray-400">
        Loading Login Terminal...
      </div>
    );
  }

  return (
    <LoginView
      availableAdmins={availableAdmins}
      onLoginSuccess={(_admin: AdminUser) => {
        router.push("/");
      }}
    />
  );
}
