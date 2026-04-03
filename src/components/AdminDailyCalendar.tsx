/**
 * AdminDailyCalendar
 * יומן יומי per מטפלת — מציג תורים על ציר זמן, מאפשר גרירה לשינוי שעה ועריכה.
 */

import { useState, useRef, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, User } from "lucide-react";
import { Appointment, Therapist, Service, DaySchedule } from "@/services/types";
import { rescheduleAppointment, getAvailableSlots } from "@/services/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  appointments: Appointment[];
  therapists: Therapist[];
  services: Service[];
  schedule: DaySchedule[];
  onAppointmentUpdated: (apt: Appointment) => void;
}

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function timeToY(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;
}

function yToTime(y: number): string {
  const SNAP_MINUTES = 5;
  const totalMins = Math.round((y / HOUR_HEIGHT) * 60);
  const h = Math.floor(totalMins / 60) + START_HOUR;
  const m = totalMins % 60;

  const snappedMins = Math.round(m / SNAP_MINUTES) * SNAP_MINUTES;
  const finalH = snappedMins >= 60 ? h + 1 : h;
  const finalM = snappedMins >= 60 ? 0 : snappedMins;

  return `${String(finalH).padStart(2, "0")}:${String(finalM).padStart(2, "0")}`;
}

function parseDurationFromNotes(notes?: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/\[dur=(\d+)\]/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function aptHeight(apt: Appointment, services: Service[]): number {
  const svc = services.find((s) => s.id === apt.serviceId);
  const durationFromNotes = parseDurationFromNotes(apt.notes);
  const mins = durationFromNotes ?? svc?.duration ?? 30;
  return (mins / 60) * HOUR_HEIGHT;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 border-amber-400 text-amber-900",
  confirmed: "bg-primary/15 border-primary text-primary",
  completed: "bg-muted border-border text-muted-foreground",
  cancelled: "bg-red-50 border-red-300 text-red-700 opacity-60",
};

// ── Edit / Reschedule Popover ─────────────────────────────────────────────
function ReschedulePopover({
  apt, services, therapists, onClose, onSaved,
}: {
  apt: Appointment;
  services: Service[];
  therapists: Therapist[];
  onClose: () => void;
  onSaved: (updated: Appointment) => void;
}) {
  const [newDate, setNewDate] = useState(apt.date);
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  const svc = services.find((s) => s.id === apt.serviceId);
  const durationFromNotes = parseDurationFromNotes(apt.notes);

  const loadSlots = async (date: string) => {
    setNewDate(date);
    setLoadingSlots(true);
    const s = await getAvailableSlots(date, apt.serviceId, apt.therapistId);
    setSlots(s);
    setLoadingSlots(false);
  };

  const handleSave = async (time: string) => {
    setSaving(true);
    try {
      await rescheduleAppointment(apt.id, newDate, time);
      toast.success("התור הוזז ✓");
      onSaved({ ...apt, date: newDate, time });
      onClose();
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">הזזת תור</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-1 mb-4 text-sm">
          <p className="font-medium">{apt.clientName} · {apt.serviceName}</p>
          <p className="text-muted-foreground">כעת: {apt.date} ב-{apt.time}</p>
          {svc && <p className="text-xs text-muted-foreground">משך: {svc.duration} דק׳{svc.breakMinutes ? ` + ${svc.breakMinutes} הפסקה` : ""}</p>}
          {!svc && durationFromNotes && <p className="text-xs text-muted-foreground">משך: {durationFromNotes} דק׳</p>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">תאריך חדש</label>
            <input
              type="date"
              value={newDate}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => loadSlots(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>

          {loadingSlots && <div className="flex justify-center py-3"><div className="h-5 w-5 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}

          {slots.length > 0 && !loadingSlots && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">שעה חדשה</label>
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {slots.filter((s) => s.available || s.time === apt.time).map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={saving || (!s.available && s.time !== apt.time)}
                    onClick={() => handleSave(s.time)}
                    className={cn(
                      "rounded-md border py-1.5 text-xs font-medium transition-colors",
                      s.time === apt.time
                        ? "border-primary bg-primary/10 text-primary"
                        : s.available
                          ? "border-border hover:border-primary hover:bg-primary/5"
                          : "border-border opacity-30 cursor-not-allowed"
                    )}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function AdminDailyCalendar({ appointments, therapists, services, schedule, onAppointmentUpdated }: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("");
  const [editApt, setEditApt] = useState<Appointment | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragY, setDragY] = useState(0);
  const columnRef = useRef<HTMLDivElement>(null);

  // כש-therapists מגיעים (async) — בחר את הראשון
  useEffect(() => {
    if (therapists.length > 0 && !selectedTherapistId) {
      setSelectedTherapistId(therapists[0].id);
    }
  }, [therapists, selectedTherapistId]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // פילטר תורים:
  // - מציג תורים שה-therapistId שלהם תואם OR (מטפלת יחידה ואין therapistId בתור = תורים ישנים)
  const dayApts = appointments.filter((a) => {
    if (a.status === "cancelled") return false;
    if (a.date !== dateStr) return false;
    if (a.therapistId === selectedTherapistId) return true;
    // תורים ישנים ללא therapist — הצג אותם תחת המטפלת הנבחרת
    if (!a.therapistId && selectedTherapistId) return true;
    return false;
  });

  const activeTherapist = therapists.find((t) => t.id === selectedTherapistId);

  // שעות עבודה של היום
  const dow = selectedDate.getDay();
  const daySchedule = schedule.find((d) => d.dayOfWeek === dow);

  // ── Drag handlers ──
  const handleDragStart = (e: React.MouseEvent, apt: Appointment) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset(e.clientY - rect.top);
    setDraggingId(apt.id);
    setDragY(timeToY(apt.time));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !columnRef.current) return;
    const colRect = columnRef.current.getBoundingClientRect();
    const rawY = e.clientY - colRect.top - dragOffset;
    const clampedY = Math.max(0, Math.min(rawY, TOTAL_HOURS * HOUR_HEIGHT - 1));
    setDragY(clampedY);
  };

  const handleMouseUp = async () => {
    if (!draggingId) return;
    const apt = appointments.find((a) => a.id === draggingId);
    if (!apt) { setDraggingId(null); return; }

    const newTime = yToTime(dragY);
    if (newTime !== apt.time) {
      try {
        await rescheduleAppointment(apt.id, apt.date, newTime);
        onAppointmentUpdated({ ...apt, time: newTime });
        toast.success(`התור הוזז ל-${newTime}`);
      } catch {
        toast.error("שגיאה בהזזה");
      }
    }
    setDraggingId(null);
  };

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header — תאריך ממורכז + בחירת מטפלת */}
      <div className="flex flex-col items-center gap-3">

        {/* ניווט תאריך — ממורכז */}
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate((d) => subDays(d, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="text-center min-w-[180px]">
            <div className="font-bold text-lg">{format(selectedDate, "EEEE", { locale: he })}</div>
            <div className="text-sm text-muted-foreground">{format(selectedDate, "d MMMM yyyy", { locale: he })}</div>
          </div>
          <button onClick={() => setSelectedDate((d) => addDays(d, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* כפתור היום — ממורכז */}
        <button
          onClick={() => setSelectedDate(new Date())}
          className="text-xs text-primary border border-primary/30 rounded-full px-3 py-1 hover:bg-primary/5 transition-colors"
        >
          היום
        </button>

        {/* בחירת מטפלת */}
        <div className="w-full overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max mx-auto px-2 justify-center">
            {therapists.filter((t) => t.isActive).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTherapistId(t.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium border transition-colors whitespace-nowrap",
                  selectedTherapistId === t.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* יום חופש */}
      {daySchedule && !daySchedule.isWorkingDay && (
        <div className="rounded-lg border border-border bg-muted/50 p-6 text-center text-muted-foreground">
          יום חופש — {activeTherapist?.name} לא עובדת היום
        </div>
      )}

      {/* ציר זמן */}
      {(!daySchedule || daySchedule.isWorkingDay) && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div
            className="relative select-none"
            style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
            ref={columnRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* שעות — עמודת שמאל */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-0 w-12 border-b border-border/40 flex items-start justify-end pr-2 pt-1"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <span className="text-xs text-muted-foreground">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}

            {/* קווי שעות */}
            {hours.map((h) => (
              <div
                key={`line-${h}`}
                className="absolute right-12 left-0 border-t border-border/30"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}

            {/* שעות עבודה — הדגשה */}
            {daySchedule && (
              <div
                className="absolute right-12 left-0 bg-primary/5 pointer-events-none"
                style={{
                  top: timeToY(daySchedule.startTime),
                  height: timeToY(daySchedule.endTime) - timeToY(daySchedule.startTime),
                }}
              />
            )}

            {/* תורים */}
            {dayApts.map((apt) => {
              const isDragging = draggingId === apt.id;
              const topY = isDragging ? dragY : timeToY(apt.time);
              const h = aptHeight(apt, services);

              return (
                <div
                  key={apt.id}
                  className={cn(
                    "absolute right-14 left-2 rounded-md border-r-4 px-2 py-1 cursor-grab active:cursor-grabbing shadow-sm transition-shadow",
                    isDragging ? "shadow-lg ring-2 ring-primary z-20 opacity-90" : "z-10",
                    STATUS_COLORS[apt.status] ?? STATUS_COLORS.pending
                  )}
                  style={{ top: topY, height: Math.max(h, 28) }}
                  onMouseDown={(e) => handleDragStart(e, apt)}
                  onClick={(e) => { e.stopPropagation(); if (!isDragging) setEditApt(apt); }}
                >
                  <div className="text-xs font-semibold truncate leading-tight">{apt.clientName}</div>
                  <div className="text-xs opacity-75 truncate">{apt.serviceName} · {apt.time}</div>
                  {apt.clientPhone && (
                    <div className="text-xs opacity-60 truncate flex items-center gap-0.5 mt-0.5">
                      <User className="h-2.5 w-2.5" />{apt.clientPhone}
                    </div>
                  )}
                </div>
              );
            })}

            {dayApts.length === 0 && (
              <div className="absolute inset-0 right-12 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground pointer-events-none">
                <span>אין תורים ב-{dateStr}</span>
                {appointments.filter(a => a.date === dateStr).length > 0 && (
                  <span className="text-xs">({appointments.filter(a => a.date === dateStr).length} תורים ביום זה למטפלות אחרות)</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* תיאור */}
      <p className="text-xs text-muted-foreground">
        💡 גרור תור לשינוי שעה · לחץ על תור לעריכה מדויקת
      </p>

      {/* Popover עריכה */}
      <AnimatePresence>
        {editApt && (
          <ReschedulePopover
            apt={editApt}
            services={services}
            therapists={therapists}
            onClose={() => setEditApt(null)}
            onSaved={(updated) => {
              onAppointmentUpdated(updated);
              setEditApt(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

