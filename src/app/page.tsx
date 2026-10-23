"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  ReceiptText,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  Clock,
  PlusCircle,
} from "lucide-react";
import {
  AdminUser,
  AuditLogRecord,
  Customer,
  ExpenseRecord,
  InventoryMovement,
  PaymentEntry,
  Product,
  ProductStockSummary,
  SaleRecord,
} from "@/types/pos";
import { formatIST } from "@/lib/format";
import { LoginView } from "@/components/views/LoginView";
import { DashboardView } from "@/components/views/DashboardView";
import { PosBillingView } from "@/components/views/PosBillingView";
import { ProductsView } from "@/components/views/ProductsView";
import { InventoryView } from "@/components/views/InventoryView";
import { CustomersView } from "@/components/views/CustomersView";
import { TransactionsView } from "@/components/views/TransactionsView";
import { PaymentsView } from "@/components/views/PaymentsView";
import { ExpensesView } from "@/components/views/ExpensesView";
import { ReportsView } from "@/components/views/ReportsView";
import { SettingsView } from "@/components/views/SettingsView";
import { ReceiptModal } from "@/components/ReceiptModal";

type NavTab =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "customers"
  | "transactions"
  | "payments"
  | "expenses"
  | "reports"
  | "settings";

const SIDEBAR_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "1. Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "2. New Sale / POS", icon: ShoppingCart },
  { id: "products", label: "3. Products", icon: Package },
  { id: "inventory", label: "4. Inventory", icon: Boxes },
  { id: "customers", label: "5. Customers", icon: Users },
  { id: "transactions", label: "6. Transactions", icon: ReceiptText },
  { id: "payments", label: "7. Payments", icon: CreditCard },
  { id: "expenses", label: "8. Expenses", icon: Wallet },
  { id: "reports", label: "9. Reports", icon: BarChart3 },
  { id: "settings", label: "10. Settings", icon: Settings },
];

export default function HostelCanteenPosApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [availableAdmins, setAvailableAdmins] = useState<
    Array<{ email: string; full_name: string; role: string }>
  >([]);

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedInventoryProductId, setSelectedInventoryProductId] = useState<
    string | null
  >(null);
  const [receiptSale, setReceiptSale] = useState<SaleRecord | null>(null);
  const [currentTimeIST, setCurrentTimeIST] = useState<string>("");

  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: "",
    endDate: "",
  });

  // Main state fetched from /api/analytics
  const [appData, setAppData] = useState<{
    environment_mode: "development_sample" | "production_clean";
    supabase_configured: boolean;
    kpis: {
      today_sales: number;
      weekly_sales: number;
      monthly_sales: number;
      period_gross_sales: number;
      period_discounts: number;
      period_refunds: number;
      period_net_sales: number;
      period_cogs: number;
      period_gross_profit: number;
      period_expenses: number;
      period_net_profit: number;
      total_transactions: number;
      cash_collected: number;
      upi_collected: number;
      other_collected: number;
      total_collected: number;
      pending_payments_amount: number;
      pending_bills_count: number;
      customer_udhaar_total: number;
      total_products: number;
      active_products: number;
      current_inventory_value: number;
      current_retail_inventory_value: number;
      low_stock_count: number;
      out_of_stock_count: number;
      duplicate_upi_warnings_count: number;
    };
    alerts: {
      out_of_stock: Product[];
      low_stock: Product[];
    };
    best_selling_products: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      category: string;
      units_sold: number;
      gross_revenue: number;
      discounts: number;
      net_revenue: number;
      cogs: number;
      estimated_profit: number;
    }>;
    daily_series: Array<{
      date: string;
      sales: number;
      cogs: number;
      gross_profit: number;
      expenses: number;
      net_profit: number;
      cash_collected: number;
      upi_collected: number;
      discounts: number;
      transactions_count: number;
    }>;
    recent_transactions: SaleRecord[];
    stock_summaries: ProductStockSummary[];
    customers: Customer[];
    sales: SaleRecord[];
    payments: PaymentEntry[];
    expenses: ExpenseRecord[];
    movements: InventoryMovement[];
    products: Product[];
    audit_logs: AuditLogRecord[];
  } | null>(null);

  // Live IST clock
  useEffect(() => {
    const updateClock = () => setCurrentTimeIST(formatIST(new Date(), true));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter.startDate) params.set("startDate", dateFilter.startDate);
      if (dateFilter.endDate) params.set("endDate", dateFilter.endDate);

      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (res.status === 401) {
        setAdmin(null);
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setAppData(json);
      }
    } catch {
      // ignore network error
    }
  }, [dateFilter.startDate, dateFilter.endDate]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          setAvailableAdmins(data.available_admins || []);
          if (data.authenticated && data.admin) {
            setAdmin(data.admin);
          }
        }
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (admin) {
      fetchAllData();
    }
  }, [admin, fetchAllData]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAdmin(null);
    setAppData(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] text-xs font-semibold text-gray-400">
        Loading Hostel Canteen POS...
      </div>
    );
  }

  if (!admin) {
    return (
      <LoginView
        availableAdmins={availableAdmins}
        onLoginSuccess={(loggedInAdmin) => setAdmin(loggedInAdmin)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F3F4F6] text-[#111827]">
      {/* Mobile Header */}
      <div className="flex items-center justify-between bg-[#111827] px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#2563EB] p-1.5">
            <Store className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold text-sm">Hostel Canteen POS</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pos")}
            className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-bold text-white"
          >
            + POS
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-1.5 text-gray-200 hover:bg-gray-800"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation (10 Modules) */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 z-40`}
      >
        {/* Brand Header */}
        <div className="hidden lg:flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <div className="rounded-xl bg-[#2563EB] p-2 text-white shadow-xs">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-[#111827] leading-tight">
              Hostel Canteen POS
            </div>
            <div className="text-[11px] text-gray-500">
              Room Snacks &amp; Cold Drinks
            </div>
          </div>
        </div>

        {/* Quick New Sale CTA */}
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={() => {
              setActiveTab("pos");
              setMobileMenuOpen(false);
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] transition shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            New Sale / Fast POS
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id !== "inventory") {
                    setSelectedInventoryProductId(null);
                  }
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? "bg-[#EFF6FF] text-[#2563EB] border border-blue-200"
                    : "text-[#111827] hover:bg-[#F3F4F6]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-[#2563EB]" : "text-gray-500"
                    }`}
                  />
                  {item.label}
                </span>
                {item.id === "inventory" &&
                  appData &&
                  appData.kpis.out_of_stock_count +
                    appData.kpis.low_stock_count >
                    0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      {appData.kpis.out_of_stock_count +
                        appData.kpis.low_stock_count}
                    </span>
                  )}
                {item.id === "customers" &&
                  appData &&
                  appData.kpis.pending_bills_count > 0 && (
                    <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                      {appData.kpis.pending_bills_count}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        {/* Admin Footer */}
        <div className="border-t border-gray-200 p-4 bg-[#F3F4F6]/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="font-bold text-[#111827] truncate">
                {admin.full_name}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {admin.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-700 hover:text-red-600 hover:border-red-200 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock className="h-3 w-3 text-[#2563EB]" />
            <span>{currentTimeIST}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          {!appData ? (
            <div className="rounded-xl bg-white p-12 text-center border border-gray-200 text-xs text-gray-500">
              Loading canteen database records...
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <DashboardView
                  data={appData}
                  dateFilter={dateFilter}
                  onDateFilterChange={(startDate, endDate) =>
                    setDateFilter({ startDate, endDate })
                  }
                  onNavigate={(tab) => setActiveTab(tab as NavTab)}
                  onSelectReceipt={(sale) => setReceiptSale(sale)}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "pos" && (
                <PosBillingView
                  products={appData.products}
                  customers={appData.customers}
                  adminName={admin.full_name}
                  onSaleCompleted={(newSale) => {
                    setReceiptSale(newSale);
                    fetchAllData();
                  }}
                />
              )}

              {activeTab === "products" && (
                <ProductsView
                  products={appData.products}
                  onRefresh={fetchAllData}
                  onNavigateToInventory={(productId) => {
                    setSelectedInventoryProductId(productId);
                    setActiveTab("inventory");
                  }}
                />
              )}

              {activeTab === "inventory" && (
                <InventoryView
                  products={appData.products}
                  summaries={appData.stock_summaries}
                  movements={appData.movements}
                  initialSelectedProductId={selectedInventoryProductId}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "customers" && (
                <CustomersView
                  customers={appData.customers}
                  onRefresh={fetchAllData}
                  onSelectReceipt={(sale) => setReceiptSale(sale)}
                />
              )}

              {activeTab === "transactions" && (
                <TransactionsView
                  sales={appData.sales}
                  onRefresh={fetchAllData}
                  onSelectReceipt={(sale) => setReceiptSale(sale)}
                />
              )}

              {activeTab === "payments" && (
                <PaymentsView
                  payments={appData.payments}
                  sales={appData.sales}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "expenses" && (
                <ExpensesView
                  expenses={appData.expenses}
                  kpis={appData.kpis}
                  onRefresh={fetchAllData}
                />
              )}

              {activeTab === "reports" && (
                <ReportsView
                  sales={appData.sales}
                  payments={appData.payments}
                  products={appData.products}
                  customers={appData.customers}
                  movements={appData.movements}
                  expenses={appData.expenses}
                  bestSellingProducts={appData.best_selling_products}
                  dailySeries={appData.daily_series}
                  kpis={appData.kpis}
                  dateFilter={dateFilter}
                  onDateFilterChange={(startDate, endDate) =>
                    setDateFilter({ startDate, endDate })
                  }
                />
              )}

              {activeTab === "settings" && (
                <SettingsView
                  admin={admin}
                  supabaseConfigured={appData.supabase_configured}
                  environmentMode={appData.environment_mode}
                  auditLogs={appData.audit_logs}
                  onRefresh={fetchAllData}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Printable & Downloadable Receipt Modal */}
      <ReceiptModal
        sale={receiptSale}
        onClose={() => setReceiptSale(null)}
      />
    </div>
  );
}
