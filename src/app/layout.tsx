import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hostel Canteen POS — Complete Canteen Management System",
  description:
    "Modern point-of-sale, inventory, customer udhaar, manual cash/UPI payment tracking, expense and profit management system for hostel canteens.",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F3F4F6] text-[#111827] antialiased">
        {children}
      </body>
    </html>
  );
}
