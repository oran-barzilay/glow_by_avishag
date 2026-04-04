/**
 * Type definitions for the Beauty Salon Booking System.
 * These types define the shape of data used throughout the app.
 * When you connect the real backend, these types should match 
 * the API response shapes from your FastAPI endpoints.
 */

/** קוסמטיקאית / מטפלת */
export interface Therapist {
  id: string;
  name: string;
  isActive: boolean;
  /** שירותים שהיא מסוגלת לתת (מערך של serviceId) */
  serviceIds: string[];
}

/** Represents a service offered by the salon */
export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;    // Duration in minutes
  price: number;       // Price in your currency
  icon: string;        // Lucide icon name for display
  color: string;       // Tailwind color class for theming
  breakMinutes: number; // הפסקה אחרי הטיפול (דקות)
  /** שירות עוגן — מגדיר את גריד השעות לכל שאר השירותים */
  isAnchor?: boolean;
}

/** Represents a single time slot available for booking */
export interface TimeSlot {
  time: string;        // Time in "HH:MM" 24-hour format
  available: boolean;  // Whether this slot can be booked
}

/** Represents a booking/appointment made by a client */
export interface Appointment {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string;        // ISO date string "YYYY-MM-DD"
  time: string;        // "HH:MM" format
  clientName: string;
  clientPhone: string;
  notes: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;   // ISO datetime string
  lateMinutes?: number | null;
  therapistId?: string | null;
  therapistName?: string | null;
  /** Timestamp שבו אישר הלקוח את התקנון */
  termsAcceptedAt?: string | null;
  /** כתובת IP שממנה אושר התקנון */
  termsAcceptedIp?: string | null;
}

/** פרופיל לקוח עם סטטיסטיקות */
export interface ClientProfile {
  phone: string;
  name: string;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  avgLateMinutes: number | null;
  score: number; // 0-100
  lastAppointment: string | null;
}

/** לקוח מנוהל (נשמר דרך ממשק הניהול) */
export interface ManagedClient {
  phone: string;
  name: string;
  isBlocked: boolean;
  /** שעות מוסתרות (HH:MM) שלא יוצגו ללקוח זה בהזמנה */
  hiddenHours: string[];
  updatedAt: string;
}

/** Represents the working hours for a specific day of the week */
export interface DaySchedule {
  dayOfWeek: number;   // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayName: string;     // Human-readable day name
  isWorkingDay: boolean;
  startTime: string;   // "HH:MM" format
  endTime: string;     // "HH:MM" format
}

/** Represents a blocked date or specific blocked hours on a date */
export interface BlockedDate {
  id: string;
  date: string;          // ISO date string "YYYY-MM-DD"
  blockedHours: string[] | null;  // null = entire day blocked, array = specific hours
  reason: string;
}

/** Data submitted when a client books an appointment */
export interface BookingFormData {
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  notes: string;
  therapistId?: string | null;
  /** Timestamp שבו אישר הלקוח את התקנון (ISO string) */
  termsAcceptedAt?: string | null;
  /** כתובת IP שממנה אושר התקנון */
  termsAcceptedIp?: string | null;
}
