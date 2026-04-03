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
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  EyeOff,
  KeyRound,
  UserCog,
  CalendarCheck,
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
  getAdminPassword,
  setAdminPassword,
  getTherapists,
  rescheduleAppointment,
  deleteAppointment,
} from "@/services/api";
import { AdminServicesTab } from "@/components/AdminServicesTab";
import { AdminTherapistsTab } from "@/components/AdminTherapistsTab";
import { AdminDailyCalendar } from "@/components/AdminDailyCalendar";
import { Appointment, DaySchedule, BlockedDate, Service, ClientProfile, Therapist } from "@/services/types";
import { getHolidayDates, getErevChagDates, getHolidayNameMap } from "@/lib/israeliHolidays";
import { toast } from "sonner";

const appointmentStatusLabel = (status: string) => {
  switch (status) {
    case "pending": return "ממתין לאישור";
    case "confirmed": return "מאושר";
    case "cancelled": return "בוטל";
    case "completed": return "הושלם";
    default: return status;
  }
};

const appointmentStatusBadgeClass = (status: Appointment["status"]) => {
  switch (status) {
    case "pending": return "bg-amber-500/15 text-amber-950 dark:text-amber-100";
    case "confirmed": return "bg-primary/10 text-primary";
    default: return "bg-muted text-muted-foreground";
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
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);

  // Collapse state for schedule sections
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [blockedOpen, setBlockedOpen] = useState(false);

  // Collapse state for clients sections
  const [statsOpen, setStatsOpen] = useState(true);
  const [clientListOpen, setClientListOpen] = useState(false);

  // Blocked date form
  const [blockDate, setBlockDate] = useState<Date | undefined>(undefined);
  const [blockReason, setBlockReason] = useState("");
  const [blockFullDay, setBlockFullDay] = useState(true);
  const [blockHours, setBlockHours] = useState("");

  // Late minutes editing
  const [lateEditId, setLateEditId] = useState<string | null>(null);
  const [lateEditValue, setLateEditValue] = useState<string>("");

  // Max advance days
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number>(() => {
    const saved = localStorage.getItem("maxAdvanceDays");
    return saved ? parseInt(saved) : 30;
  });

  // קפיצת זמן לפי שירות עוגן
  const anchorService = services.find((s) => s.isAnchor);
  const anchorStepMinutes = anchorService
    ? Math.max(5, anchorService.duration + (anchorService.breakMinutes ?? 0))
    : 5;
  const anchorStepSeconds = anchorStepMinutes * 60;

  const snapTimeToStep = (time: string, stepMinutes: number): string => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m;
    const snapped = Math.round(total / stepMinutes) * stepMinutes;
    const clamped = Math.max(0, Math.min(23 * 60 + 59, snapped));
    const hh = Math.floor(clamped / 60);
    const mm = clamped % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
  };

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleMaxAdvanceDaysChange = (value: number) => {
    setMaxAdvanceDays(value);
    localStorage.setItem("maxAdvanceDays", String(value));
    toast.success("ההגדרה נשמרה");
  };

  const handleBlockHolidays = async () => {
    const holidayDates = getHolidayDates();
    const nameMap = getHolidayNameMap();
    const existing = new Set(blockedDates.map((b) => b.date));
    const toAdd = holidayDates.filter((d) => !existing.has(d));
    if (toAdd.length === 0) {
      toast.info("כל ימי החג כבר חסומים");
      return;
    }
    for (const d of toAdd) {
      await addBlockedDate({ date: d, blockedHours: null, reason: nameMap[d] ?? "חג" });
    }
    setBlockedDates(await getBlockedDates());
    toast.success(`נחסמו ${toAdd.length} ימי חג`);
  };

  const handleBlockErevChag = async () => {
    const erevDates = getErevChagDates();
    const nameMap = getHolidayNameMap();
    const existing = new Set(blockedDates.map((b) => b.date));
    const toAdd = erevDates.filter((d) => !existing.has(d));
    if (toAdd.length === 0) {
      toast.info("כל ערבי החג כבר חסומים");
      return;
    }
    for (const d of toAdd) {
      await addBlockedDate({ date: d, blockedHours: null, reason: nameMap[d] ?? "ערב חג" });
    }
    setBlockedDates(await getBlockedDates());
    toast.success(`נחסמו ${toAdd.length} ערבי חג`);
  };

  // Keep the existing "הזז" buttons working without extra modal state.
  const setRescheduleApt = async (apt: Appointment) => {
    const dateInput = window.prompt("תאריך חדש (YYYY-MM-DD)", apt.date);
    if (!dateInput) return;
    const timeInput = window.prompt("שעה חדשה (HH:MM)", apt.time);
    if (!timeInput) return;
    await rescheduleAppointment(apt.id, dateInput, timeInput);
    setAppointments((prev) => prev.map((a) => (a.id === apt.id ? { ...a, date: dateInput, time: timeInput } : a)));
    toast.success("התור הוזז בהצלחה");
  };

  useEffect(() => {
    Promise.all([
      getAppointments(),
      getWeeklySchedule(),
      getBlockedDates(),
      getServices(),
      getClientProfiles(),
      getTherapists(),
    ]).then(([apts, sched, blocks, svc, profiles, therapistList]) => {
      setAppointments(apts);
      setSchedule(sched);
      setBlockedDates(blocks);
      setServices([...svc]);
      setClientProfiles(profiles);
      setTherapists(therapistList);
      setLoading(false);
    });
  }, []);

  const handleToggleDay = async (dayOfWeek: number) => {
    const day = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;
    const updated = { ...day, isWorkingDay: !day.isWorkingDay };
    await updateDaySchedule(updated);
    setSchedule((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? updated : d)));
    toast.success(`${day.dayName} עודכן`);
  };

  const handleTimeChange = async (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    const day = schedule.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return;

    const nextValue = snapTimeToStep(value, anchorStepMinutes);
    const updated = { ...day, [field]: nextValue };

    // מוודא שעת סיום אחרי שעת התחלה לפחות קפיצה אחת
    if (updated.startTime >= updated.endTime) {
      if (field === "startTime") {
        const [h, m] = updated.startTime.split(":").map(Number);
        const endMins = h * 60 + m + anchorStepMinutes;
        const hh = Math.floor(Math.min(endMins, 23 * 60 + 59) / 60);
        const mm = Math.min(endMins, 23 * 60 + 59) % 60;
        updated.endTime = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
      } else {
        const [h, m] = updated.endTime.split(":").map(Number);
        const startMins = Math.max(0, h * 60 + m - anchorStepMinutes);
        const hh = Math.floor(startMins / 60);
        const mm = startMins % 60;
        updated.startTime = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
      }
    }

    await updateDaySchedule(updated);
    setSchedule((prev) => prev.map((d) => (d.dayOfWeek === dayOfWeek ? updated : d)));
  };

  const handleAddBlock = async () => {
    if (!blockDate) { toast.error("נא לבחור תאריך לחסימה"); return; }
    const hours = blockFullDay ? null : blockHours.split(",").map((h) => h.trim()).filter(Boolean);
    await addBlockedDate({ date: format(blockDate, "yyyy-MM-dd"), blockedHours: hours, reason: blockReason || "ללא סיבה" });
    const updated = await getBlockedDates();
    setBlockedDates(updated);
    setBlockDate(undefined);
    setBlockReason("");
    setBlockHours("");
    toast.success("התאריך נחסם בהצלחה");
  };

  const handleRemoveBlock = async (id: string) => {
    await removeBlockedDate(id);
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    toast.success("החסימה הוסרה");
  };

  const handleCancelAppointment = async (id: string) => {
    await cancelAppointment(id);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a)));
    toast.success("התור בוטל");
  };

  const handleDeleteAppointment = async (id: string) => {
    await deleteAppointment(id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    toast.success("התור נמחק לצמיתות");
  };

  const handleConfirmAppointment = async (id: string) => {
    await confirmAppointment(id);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "confirmed" as const } : a)));
    toast.success("התור אושר");
  };

  const handleSaveLateMinutes = async (id: string) => {
    const val = lateEditValue === "" ? null : Number(lateEditValue);
    await updateLateMinutes(id, val);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, lateMinutes: val } : a)));
    const profiles = await getClientProfiles();
    setClientProfiles(profiles);
    setLateEditId(null);
    setLateEditValue("");
    toast.success("האיחור נשמר");
  };

  const handleChangePassword = async () => {
    if (!newPassword) { toast.error("יש להזין סיסמה חדשה"); return; }
    if (newPassword !== confirmPassword) { toast.error("הסיסמאות אינן תואמות"); return; }
    if (newPassword.length < 4) { toast.error("הסיסמה חייבת להכיל לפחות 4 תווים"); return; }

    // verify current password
    setSavingPassword(true);
    try {
      const dbPw = await getAdminPassword();
      const fallback = import.meta.env.VITE_ADMIN_PASSWORD ?? "i_am_shugi";
      const correct = dbPw ?? fallback;
      if (currentPassword !== correct) { toast.error("הסיסמה הנוכחית שגויה"); return; }
      await setAdminPassword(newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("הסיסמה עודכנה בהצלחה ✓");
    } catch {
      toast.error("שגיאה בשמירת הסיסמה");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" lang="he" className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── helper: collapsible section header ───────────────────────────────────
  const SectionHeader = ({
    title, icon, open, onToggle, badge,
  }: { title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; badge?: number }) => (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-card hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-2 font-semibold text-foreground">
        {icon}
        {title}
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{badge}</span>
        )}
      </div>
      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div dir="rtl" lang="he" className="min-h-[80vh] py-8">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-start">
            <h1 className="mb-2 text-3xl font-bold">לוח בקרה</h1>
            <p className="text-muted-foreground">ניהול יומן, תורים, שירותים וזמינות</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onLogout} className="shrink-0 gap-2 self-start">
            <LogOut className="h-4 w-4" />
            התנתקות
          </Button>
        </div>

        <Tabs defaultValue="appointments" className="w-full" dir="rtl">
          <TabsList className="mb-6 h-auto grid w-full grid-cols-4 grid-rows-2 sm:grid-rows-1 sm:grid-cols-7 gap-1 p-1">
            <TabsTrigger value="appointments" className="gap-1 text-xs py-2">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>תורים</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1 text-xs py-2">
              <CalendarCheck className="h-4 w-4 shrink-0" />
              <span>יומן</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-1 text-xs py-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>שירותים</span>
            </TabsTrigger>
            <TabsTrigger value="therapists" className="gap-1 text-xs py-2">
              <UserCog className="h-4 w-4 shrink-0" />
              <span>מטפלות</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1 text-xs py-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>שעות</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-1 text-xs py-2">
              <Users className="h-4 w-4 shrink-0" />
              <span>לקוחות</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs py-2">
              <Settings className="h-4 w-4 shrink-0" />
              <span>הגדרות</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: APPOINTMENTS ===== */}
          <TabsContent value="appointments">
            {(() => {
              const today = format(new Date(), "yyyy-MM-dd");
              // רק תורים עתידיים, ממוינים לפי תאריך כניסה (createdAt)
              const future = appointments
                .filter((a) => a.date >= today)
                .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
              const activeApts   = future.filter((a) => a.status !== "cancelled");
              const cancelledApts = future.filter((a) => a.status === "cancelled");

              return (
                <div className="space-y-3">
                  {/* תורים פעילים */}
                  {activeApts.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">אין תורים עתידיים פעילים</p>
                  )}
                  {activeApts.map((apt, i) => (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-semibold text-foreground">{apt.serviceName}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", appointmentStatusBadgeClass(apt.status))}>
                            {appointmentStatusLabel(apt.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {apt.date} בשעה {apt.time} · {apt.clientName} · {apt.clientPhone}
                          {apt.therapistName && ` · ${apt.therapistName}`}
                        </p>
                        {apt.notes && <p className="mt-1 text-xs text-muted-foreground italic">הערה: {apt.notes}</p>}
                        {apt.lateMinutes != null && (
                          <p className="mt-1 text-xs text-amber-600 font-medium">⏱ איחר {apt.lateMinutes} דקות</p>
                        )}
                        {lateEditId === apt.id && (
                          <div className="mt-2 flex items-center gap-2" dir="ltr">
                            <Input type="number" min={0} max={120} placeholder="0" value={lateEditValue}
                              onChange={(e) => setLateEditValue(e.target.value)} className="w-24 h-8 text-sm" />
                            <span className="text-xs text-muted-foreground" dir="rtl">דקות איחור</span>
                            <Button size="sm" variant="hero" className="h-8 text-xs" onClick={() => handleSaveLateMinutes(apt.id)}>שמור</Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setLateEditId(null)}>ביטול</Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        {apt.status === "pending" && (
                          <Button variant="hero" size="sm" onClick={() => handleConfirmAppointment(apt.id)} className="gap-1">
                            <Check className="h-3.5 w-3.5" />אשר
                          </Button>
                        )}
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <Button variant="outline" size="sm" onClick={() => setRescheduleApt(apt)}
                            className="gap-1 text-blue-600 border-blue-200 hover:text-blue-700">
                            <Clock className="h-3.5 w-3.5" />הזז
                          </Button>
                        )}
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <Button variant="outline" size="sm" onClick={() => handleCancelAppointment(apt.id)}
                            className="gap-1 text-destructive hover:text-destructive">
                            בטל<X className="h-3 w-3" />
                          </Button>
                        )}
                        {(apt.status === "confirmed" || apt.status === "completed") && (
                          <Button variant="outline" size="sm"
                            onClick={() => { setLateEditId(apt.id); setLateEditValue(apt.lateMinutes != null ? String(apt.lateMinutes) : ""); }}
                            className="gap-1 text-amber-600 border-amber-300 hover:text-amber-700">
                            <Timer className="h-3.5 w-3.5" />איחור
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteAppointment(apt.id)}
                          className="gap-1 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}

                  {/* תורים מבוטלים (עתידיים) */}
                  {cancelledApts.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <X className="h-4 w-4" />
                        תורים מבוטלים ({cancelledApts.length})
                      </h3>
                      <div className="space-y-2">
                        {cancelledApts.map((apt, i) => (
                          <motion.div
                            key={apt.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex-1">
                              <div className="mb-0.5 flex items-center gap-2">
                                <span className="font-medium text-muted-foreground text-sm">{apt.serviceName}</span>
                                <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-medium">בוטל</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {apt.date} בשעה {apt.time} · {apt.clientName} · {apt.clientPhone}
                                {apt.therapistName && ` · ${apt.therapistName}`}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                              <Button variant="outline" size="sm"
                                onClick={async () => {
                                  await confirmAppointment(apt.id);
                                  setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "confirmed" as const } : a));
                                  toast.success("התור הוחזר ואושר");
                                }}
                                className="gap-1 text-green-600 border-green-200 hover:text-green-700 text-xs">
                                <Check className="h-3 w-3" />החזר
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setRescheduleApt(apt)}
                                className="gap-1 text-blue-600 border-blue-200 hover:text-blue-700 text-xs">
                                <Clock className="h-3 w-3" />הזז
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteAppointment(apt.id)}
                                className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* ===== TAB: SERVICES ===== */}
          <TabsContent value="services">
            <AdminServicesTab services={services} setServices={setServices} />
          </TabsContent>

          {/* ===== TAB: DAILY CALENDAR ===== */}
          <TabsContent value="calendar">
            {therapists.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">הוסיפי מטפלת כדי לצפות ביומן</p>
            ) : (
              <AdminDailyCalendar
                appointments={appointments}
                therapists={therapists}
                services={services}
                schedule={schedule}
                onAppointmentUpdated={(updated) =>
                  setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                }
              />
            )}
          </TabsContent>

          {/* ===== TAB: THERAPISTS ===== */}
          <TabsContent value="therapists">
            <AdminTherapistsTab
              therapists={therapists}
              setTherapists={setTherapists}
              services={services}
            />
          </TabsContent>

          {/* ===== TAB: SCHEDULE + BLOCKED (merged, collapsible) ===== */}
          <TabsContent value="schedule">
            <div className="space-y-3">

              {/* ── Section 1: Working Hours ── */}
              <SectionHeader
                title="שעות פעילות"
                icon={<Clock className="h-4 w-4 text-primary" />}
                open={scheduleOpen}
                onToggle={() => setScheduleOpen((v) => !v)}
              />
              {scheduleOpen && (
                <div className="space-y-2 pt-1 pb-2">
                  {schedule.map((day) => (
                    <div
                      key={day.dayOfWeek}
                      className={cn("rounded-lg border border-border p-4 transition-colors", day.isWorkingDay ? "bg-card" : "bg-muted/50")}
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 w-36 shrink-0">
                          <Switch checked={day.isWorkingDay} onCheckedChange={() => handleToggleDay(day.dayOfWeek)} />
                          <span className={cn("font-semibold text-sm", !day.isWorkingDay && "text-muted-foreground")}>
                            {day.dayName}
                          </span>
                        </div>
                        {day.isWorkingDay ? (
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-primary">שעת התחלה</span>
                              <Input type="time" value={day.startTime}
                                onChange={(e) => handleTimeChange(day.dayOfWeek, "startTime", e.target.value)}
                                step={anchorStepSeconds}
                                className="w-32 border-primary/40 focus:border-primary" dir="ltr" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-muted-foreground">שעת סיום</span>
                              <Input type="time" value={day.endTime}
                                onChange={(e) => handleTimeChange(day.dayOfWeek, "endTime", e.target.value)}
                                step={anchorStepSeconds}
                                className="w-32" dir="ltr" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">סגור</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Max advance days */}
                  <div className="mt-4 rounded-lg border border-border bg-card p-4 shadow-card space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      הזמנה מקסימלית קדימה
                    </div>
                    <p className="text-xs text-muted-foreground">לקוחות לא יוכלו לבחור תאריך מעבר למספר הימים שתגדירי</p>
                    {anchorService && (
                      <p className="text-xs text-muted-foreground">
                        קפיצת שעות הפעילות מותאמת לשירות העוגן: {anchorStepMinutes} דקות.
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <Input type="number" min={1} max={365} value={maxAdvanceDays}
                        onChange={(e) => setMaxAdvanceDays(Number(e.target.value))} className="w-28" dir="ltr" />
                      <span className="text-sm text-muted-foreground">ימים</span>
                      <Button variant="hero" size="sm" onClick={() => handleMaxAdvanceDaysChange(maxAdvanceDays)}>שמור</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Section 2: Blocked Dates ── */}
              <SectionHeader
                title="תאריכים חסומים"
                icon={<CalendarOff className="h-4 w-4 text-destructive" />}
                open={blockedOpen}
                onToggle={() => setBlockedOpen((v) => !v)}
                badge={blockedDates.length}
              />
              {blockedOpen && (
                <div className="space-y-3 pt-1 pb-2">

                  {/* ── Quick holiday blocking ── */}
                  <div className="rounded-lg border border-border bg-card p-4 shadow-card space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <CalendarOff className="h-4 w-4 text-primary" />
                      חסימה מהירה לפי לוח השנה העברי
                    </div>
                    <p className="text-xs text-muted-foreground">חוסם אוטומטית את כל ימי החג / ערבי החג לשנים הקרובות (2025–2028)</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleBlockHolidays}>
                        <CalendarOff className="h-3.5 w-3.5" />
                        חסום ימי חג
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleBlockErevChag}>
                        <Clock className="h-3.5 w-3.5" />
                        חסום ערבי חג
                      </Button>
                    </div>
                  </div>

                  {/* Add blocked date form */}
                  <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                    <h3 className="mb-4 text-base font-semibold">הוספת חסימה</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">תאריך</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-start font-normal", !blockDate && "text-muted-foreground")}>
                              <CalendarDays className="me-2 h-4 w-4" />
                              {blockDate ? format(blockDate, "PPP", { locale: he }) : "בחרי תאריך"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start" dir="rtl">
                            <Calendar mode="single" selected={blockDate} onSelect={setBlockDate}
                              disabled={(date) => date < new Date()} locale={he} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium">סיבה</label>
                        <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="לדוגמה: חג" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">חסימת יום שלם</span>
                        <Switch checked={blockFullDay} onCheckedChange={setBlockFullDay} />
                      </div>
                      {!blockFullDay && (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium">שעות לחסימה (מופרדות בפסיקים)</label>
                          <Input value={blockHours} onChange={(e) => setBlockHours(e.target.value)} placeholder="09:00, 09:30, 10:00" />
                        </div>
                      )}
                    </div>
                    <Button onClick={handleAddBlock} variant="hero" className="mt-4 gap-2">
                      חסימת תאריך<Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Blocked list */}
                  {blockedDates.length === 0 ? (
                    <p className="py-6 text-center text-muted-foreground">אין תאריכים חסומים</p>
                  ) : (
                    blockedDates.map((block) => (
                      <div key={block.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card">
                        <div>
                          <span className="font-medium">{block.date}</span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <span className="text-sm text-muted-foreground">
                            {block.blockedHours ? `שעות: ${block.blockedHours.join(", ")}` : "יום שלם"}
                          </span>
                          {block.reason && <span className="ms-2 text-sm text-muted-foreground italic">({block.reason})</span>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveBlock(block.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== TAB: CLIENTS + STATS (merged, collapsible) ===== */}
          <TabsContent value="clients">
            <div className="space-y-3">

              {/* ── Section 1: Statistics ── */}
              <SectionHeader
                title="סטטיסטיקות"
                icon={<BarChart2 className="h-4 w-4 text-primary" />}
                open={statsOpen}
                onToggle={() => setStatsOpen((v) => !v)}
              />
              {statsOpen && (() => {
                const total = appointments.length;
                const confirmed = appointments.filter(a => a.status === "confirmed").length;
                const completed = appointments.filter(a => a.status === "completed").length;
                const cancelled = appointments.filter(a => a.status === "cancelled").length;
                const pending = appointments.filter(a => a.status === "pending").length;
                const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

                const dayCount: Record<string, number> = {};
                appointments.forEach(a => {
                  const d = new Date(a.date + "T00:00:00");
                  const name = format(d, "EEEE", { locale: he });
                  dayCount[name] = (dayCount[name] ?? 0) + 1;
                });
                const busiestDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

                const serviceCount: Record<string, number> = {};
                appointments.forEach(a => { serviceCount[a.serviceName] = (serviceCount[a.serviceName] ?? 0) + 1; });
                const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0];

                const lateApts = appointments.filter(a => a.lateMinutes != null && a.lateMinutes > 0);
                const avgLate = lateApts.length > 0
                  ? Math.round(lateApts.reduce((s, a) => s + (a.lateMinutes ?? 0), 0) / lateApts.length)
                  : null;

                const monthMap: Record<string, number> = {};
                appointments.forEach(a => { const m = a.date.slice(0, 7); monthMap[m] = (monthMap[m] ?? 0) + 1; });
                const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

                return (
                  <div className="space-y-4 pt-1 pb-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "סה״כ תורים", value: total, color: "text-primary" },
                        { label: "מאושרים / הושלמו", value: confirmed + completed, color: "text-green-600" },
                        { label: "ממתינים", value: pending, color: "text-amber-600" },
                        { label: "שיעור ביטולים", value: `${cancelRate}%`, color: "text-red-500" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-lg border bg-card p-4 text-center shadow-card">
                          <div className={cn("text-2xl font-bold", color)}>{value}</div>
                          <div className="text-xs text-muted-foreground mt-1">{label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-card p-4 shadow-card flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-primary shrink-0" />
                        <div><div className="text-sm font-semibold">יום עמוס</div>
                          <div className="text-base font-bold">{busiestDay ? `${busiestDay[0]} (${busiestDay[1]})` : "—"}</div></div>
                      </div>
                      <div className="rounded-lg border bg-card p-4 shadow-card flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary shrink-0" />
                        <div><div className="text-sm font-semibold">שירות פופולרי</div>
                          <div className="text-base font-bold">{topService ? `${topService[0]} (${topService[1]})` : "—"}</div></div>
                      </div>
                      <div className="rounded-lg border bg-card p-4 shadow-card flex items-center gap-3">
                        <Timer className="h-8 w-8 text-amber-500 shrink-0" />
                        <div><div className="text-sm font-semibold">ממוצע איחור</div>
                          <div className="text-base font-bold">{avgLate != null ? `${avgLate} דק׳` : "לא הוזן"}</div></div>
                      </div>
                    </div>

                    {months.length > 0 && (
                      <div className="rounded-lg border bg-card p-5 shadow-card">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                          <BarChart2 className="h-4 w-4 text-primary" />תורים לפי חודש (6 אחרונים)
                        </h3>
                        <div className="flex items-end gap-2 h-28">
                          {months.map(([month, count]) => {
                            const maxC = Math.max(...months.map(m => m[1]));
                            const h = maxC > 0 ? (count / maxC) * 100 : 0;
                            return (
                              <div key={month} className="flex flex-col items-center gap-1 flex-1">
                                <span className="text-xs font-bold text-primary">{count}</span>
                                <div className="w-full rounded-t bg-primary/70 transition-all" style={{ height: `${h}%`, minHeight: "4px" }} />
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

              {/* ── Section 2: Client Profiles ── */}
              <SectionHeader
                title="פרופילי לקוחות"
                icon={<Users className="h-4 w-4 text-primary" />}
                open={clientListOpen}
                onToggle={() => setClientListOpen((v) => !v)}
                badge={clientProfiles.length}
              />
              {clientListOpen && (
                <div className="space-y-3 pt-1 pb-2">
                  {clientProfiles.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">אין נתוני לקוחות</p>
                  ) : (
                    clientProfiles.map((client) => {
                      const scoreColor = client.score >= 80 ? "text-green-600" : client.score >= 50 ? "text-amber-500" : "text-red-500";
                      const scoreBg = client.score >= 80 ? "bg-green-50 border-green-200" : client.score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
                      return (
                        <div key={client.phone} className={cn("rounded-lg border p-4 shadow-card flex flex-col sm:flex-row sm:items-center gap-4", scoreBg)}>
                          <div className={cn("flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 shrink-0 mx-auto sm:mx-0", scoreBg)}>
                            <span className={cn("text-xl font-bold", scoreColor)}>{client.score}</span>
                            <Star className={cn("h-3 w-3", scoreColor)} />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="font-semibold">{client.name}</div>
                            <div className="text-sm text-muted-foreground">{client.phone}</div>
                            <div className="flex flex-wrap gap-3 text-xs mt-1">
                              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{client.totalAppointments} תורים</span>
                              <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="h-3 w-3" />{client.cancelledAppointments} ביטולים</span>
                              {client.avgLateMinutes != null && (
                                <span className="flex items-center gap-1 text-amber-600"><Timer className="h-3 w-3" />איחור ממוצע: {Math.round(client.avgLateMinutes)} דק׳</span>
                              )}
                              {client.lastAppointment && <span className="text-muted-foreground">תור אחרון: {client.lastAppointment}</span>}
                            </div>
                          </div>
                          <div className={cn("text-xs font-semibold text-center shrink-0", scoreColor)}>
                            {client.score >= 80 ? "לקוח מעולה ⭐" : client.score >= 50 ? "לקוח בינוני ⚠️" : "לקוח בעייתי 🚨"}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground mb-2">איך מחושב הציון?</p>
                    <p>• מתחיל מ-100 נקודות</p>
                    <p>• כל ביטול מוריד עד 50 נק׳ (לפי אחוז ביטולים)</p>
                    <p>• איחור ממוצע מוריד עד 30 נק׳ (5 נק׳ לכל 5 דקות)</p>
                    <p className="mt-2">💡 לחצי "איחור" בטאב תורים לאחר אישור התור</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== TAB: SETTINGS ===== */}
          <TabsContent value="settings">
            <div className="space-y-4">

              {/* Password change card */}
              <div className="rounded-lg border border-border bg-card p-6 shadow-card space-y-5">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  שינוי סיסמת כניסה
                </h3>

                {/* Current password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">סיסמה נוכחית</label>
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground">
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">סיסמה חדשה</label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowNewPw(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground">
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm new password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">אימות סיסמה חדשה</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn("pr-10", confirmPassword && newPassword !== confirmPassword && "border-destructive")}
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowConfirmPw(v => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground">
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">הסיסמאות אינן תואמות</p>
                  )}
                </div>

                <Button
                  variant="hero"
                  onClick={handleChangePassword}
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="gap-2"
                >
                  {savingPassword ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />שומר...</>
                  ) : (
                    <><KeyRound className="h-4 w-4" />עדכן סיסמה</>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
