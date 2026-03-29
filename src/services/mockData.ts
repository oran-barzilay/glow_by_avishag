/**
 * Mock data for the Beauty Salon Booking System.
 * This file contains all the fake data used to simulate API responses.
 * When connecting to the real FastAPI backend, you won't need this file anymore.
 */

import { Service, Appointment, DaySchedule, BlockedDate } from "./types";

/** List of services the salon offers */
export const mockServices: Service[] = [
  {
    id: "gel-polish",
    name: "לק ג׳ל",
    description: "מניקור ג׳ל עמיד לאורך זמן, גימור מבריק ומושלם. מעל 200 גוונים לבחירה.",
    duration: 60,
    price: 45,
    icon: "Sparkles",
    color: "service-nails",
    breakMinutes: 10,
  },
  {
    id: "eyebrows",
    name: "עיצוב גבות",
    description: "עיצוב גבות מקצועי עם שעווה, חוט וצבע — למסגרת פנים מדויקת וטבעית.",
    duration: 30,
    price: 35,
    icon: "Eye",
    color: "service-brows",
    breakMinutes: 5,
  },
  {
    id: "spray-tan",
    name: "שיזוף בהתזה",
    description: "גוון שיזוף טבעי ואחיד עם נוסחה אורגנית פרימיום.",
    duration: 45,
    price: 55,
    icon: "Sun",
    color: "service-tan",
    breakMinutes: 10,
  },
];

/** Default weekly schedule — defines working hours for each day */
export const mockWeeklySchedule: DaySchedule[] = [
  { dayOfWeek: 0, dayName: "יום ראשון", isWorkingDay: false, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 1, dayName: "יום שני", isWorkingDay: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 2, dayName: "יום שלישי", isWorkingDay: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 3, dayName: "יום רביעי", isWorkingDay: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 4, dayName: "יום חמישי", isWorkingDay: true, startTime: "09:00", endTime: "19:00" },
  { dayOfWeek: 5, dayName: "יום שישי", isWorkingDay: true, startTime: "09:00", endTime: "19:00" },
  { dayOfWeek: 6, dayName: "יום שבת", isWorkingDay: true, startTime: "10:00", endTime: "16:00" },
];

/** Some blocked dates for demonstration */
export const mockBlockedDates: BlockedDate[] = [
  {
    id: "block-1",
    date: "2026-03-15",
    blockedHours: null,
    reason: "חג",
  },
  {
    id: "block-2",
    date: "2026-03-20",
    blockedHours: ["09:00", "09:30", "10:00"],
    reason: "הדרכת צוות (בוקר)",
  },
];

/** Some sample appointments for the admin dashboard */
export const mockAppointments: Appointment[] = [
  {
    id: "apt-1",
    serviceId: "gel-polish",
    serviceName: "לק ג׳ל",
    date: "2026-03-09",
    time: "10:00",
    clientName: "נועה כהן",
    clientPhone: "050-1234567",
    notes: "מעדיפה גוונים פסטליים",
    status: "confirmed",
    createdAt: "2026-03-06T14:30:00Z",
  },
  {
    id: "apt-2",
    serviceId: "eyebrows",
    serviceName: "עיצוב גבות",
    date: "2026-03-09",
    time: "11:00",
    clientName: "מיכל לוי",
    clientPhone: "052-9876543",
    notes: "",
    status: "confirmed",
    createdAt: "2026-03-06T15:00:00Z",
  },
  {
    id: "apt-3",
    serviceId: "spray-tan",
    serviceName: "שיזוף בהתזה",
    date: "2026-03-10",
    time: "14:00",
    clientName: "שירה אברהם",
    clientPhone: "054-1112233",
    notes: "גוון בינוני",
    status: "confirmed",
    createdAt: "2026-03-07T09:00:00Z",
  },
  {
    id: "apt-4",
    serviceId: "gel-polish",
    serviceName: "לק ג׳ל",
    date: "2026-03-11",
    time: "15:00",
    clientName: "דנה ישראלי",
    clientPhone: "053-4445566",
    notes: "ציפורן צרפתית",
    status: "pending",
    createdAt: "2026-03-07T11:30:00Z",
  },
];
