# Hostel Canteen POS — Complete Canteen Management System

A full-stack, modern, responsive Point-of-Sale (POS), Inventory, Customer Udhaar, Manual Cash/UPI Payment, Expense, and Profit Management web application built with **Next.js (App Router), React, TypeScript, Tailwind CSS, and Supabase PostgreSQL**.

> **Zero Payment Gateways by Design:** No Razorpay, Cashfree, or PhonePe Payment Gateway API keys are required or integrated. All Cash and UPI payments (Google Pay, PhonePe, Paytm, etc.) and UTR / transaction reference numbers are entered manually by the admin, flagged clearly as manually recorded, and checked automatically for duplicate UTR warnings.

---

## 1. Setup & Installation Instructions

### Prerequisites
- **Node.js** `v18.18+` (tested on `v24.19.0`)
- **npm** `v9+`

### Step-by-Step Local Setup
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open the application:**
   Visit `http://localhost:3000` in your browser.
   - **Default Local Admin Email:** `admin@hostelcanteen.local`
   - **Default Local Admin Password:** `ChangeThisStrongPassword!2026`

---

## 2. Supabase Configuration Instructions

The project includes complete PostgreSQL schema, Row Level Security (RLS) policies, financial deletion-prevention triggers, and atomic PL/pgSQL transaction functions in `supabase/migrations/`.

1. Create a new project at [https://supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Run the migrations in order:
   - Copy and run `supabase/migrations/001_initial_schema.sql` (creates `users`, `products`, `customers`, `daily_bill_counters`, `sales`, `sale_items`, `payments`, `inventory_movements`, `expenses`, `refunds_cancellations`, `audit_logs`, triggers, and RLS policies).
   - Copy and run `supabase/migrations/002_atomic_rpc_functions.sql` (creates atomic row-locking stock and transaction RPCs).
4. In **Authentication -> Users**, create your admin account (e.g. `admin@yourdomain.com`) and insert a matching row into `public.users` with `role = 'admin'` and `is_active = true`:
   ```sql
   INSERT INTO public.users (email, full_name, role, is_active)
   VALUES ('admin@yourdomain.com', 'Hostel Canteen Owner', 'admin', true);
   ```
5. Copy your project's **Project URL**, **anon public key**, and **service_role secret key** from **Project Settings -> API** into `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
   ```
   > **Security Rule:** `SUPABASE_SERVICE_ROLE_KEY` is strictly server-only (`src/lib/supabase/server.ts`) and is never exposed to client components or committed to Git.

---

## 3. Deployment Guide (Vercel)

1. Push the repository to GitHub (verify `.env.local` and `/data/*.json` are ignored by `.gitignore`).
2. Import the repository into [Vercel](https://vercel.com).
3. In Vercel **Project Settings -> Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_DEFAULT_EMAIL`
   - `ADMIN_DEFAULT_PASSWORD`
   - `SESSION_SECRET` (a 64-character random hex string)
   - `SEED_DEV_SAMPLE_DATA=false` (ensures production never seeds sample records)
4. Click **Deploy**.

---

## 4. Testing Instructions

### Automated End-to-End Verification Suite
Run the automated verification suite covering all 17 business and accounting requirements:
```bash
npm run test:pos
```
This script verifies:
1. Clean Production Mode initialization (0 sample records)
2. Product creation, editing, SKU uniqueness, and auto unit profit (`selling_price - purchase_price`)
3. Incoming stock purchases, damaged stock deductions, and oversell prevention
4. Billing subtotal, item-level & bill-level fixed (`₹`) and percentage (`%`) discounts, and idempotency keys
5. Split payments (e.g., `₹20` Cash + `₹25` UPI on a `₹45` bill) and manual UTR recording
6. Customer Udhaar tracking, partial payments, later repayments, duplicate UPI reference warnings, and audited payment corrections
7. Controlled bill cancellations & refunds with automatic stock restoration
8. COGS, Gross Profit, Operating Expenses, Net Profit, 8-way transaction filters, CSV export, and HMAC session authentication

---

## 5. Backup & Data-Export Guidance

1. **Full JSON Database Snapshot:**
   Navigate to **10. Settings -> Backup & Data Export** and click **Download Full JSON Backup Snapshot** to save a complete copy of all products, inventory movements, customers, sales, payments, expenses, and audit logs.
2. **Module CSV Exports:**
   - **Products:** Click **Export Report** on the **Products** page.
   - **Inventory:** Export either the **Opening & Closing Stock Reconciliation Ledger** or **Stock Movement History** from the **Inventory** page.
   - **Customers & Udhaar:** Click **Export Report** on the **Customers** page.
   - **Transactions:** Click **Export Report (CSV)** on the **Transactions** page.
   - **Manual Payments:** Click **Export Report** on the **Payments** page.
   - **12 Reports Suite:** Export any of the 12 reports in **9. Reports** to CSV.
3. **Production Separation:**
   In **10. Settings**, click **Switch to Clean Production (0 Records)** before recording real hostel canteen sales so sample development data is never mixed with live production records.
