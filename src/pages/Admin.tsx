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
  Download,
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
import { formatHebrewDate } from "@/lib/dateFormat";
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
  createAdminExceptionAppointment,
  hasClientCancelRequest,
  getManagedClients,
  upsertManagedClient,
  setManagedClientBlocked,
  setManagedClientHiddenHours,
} from "@/services/api";
import { AdminServicesTab } from "@/components/AdminServicesTab";
import { AdminTherapistsTab } from "@/components/AdminTherapistsTab";
import { AdminDailyCalendar } from "@/components/AdminDailyCalendar";
import { Appointment, DaySchedule, BlockedDate, Service, ClientProfile, Therapist, ManagedClient } from "@/services/types";
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
  const [managedClients, setManagedClients] = useState<ManagedClient[]>([]);
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
  const [blockHours, setBlockHours] = useState<string[]>([]);

  // Late minutes editing
  const [lateEditId, setLateEditId] = useState<string | null>(null);
  const [lateEditValue, setLateEditValue] = useState<string>("");

  // Max advance days
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number>(() => {
    const saved = localStorage.getItem("maxAdvanceDays");
    return saved ? parseInt(saved) : 30;
  });
  const [adminMaxVisibleAppointments, setAdminMaxVisibleAppointments] = useState<number>(() => {
    const saved = localStorage.getItem("adminMaxVisibleAppointments");
    const parsed = saved ? Number(saved) : 5;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  });
  const [appointmentsSearch, setAppointmentsSearch] = useState("");
  const [appointmentsDateRange, setAppointmentsDateRange] = useState<{ from?: Date; to?: Date }>({});
   const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [activeAdminTab, setActiveAdminTab] = useState("appointments");
  const [clientsSearch, setClientsSearch] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [clientHiddenRangeDrafts, setClientHiddenRangeDrafts] = useState<Record<string, { from: string; to: string }>>({});
  const [clientHiddenSelections, setClientHiddenSelections] = useState<Record<string, string[]>>({});

  const [holidayToggleLoading, setHolidayToggleLoading] = useState(false);

  // תור חריג (מנהל)
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionForm, setExceptionForm] = useState(() => ({
    serviceId: "",
    customServiceName: "",
    desiredDurationMinutes: "30",
    therapistId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    clientName: "",
    clientPhone: "",
    notes: "",
  }));

  // טווח תצוגה לרשימת חסימות לפי חלון ההזמנה המקסימלי
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const maxBookingDate = new Date(todayStart);
  maxBookingDate.setDate(maxBookingDate.getDate() + maxAdvanceDays);
  maxBookingDate.setHours(23, 59, 59, 999);

  const holidayDatesSet = new Set(getHolidayDates());
  const erevDatesSet = new Set(getErevChagDates());
  const blockedDateSet = new Set(blockedDates.filter((b) => b.blockedHours === null).map((b) => b.date));

  const holidaysBlocked = [...holidayDatesSet].every((d) => blockedDateSet.has(d));
  const erevBlocked = [...erevDatesSet].every((d) => blockedDateSet.has(d));

  const visibleBlockedDates = blockedDates
    .filter((b) => {
      const d = new Date(`${b.date}T00:00:00`);
      return d >= todayStart && d <= maxBookingDate;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

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

  // שינוי מועד תור (מנהל) - מודאל פנימי במקום window.prompt
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const openExceptionModal = (defaults?: { date?: string; time?: string; therapistId?: string }) => {
    const defaultService = services[0];
    setExceptionForm((prev) => ({
      ...prev,
      serviceId: defaultService?.id ?? prev.serviceId,
      customServiceName: "",
      desiredDurationMinutes: String(defaultService?.duration ?? 30),
      therapistId: defaults?.therapistId ?? therapists.find((t) => t.isActive)?.id ?? prev.therapistId,
      date: defaults?.date ?? format(new Date(), "yyyy-MM-dd"),
      time: (defaults?.time ?? prev.time) || "09:00",
    }));
    setExceptionOpen(true);
  };

  const selectedExceptionService = services.find((s) => s.id === exceptionForm.serviceId);

  const handleExceptionServiceChange = (value: string) => {
    setExceptionForm((prev) => ({
      ...prev,
      serviceId: value,
      desiredDurationMinutes:
        value === "__other__"
          ? prev.desiredDurationMinutes
          : String(services.find((s) => s.id === value)?.duration ?? 30),
    }));
  };

  const isOtherExceptionService = exceptionForm.serviceId === "__other__";

  const handleCreateException = async () => {
    const desiredDuration = Number(exceptionForm.desiredDurationMinutes);
    if (!exceptionForm.serviceId || !exceptionForm.therapistId || !exceptionForm.date || !exceptionForm.time || !exceptionForm.clientName) {
      toast.error("נא למלא את כל שדות החובה");
      return;
    }
    if (!Number.isFinite(desiredDuration) || desiredDuration <= 0) {
      toast.error("נא להזין אורך טיפול תקין");
      return;
    }
    if (isOtherExceptionService && !exceptionForm.customServiceName.trim()) {
      toast.error("נא להזין סוג טיפול עבור 'אחר'");
      return;
    }
    setExceptionSaving(true);
    try {
      const apt = await createAdminExceptionAppointment({
        serviceId: exceptionForm.serviceId,
        customServiceName: isOtherExceptionService ? exceptionForm.customServiceName.trim() : undefined,
        desiredDurationMinutes: desiredDuration,
        therapistId: exceptionForm.therapistId,
        date: exceptionForm.date,
        time: exceptionForm.time,
        clientName: exceptionForm.clientName,
        clientPhone: exceptionForm.clientPhone,
        notes: exceptionForm.notes,
      });
      setAppointments((prev) => [...prev, apt]);
      setExceptionOpen(false);
      toast.success("התור החריג נוסף בהצלחה");
    } catch {
      toast.error("שגיאה ביצירת תור חריג");
    } finally {
      setExceptionSaving(false);
    }
  };

  const handleMaxAdvanceDaysChange = (value: number) => {
    setMaxAdvanceDays(value);
    localStorage.setItem("maxAdvanceDays", String(value));
    toast.success("ההגדרה נשמרה");
  };

  const handleAdminMaxVisibleAppointmentsChange = (value: number) => {
    const next = Math.max(1, Math.min(500, Math.floor(value || 1)));
    setAdminMaxVisibleAppointments(next);
    localStorage.setItem("adminMaxVisibleAppointments", String(next));
  };

  const handleClearAppointmentsFilters = () => {
    setAppointmentsSearch("");
    setAppointmentsDateRange({});
    setAppointmentsPage(1);
  };

  useEffect(() => {
    setAppointmentsPage(1);
  }, [appointmentsSearch, appointmentsDateRange.from, appointmentsDateRange.to, adminMaxVisibleAppointments]);

  const handleBlockHolidays = async () => {
    if (holidayToggleLoading) return;
    setHolidayToggleLoading(true);
    try {
      const holidayDates = getHolidayDates();
      const nameMap = getHolidayNameMap();
      const existingByDate = new Map(blockedDates.map((b) => [b.date, b]));

      if (holidaysBlocked) {
        // Toggle OFF: הסר חסימות חג קיימות
        const toRemove = blockedDates.filter((b) => holidayDates.includes(b.date));
        await Promise.all(toRemove.map((b) => removeBlockedDate(b.id)));
        toast.success(`הוסרו ${toRemove.length} חסימות חג`);
      } else {
        // Toggle ON: הוסף חסימות חסרות בלבד
        const toAdd = holidayDates.filter((d) => !existingByDate.has(d));
        await Promise.all(
          toAdd.map((d) =>
            addBlockedDate({ date: d, blockedHours: null, reason: nameMap[d] ?? "חג" })
          )
        );
        toast.success(`נחסמו ${toAdd.length} ימי חג`);
      }

      setBlockedDates(await getBlockedDates());
    } finally {
      setHolidayToggleLoading(false);
    }
  };

  const handleBlockErevChag = async () => {
    if (holidayToggleLoading) return;
    setHolidayToggleLoading(true);
    try {
      const erevDates = getErevChagDates();
      const nameMap = getHolidayNameMap();
      const existingByDate = new Map(blockedDates.map((b) => [b.date, b]));

      if (erevBlocked) {
        // Toggle OFF: הסר חסימות ערב חג קיימות
        const toRemove = blockedDates.filter((b) => erevDates.includes(b.date));
        await Promise.all(toRemove.map((b) => removeBlockedDate(b.id)));
        toast.success(`הוסרו ${toRemove.length} חסימות ערב חג`);
      } else {
        // Toggle ON: הוסף חסימות חסרות בלבד
        const toAdd = erevDates.filter((d) => !existingByDate.has(d));
        await Promise.all(
          toAdd.map((d) =>
            addBlockedDate({ date: d, blockedHours: null, reason: nameMap[d] ?? "ערב חג" })
          )
        );
        toast.success(`נחסמו ${toAdd.length} ערבי חג`);
      }

      setBlockedDates(await getBlockedDates());
    } finally {
      setHolidayToggleLoading(false);
    }
  };

  // Keep the existing "הזז" buttons working without extra modal state.
  const setRescheduleAptModal = (apt: Appointment) => {
    setRescheduleApt(apt);
    setRescheduleDate(apt.date);
    setRescheduleTime(apt.time);
  };

  const handleSaveReschedule = async () => {
    if (!rescheduleApt) return;
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("נא לבחור תאריך ושעה");
      return;
    }
    setRescheduleSaving(true);
    try {
      await rescheduleAppointment(rescheduleApt.id, rescheduleDate, rescheduleTime);
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === rescheduleApt.id ? { ...a, date: rescheduleDate, time: rescheduleTime } : a
        )
      );
      toast.success("התור הוזז בהצלחה");
      setRescheduleApt(null);
    } catch {
      toast.error("שגיאה בהזזת התור");
    } finally {
      setRescheduleSaving(false);
    }
  };

  const parseDurationFromNotes = (notes?: string | null): number | null => {
    if (!notes) return null;
    const m = notes.match(/\[dur=(\d+)\]/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const getAppointmentTotalBlockMinutes = (apt: Appointment): number => {
    const svc = services.find((s) => s.id === apt.serviceId);
    if (svc) return svc.duration + (svc.breakMinutes ?? 0);
    return parseDurationFromNotes(apt.notes) ?? 30;
  };

  const minutesFromHHMM = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const rescheduleConflict = (() => {
    if (!rescheduleApt || !rescheduleDate || !rescheduleTime || !rescheduleApt.therapistId) return null;

    const start = minutesFromHHMM(rescheduleTime);
    const end = start + getAppointmentTotalBlockMinutes(rescheduleApt);

    return appointments.find((other) => {
      if (other.id === rescheduleApt.id) return false;
      if (other.status === "cancelled") return false;
      if (other.date !== rescheduleDate) return false;
      if (other.therapistId !== rescheduleApt.therapistId) return false;

      const otherStart = minutesFromHHMM(other.time);
      const otherEnd = otherStart + getAppointmentTotalBlockMinutes(other);
      return start < otherEnd && end > otherStart;
    }) ?? null;
  })();

  useEffect(() => {
    Promise.all([
      getAppointments(),
      getWeeklySchedule(),
      getBlockedDates(),
      getServices(),
      getClientProfiles(),
      getTherapists(),
      getManagedClients(),
    ]).then(([apts, sched, blocks, svc, profiles, therapistList, managed]) => {
      setAppointments(apts);
      setSchedule(sched);
      setBlockedDates(blocks);
      setServices([...svc]);
      setClientProfiles(profiles);
      setTherapists(therapistList);
      setManagedClients(managed);
      setLoading(false);
    });
  }, []);

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

  const handleAddManagedClient = async () => {
    try {
      const saved = await upsertManagedClient({ name: newClientName, phone: newClientPhone });
      setManagedClients((prev) => {
        const exists = prev.some((c) => c.phone === saved.phone);
        return exists ? prev.map((c) => (c.phone === saved.phone ? saved : c)) : [...prev, saved];
      });
      setNewClientName("");
      setNewClientPhone("");
      toast.success("לקוח נשמר בהצלחה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירת לקוח");
    }
  };

  const handleToggleManagedBlocked = async (phone: string, name: string, next: boolean) => {
    try {
      await setManagedClientBlocked(phone, next, name);
      setManagedClients((prev) => prev.map((c) =>
        normalizePhone(c.phone) === normalizePhone(phone)
          ? { ...c, isBlocked: next, updatedAt: new Date().toISOString() }
          : c
      ));
      toast.success(next ? "הלקוח נחסם" : "החסימה הוסרה");
    } catch {
      toast.error("שגיאה בעדכון חסימה");
    }
  };

  const handleSaveClientHiddenHours = async (phone: string, name: string, hours: string[]) => {
    try {
      await setManagedClientHiddenHours(phone, hours, name);
      setManagedClients((prev) => prev.map((c) =>
        normalizePhone(c.phone) === normalizePhone(phone)
          ? { ...c, hiddenHours: hours, updatedAt: new Date().toISOString() }
          : c
      ));
      toast.success("השעות המוסתרות נשמרו");
    } catch {
      toast.error("שגיאה בשמירת שעות מוסתרות");
    }
  };

  const managedByPhone = new Map(managedClients.map((c) => [normalizePhone(c.phone), c]));
  const mergedClients = clientProfiles.map((p) => {
    const m = managedByPhone.get(normalizePhone(p.phone));
    return {
      ...p,
      name: m?.name || p.name,
      isBlocked: m?.isBlocked ?? false,
      hiddenHours: m?.hiddenHours ?? [],
    };
  });
  const managedOnlyClients = managedClients
    .filter((m) => !mergedClients.some((c) => normalizePhone(c.phone) === normalizePhone(m.phone)))
    .map((m) => ({
      phone: m.phone,
      name: m.name,
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      avgLateMinutes: null as number | null,
      score: 100,
      lastAppointment: null as string | null,
      isBlocked: m.isBlocked,
      hiddenHours: m.hiddenHours,
    }));
  const searchableClients = [...mergedClients, ...managedOnlyClients].filter((c) => {
    const q = clientsSearch.trim().toLowerCase();
    if (!q) return true;
    const byName = c.name.toLowerCase().includes(q);
    const byPhone = normalizePhone(c.phone).includes(normalizePhone(q));
    return byName || byPhone;
  });

  const clientHourOptions = (() => {
    const parseMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    const formatMinutes = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };

    const working = schedule.filter((d) => d.isWorkingDay);
    if (!working.length) return ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

    const min = Math.min(...working.map((d) => parseMinutes(d.startTime)));
    const max = Math.max(...working.map((d) => parseMinutes(d.endTime)));
    const arr: string[] = [];
    for (let t = min; t <= max; t += anchorStepMinutes) arr.push(formatMinutes(t));
    return arr;
  })();

  const getClientHiddenHours = (phone: string, fallback: string[]) =>
    clientHiddenSelections[phone] ?? fallback;

  const getClientRangeDraft = (phone: string) => {
    const existing = clientHiddenRangeDrafts[phone];
    if (existing) return existing;
    const from = clientHourOptions[0] ?? "09:00";
    const to = clientHourOptions[1] ?? from;
    return { from, to };
  };

  const setClientRangeDraft = (phone: string, next: { from: string; to: string }) => {
    setClientHiddenRangeDrafts((prev) => ({ ...prev, [phone]: next }));
  };

  const handleAddHiddenRangeForClient = (phone: string, fallbackHours: string[]) => {
    const draft = getClientRangeDraft(phone);
    const fromM = toMinutes(draft.from);
    const toM = toMinutes(draft.to);
    if (toM <= fromM) {
      toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    const rangeSlots = clientHourOptions.filter((h) => {
      const m = toMinutes(h);
      return m >= fromM && m < toM;
    });
    const merged = [...new Set([...getClientHiddenHours(phone, fallbackHours), ...rangeSlots])].sort();
    setClientHiddenSelections((prev) => ({ ...prev, [phone]: merged }));
  };

  const handleRemoveHiddenHourForClient = (phone: string, hour: string, fallbackHours: string[]) => {
    const next = getClientHiddenHours(phone, fallbackHours).filter((h) => h !== hour);
    setClientHiddenSelections((prev) => ({ ...prev, [phone]: next }));
  };

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

  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const blockSlotStepMinutes = anchorStepMinutes;
  const selectedBlockDaySchedule = blockDate
    ? schedule.find((d) => d.dayOfWeek === blockDate.getDay())
    : undefined;

  const blockSlotOptions = !selectedBlockDaySchedule || !selectedBlockDaySchedule.isWorkingDay
    ? []
    : (() => {
        const start = toMinutes(selectedBlockDaySchedule.startTime);
        const end = toMinutes(selectedBlockDaySchedule.endTime);
        const slots: string[] = [];
        for (let t = start; t < end; t += blockSlotStepMinutes) {
          slots.push(toTime(t));
        }
        return slots;
      })();

  const toggleBlockHour = (time: string) => {
    setBlockHours((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time].sort()
    );
  };

  const handleAddBlock = async () => {
    if (!blockDate) { toast.error("נא לבחור תאריך לחסימה"); return; }
    const hours = blockFullDay ? null : blockHours;
    if (!blockFullDay && hours.length === 0) { toast.error("בחרי לפחות סלוט אחד לחסימה"); return; }
    await addBlockedDate({ date: format(blockDate, "yyyy-MM-dd"), blockedHours: hours, reason: blockReason || "ללא סיבה" });
    const updated = await getBlockedDates();
    setBlockedDates(updated);
    setBlockDate(undefined);
    setBlockReason("");
    setBlockHours([]);
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
    if (newPassword !== confirmPassword) { toast.error("הסיסאות אינן תואמות"); return; }
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

  const toIcsDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  };

  const escapeIcsText = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  const parseLocalDateTime = (date: string, time: string): Date => {
    const safeTime = time?.length === 5 ? `${time}:00` : (time || "00:00:00");
    return new Date(`${date}T${safeTime}`);
  };

  const handleCalendarUpdateExport = () => {
    const now = new Date();
    const future = appointments.filter((a) => parseLocalDateTime(a.date, a.time) > now);

    if (future.length === 0) {
      toast.error("אין תורים עתידיים לייצוא");
      return;
    }

    const dtStamp = toIcsDateTime(new Date());
    const vevents = future
      .sort((a, b) => {
        const aDt = parseLocalDateTime(a.date, a.time).getTime();
        const bDt = parseLocalDateTime(b.date, b.time).getTime();
        return aDt - bDt;
      })
      .map((apt) => {
        const service = services.find((s) => s.id === apt.serviceId);
        const durationMinutes = service?.duration ?? 30;
        const start = parseLocalDateTime(apt.date, apt.time);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        const status = apt.status === "cancelled" ? "CANCELLED" : apt.status === "pending" ? "TENTATIVE" : "CONFIRMED";

        const lines = [
          "BEGIN:VEVENT",
          `UID:glow-apt-${apt.id}@glowgetter`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${toIcsDateTime(start)}`,
          `DTEND:${toIcsDateTime(end)}`,
          `SUMMARY:${escapeIcsText(`${apt.clientName} - ${apt.serviceName}`)}`,
          `DESCRIPTION:${escapeIcsText(`טלפון: ${apt.clientPhone}${apt.notes ? `\\nהערה: ${apt.notes}` : ""}`)}`,
          `STATUS:${status}`,
          "END:VEVENT",
        ];
        return lines.join("\r\n");
      })
      .join("\r\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Glow Studio//Admin Calendar Export//HE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Glow Studio",
      vevents,
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glow-calendar-${format(new Date(), "yyyy-MM-dd")}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast.success("קובץ יומן נוצר בהצלחה");
  };

  // ── DEBUG: dump entire state ─────────────────────────────────────────────
  // useEffect(() => {
  //   const dump = {
  //     appointments,
  //     schedule,
  //     blockedDates,
  //     services,
  //     clientProfiles,
  //     therapists,
  //     maxAdvanceDays,
  //   };
  //   console.log("Admin state dump:", JSON.stringify(dump, null, 2));
  // }, [appointments, schedule, blockedDates, services, clientProfiles, therapists, maxAdvanceDays]);

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

        <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="w-full" dir="rtl">
          <div className="mb-6 flex flex-col gap-3">
            <TabsList className="h-auto grid w-full grid-cols-4 grid-rows-2 sm:grid-rows-1 sm:grid-cols-7 gap-1 p-1">
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

            {activeAdminTab === "calendar" && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={handleCalendarUpdateExport}>
                  <Download className="h-4 w-4" />
                  עדכון יומן אישי
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={openExceptionModal}>
                  <Plus className="h-4 w-4" />
                  הוספת תור חריג
                </Button>
              </div>
            )}
          </div>

          {/* ===== TAB: APPOINTMENTS ===== */}
          <TabsContent value="appointments">
            {(() => {
              const now = new Date();
              const toLocalDateTime = (date: string, time: string): Date => {
                const safeTime = time?.length === 5 ? `${time}:00` : (time || "00:00:00");
                return new Date(`${date}T${safeTime}`);
              };

              // רק תורים עתידיים, ממוינים לפי תאריך כניסה (createdAt)
              const future = appointments
                .filter((a) => toLocalDateTime(a.date, a.time) > now)
                .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

              const normalizedSearch = appointmentsSearch.trim().toLowerCase();
              const searchDigits = normalizedSearch.replace(/\D/g, "");
              const appointmentsDateFrom = appointmentsDateRange.from
                ? format(appointmentsDateRange.from, "yyyy-MM-dd")
                : "";
              const appointmentsDateTo = appointmentsDateRange.to
                ? format(appointmentsDateRange.to, "yyyy-MM-dd")
                : "";

              const filteredFuture = future.filter((a) => {
                const nameMatch = a.clientName.toLowerCase().includes(normalizedSearch);
                const phoneDigits = a.clientPhone.replace(/\D/g, "");
                const phoneMatch = searchDigits.length > 0 && phoneDigits.includes(searchDigits);
                const matchesSearch = normalizedSearch.length === 0 || nameMatch || phoneMatch;
                const matchesFrom = !appointmentsDateFrom || a.date >= appointmentsDateFrom;
                const matchesTo = !appointmentsDateTo || a.date <= appointmentsDateTo;
                return matchesSearch && matchesFrom && matchesTo;
              });

              const totalPages = Math.max(1, Math.ceil(filteredFuture.length / adminMaxVisibleAppointments));
              const currentPage = Math.min(appointmentsPage, totalPages);
              const pageStart = (currentPage - 1) * adminMaxVisibleAppointments;
              const visibleFuture = filteredFuture.slice(pageStart, pageStart + adminMaxVisibleAppointments);

              const activeApts = visibleFuture.filter((a) => a.status !== "cancelled");
              const cancelledApts = visibleFuture.filter((a) => a.status === "cancelled");

              return (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-card p-3 shadow-card">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                         <Input
                           value={appointmentsSearch}
                           onChange={(e) => setAppointmentsSearch(e.target.value)}
                           placeholder="חיפוש לפי שם או טלפון"
                         />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full min-w-0 justify-start font-normal overflow-hidden">
                              <CalendarDays className="me-2 h-4 w-4" />
                              {appointmentsDateRange.from ? (
                                appointmentsDateRange.to ? (
                                  <span className="min-w-0 truncate text-start">
                                    {format(appointmentsDateRange.from, "dd/MM/yy")} - {format(appointmentsDateRange.to, "dd/MM/yy")}
                                  </span>
                                ) : (
                                  <span className="min-w-0 truncate text-start">{format(appointmentsDateRange.from, "dd/MM/yy")}</span>
                                )
                              ) : (
                                <span className="min-w-0 truncate text-start text-muted-foreground">סינון לפי טווח תאריכים</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="start" dir="rtl">
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">בחרי מתאריך ועד תאריך</p>
                              <Calendar
                                mode="range"
                                selected={{ from: appointmentsDateRange.from, to: appointmentsDateRange.to }}
                                onSelect={(range) => setAppointmentsDateRange({ from: range?.from, to: range?.to })}
                                locale={he}
                                className="pointer-events-auto"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                       </div>

                       <div className="flex items-center gap-2 shrink-0">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={handleClearAppointmentsFilters}
                           disabled={!appointmentsSearch && !appointmentsDateRange.from && !appointmentsDateRange.to}
                         >
                           ניקוי
                         </Button>
                         <Button variant="outline" size="sm" className="gap-1" onClick={openExceptionModal}>
                          <Plus className="h-4 w-4" />
                          הוספת תור חריג
                        </Button>
                       </div>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      נמצאו {filteredFuture.length} תורים עתידיים | עמוד {currentPage} מתוך {totalPages}
                    </div>
                  </div>

                  {/* תורים פעילים */}
                  {filteredFuture.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">אין תורים עתידיים לפי הסינון שנבחר</p>
                  )}
                  {filteredFuture.length > 0 && activeApts.length === 0 && (
                    <p className="py-4 text-center text-muted-foreground">אין תורים פעילים בעמוד זה</p>
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
                          {formatHebrewDate(apt.date)} בשעה {apt.time} · {apt.clientName} · {apt.clientPhone}
                          {apt.therapistName && ` · ${apt.therapistName}`}
                        </p>
                        {apt.notes && <p className="mt-1 text-xs text-muted-foreground italic">הערה: {apt.notes}</p>}
                        {apt.status === "confirmed" && hasClientCancelRequest(apt.notes) && (
                          <p className="mt-1 text-xs text-amber-700 font-medium">לקוח ביקש ביטול - נדרש אישור מנהל</p>
                        )}
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
                          <Button variant="outline" size="sm" onClick={() => setRescheduleAptModal(apt)}
                            className="gap-1 text-blue-600 border-blue-200 hover:text-blue-700">
                            <Clock className="h-3.5 w-3.5" />הזז
                          </Button>
                        )}
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <Button variant="outline" size="sm" onClick={() => handleCancelAppointment(apt.id)}
                            className="gap-1 text-destructive hover:text-destructive">
                            {apt.status === "confirmed" && hasClientCancelRequest(apt.notes) ? "אשר ביטול" : "בטל"}
                            <X className="h-3 w-3" />
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
                                {formatHebrewDate(apt.date)} בשעה {apt.time} · {apt.clientName} · {apt.clientPhone}
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
                              <Button variant="outline" size="sm" onClick={() => setRescheduleAptModal(apt)}
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

                  {filteredFuture.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <div className="flex items-center gap-2" dir="ltr">
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={adminMaxVisibleAppointments}
                          onChange={(e) => handleAdminMaxVisibleAppointmentsChange(Number(e.target.value))}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground" dir="rtl">תורים בעמוד</span>
                      </div>
                       <Button
                         variant="outline"
                         size="sm"
                         disabled={currentPage <= 1}
                         onClick={() => setAppointmentsPage((p) => Math.max(1, p - 1))}
                       >
                         הקודם
                       </Button>
                       <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
                       <Button
                         variant="outline"
                         size="sm"
                         disabled={currentPage >= totalPages}
                         onClick={() => setAppointmentsPage((p) => Math.min(totalPages, p + 1))}
                       >
                         הבא
                       </Button>
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
            <div className="space-y-3">
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
                  onCreateExceptionFromCalendar={({ date, time, therapistId }) => {
                    openExceptionModal({ date, time, therapistId });
                  }}
                />
              )}
            </div>
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
                badge={visibleBlockedDates.length}
              />
              {blockedOpen && (
                <div className="space-y-3 pt-1 pb-2">

                  {/* ── Quick holiday blocking ── */}
                  <div className="rounded-lg border border-border bg-card p-4 shadow-card space-y-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <CalendarOff className="h-4 w-4 text-primary" />
                      חסימה מהירה לפי לוח השנה העברי
                    </div>
                    <p className="text-xs text-muted-foreground">טוגל לחסימה/הסרה אוטומטית של חגים וערבי חג.</p>
                    <div className="grid gap-3 mt-2">
                      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="text-sm">חסימת כל ימי החג</div>
                        <Switch checked={holidaysBlocked} onCheckedChange={handleBlockHolidays} disabled={holidayToggleLoading} />
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="text-sm">חסימת כל ערבי החג</div>
                        <Switch checked={erevBlocked} onCheckedChange={handleBlockErevChag} disabled={holidayToggleLoading} />
                      </div>
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
                        <div className="sm:col-span-2 space-y-2">
                          <label className="mb-1.5 block text-sm font-medium">בחרי סלוטים לחסימה</label>
                          {!blockDate ? (
                            <p className="text-xs text-muted-foreground">בחרי קודם תאריך</p>
                          ) : !selectedBlockDaySchedule || !selectedBlockDaySchedule.isWorkingDay ? (
                            <p className="text-xs text-muted-foreground">היום שסומן סגור בשעות הפעילות</p>
                          ) : (
                            <div className="max-h-44 overflow-y-auto rounded-md border border-border p-2">
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" dir="ltr">
                                {blockSlotOptions.map((slot) => {
                                  const selected = blockHours.includes(slot);
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => toggleBlockHour(slot)}
                                      className={cn(
                                        "rounded-md border px-2 py-1 text-xs transition-colors",
                                        selected
                                          ? "bg-destructive/10 border-destructive text-destructive"
                                          : "bg-background border-border text-foreground hover:bg-muted"
                                      )}
                                    >
                                      {slot}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {blockHours.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              נבחרו {blockHours.length} סלוטים לחסימה
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button onClick={handleAddBlock} variant="hero" className="mt-4 gap-2">
                      חסימת תאריך<Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Blocked list */}
                  {visibleBlockedDates.length === 0 ? (
                    <p className="py-6 text-center text-muted-foreground">אין חסימות בטווח ההזמנה המקסימלי</p>
                  ) : (
                    visibleBlockedDates.map((block) => (
                      <div key={block.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card">
                        <div>
                          <span className="font-medium">{formatHebrewDate(block.date)}</span>
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
                  <div className="rounded-lg border bg-card p-4 shadow-card space-y-3">
                    <p className="text-sm font-semibold">הוספה/עדכון לקוח</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="שם לקוח" />
                      <Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="טלפון" dir="ltr" />
                      <Button variant="hero" onClick={handleAddManagedClient}>שמור לקוח</Button>
                    </div>
                    <Input
                      value={clientsSearch}
                      onChange={(e) => setClientsSearch(e.target.value)}
                      placeholder="חיפוש לקוח לפי שם או טלפון"
                    />
                  </div>

                  {searchableClients.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">אין לקוחות להצגה</p>
                  ) : (
                    searchableClients.map((client) => {
                       const scoreColor = client.score >= 80 ? "text-green-600" : client.score >= 50 ? "text-amber-500" : "text-red-500";
                       const scoreBg = client.score >= 80 ? "bg-green-50 border-green-200" : client.score >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
                      const selectedHiddenHours = getClientHiddenHours(client.phone, client.hiddenHours ?? []);
                      const draft = getClientRangeDraft(client.phone);
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
                              {client.lastAppointment && <span className="text-muted-foreground">תור אחרון: {formatHebrewDate(client.lastAppointment)}</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs">חסום להזמנה</span>
                              <Switch
                                checked={Boolean(client.isBlocked)}
                                onCheckedChange={(next) => handleToggleManagedBlocked(client.phone, client.name, next)}
                              />
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="w-full rounded-md border border-border bg-background p-2 space-y-2">
                                <div className="text-[11px] text-muted-foreground">חסימת שעות להצגה ללקוח (משעה עד שעה)</div>
                                <div className="flex flex-wrap items-center gap-2" dir="ltr">
                                  <select
                                    value={draft.from}
                                    onChange={(e) => setClientRangeDraft(client.phone, { ...draft, from: e.target.value })}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                  >
                                    {clientHourOptions.map((h) => <option key={`from-${client.phone}-${h}`} value={h}>{h}</option>)}
                                  </select>
                                  <span className="text-xs text-muted-foreground" dir="rtl">עד</span>
                                  <select
                                    value={draft.to}
                                    onChange={(e) => setClientRangeDraft(client.phone, { ...draft, to: e.target.value })}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                                  >
                                    {clientHourOptions.map((h) => <option key={`to-${client.phone}-${h}`} value={h}>{h}</option>)}
                                  </select>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => handleAddHiddenRangeForClient(client.phone, client.hiddenHours ?? [])}
                                  >
                                    הוסף טווח
                                  </Button>
                                </div>

                                <div className="flex flex-wrap gap-1" dir="ltr">
                                  {selectedHiddenHours.length === 0 ? (
                                    <span className="text-[11px] text-muted-foreground" dir="rtl">לא נבחרו שעות מוסתרות</span>
                                  ) : (
                                    selectedHiddenHours.map((h) => (
                                      <button
                                        key={`${client.phone}-${h}`}
                                        type="button"
                                        onClick={() => handleRemoveHiddenHourForClient(client.phone, h, client.hiddenHours ?? [])}
                                        className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/70"
                                        title="הסר שעה"
                                      >
                                        {h} ×
                                      </button>
                                    ))
                                  )}
                                </div>

                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="hero"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => handleSaveClientHiddenHours(client.phone, client.name, selectedHiddenHours)}
                                  >
                                    שמור שעות מוסתרות
                                  </Button>
                                </div>
                              </div>
                             </div>
                           </div>
                         </div>
                      );
                    })
                  )}
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
                    <p className="text-xs text-destructive">הסיסאות אינן תואמות</p>
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

      {rescheduleApt && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRescheduleApt(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">הזזת תור</h3>
              <button onClick={() => setRescheduleApt(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {rescheduleApt.clientName} · {rescheduleApt.serviceName}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">תאריך חדש</label>
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm font-medium">שעה חדשה</label>
                <Input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="mt-1"
                  dir="ltr"
                />
              </div>
            </div>

            {rescheduleConflict && (
              <p className="mt-3 text-sm text-destructive">
                אזהרה: קיימת חפיפה עם תור של {rescheduleConflict.clientName} בשעה {rescheduleConflict.time}.
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRescheduleApt(null)}>ביטול</Button>
              <Button variant="hero" onClick={handleSaveReschedule} disabled={rescheduleSaving || !!rescheduleConflict}>
                {rescheduleSaving ? "שומר..." : "שמור שינוי"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {exceptionOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setExceptionOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">הוספת תור חריג</h3>
              <button onClick={() => setExceptionOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">שירות*</label>
                <select
                  value={exceptionForm.serviceId}
                  onChange={(e) => handleExceptionServiceChange(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">בחרי שירות</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__other__">אחר...</option>
                </select>
              </div>

              {isOtherExceptionService && (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">סוג טיפול (אחר)*</label>
                  <Input
                    value={exceptionForm.customServiceName}
                    onChange={(e) => setExceptionForm((p) => ({ ...p, customServiceName: e.target.value }))}
                    className="mt-1"
                    placeholder="לדוגמה: טיפול ייחודי"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">אורך טיפול (דקות)*</label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={exceptionForm.desiredDurationMinutes}
                  onChange={(e) => setExceptionForm((p) => ({ ...p, desiredDurationMinutes: e.target.value }))}
                  className="mt-1"
                  dir="ltr"
                />
                {!isOtherExceptionService && selectedExceptionService && (
                  <p className="mt-1 text-[11px] text-muted-foreground">ברירת מחדל מהשירות: {selectedExceptionService.duration} דק׳</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">תאריך*</label>
                <Input type="date" value={exceptionForm.date} onChange={(e) => setExceptionForm((p) => ({ ...p, date: e.target.value }))} className="mt-1" dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-medium">שעה*</label>
                <Input type="time" value={exceptionForm.time} onChange={(e) => setExceptionForm((p) => ({ ...p, time: e.target.value }))} className="mt-1" dir="ltr" />
              </div>

              <div>
                <label className="text-sm font-medium">שם לקוח*</label>
                <Input value={exceptionForm.clientName} onChange={(e) => setExceptionForm((p) => ({ ...p, clientName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">טלפון</label>
                <Input value={exceptionForm.clientPhone} onChange={(e) => setExceptionForm((p) => ({ ...p, clientPhone: e.target.value }))} className="mt-1" dir="ltr" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium">הערה</label>
                <Input value={exceptionForm.notes} onChange={(e) => setExceptionForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExceptionOpen(false)}>ביטול</Button>
              <Button variant="hero" onClick={handleCreateException} disabled={exceptionSaving}>
                {exceptionSaving ? "שומר..." : "הוספה"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
