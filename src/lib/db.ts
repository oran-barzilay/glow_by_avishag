import { supabase } from "@/lib/supabase";
import type { Appointment, BookingFormData, ClientProfile } from "@/services/types";

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

// ── שליפת תורים לפי טלפון ("התורים שלי") ────────────────────────────────
export async function getAppointmentsByPhone(
  phone: string
): Promise<Appointment[]> {
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
export async function createAppointment(
  booking: BookingFormData
): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        service_id: booking.serviceId,
        service_name: booking.serviceId, // יעודכן בהמשך
        date: booking.date,
        time: booking.time,
        name: booking.clientName,
        phone: booking.clientPhone.replace(/\D/g, ""),
        notes: booking.notes ?? "",
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

// ── עדכון סטטוס תור ──────────────────────────────────────────────────────
export async function updateAppointmentStatus(
  id: string,
  status: Appointment["status"]
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

// ── בדיקה אם שעה תפוסה ───────────────────────────────────────────────────
export async function isTimeSlotTaken(
  date: string,
  time: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("date", date)
    .eq("time", time)
    .neq("status", "cancelled")
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// ── עדכון דקות איחור לתור ────────────────────────────────────────────────
export async function updateLateMinutes(
  id: string,
  lateMinutes: number | null
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update({ late_minutes: lateMinutes })
    .eq("id", id);

  if (error) throw error;
}

// ── שליפת פרופילי לקוחות ─────────────────────────────────────────────────
export async function getClientProfiles(): Promise<ClientProfile[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("date", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];

  // קבץ לפי טלפון
  const map: Record<string, ClientProfile> = {};
  for (const row of rows) {
    const phone = row.phone ?? "";
    if (!map[phone]) {
      map[phone] = {
        phone,
        name: row.name ?? "",
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        avgLateMinutes: null,
        score: 100,
        lastAppointment: null,
      };
    }
    const p = map[phone];
    p.totalAppointments++;
    if (row.status === "completed") p.completedAppointments++;
    if (row.status === "cancelled") p.cancelledAppointments++;
    if (!p.lastAppointment || row.date > p.lastAppointment)
      p.lastAppointment = row.date;
  }

  // חשב ממוצע איחור וציון
  for (const phone of Object.keys(map)) {
    const p = map[phone];
    const lateRows = rows.filter(
      (r) => r.phone === phone && typeof r.late_minutes === "number"
    );
    if (lateRows.length > 0) {
      p.avgLateMinutes =
        lateRows.reduce((sum: number, r: Record<string,number>) => sum + (r.late_minutes ?? 0), 0) /
        lateRows.length;
    }

    // ציון: מתחיל מ-100, מחסיר על ביטולים ואיחורים
    let score = 100;
    if (p.totalAppointments > 0) {
      const cancelRate = p.cancelledAppointments / p.totalAppointments;
      score -= Math.round(cancelRate * 50); // עד -50 על ביטולים
    }
    if (p.avgLateMinutes !== null) {
      score -= Math.min(30, Math.round(p.avgLateMinutes / 5) * 5); // עד -30 על איחורים
    }
    p.score = Math.max(0, score);
  }

  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "he"));
}

// ── מיפוי שורת DB → טיפוס Appointment ───────────────────────────────────
function mapRow(row: Record<string, string>): Appointment {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    date: row.date,
    time: row.time,
    clientName: row.name,
    clientPhone: row.phone,
    notes: row.notes ?? "",
    status: row.status as Appointment["status"],
    createdAt: row.created_at,
    lateMinutes: row.late_minutes != null ? Number(row.late_minutes) : null,
  };
}

