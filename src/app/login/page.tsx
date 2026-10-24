"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginView } from "@/components/views/LoginView";
import { AdminUser, Customer } from "@/types/pos";

export default function LoginPage() {
  const router = useRouter();
  const [availableAdmins, setAvailableAdmins] = useState<
    Array<{ email: string; full_name: string; role: string }>
  >([]);
  const [availableCustomers, setAvailableCustomers] = useState<
    Array<{
      id: string;
      name: string;
      room_number?: string | null;
      outstanding_dues: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          setAvailableAdmins(data.available_admins || []);
          setAvailableCustomers(data.available_customers || []);
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
      <div className="min-h-screen flex items-center justify-center bg-[#090D16] text-xs font-semibold text-slate-400">
        Loading Login Terminal...
      </div>
    );
  }

  return (
    <LoginView
      availableAdmins={availableAdmins}
      availableCustomers={availableCustomers}
      onLoginSuccess={(_admin: AdminUser) => {
        router.push("/");
      }}
      onCustomerLoginSuccess={(customer: Customer | null) => {
        if (customer) {
          router.push(`/customer?customerId=${encodeURIComponent(customer.id)}`);
        } else {
          router.push("/customer");
        }
      }}
    />
  );
}
