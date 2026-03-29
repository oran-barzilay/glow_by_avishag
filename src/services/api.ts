/**
 * API Service Layer
 * =================
 * כשמשתני VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY מוגדרים —
 * הפונקציות הרלוונטיות לתורים קוראות/כותבות ל-Supabase.
 * אחרת נעשה שימוש ב-mock data (לפיתוח מקומי).
 */

import {
  Service,
  TimeSlot,
  Appointment,
  DaySchedule,
  BlockedDate,
  BookingFormData,
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
} from "@/lib/db";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// האם Supabase מוגדר?
const useSupabase = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ============================================================
// CLIENT-FACING API FUNCTIONS
// ============================================================

/**
 * Fetches all available services from the salon.
 * Replace with: GET /api/services
 */
export async function getServices(): Promise<Service[]> {
  await delay(300);
  return mockServices;
}

/**
 * Fetches available time slots for a given date and service.
 * The function generates slots based on the weekly schedule,
 * filters out blocked dates/hours, and removes already-booked slots.
 * 
 * Replace with: GET /api/slots?date={date}&serviceId={serviceId}
 */
export async function getAvailableSlots(
  date: string,
  serviceId: string
): Promise<TimeSlot[]> {
  await delay(400);

  // Parse the date to find the day of the week (0 = Sunday)
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();

  // Look up the schedule for this day of the week
  const daySchedule = mockWeeklySchedule.find(
    (d) => d.dayOfWeek === dayOfWeek
  );

  // If it's not a working day, return empty slots
  if (!daySchedule || !daySchedule.isWorkingDay) {
    return [];
  }

  // Check if the entire date is blocked
  const blocked = mockBlockedDates.find((b) => b.date === date);
  if (blocked && blocked.blockedHours === null) {
    return []; // Entire day is blocked
  }

  // Generate 30-minute time slots between start and end time
  const slots: TimeSlot[] = [];
  const [startH, startM] = daySchedule.startTime.split(":").map(Number);
  const [endH, endM] = daySchedule.endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Find the service to know its duration
  const service = mockServices.find((s) => s.id === serviceId);
  const slotInterval = 30; // Generate a slot every 30 minutes

  for (let mins = startMinutes; mins < endMinutes; mins += slotInterval) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;

    // Check if this specific hour is blocked
    const isBlocked =
      blocked?.blockedHours?.includes(timeStr) ?? false;

    // Check if there's already an appointment at this time
    const isBooked = useSupabase
      ? await isTimeSlotTaken(date, timeStr)
      : mockAppointments.some(
          (apt) =>
            apt.date === date &&
            apt.time === timeStr &&
            (apt.status === "pending" || apt.status === "confirmed")
        );

    slots.push({
      time: timeStr,
      available: !isBlocked && !isBooked,
    });
  }

  return slots;
}

/**
 * Submits a new booking/appointment.
 */
export async function createBooking(
  data: BookingFormData
): Promise<Appointment> {
  if (useSupabase) {
    const service = mockServices.find((s) => s.id === data.serviceId);
    return dbCreate({ ...data, serviceId: data.serviceId, serviceName: service?.name ?? data.serviceId } as any);
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
  };
  mockAppointments.push(newAppointment);

  return newAppointment;
}

// ============================================================
// ADMIN API FUNCTIONS
// ============================================================

/**
 * Fetches all appointments (for admin dashboard).
 */
export async function getAppointments(): Promise<Appointment[]> {
  if (useSupabase) {
    return dbGetAll();
  }
  await delay(300);
  return [...mockAppointments].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
  });
}

/**
 * Fetches the weekly schedule (default working hours).
 * Replace with: GET /api/admin/schedule
 */
export async function getWeeklySchedule(): Promise<DaySchedule[]> {
  await delay(200);
  return [...mockWeeklySchedule];
}

/**
 * Updates the schedule for a specific day of the week.
 * Replace with: PUT /api/admin/schedule/{dayOfWeek}
 */
export async function updateDaySchedule(
  schedule: DaySchedule
): Promise<DaySchedule> {
  await delay(300);

  // Find and update the mock data in place
  const index = mockWeeklySchedule.findIndex(
    (d) => d.dayOfWeek === schedule.dayOfWeek
  );
  if (index !== -1) {
    mockWeeklySchedule[index] = schedule;
  }

  return schedule;
}

/**
 * Fetches all blocked dates.
 * Replace with: GET /api/admin/blocked-dates
 */
export async function getBlockedDates(): Promise<BlockedDate[]> {
  await delay(200);
  return [...mockBlockedDates];
}

/**
 * Adds a new blocked date or blocked hours.
 * Replace with: POST /api/admin/blocked-dates
 */
export async function addBlockedDate(
  data: Omit<BlockedDate, "id">
): Promise<BlockedDate> {
  await delay(300);

  const newBlock: BlockedDate = {
    id: `block-${Date.now()}`,
    ...data,
  };
  mockBlockedDates.push(newBlock);

  return newBlock;
}

/**
 * Removes a blocked date.
 * Replace with: DELETE /api/admin/blocked-dates/{id}
 */
export async function removeBlockedDate(id: string): Promise<void> {
  await delay(200);

  const index = mockBlockedDates.findIndex((b) => b.id === id);
  if (index !== -1) {
    mockBlockedDates.splice(index, 1);
  }
}

/**
 * Cancels an appointment (admin action).
 */
export async function cancelAppointment(id: string): Promise<void> {
  if (useSupabase) {
    return updateAppointmentStatus(id, "cancelled");
  }
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt) apt.status = "cancelled";
}

/**
 * Confirms a pending appointment (admin action).
 */
export async function confirmAppointment(id: string): Promise<void> {
  if (useSupabase) {
    return updateAppointmentStatus(id, "confirmed");
  }
  await delay(300);
  const apt = mockAppointments.find((a) => a.id === id);
  if (apt && apt.status === "pending") apt.status = "confirmed";
}

/**
 * Updates an existing service (admin).
 * Replace with: PUT /api/admin/services/{id}
 */
export async function updateService(service: Service): Promise<Service> {
  await delay(250);

  const index = mockServices.findIndex((s) => s.id === service.id);
  if (index === -1) {
    throw new Error("השירות לא נמצא");
  }
  mockServices[index] = { ...service };
  return mockServices[index];
}

export type CreateServiceInput = Omit<Service, "id">;

/**
 * Adds a new service (admin).
 * Replace with: POST /api/admin/services
 */
export async function addService(data: CreateServiceInput): Promise<Service> {
  await delay(300);

  const id = `svc-${Date.now()}`;
  const newService: Service = { ...data, id };
  mockServices.push(newService);
  return newService;
}

/**
 * Deletes a service (admin). Blocked if active appointments reference it.
 * Replace with: DELETE /api/admin/services/{id}
 */
export async function deleteService(id: string): Promise<void> {
  await delay(250);

  const hasActiveBooking = mockAppointments.some(
    (a) =>
      a.serviceId === id &&
      (a.status === "pending" || a.status === "confirmed")
  );
  if (hasActiveBooking) {
    throw new Error(
      "לא ניתן למחוק — יש תור פעיל או ממתין לאישור עבור שירות זה"
    );
  }

  const index = mockServices.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error("השירות לא נמצא");
  }
  mockServices.splice(index, 1);
}
