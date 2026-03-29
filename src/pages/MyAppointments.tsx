/**
 * MyAppointments Page
 * Allows a client to enter their phone number and view their appointments.
 * The phone number is saved to localStorage for convenience.
 */

import { useEffect, useState } from "react";
import { getAppointmentsByPhone } from "@/lib/db";
import { getAppointments } from "@/services/api";
import { Appointment } from "@/services/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const PHONE_STORAGE_KEY = "userPhone";
const useSupabase = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

const statusLabel = (status: Appointment["status"]) => {
  switch (status) {
    case "pending":   return "ממתין לאישור";
    case "confirmed": return "מאושר";
    case "cancelled": return "בוטל";
    case "completed": return "הושלם";
    default:          return status;
  }
};

const statusClass = (status: Appointment["status"]) => {
  switch (status) {
    case "pending":   return "bg-amber-500/15 text-amber-900";
    case "confirmed": return "bg-primary/10 text-primary";
    case "cancelled": return "bg-destructive/10 text-destructive";
    case "completed": return "bg-muted text-muted-foreground";
    default:          return "bg-muted text-muted-foreground";
  }
};

export default function MyAppointments() {
  const [inputValue, setInputValue] = useState<string>(
    () => localStorage.getItem(PHONE_STORAGE_KEY) ?? ""
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // טעינה אוטומטית אם יש טלפון שמור
  useEffect(() => {
    const saved = localStorage.getItem(PHONE_STORAGE_KEY);
    if (saved && saved.length >= 7) {
      doFetch(saved);
    }
  }, []);

  const doFetch = async (phoneNumber: string) => {
    setLoading(true);
    setSearched(false);
    const cleaned = phoneNumber.replace(/\D/g, "");
    let filtered: Appointment[];
    if (useSupabase) {
      filtered = await getAppointmentsByPhone(cleaned);
    } else {
      const all = await getAppointments();
      filtered = all.filter(
        (a) => a.clientPhone.replace(/\D/g, "") === cleaned
      );
    }
    setAppointments(filtered);
    setLoading(false);
    setSearched(true);
  };

  const handleSearch = () => {
    if (inputValue.length < 7) return;
    localStorage.setItem(PHONE_STORAGE_KEY, inputValue);
    doFetch(inputValue);
  };

  const upcoming  = appointments.filter((a) => a.status !== "cancelled");
  const cancelled = appointments.filter((a) => a.status === "cancelled");

  return (
    <div dir="rtl" lang="he" className="min-h-[80vh] py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">התורים שלי</h1>
          <p className="text-muted-foreground">
            הזן את מספר הטלפון שלך כדי לצפות בתורים
          </p>
        </div>

        {/* Phone Input */}
        <div className="flex gap-2 mb-8">
          <Input
            type="tel"
            placeholder="לדוגמה: 050-1234567"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            dir="ltr"
            className="text-left"
          />
          <Button
            variant="hero"
            onClick={handleSearch}
            disabled={inputValue.length < 7 || loading}
          >
            {loading ? "טוען..." : "חיפוש"}
          </Button>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* No results */}
        {!loading && searched && appointments.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            לא נמצאו תורים למספר טלפון זה.
          </p>
        )}

        {/* Upcoming appointments */}
        {!loading && upcoming.length > 0 && (
          <div className="space-y-3 mb-6">
            <h2 className="text-lg font-semibold">תורים קרובים</h2>
            {upcoming.map((apt, i) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{apt.serviceName}</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusClass(apt.status)
                  )}>
                    {statusLabel(apt.status)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {apt.date} בשעה {apt.time}
                </p>
                {apt.notes && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    הערה: {apt.notes}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Cancelled appointments */}
        {!loading && cancelled.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground">
              תורים מבוטלים
            </h2>
            {cancelled.map((apt, i) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-border bg-muted/50 p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-muted-foreground">
                    {apt.serviceName}
                  </span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusClass(apt.status)
                  )}>
                    {statusLabel(apt.status)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {apt.date} בשעה {apt.time}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

