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
  BarChart2,
  Users,
  TrendingUp,
  Timer,
  Star,
  AlertTriangle,
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
  updateLateMinutes,
  getClientProfiles,
} from "@/services/api";
import { AdminServicesTab } from "@/components/AdminServicesTab";
import { Appointment, DaySchedule, BlockedDate, Service, ClientProfile } from "@/services/types";
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
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // State for adding a new blocked date
  const [blockDate, setBlockDate] = useState<Date | undefined>(undefined);
  const [blockReason, setBlockReason] = useState("");
  const [blockFullDay, setBlockFullDay] = useState(true);
  const [blockHours, setBlockHours] = useState("");

  // Late minutes editing
  const [lateEditId, setLateEditId] = useState<string | null>(null);
  const [lateEditValue, setLateEditValue] = useState<string>("");

  // כמה ימים קדימה ניתן לבחור תור
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number>(() => {
    const saved = localStorage.getItem("maxAdvanceDays");
    return saved ? parseInt(saved) : 30;
  });

  const handleMaxAdvanceDaysChange = (value: number) => {
    setMaxAdvanceDays(value);
    localStorage.setItem("maxAdvanceDays", String(value));
    toast.success("ההגדרה נשמרה");
  };

  // Load all admin data on mount
  useEffect(() => {
    Promise.all([
      getAppointments(),
      getWeeklySchedule(),
      getBlockedDates(),
      getServices(),
      getClientProfiles(),
    ]).then(([apts, sched, blocks, svc, profiles]) => {
      setAppointments(apts);
      setSchedule(sched);
      setBlockedDates(blocks);
      setServices([...svc]);
      setClientProfiles(profiles);
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

  const handleSaveLateMinutes = async (id: string) => {
    const val = lateEditValue === "" ? null : Number(lateEditValue);
    await updateLateMinutes(id, val);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lateMinutes: val } : a))
    );
    // Refresh profiles
    const profiles = await getClientProfiles();
    setClientProfiles(profiles);
    setLateEditId(null);
    setLateEditValue("");
    toast.success("האיחור נשמר");
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
          <TabsList className="mb-6 grid w-full grid-cols-3 sm:grid-cols-6 gap-1">
            <TabsTrigger value="appointments" className="gap-1 text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">תורים</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-1 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">שירותים</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1 text-xs sm:text-sm">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">שעות פעילות</span>
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-1 text-xs sm:text-sm">
              <CalendarOff className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">חסומים</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 text-xs sm:text-sm">
              <BarChart2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">סטטיסטיקות</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-1 text-xs sm:text-sm">
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">לקוחות</span>
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
                        {/* Late minutes display */}
                        {apt.lateMinutes != null && (
                          <p className="mt-1 text-xs text-amber-600 font-medium">
                            ⏱ איחר {apt.lateMinutes} דקות
                          </p>
                        )}
                        {/* Late minutes edit inline */}
                        {lateEditId === apt.id && (
                          <div className="mt-2 flex items-center gap-2" dir="ltr">
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              placeholder="0"
                              value={lateEditValue}
                              onChange={(e) => setLateEditValue(e.target.value)}
                              className="w-24 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground" dir="rtl">דקות איחור</span>
                            <Button size="sm" variant="hero" className="h-8 text-xs" onClick={() => handleSaveLateMinutes(apt.id)}>שמור</Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLateEditId(null)}>ביטול</Button>
                          </div>
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
                        {/* Late minutes button for confirmed/completed */}
                        {(apt.status === "confirmed" || apt.status === "completed") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLateEditId(apt.id);
                              setLateEditValue(apt.lateMinutes != null ? String(apt.lateMinutes) : "");
                            }}
                            className="gap-1 text-amber-600 border-amber-300 hover:text-amber-700"
                          >
                            <Timer className="h-3.5 w-3.5" />
                            איחור
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
                    "rounded-lg border border-border p-4 transition-colors",
                    day.isWorkingDay ? "bg-card" : "bg-muted/50"
                  )}
                >
                  {/* Row: toggle + day name + times */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Toggle + day name - fixed width so they align */}
                    <div className="flex items-center gap-3 w-36 shrink-0">
                      <Switch
                        checked={day.isWorkingDay}
                        onCheckedChange={() => handleToggleDay(day.dayOfWeek)}
                      />
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          !day.isWorkingDay && "text-muted-foreground"
                        )}
                      >
                        {day.dayName}
                      </span>
                    </div>

                    {/* Time inputs */}
                    {day.isWorkingDay ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-primary">שעת התחלה</span>
                          <Input
                            type="time"
                            value={day.startTime}
                            onChange={(e) =>
                              handleTimeChange(day.dayOfWeek, "startTime", e.target.value)
                            }
                            className="w-32 border-primary/40 focus:border-primary"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">שעת סיום</span>
                          <Input
                            type="time"
                            value={day.endTime}
                            onChange={(e) =>
                              handleTimeChange(day.dayOfWeek, "endTime", e.target.value)
                            }
                            className="w-32"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">סגור</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Advance booking setting - moved here from Settings tab */}
            <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-card space-y-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                הזמנה מקסימלית קדימה
              </h3>
              <p className="text-xs text-muted-foreground">
                לקוחות לא יוכלו לבחור תאריך מעבר למספר הימים שתגדירי כאן
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={maxAdvanceDays}
                  onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                  className="w-28"
                  dir="ltr"
                />
                <span className="text-sm text-muted-foreground">ימים</span>
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => handleMaxAdvanceDaysChange(maxAdvanceDays)}
                >
                  שמור
                </Button>
              </div>
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

          {/* ===== TAB: SETTINGS ===== */}
          <TabsContent value="settings">
            <div className="rounded-lg border border-border bg-card p-6 shadow-card space-y-6">
              <h3 className="text-lg font-semibold">הגדרות הזמנת תורים</h3>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  כמה ימים קדימה ניתן להזמין תור
                </label>
                <p className="text-xs text-muted-foreground">
                  לקוחות לא יוכלו לבחור תאריך מעבר למספר הימים שתגדיר כאן
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={maxAdvanceDays}
                    onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                    className="w-28"
                    dir="ltr"
                  />
                  <span className="text-sm text-muted-foreground">ימים</span>
                  <Button
                    variant="hero"
                    size="sm"
                    onClick={() => handleMaxAdvanceDaysChange(maxAdvanceDays)}
                  >
                    שמור
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ===== TAB: STATS ===== */}
          <TabsContent value="stats">
            {(() => {
              const total = appointments.length;
              const confirmed = appointments.filter(a => a.status === "confirmed").length;
              const completed = appointments.filter(a => a.status === "completed").length;
              const cancelled = appointments.filter(a => a.status === "cancelled").length;
              const pending = appointments.filter(a => a.status === "pending").length;
              const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

              // Appointments per day of week
              const dayCount: Record<string, number> = {};
              appointments.forEach(a => {
                const d = new Date(a.date + "T00:00:00");
                const name = format(d, "EEEE", { locale: he });
                dayCount[name] = (dayCount[name] ?? 0) + 1;
              });
              const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

              // Appointments per service
              const serviceCount: Record<string, number> = {};
              appointments.forEach(a => {
                serviceCount[a.serviceName] = (serviceCount[a.serviceName] ?? 0) + 1;
              });
              const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0];

              // Late appointments
              const lateApts = appointments.filter(a => a.lateMinutes != null && a.lateMinutes > 0);
              const avgLate = lateApts.length > 0
                ? Math.round(lateApts.reduce((s, a) => s + (a.lateMinutes ?? 0), 0) / lateApts.length)
                : null;

              // Monthly counts (last 6 months)
              const monthMap: Record<string, number> = {};
              appointments.forEach(a => {
                const month = a.date.slice(0, 7); // YYYY-MM
                monthMap[month] = (monthMap[month] ?? 0) + 1;
              });
              const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

              return (
                <div className="space-y-6">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border bg-card p-4 text-center shadow-card">
                      <div className="text-2xl font-bold text-primary">{total}</div>
                      <div className="text-xs text-muted-foreground mt-1">סה״כ תורים</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-center shadow-card">
                      <div className="text-2xl font-bold text-green-600">{confirmed + completed}</div>
                      <div className="text-xs text-muted-foreground mt-1">מאושרים / הושלמו</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-center shadow-card">
                      <div className="text-2xl font-bold text-amber-600">{pending}</div>
                      <div className="text-xs text-muted-foreground mt-1">ממתינים לאישור</div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 text-center shadow-card">
                      <div className="text-2xl font-bold text-red-500">{cancelRate}%</div>
                      <div className="text-xs text-muted-foreground mt-1">שיעור ביטולים</div>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-card p-4 shadow-card flex items-center gap-3">
                      <TrendingUp className="h-8 w-8 text-primary shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">יום עמוס ביותר</div>
                        <div className="text-lg font-bold">{busiestDay ? `${busiestDay[0]} (${busiestDay[1]})` : "—"}</div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 shadow-card flex items-center gap-3">
                      <Sparkles className="h-8 w-8 text-primary shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">שירות פופולרי</div>
                        <div className="text-lg font-bold">{topService ? `${topService[0]} (${topService[1]})` : "—"}</div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4 shadow-card flex items-center gap-3">
                      <Timer className="h-8 w-8 text-amber-500 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">ממוצע איחור</div>
                        <div className="text-lg font-bold">{avgLate != null ? `${avgLate} דק׳` : "לא הוזן"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Monthly bar chart */}
                  {months.length > 0 && (
                    <div className="rounded-lg border bg-card p-5 shadow-card">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-primary" />
                        תורים לפי חודש (6 חודשים אחרונים)
                      </h3>
                      <div className="flex items-end gap-2 h-32">
                        {months.map(([month, count]) => {
                          const maxCount = Math.max(...months.map(m => m[1]));
                          const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          return (
                            <div key={month} className="flex flex-col items-center gap-1 flex-1">
                              <span className="text-xs font-bold text-primary">{count}</span>
                              <div
                                className="w-full rounded-t bg-primary/70 transition-all"
                                style={{ height: `${heightPct}%`, minHeight: "4px" }}
                              />
                              <span className="text-xs text-muted-foreground">{month.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* ===== TAB: CLIENTS ===== */}
          <TabsContent value="clients">
            <div className="space-y-3">
              {clientProfiles.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">אין נתוני לקוחות</p>
              ) : (
                clientProfiles.map((client) => {
                  const scoreColor =
                    client.score >= 80 ? "text-green-600" :
                    client.score >= 50 ? "text-amber-500" : "text-red-500";
                  const scoreBg =
                    client.score >= 80 ? "bg-green-50 border-green-200" :
                    client.score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
                  return (
                    <div
                      key={client.phone}
                      className={cn("rounded-lg border p-4 shadow-card flex flex-col sm:flex-row sm:items-center gap-4", scoreBg)}
                    >
                      {/* Score circle */}
                      <div className={cn("flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 shrink-0 mx-auto sm:mx-0", scoreBg)}>
                        <span className={cn("text-xl font-bold", scoreColor)}>{client.score}</span>
                        <Star className={cn("h-3 w-3", scoreColor)} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-foreground">{client.name}</div>
                        <div className="text-sm text-muted-foreground">{client.phone}</div>
                        <div className="flex flex-wrap gap-3 text-xs mt-1">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {client.totalAppointments} תורים
                          </span>
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3 w-3" /> {client.cancelledAppointments} ביטולים
                          </span>
                          {client.avgLateMinutes != null && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Timer className="h-3 w-3" /> איחור ממוצע: {Math.round(client.avgLateMinutes)} דק׳
                            </span>
                          )}
                          {client.lastAppointment && (
                            <span className="text-muted-foreground">
                              תור אחרון: {client.lastAppointment}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score label */}
                      <div className="text-center shrink-0">
                        <div className={cn("text-xs font-semibold", scoreColor)}>
                          {client.score >= 80 ? "לקוח מעולה ⭐" :
                           client.score >= 50 ? "לקוח בינוני ⚠️" : "לקוח בעייתי 🚨"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground mb-2">איך מחושב הציון?</p>
              <p>• מתחיל מ-100 נקודות</p>
              <p>• כל ביטול מורד עד 50 נק׳ (בהתאם לאחוז ביטולים)</p>
              <p>• איחור ממוצע מוריד עד 30 נק׳ (5 נק׳ לכל 5 דקות איחור)</p>
              <p className="mt-2">💡 כדי לתעד איחור - לחץ על כפתור "איחור" בטאב התורים לאחר אישור התור</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
