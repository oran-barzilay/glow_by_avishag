/**
 * Admin Dashboard Page
 * Provides the business owner with tools to manage their salon:
 * 1. View upcoming appointments
 * 2. Set default working hours for each day
 * 3. Block specific dates or hours
 * 
 * Uses tabs to organize the three sections.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  CalendarOff,
  Check,
  Clock,
  CalendarDays,
  LogOut,
  Sparkles,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getAppointments,
  getWeeklySchedule,
  getBlockedDates,
  getServices,
  updateDaySchedule,
  addBlockedDate,
  removeBlockedDate,
  cancelAppointment,
  confirmAppointment,
} from "@/services/api";
import { AdminServicesTab } from "@/components/AdminServicesTab";
import { Appointment, DaySchedule, BlockedDate, Service } from "@/services/types";
import { toast } from "sonner";

const appointmentStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "ממתין לאישור";
    case "confirmed":
      return "מאושר";
    case "cancelled":
      return "בוטל";
    case "completed":
      return "הושלם";
    default:
      return status;
  }
};

const appointmentStatusBadgeClass = (status: Appointment["status"]) => {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-950 dark:text-amber-100";
    case "confirmed":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
};

interface AdminProps {
  onLogout: () => void;
}

const Admin = ({ onLogout }: AdminProps) => {
  // ===== STATE =====
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // State for adding a new blocked date
  const [blockDate, setBlockDate] = useState<Date | undefined>(undefined);
  const [blockReason, setBlockReason] = useState("");
  const [blockFullDay, setBlockFullDay] = useState(true);
  const [blockHours, setBlockHours] = useState("");

  // Load all admin data on mount
  useEffect(() => {
    Promise.all([
      getAppointments(),
      getWeeklySchedule(),
      getBlockedDates(),
      getServices(),
    ]).then(([apts, sched, blocks, svc]) => {
      setAppointments(apts);
      setSchedule(sched);
      setBlockedDates(blocks);
      setServices([...svc]);
      setLoading(false);
    });
  }, []);

  /**
   * Toggles whether a day is a working day or not,
   * and saves the change via the API.
   */
  const handleToggleDay = async (dayOfWeek: number) => {
    const day = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;

    const updated = { ...day, isWorkingDay: !day.isWorkingDay };
    await updateDaySchedule(updated);
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? updated : d))
    );
    toast.success(`${day.dayName} עודכן`);
  };

  /**
   * Updates the start or end time for a specific day.
   */
  const handleTimeChange = async (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    const day = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;

    const updated = { ...day, [field]: value };
    await updateDaySchedule(updated);
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? updated : d))
    );
  };

  /**
   * Adds a new blocked date to the schedule.
   */
  const handleAddBlock = async () => {
    if (!blockDate) {
      toast.error("נא לבחור תאריך לחסימה");
      return;
    }

    // Parse blocked hours if not blocking the full day
    const hours = blockFullDay
      ? null
      : blockHours.split(",").map((h) => h.trim()).filter(Boolean);

    await addBlockedDate({
      date: format(blockDate, "yyyy-MM-dd"),
      blockedHours: hours,
      reason: blockReason || "ללא סיבה",
    });

    // Refresh blocked dates list
    const updated = await getBlockedDates();
    setBlockedDates(updated);

    // Reset form
    setBlockDate(undefined);
    setBlockReason("");
    setBlockHours("");
    toast.success("התאריך נחסם בהצלחה");
  };

  /**
   * Removes a blocked date.
   */
  const handleRemoveBlock = async (id: string) => {
    await removeBlockedDate(id);
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    toast.success("החסימה הוסרה");
  };

  /**
   * Cancels an appointment.
   */
  const handleCancelAppointment = async (id: string) => {
    await cancelAppointment(id);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
    );
    toast.success("התור בוטל");
  };

  const handleConfirmAppointment = async (id: string) => {
    await confirmAppointment(id);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a))
    );
    toast.success("התור אושר");
  };

  if (loading) {
    return (
      <div dir="rtl" lang="he" className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div dir="rtl" lang="he" className="min-h-[80vh] py-8">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-start">
            <h1 className="mb-2 text-3xl font-bold">לוח בקרה</h1>
            <p className="text-muted-foreground">
              ניהול יומן, תורים, שירותים וזמינות
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="shrink-0 gap-2 self-start"
          >
            <LogOut className="h-4 w-4" />
            התנתקות
          </Button>
        </div>

        {/* ===== TABBED INTERFACE ===== */}
        <Tabs defaultValue="appointments" className="w-full" dir="rtl">
          <TabsList className="mb-6 grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="appointments" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">תורים</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">שירותים</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">שעות פעילות</span>
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-2">
              <CalendarOff className="h-4 w-4" />
              <span className="hidden sm:inline">תאריכים חסומים</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB 1: APPOINTMENTS ===== */}
          <TabsContent value="appointments">
            <div className="space-y-3">
              {appointments.filter((a) => a.status !== "cancelled").length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                  אין תורים קרובים
                </p>
              ) : (
                appointments
                  .filter((a) => a.status !== "cancelled")
                  .map((apt, i) => (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {apt.serviceName}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              appointmentStatusBadgeClass(apt.status)
                            )}
                          >
                            {appointmentStatusLabel(apt.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {apt.date} בשעה {apt.time} · {apt.clientName} · {apt.clientPhone}
                        </p>
                        {apt.notes && (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            הערה: {apt.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        {apt.status === "pending" && (
                          <Button
                            variant="hero"
                            size="sm"
                            onClick={() => handleConfirmAppointment(apt.id)}
                            className="gap-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            אשר תור
                          </Button>
                        )}
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelAppointment(apt.id)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            ביטול
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))
              )}
            </div>
          </TabsContent>

          {/* ===== TAB: SERVICES ===== */}
          <TabsContent value="services">
            <AdminServicesTab services={services} setServices={setServices} />
          </TabsContent>

          {/* ===== TAB 2: WORKING HOURS ===== */}
          <TabsContent value="schedule">
            <div className="space-y-3">
              {schedule.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors sm:flex-row sm:items-center",
                    day.isWorkingDay ? "bg-card" : "bg-muted/50"
                  )}
                >
                  {/* Day name (first in DOM for RTL reading order) + toggle */}
                  <div className="flex min-w-[140px] items-center gap-3">
                    <span
                      className={cn(
                        "font-medium",
                        !day.isWorkingDay && "text-muted-foreground"
                      )}
                    >
                      {day.dayName}
                    </span>
                    <Switch
                      checked={day.isWorkingDay}
                      onCheckedChange={() => handleToggleDay(day.dayOfWeek)}
                    />
                  </div>

                  {/* Time inputs (only shown if it's a working day) — LTR for native time controls */}
                  {day.isWorkingDay && (
                    <div className="flex items-center gap-2" dir="ltr">
                      <Input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          handleTimeChange(day.dayOfWeek, "startTime", e.target.value)
                        }
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground" dir="rtl">
                        עד
                      </span>
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          handleTimeChange(day.dayOfWeek, "endTime", e.target.value)
                        }
                        className="w-32"
                      />
                    </div>
                  )}

                  {!day.isWorkingDay && (
                    <span className="text-sm text-muted-foreground">סגור</span>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ===== TAB 3: BLOCKED DATES ===== */}
          <TabsContent value="blocked">
            {/* Form to add a new blocked date */}
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <h3 className="mb-4 text-lg font-semibold">חסימת תאריך</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Date picker */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">תאריך</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-start font-normal",
                          !blockDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="me-2 h-4 w-4" />
                        {blockDate ? format(blockDate, "PPP", { locale: he }) : "בחרו תאריך"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start" dir="rtl">
                      <Calendar
                        mode="single"
                        selected={blockDate}
                        onSelect={setBlockDate}
                        disabled={(date) => date < new Date()}
                        locale={he}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Reason input */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">סיבה</label>
                  <Input
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="לדוגמה: חג"
                  />
                </div>

                {/* Full day toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-sm">חסימת יום שלם</span>
                  <Switch
                    checked={blockFullDay}
                    onCheckedChange={setBlockFullDay}
                  />
                </div>

                {/* Specific hours input (shown when not blocking full day) */}
                {!blockFullDay && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      שעות לחסימה (מופרדות בפסיקים)
                    </label>
                    <Input
                      value={blockHours}
                      onChange={(e) => setBlockHours(e.target.value)}
                      placeholder="לדוגמה: 09:00, 09:30, 10:00"
                    />
                  </div>
                )}
              </div>

              <Button
                onClick={handleAddBlock}
                variant="hero"
                className="mt-4 gap-2"
              >
                חסימת תאריך
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* List of currently blocked dates */}
            <div className="space-y-3">
              {blockedDates.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  אין תאריכים חסומים
                </p>
              ) : (
                blockedDates.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card"
                  >
                    <div>
                      <span className="font-medium">{block.date}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">
                        {block.blockedHours
                          ? `שעות: ${block.blockedHours.join(", ")}`
                          : "יום שלם"}
                      </span>
                      {block.reason && (
                        <span className="ms-2 text-sm text-muted-foreground italic">
                          ({block.reason})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveBlock(block.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
