"use client";

import React, { useEffect, useState } from "react";
import { BadgePercent } from "lucide-react";

export function CommissionRateCard() {
  const [rate, setRate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team?period=all")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setRate(String(json.commission_rate_percent));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_commission_rate", rate: Number(rate) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save commission rate.");
      setRate(String(json.commission_rate_percent));
      setMessage({
        ok: true,
        text: `Saved. ${json.commission_rate_percent}% applies to bills created from now on.`,
      });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to save commission rate.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3 text-xs">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
        <BadgePercent className="h-4 w-4 text-[#2563EB]" />
        <h2 className="text-sm font-bold text-[#111827]">Sales Executive Commission</h2>
      </div>
      <p className="text-gray-500">
        Commission = this percentage of the profit on each executive&apos;s non-cancelled
        bills. Changing it affects new bills only; earlier bills keep the rate they were
        created with.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold"
        />
        <span className="font-bold text-gray-600">%</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || rate === ""}
          className="btn-3d-primary rounded-lg px-3.5 py-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving..." : "Save Rate"}
        </button>
      </div>
      {message && (
        <div className={message.ok ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
          {message.text}
        </div>
      )}
    </div>
  );
}
