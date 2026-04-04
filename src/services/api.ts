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
  ManagedClient,
} from "./types";

import {
  mockServices,
  mockAppointments,
  mockWeeklySchedule,
  mockBlockedDates,
} from "./mockData";

import {
  getAllAppointments as dbGetAll,
  getAppointmentsByPhone as dbGetByPhone,
  getManagedClients as dbGetManagedClients,
  saveManagedClients as dbSaveManagedClients,
  createAppointment as dbCreate,
  createAdminAppointment as dbCreateAdmin,
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
  rescheduleAppointmentByClient as dbRescheduleByClient,
  cancelPendingAppointmentByClient as dbCancelPendingByClient,
  requestCancellationByClient as dbRequestCancellationByClient,
  deleteAppointment as dbDeleteAppointment,
  getTerms as dbGetTerms,
  setTerms as dbSetTerms,
} from "@/lib/db";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const useSupabase = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const CLIENT_CANCEL_REQUEST_TAG = "[cancel-request]";

export const hasClientCancelRequest = (notes?: string | null): boolean =>
  !!notes && notes.includes(CLIENT_CANCEL_REQUEST_TAG);

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export async function findClientByPhone(phone: string): Promise<{ name: string; phone: string } | null> {
  const cleaned = normalizePhone(phone);
  if (cleaned.length < 7) return null;

  const managed = await getManagedClients();
  const managedMatch = managed.find((c) => c.phone === cleaned);
  if (managedMatch) return { name: managedMatch.name, phone: managedMatch.phone };

  if (useSupabase) {
    const rows = await dbGetByPhone(cleaned);
    if (!rows.length) return null;
    const latest = [...rows].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
    return { name: latest.clientName, phone: latest.clientPhone };
  }

  const rows = mockAppointments
    .filter((a) => a.clientPhone.replace(/\D/g, "") === cleaned)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  if (!rows.length) return null;
  return { name: rows[0].clientName, phone: rows[0].clientPhone };
}

export async function getManagedClients(): Promise<ManagedClient[]> {
  if (useSupabase) return dbGetManagedClients();
  try {
    const raw = localStorage.getItem("managedClients");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveManagedClients(clients: ManagedClient[]): Promise<void> {
  if (useSupabase) {
    await dbSaveManagedClients(clients);
    return;
  }
  localStorage.setItem("managedClients", JSON.stringify(clients));
}

export async function upsertManagedClient(input: { phone: string; name: string }): Promise<ManagedClient> {
  const phone = normalizePhone(input.phone);
  if (phone.length < 7) throw new Error("טלפון לא תקין");
  const name = input.name.trim();
  if (!name) throw new Error("שם לקוח חובה");

  const current = await getManagedClients();
  const existing = current.find((c) => c.phone === phone);
  const next: ManagedClient = {
    phone,
    name,
    isBlocked: existing?.isBlocked ?? false,
    hiddenHours: existing?.hiddenHours ?? [],
    updatedAt: new Date().toISOString(),
  };
  const merged = existing
    ? current.map((c) => (c.phone === phone ? next : c))
    : [...current, next];
  await saveManagedClients(merged);
  return next;
}

export async function setManagedClientBlocked(phone: string, isBlocked: boolean, defaultName?: string): Promise<void> {
  const cleaned = normalizePhone(phone);
  const current = await getManagedClients();
  const found = current.find((c) => c.phone === cleaned);
  if (!found) {
    if (!defaultName?.trim()) throw new Error("לקוח לא נמצא");
    await upsertManagedClient({ phone: cleaned, name: defaultName });
    return setManagedClientBlocked(cleaned, isBlocked);
  }
  await saveManagedClients(current.map((c) =>
    c.phone === cleaned ? { ...c, isBlocked, updatedAt: new Date().toISOString() } : c
  ));
}

export async function setManagedClientHiddenHours(phone: string, hiddenHours: string[], defaultName?: string): Promise<void> {
  const cleaned = normalizePhone(phone);
  const current = await getManagedClients();
  const found = current.find((c) => c.phone === cleaned);
  if (!found) {
    if (!defaultName?.trim()) throw new Error("לקוח לא נמצא");
    await upsertManagedClient({ phone: cleaned, name: defaultName });
    return setManagedClientHiddenHours(cleaned, hiddenHours);
  }
  const normalizedHours = [...new Set(hiddenHours)].sort();
  await saveManagedClients(current.map((c) =>
    c.phone === cleaned ? { ...c, hiddenHours: normalizedHours, updatedAt: new Date().toISOString() } : c
  ));
}

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
      isAnchor: r.is_anchor ?? false,
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
  therapistId?: string | null,
  clientPhone?: string | null,
): Promise<TimeSlot[]> {
  await delay(200);

  const parseDurationFromNotes = (notes?: string | null): number | null => {
    if (!notes) return null;
    const m = notes.match(/\[dur=(\d+)\]/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

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
  const totalBlock = duration + breakMins;

  // תורים קיימים של המטפלת בתאריך הזה
  let bookedSlots: Array<{ time: string; totalBlock: number }> = [];
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    let query = supabase
      .from("appointments")
      .select("time, service_id, notes")
      .eq("date", date)
      .neq("status", "cancelled");
    if (therapistId) query = query.eq("therapist_id", therapistId);
    const { data } = await query;
    if (data) {
      bookedSlots = data.map((r) => {
        const svc = allServices.find((s) => s.id === r.service_id);
        const dynamicDuration = parseDurationFromNotes((r as { notes?: string | null }).notes);
        return {
          time: r.time,
          totalBlock: svc
            ? (svc.duration + (svc.breakMinutes ?? 0))
            : (dynamicDuration ?? 30),
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
        const dynamicDuration = parseDurationFromNotes(a.notes);
        return {
          time: a.time,
          totalBlock: svc
            ? (svc.duration + (svc.breakMinutes ?? 0))
            : (dynamicDuration ?? 30),
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

  // ── Anchor service (שירות עוגן) ───────────────────────────────────────────
  // NOTE: anchorService is only found if the `is_anchor` column exists in the
  // Supabase `services` table. Run the SQL migration first (see README).
  const anchorService = allServices.find((s) => s.isAnchor);
  const anchorTotalBlock = anchorService
    ? (anchorService.duration + (anchorService.breakMinutes ?? 0))
    : null;

  const SLOT_STEP = 5;

  // Sort existing booked ranges ascending by start time.
  const bookedRanges = bookedSlots
    .map((b) => ({ start: toMins(b.time), end: toMins(b.time) + b.totalBlock }))
    .sort((a, b) => a.start - b.start);

  // Step 1 — Free blocks (contiguous gaps inside the workday).
  const freeBlocks: Array<{ start: number; end: number }> = [];
  let cursor = workStart;
  for (const r of bookedRanges) {
    if (r.start > cursor) {
      freeBlocks.push({ start: cursor, end: Math.min(r.start, workEnd) });
    }
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < workEnd) freeBlocks.push({ start: cursor, end: workEnd });

  const candidateStarts = new Set<number>();

  if (anchorTotalBlock) {
    // ── ANCHOR GRID MODE ─────────────────────────────────────────────────────
    //
    // The step size for a given service is GCD(serviceTotalBlock, anchorTotalBlock).
    //
    // WHY GCD?
    //   • Anchor = 70 min (60+10).  Service = 70 min → step = GCD(70,70) = 70.
    //     Slots: 09:00, 10:10, 11:20 …  (every full anchor cell)
    //
    //   • Service = 35 min (30+5)  → step = GCD(35,70) = 35.
    //     Slots: 09:00, 09:35, 10:10, 10:45 …  (every half anchor cell)
    //     Two of these fit perfectly inside one anchor cell with no dead time.
    //
    //   • Service = 210 min (180+30) → step = GCD(210,70) = 70.
    //     Slots: 09:00, 10:10 …  (only full-cell boundaries, since 3 cells = 210)
    //
    //   • Service = 25 min (shizuf, break=10 → totalBlock=35) → step = GCD(35,70) = 35.
    //     Same as the 35-min case above.
    //
    // A slot is offered when the step-boundary falls inside a free block AND
    // the service duration fits before the block ends.
    //
    // Dynamic update: because every service snaps to a multiple of GCD, any
    // booking (anchor or non-anchor) leaves the remaining free space also a
    // multiple of GCD — so the grid stays consistent for future bookings.

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const step = gcd(totalBlock, anchorTotalBlock);

    for (let t = workStart; t + duration <= workEnd; t += step) {
      for (const block of freeBlocks) {
        if (t >= block.start && t + duration <= block.end) {
          candidateStarts.add(t);
          break;
        }
      }
    }

  } else {
    // ── FALLBACK: no anchor defined ───────────────────────────────────────────
    // Offer every 5-minute candidate in each free block + block edges.
    for (const block of freeBlocks) {
      const blockSize = block.end - block.start;
      if (blockSize < duration) continue;

      candidateStarts.add(block.start);

      const maxOffset = blockSize - duration;
      for (let offset = SLOT_STEP; offset <= maxOffset; offset += SLOT_STEP) {
        candidateStarts.add(block.start + offset);
      }

      const rightEdge = block.end - duration;
      if (rightEdge > block.start) candidateStarts.add(rightEdge);
    }
  }

  // Step 3 — Sort, filter, build TimeSlot objects.
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

  if (clientPhone) {
    const managed = await getManagedClients();
    const rule = managed.find((c) => c.phone === normalizePhone(clientPhone));
    if (rule?.isBlocked) return [];
    if (rule?.hiddenHours?.length) {
      return slots.filter((s) => !rule.hiddenHours.includes(s.time));
    }
  }

  return slots;
}

// ============================================================
// CREATE BOOKING
// ============================================================
export async function createBooking(data: BookingFormData): Promise<Appointment> {
  const managed = await getManagedClients();
  const clientRule = managed.find((c) => c.phone === normalizePhone(data.clientPhone));
  if (clientRule?.isBlocked) {
    throw new Error("לא ניתן לקבוע תור עבור לקוח זה. פני למנהלת הסטודיו.");
  }

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

export type CreateAdminExceptionInput = {
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  notes?: string;
  therapistId?: string | null;
  desiredDurationMinutes?: number;
  customServiceName?: string;
};

export async function createAdminExceptionAppointment(
  data: CreateAdminExceptionInput
): Promise<Appointment> {
  const durationTag = data.desiredDurationMinutes && data.desiredDurationMinutes > 0
    ? `[dur=${data.desiredDurationMinutes}]`
    : "";
  const mergedNotes = [durationTag, data.notes ?? ""].filter(Boolean).join(" ").trim();

  const isOther = data.serviceId === "__other__";
  const effectiveServiceId = isOther ? "custom-other" : data.serviceId;

  if (useSupabase) {
    const allServices = await getServices();
    const service = allServices.find((s) => s.id === data.serviceId);
    let therapistName: string | undefined;
    if (data.therapistId) {
      const therapistList = await dbGetAllTherapists();
      therapistName = therapistList.find((t) => t.id === data.therapistId)?.name;
    }

    return dbCreateAdmin({
      serviceId: effectiveServiceId,
      date: data.date,
      time: data.time,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      notes: mergedNotes,
      therapistId: data.therapistId ?? null,
      serviceName: isOther ? (data.customServiceName?.trim() || "טיפול אחר") : (service?.name ?? data.serviceId),
      therapistName,
      status: "confirmed",
    });
  }

  await delay(250);
  const service = mockServices.find((s) => s.id === data.serviceId);
  const apt: Appointment = {
    id: `apt-${Date.now()}`,
    serviceId: effectiveServiceId,
    serviceName: isOther ? (data.customServiceName?.trim() || "טיפול אחר") : (service?.name ?? data.serviceId),
    date: data.date,
    time: data.time,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    notes: mergedNotes,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    therapistId: data.therapistId ?? null,
    therapistName: mockTherapists.find((t) => t.id === data.therapistId)?.name ?? null,
  };
  mockAppointments.push(apt);
  return apt;
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

// ביטול ע"י לקוח:
// - תור pending: מתבטל מיד
// - תור confirmed: נשלחת בקשת ביטול לאישור מנהל
export async function cancelAppointmentByClient(appointment: Appointment): Promise<Appointment> {
  if (useSupabase) {
    if (appointment.status === "pending") {
      await dbCancelPendingByClient(appointment.id);
      return { ...appointment, status: "cancelled" };
    }

    if (appointment.status === "confirmed") {
      const nextNotes = hasClientCancelRequest(appointment.notes)
        ? (appointment.notes ?? "")
        : `${appointment.notes ?? ""} ${CLIENT_CANCEL_REQUEST_TAG}`.trim();
      await dbRequestCancellationByClient(appointment.id, nextNotes);
      return { ...appointment, notes: nextNotes };
    }

    return appointment;
  }

  await delay(250);
  const apt = mockAppointments.find((a) => a.id === appointment.id);
  if (!apt) return appointment;

  if (apt.status === "pending") {
    apt.status = "cancelled";
    return { ...apt };
  }

  if (apt.status === "confirmed") {
    if (!hasClientCancelRequest(apt.notes)) {
      apt.notes = `${apt.notes ?? ""} ${CLIENT_CANCEL_REQUEST_TAG}`.trim();
    }
    return { ...apt };
  }

  return { ...apt };
}

export async function rescheduleAppointment(id: string, date: string, time: string): Promise<void> {
  if (useSupabase) return dbReschedule(id, date, time);
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt) { apt.date = date; apt.time = time; }
}

// שינוי מועד ע"י לקוח מחזיר את התור למצב ממתין לאישור
export async function rescheduleAppointmentByClient(id: string, date: string, time: string): Promise<void> {
  if (useSupabase) {
    const all = await dbGetAll();
    const apt = all.find((a) => a.id === id);
    if (!apt) throw new Error("התור לא נמצא");

    const slots = await getAvailableSlots(date, apt.serviceId, apt.therapistId, apt.clientPhone);
    const allowed = slots.some((s) => s.time === time && s.available);
    if (!allowed) throw new Error("השעה שבחרת אינה זמינה");

    return dbRescheduleByClient(id, date, time);
  }
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt) {
    const slots = await getAvailableSlots(date, apt.serviceId, apt.therapistId, apt.clientPhone);
    const allowed = slots.some((s) => s.time === time && s.available);
    if (!allowed) throw new Error("השעה שבחרת אינה זמינה");
    apt.date = date;
    apt.time = time;
    apt.status = "pending";
  }
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

// ============================================================
// CLIENTS
// ============================================================
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
    if (service.isAnchor) {
      await supabase.from("services").update({ is_anchor: false }).neq("id", service.id);
    }
    const { data, error } = await supabase.from("services").upsert({
      id: service.id,
      name: service.name,
      description: service.description,
      duration: service.duration,
      price: service.price,
      icon: service.icon,
      color: service.color,
      break_minutes: service.breakMinutes,
      is_anchor: service.isAnchor ?? false,
    }).select().single();
    if (error) throw error;
    return { ...service, breakMinutes: data.break_minutes ?? 0, isAnchor: data.is_anchor ?? false };
  }
  await delay(250);
  if (service.isAnchor) {
    mockServices.forEach((s) => { if (s.id !== service.id) s.isAnchor = false; });
  }
  const index = mockServices.findIndex((s) => s.id === service.id);
  if (index === -1) throw new Error("השירות לא נמצא");
  mockServices[index] = { ...service };
  return mockServices[index];
}

export async function setAnchorService(serviceId: string | null): Promise<void> {
  if (useSupabase) {
    const { supabase } = await import("@/lib/supabase");
    await supabase.from("services").update({ is_anchor: false }).neq("id", "");
    if (serviceId) {
      await supabase.from("services").update({ is_anchor: true }).eq("id", serviceId);
    }
    return;
  }
  mockServices.forEach((s) => { s.isAnchor = s.id === serviceId; });
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

// ============================================================
// TERMS (תקנון)
// ============================================================
export async function getTerms(): Promise<string> {
  if (useSupabase) return dbGetTerms();
  return localStorage.getItem("terms") ?? "";
}

export async function setTerms(text: string): Promise<void> {
  if (useSupabase) return dbSetTerms(text);
  localStorage.setItem("terms", text);
}
