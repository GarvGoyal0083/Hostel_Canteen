"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerPortalView } from "@/components/views/CustomerPortalView";
import { Customer } from "@/types/pos";

function CustomerPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get("customerId");

  const [initialCustomer, setInitialCustomer] = useState<Customer | null>(null);
  const [ready, setReady] = useState(!customerIdParam);

  useEffect(() => {
    if (!customerIdParam) {
      setReady(true);
      return;
    }
    async function loadStudent() {
      try {
        const res = await fetch(
          `/api/customer-portal?customerId=${encodeURIComponent(customerIdParam!)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.customer_profile) {
            setInitialCustomer(data.customer_profile);
          }
        }
      } finally {
        setReady(true);
      }
    }
    loadStudent();
  }, [customerIdParam]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] text-xs font-bold text-slate-500">
        Loading Student Canteen Passbook...
      </div>
    );
  }

  return (
    <CustomerPortalView
      initialCustomer={initialCustomer}
      onExitToLogin={() => router.push("/login")}
    />
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] text-xs font-bold text-slate-500">
          Opening Student Canteen Portal...
        </div>
      }
    >
      <CustomerPortalContent />
    </Suspense>
  );
}
