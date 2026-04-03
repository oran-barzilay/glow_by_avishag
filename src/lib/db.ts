import { supabase } from "@/lib/supabase";
import type { Appointment, BookingFormData, ClientProfile, Therapist } from "@/services/types";

// ── שליפת כל התורים (לממשק ניהול) ──────────────────────────────────────
export async function getAllAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// ── שליפת תורים לפי טלפון ────────────────────────────────────────────────
export async function getAppointmentsByPhone(phone: string): Promise<Appointment[]> {
  const cleaned = phone.replace(/\D/g, "");
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("phone", cleaned)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

// ── יצירת תור חדש ────────────────────────────────────────────────────────
export async function createAppointment(booking: BookingFormData & { serviceName?: string }): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert([{
      service_id: booking.serviceId,
      service_name: booking.serviceName ?? booking.serviceId,
      date: booking.date,
      time: booking.time,
      name: booking.clientName,
      phone: booking.clientPhone.replace(/\D/g, ""),
      notes: booking.notes ?? "",
      status: "pending",
      therapist_id: booking.therapistId ?? null,
      therapist_name: (booking as BookingFormData & { therapistName?: string }).therapistName ?? null,
    }])
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

// ── יצירת תור חריג (מנהל) ────────────────────────────────────────────────
export async function createAdminAppointment(
  booking: BookingFormData & {
    serviceName?: string;
    therapistName?: string;
    status?: Appointment["status"];
  }
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert([{
      service_id: booking.serviceId,
      service_name: booking.serviceName ?? booking.serviceId,
      date: booking.date,
      time: booking.time,
      name: booking.clientName,
      phone: (booking.clientPhone ?? "").replace(/\D/g, ""),
      notes: booking.notes ?? "",
      status: booking.status ?? "confirmed",
      therapist_id: booking.therapistId ?? null,
      therapist_name: booking.therapistName ?? null,
    }])
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

// ── מחיקת תור לצמיתות ────────────────────────────────────────────────────
export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

// ── עדכון סטטוס תור ──────────────────────────────────────────────────────
export async function updateAppointmentStatus(id: string, status: Appointment["status"]): Promise<void> {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) throw error;
}

// ── שינוי שעה/תאריך לתור ─────────────────────────────────────────────────
export async function rescheduleAppointment(id: string, date: string, time: string): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ date, time })
    .eq("id", id);
  if (error) throw error;
}

// ── בדיקה אם שעה תפוסה (לפי מטפלת אם הוגדרה) ───────────────────────────
export async function isTimeSlotTaken(
  date: string,
  time: string,
  therapistId?: string | null
): Promise<boolean> {
  let query = supabase
    .from("appointments")
    .select("id")
    .eq("date", date)
    .eq("time", time)
    .neq("status", "cancelled");

  if (therapistId) {
    query = query.eq("therapist_id", therapistId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return !!data;
}

// ── עדכון דקות איחור לתור ────────────────────────────────────────────────
export async function updateLateMinutes(id: string, lateMinutes: number | null): Promise<void> {
  const { error } = await supabase.from("appointments").update({ late_minutes: lateMinutes }).eq("id", id);
  if (error) throw error;
}

// ── שליפת כל המטפלות ─────────────────────────────────────────────────────
export async function getAllTherapists(): Promise<Therapist[]> {
  const { data, error } = await supabase
    .from("therapists")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active ?? true,
    serviceIds: r.service_ids ?? [],
  }));
}

// ── הוספת מטפלת ──────────────────────────────────────────────────────────
export async function createTherapist(name: string, serviceIds: string[]): Promise<Therapist> {
  const { data, error } = await supabase
    .from("therapists")
    .insert([{ name, is_active: true, service_ids: serviceIds }])
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, name: data.name, isActive: data.is_active, serviceIds: data.service_ids ?? [] };
}

// ── עדכון מטפלת ──────────────────────────────────────────────────────────
export async function updateTherapist(therapist: Therapist): Promise<void> {
  const { error } = await supabase
    .from("therapists")
    .update({ name: therapist.name, is_active: therapist.isActive, service_ids: therapist.serviceIds })
    .eq("id", therapist.id);

  if (error) throw error;
}

// ── מחיקת מטפלת ──────────────────────────────────────────────────────────
export async function deleteTherapist(id: string): Promise<void> {
  const { error } = await supabase.from("therapists").delete().eq("id", id);
  if (error) throw error;
}

// ── שליפת תורים תפוסים של מטפלת בתאריך (לחישוב זמינות) ──────────────────
export async function getTherapistBookedSlots(
  therapistId: string,
  date: string
): Promise<Array<{ time: string; duration: number; breakMinutes: number }>> {
  const { data, error } = await supabase
    .from("appointments")
    .select("time, service_id")
    .eq("therapist_id", therapistId)
    .eq("date", date)
    .neq("status", "cancelled");

  if (error) throw error;
  return (data ?? []).map((r) => ({
    time: r.time,
    duration: 30, // fallback - יחושב מהשירות
    breakMinutes: 0,
  }));
}

// ── שליפת פרופילי לקוחות ─────────────────────────────────────────────────
export async function getClientProfiles(): Promise<ClientProfile[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("date", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];

  const map: Record<string, ClientProfile> = {};
  for (const row of rows) {
    const phone = row.phone ?? "";
    if (!map[phone]) {
      map[phone] = { phone, name: row.name ?? "", totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, avgLateMinutes: null, score: 100, lastAppointment: null };
    }
    const p = map[phone];
    p.totalAppointments++;
    if (row.status === "completed") p.completedAppointments++;
    if (row.status === "cancelled") p.cancelledAppointments++;
    if (!p.lastAppointment || row.date > p.lastAppointment) p.lastAppointment = row.date;
  }

  for (const phone of Object.keys(map)) {
    const p = map[phone];
    const lateRows = rows.filter((r) => r.phone === phone && typeof r.late_minutes === "number");
    if (lateRows.length > 0) {
      p.avgLateMinutes = lateRows.reduce((sum: number, r: Record<string, number>) => sum + (r.late_minutes ?? 0), 0) / lateRows.length;
    }
    let score = 100;
    if (p.totalAppointments > 0) score -= Math.round((p.cancelledAppointments / p.totalAppointments) * 50);
    if (p.avgLateMinutes !== null) score -= Math.min(30, Math.round(p.avgLateMinutes / 5) * 5);
    p.score = Math.max(0, score);
  }

  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "he"));
}

// ── שליפת סיסמת ניהול ────────────────────────────────────────────────────
export async function getAdminPassword(): Promise<string | null> {
  const { data, error } = await supabase.from("settings").select("value").eq("key", "admin_password").maybeSingle();
  if (error) return null;
  return data?.value ?? null;
}

// ── שמירת סיסמת ניהול ────────────────────────────────────────────────────
export async function setAdminPassword(password: string): Promise<void> {
  const { error } = await supabase.from("settings").upsert({ key: "admin_password", value: password }, { onConflict: "key" });
  if (error) throw error;
}

// ── מיפוי שורת DB → טיפוס Appointment ───────────────────────────────────
function mapRow(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    serviceName: row.service_name as string,
    date: row.date as string,
    time: row.time as string,
    clientName: row.name as string,
    clientPhone: row.phone as string,
    notes: (row.notes as string) ?? "",
    status: row.status as Appointment["status"],
    createdAt: row.created_at as string,
    lateMinutes: row.late_minutes != null ? Number(row.late_minutes) : null,
    therapistId: (row.therapist_id as string) ?? null,
    therapistName: (row.therapist_name as string) ?? null,
  };
}
