/**
 * MyAppointments Page
 * Allows a client to enter their phone number and view their appointments.
 * The phone number is saved to localStorage for convenience.
 */

import { useEffect, useState } from "react";
import { getAppointmentsByPhone } from "@/lib/db";
import { getAppointments, getAvailableSlots, rescheduleAppointmentByClient, getBlockedDates, getWeeklySchedule } from "@/services/api";
import { Appointment, BlockedDate, DaySchedule } from "@/services/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { formatHebrewDate } from "@/lib/dateFormat";
import { CalendarDays, Clock, X } from "lucide-react";
import { toast } from "sonner";

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

const formatIsraeliDate = (isoDate: string) => formatHebrewDate(isoDate);

// ── Reschedule modal ──────────────────────────────────────────────────────
function RescheduleModal({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSaved: (apt: Appointment) => void;
}) {
  const [step, setStep] = useState<"date" | "time">("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);

  useEffect(() => {
    Promise.all([getBlockedDates(), getWeeklySchedule()]).then(([blocks, weekly]) => {
      setBlockedDates(blocks);
      setWeeklySchedule(weekly);
    });
  }, []);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const maxAdvanceDays = parseInt(localStorage.getItem("maxAdvanceDays") ?? "30");
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
  maxDate.setHours(23, 59, 59, 999);

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setLoadingSlots(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const available = await getAvailableSlots(dateStr, appointment.serviceId, appointment.therapistId);
    setSlots(available);
    setLoadingSlots(false);
    setStep("time");
  };

  const handleTimeSelect = async (time: string) => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      await rescheduleAppointmentByClient(appointment.id, dateStr, time);
      toast.success("הבקשה לשינוי נקלטה ונשלחה לאישור מנהל ✓");
      onSaved({ ...appointment, date: dateStr, time, status: "pending" });
      onClose();
    } catch {
      toast.error("שגיאה בשמירת השינוי");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">שינוי מועד תור</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {appointment.serviceName} · {appointment.therapistName ?? ""}
        </p>

        {step === "date" && (
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(d) => {
                if (d < todayStart || d > maxDate) return true;
                const dateStr = format(d, "yyyy-MM-dd");
                const isBlocked = blockedDates.some((b) => b.date === dateStr && b.blockedHours === null);
                if (isBlocked) return true;
                const daySchedule = weeklySchedule.find((w) => w.dayOfWeek === d.getDay());
                return !!daySchedule && !daySchedule.isWorkingDay;
              }}
              modifiers={{
                blocked: (d) => {
                  const dateStr = format(d, "yyyy-MM-dd");
                  return blockedDates.some((b) => b.date === dateStr && b.blockedHours === null);
                },
                closed: (d) => {
                  const daySchedule = weeklySchedule.find((w) => w.dayOfWeek === d.getDay());
                  return !!daySchedule && !daySchedule.isWorkingDay;
                },
              }}
              modifiersClassNames={{
                blocked: "bg-zinc-300/70 text-zinc-500 line-through opacity-70",
                closed: "bg-zinc-400/80 text-zinc-600 opacity-80",
              }}
              locale={he}
              className="pointer-events-auto"
            />
          </div>
        )}

        {step === "time" && (
          <div>
            <button
              onClick={() => setStep("date")}
              className="text-xs text-primary mb-3 flex items-center gap-1 hover:underline"
            >
              <CalendarDays className="h-3 w-3" />
              {selectedDate && format(selectedDate, "EEEE, d MMM", { locale: he })} — שנה תאריך
            </button>

            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <p className="text-xs text-amber-700 mb-2">לאחר שינוי מועד התור יעבור לאישור מחדש של המנהל</p>
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {slots.filter((s) => s.available).map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={saving}
                      onClick={() => handleTimeSelect(s.time)}
                      className="rounded-lg border border-border bg-card py-2 text-sm font-medium hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      {s.time}
                    </button>
                  ))}
                  {slots.filter((s) => s.available).length === 0 && (
                    <p className="col-span-3 text-center text-sm text-muted-foreground py-4">אין שעות פנויות</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function MyAppointments() {
  const [inputValue, setInputValue] = useState<string>(
    () => localStorage.getItem(PHONE_STORAGE_KEY) ?? ""
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);

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
      filtered = all.filter((a) => a.clientPhone.replace(/\D/g, "") === cleaned);
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

  const handleRescheduleSaved = (updated: Appointment) => {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const upcoming  = appointments.filter((a) => a.status !== "cancelled");
  const cancelled = appointments.filter((a) => a.status === "cancelled");

  return (
    <div dir="rtl" lang="he" className="min-h-[80vh] py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">התורים שלי</h1>
          <p className="text-muted-foreground">הזן את מספר הטלפון שלך כדי לצפות בתורים</p>
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
          <Button variant="hero" onClick={handleSearch} disabled={inputValue.length < 7 || loading}>
            {loading ? "טוען..." : "חיפוש"}
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && searched && appointments.length === 0 && (
          <p className="text-center text-muted-foreground py-12">לא נמצאו תורים למספר טלפון זה.</p>
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
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusClass(apt.status))}>
                    {statusLabel(apt.status)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatIsraeliDate(apt.date)} בשעה {apt.time}
                  {apt.therapistName && ` · ${apt.therapistName}`}
                </p>
                {apt.notes && (
                  <p className="mt-1 text-xs text-muted-foreground italic">הערה: {apt.notes}</p>
                )}
                {/* כפתור שינוי מועד — רק לתורים עתידיים שלא בוטלו */}
                {(apt.status === "pending" || apt.status === "confirmed") && apt.date >= format(new Date(), "yyyy-MM-dd") && (
                  <button
                    type="button"
                    onClick={() => setRescheduleApt(apt)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    שנה מועד תור
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Cancelled appointments */}
        {!loading && cancelled.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground">תורים מבוטלים</h2>
            {cancelled.map((apt, i) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-border bg-muted/50 p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-muted-foreground">{apt.serviceName}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusClass(apt.status))}>
                    {statusLabel(apt.status)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{formatIsraeliDate(apt.date)} בשעה {apt.time}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Reschedule modal */}
      <AnimatePresence>
        {rescheduleApt && (
          <RescheduleModal
            appointment={rescheduleApt}
            onClose={() => setRescheduleApt(null)}
            onSaved={handleRescheduleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
