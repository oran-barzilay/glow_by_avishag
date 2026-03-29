/**
 * API Service Layer
 */

import {
  Service,
  TimeSlot,
  Appointment,
  DaySchedule,
  BlockedDate,
  BookingFormData,
  ClientProfile,
  Therapist,
} from "./types";

import {
  mockServices,
  mockAppointments,
  mockWeeklySchedule,
  mockBlockedDates,
} from "./mockData";

import {
  getAllAppointments as dbGetAll,
  createAppointment as dbCreate,
  updateAppointmentStatus,
  isTimeSlotTaken,
  updateLateMinutes as dbUpdateLateMinutes,
  getClientProfiles as dbGetClientProfiles,
  getAdminPassword as dbGetAdminPassword,
  setAdminPassword as dbSetAdminPassword,
  getAllTherapists as dbGetAllTherapists,
  createTherapist as dbCreateTherapist,
  updateTherapist as dbUpdateTherapist,
  deleteTherapist as dbDeleteTherapist,
  rescheduleAppointment as dbReschedule,
  deleteAppointment as dbDeleteAppointment,
} from "@/lib/db";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const useSupabase = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Mock therapists ───────────────────────────────────────────────────────
const mockTherapists: Therapist[] = [
  { id: "therapist-1", name: "אביגייל בז'ה", isActive: true, serviceIds: ["gel-polish", "eyebrows", "spray-tan"] },
];

// ============================================================
// SERVICES
// ============================================================
export async function getServices(): Promise<Service[]> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase.from("services").select("*").order("name");
    if (error || !data?.length) return mockServices;
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      duration: r.duration ?? 30,
      price: r.price ?? 0,
      icon: r.icon ?? "Sparkles",
      color: r.color ?? "service-nails",
      breakMinutes: r.break_minutes ?? 0,
    }));
  }
  await delay(300);
  return mockServices;
}

// ============================================================
// SLOTS — מחשב זמינות תוך התחשבות במטפלת, משך טיפול והפסקה
// ============================================================
export async function getAvailableSlots(
  date: string,
  serviceId: string,
  therapistId?: string | null
): Promise<TimeSlot[]> {
  await delay(200);

  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();

  // שעות עבודה
  let daySchedule = mockWeeklySchedule.find((d) => d.dayOfWeek === dayOfWeek);
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("working_hours")
      .select("*")
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();
    if (data) {
      daySchedule = {
        dayOfWeek: data.day_of_week,
        dayName: data.day_name ?? "",
        isWorkingDay: data.is_working_day,
        startTime: data.start_time,
        endTime: data.end_time,
      };
    }
  }
  if (!daySchedule || !daySchedule.isWorkingDay) return [];

  // תאריכים חסומים
  let blocked = mockBlockedDates.find((b) => b.date === date);
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("blocked_dates")
      .select("*")
      .eq("date", date)
      .maybeSingle();
    if (data) {
      blocked = {
        id: data.id,
        date: data.date,
        blockedHours: data.blocked_hours ?? null,
        reason: data.reason ?? "",
      };
    }
  }
  if (blocked && blocked.blockedHours === null) return [];

  // שירות
  const allServices = await getServices();
  const service = allServices.find((s) => s.id === serviceId);
  const duration = service?.duration ?? 30;
  const breakMins = service?.breakMinutes ?? 0;
  const quantum = Math.max(5, duration + breakMins);
  const totalBlock = duration + breakMins;

  // תורים קיימים של המטפלת בתאריך הזה
  let bookedSlots: Array<{ time: string; totalBlock: number }> = [];
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    let query = supabase
      .from("appointments")
      .select("time, service_id")
      .eq("date", date)
      .neq("status", "cancelled");
    if (therapistId) query = query.eq("therapist_id", therapistId);
    const { data } = await query;
    if (data) {
      bookedSlots = data.map((r) => {
        const svc = allServices.find((s) => s.id === r.service_id);
        return {
          time: r.time,
          totalBlock: (svc?.duration ?? 30) + (svc?.breakMinutes ?? 0),
        };
      });
    }
  } else {
    bookedSlots = mockAppointments
      .filter(
        (a) =>
          a.date === date &&
          a.status !== "cancelled" &&
          (!therapistId || a.therapistId === therapistId)
      )
      .map((a) => {
        const svc = mockServices.find((s) => s.id === a.serviceId);
        return {
          time: a.time,
          totalBlock: (svc?.duration ?? 30) + (svc?.breakMinutes ?? 0),
        };
      });
  }

  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const [startH, startM] = daySchedule.startTime.split(":").map(Number);
  const [endH, endM] = daySchedule.endTime.split(":").map(Number);
  const workStart = startH * 60 + startM;
  const workEnd = endH * 60 + endM;

  const bookedRanges = bookedSlots
    .map((b) => ({ start: toMins(b.time), end: toMins(b.time) + b.totalBlock }))
    .sort((a, b) => a.start - b.start);

  // חלונות פנויים בתוך שעות העבודה
  const freeWindows: Array<{ start: number; end: number }> = [];
  let cursor = workStart;
  for (const r of bookedRanges) {
    if (r.start > cursor) {
      freeWindows.push({ start: cursor, end: Math.min(r.start, workEnd) });
    }
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < workEnd) freeWindows.push({ start: cursor, end: workEnd });

  // מועמדים חכמים: בתחילת כל חלון ואז בקוונטות של אורך הטיפול+הפסקה
  const candidateStarts = new Set<number>();
  for (const w of freeWindows) {
    // אפשר להתחיל מיד בתחילת החלון
    if (w.start + duration <= w.end) candidateStarts.add(w.start);

    // ואז רק בקוונטות כדי לא ליצור "שברי זמן" מיותרים
    for (let s = w.start + quantum; s + duration <= w.end; s += quantum) {
      candidateStarts.add(s);
    }
  }

  // בנוסף: סוף תור קיים הוא נקודת התחלה חשובה למילוי מיטבי
  for (const r of bookedRanges) {
    if (r.end >= workStart && r.end + duration <= workEnd) candidateStarts.add(r.end);
  }

  const sortedStarts = [...candidateStarts]
    .sort((a, b) => a - b)
    .filter((mins) => mins >= workStart && mins + duration <= workEnd);

  const slots: TimeSlot[] = sortedStarts.map((mins) => {
    const timeStr = toTime(mins);
    const isBlockedHour = blocked?.blockedHours?.includes(timeStr) ?? false;
    const slotEnd = mins + totalBlock;
    const hasConflict = bookedRanges.some((r) => mins < r.end && slotEnd > r.start);
    return { time: timeStr, available: !isBlockedHour && !hasConflict };
  });

  return slots;
}

// ============================================================
// CREATE BOOKING
// ============================================================
export async function createBooking(data: BookingFormData): Promise<Appointment> {
  if (useSupabase) {
    const allServices = await getServices();
    const service = allServices.find((s) => s.id === data.serviceId);
    // מצא שם מטפלת
    let therapistName: string | undefined;
    if (data.therapistId) {
      const therapistList = await dbGetAllTherapists();
      therapistName = therapistList.find((t) => t.id === data.therapistId)?.name;
    }
    return dbCreate({
      ...data,
      serviceName: service?.name ?? data.serviceId,
      therapistName,
    } as BookingFormData & { serviceName: string; therapistName?: string });
  }
  await delay(600);
  const service = mockServices.find((s) => s.id === data.serviceId);
  const newAppointment: Appointment = {
    id: `apt-${Date.now()}`,
    serviceId: data.serviceId,
    serviceName: service?.name ?? "Unknown",
    date: data.date,
    time: data.time,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    notes: data.notes,
    status: "pending",
    createdAt: new Date().toISOString(),
    therapistId: data.therapistId ?? null,
    therapistName: mockTherapists.find((t) => t.id === data.therapistId)?.name ?? null,
  };
  mockAppointments.push(newAppointment);
  return newAppointment;
}

// ============================================================
// THERAPISTS
// ============================================================
export async function getTherapists(): Promise<Therapist[]> {
  if (useSupabase) return dbGetAllTherapists();
  await delay(200);
  return [...mockTherapists];
}

export async function addTherapist(name: string, serviceIds: string[]): Promise<Therapist> {
  if (useSupabase) return dbCreateTherapist(name, serviceIds);
  await delay(200);
  const t: Therapist = { id: `therapist-${Date.now()}`, name, isActive: true, serviceIds };
  mockTherapists.push(t);
  return t;
}

export async function saveTherapist(therapist: Therapist): Promise<void> {
  if (useSupabase) return dbUpdateTherapist(therapist);
  const idx = mockTherapists.findIndex((t) => t.id === therapist.id);
  if (idx !== -1) mockTherapists[idx] = therapist;
}

export async function removeTherapist(id: string): Promise<void> {
  if (useSupabase) return dbDeleteTherapist(id);
  const idx = mockTherapists.findIndex((t) => t.id === id);
  if (idx !== -1) mockTherapists.splice(idx, 1);
}

// ============================================================
// ADMIN — APPOINTMENTS
// ============================================================
export async function getAppointments(): Promise<Appointment[]> {
  if (useSupabase) return dbGetAll();
  await delay(300);
  return [...mockAppointments].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export async function getWeeklySchedule(): Promise<DaySchedule[]> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("working_hours").select("*").order("day_of_week");
    if (data?.length) {
      return data.map((r) => ({ dayOfWeek: r.day_of_week, dayName: r.day_name ?? "", isWorkingDay: r.is_working_day, startTime: r.start_time, endTime: r.end_time }));
    }
  }
  await delay(200);
  return [...mockWeeklySchedule];
}

export async function updateDaySchedule(schedule: DaySchedule): Promise<DaySchedule> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("working_hours").upsert({
      day_of_week: schedule.dayOfWeek,
      day_name: schedule.dayName,
      is_working_day: schedule.isWorkingDay,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
    }, { onConflict: "day_of_week" });
    return schedule;
  }
  await delay(300);
  const index = mockWeeklySchedule.findIndex((d) => d.dayOfWeek === schedule.dayOfWeek);
  if (index !== -1) mockWeeklySchedule[index] = schedule;
  return schedule;
}

export async function getBlockedDates(): Promise<BlockedDate[]> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.from("blocked_dates").select("*").order("date");
    if (data) return data.map((r) => ({ id: r.id, date: r.date, blockedHours: r.blocked_hours ?? null, reason: r.reason ?? "" }));
  }
  await delay(200);
  return [...mockBlockedDates];
}

export async function addBlockedDate(data: Omit<BlockedDate, "id">): Promise<BlockedDate> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data: row, error } = await supabase.from("blocked_dates").insert([{ date: data.date, blocked_hours: data.blockedHours, reason: data.reason }]).select().single();
    if (error) throw error;
    return { id: row.id, date: row.date, blockedHours: row.blocked_hours ?? null, reason: row.reason ?? "" };
  }
  await delay(300);
  const newBlock: BlockedDate = { id: `block-${Date.now()}`, ...data };
  mockBlockedDates.push(newBlock);
  return newBlock;
}

export async function removeBlockedDate(id: string): Promise<void> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("blocked_dates").delete().eq("id", id);
    return;
  }
  await delay(200);
  const index = mockBlockedDates.findIndex((b) => b.id === id);
  if (index !== -1) mockBlockedDates.splice(index, 1);
}

export async function cancelAppointment(id: string): Promise<void> {
  if (useSupabase) return updateAppointmentStatus(id, "cancelled");
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt) apt.status = "cancelled";
}

export async function rescheduleAppointment(id: string, date: string, time: string): Promise<void> {
  if (useSupabase) return dbReschedule(id, date, time);
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt) { apt.date = date; apt.time = time; }
}

export async function deleteAppointment(id: string): Promise<void> {
  if (useSupabase) return dbDeleteAppointment(id);
  await delay(200);
  const idx = mockAppointments.findIndex((a) => a.id === id);
  if (idx !== -1) mockAppointments.splice(idx, 1);
}

export async function confirmAppointment(id: string): Promise<void> {
  if (useSupabase) return updateAppointmentStatus(id, "confirmed");
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt && apt.status === "pending") apt.status = "confirmed";
}

export async function updateLateMinutes(id: string, lateMinutes: number | null): Promise<void> {
  if (useSupabase) return dbUpdateLateMinutes(id, lateMinutes);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt) apt.lateMinutes = lateMinutes;
}

export async function getClientProfiles(): Promise<ClientProfile[]> {
  if (useSupabase) return dbGetClientProfiles();
  const map: Record<string, ClientProfile> = {};
  for (const apt of mockAppointments) {
    if (!map[apt.clientPhone]) {
      map[apt.clientPhone] = { phone: apt.clientPhone, name: apt.clientName, totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, avgLateMinutes: null, score: 100, lastAppointment: null };
    }
    const p = map[apt.clientPhone];
    p.totalAppointments++;
    if (apt.status === "completed") p.completedAppointments++;
    if (apt.status === "cancelled") p.cancelledAppointments++;
    if (!p.lastAppointment || apt.date > p.lastAppointment) p.lastAppointment = apt.date;
  }
  return Object.values(map);
}

export async function getAdminPassword(): Promise<string | null> {
  if (useSupabase) return dbGetAdminPassword();
  return localStorage.getItem("adminPassword");
}

export async function setAdminPassword(password: string): Promise<void> {
  if (useSupabase) return dbSetAdminPassword(password);
  localStorage.setItem("adminPassword", password);
}

// ── Services CRUD (admin) ─────────────────────────────────────────────────
export async function updateService(service: Service): Promise<Service> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data, error } = await supabase.from("services").upsert({
      id: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price,
      icon: service.icon,
      color: service.color,
      break_minutes: service.breakMinutes,
    }).select().single();
    if (error) throw error;
    return { ...service, breakMinutes: data.break_minutes ?? 0 };
  }
  await delay(250);
  const index = mockServices.findIndex((s) => s.id === service.id);
  if (index === -1) throw new Error("השירות לא נמצא");
  mockServices[index] = { ...service };
  return mockServices[index];
}

export type CreateServiceInput = Omit<Service, "id">;

export async function addService(data: CreateServiceInput): Promise<Service> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { data: row, error } = await supabase.from("services").insert([{
      name: data.name, description: data.description, duration: data.duration,
      price: data.price, icon: data.icon, color: data.color, break_minutes: data.breakMinutes ?? 0,
    }]).select().single();
    if (error) throw error;
    return { id: row.id, name: row.name, description: row.description ?? "", duration: row.duration, price: row.price, icon: row.icon, color: row.color, breakMinutes: row.break_minutes ?? 0 };
  }
  await delay(300);
  const id = `svc-${Date.now()}`;
  const newService: Service = { ...data, id, breakMinutes: data.breakMinutes ?? 0 };
  mockServices.push(newService);
  return newService;
}

export async function deleteService(id: string): Promise<void> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await delay(250);
  const hasActiveBooking = mockAppointments.some((a) => a.serviceId === id && (a.status === "pending" || a.status === "confirmed"));
  if (hasActiveBooking) throw new Error("לא ניתן למחוק — יש תור פעיל עבור שירות זה");
  const index = mockServices.findIndex((s) => s.id === id);
  if (index === -1) throw new Error("השירות לא נמצא");
  mockServices.splice(index, 1);
}
