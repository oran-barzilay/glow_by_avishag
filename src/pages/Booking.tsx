/**
 * Booking Page
 * Multi-step booking flow: Select Service → Pick Date → Choose Time → Fill Contact Form
 * 
 * The page uses URL search params to pre-select a service if the user
 * clicked "Book Now" on a specific service card from the landing page.
 */

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, CalendarDays, Clock, User, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ServiceCard } from "@/components/ServiceCard";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { BookingForm } from "@/components/BookingForm";
import { getServices, getAvailableSlots, createBooking, getTherapists, getBlockedDates, getWeeklySchedule } from "@/services/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Service, TimeSlot, Therapist, BlockedDate, DaySchedule } from "@/services/types";
import { toast } from "sonner";

/**
 * Defines the steps in the booking process.
 * Each step has a label and an icon for the progress bar.
 */
const STEPS = [
  { label: "שירות", icon: Check },
  { label: "מטפלת", icon: UserCheck },
  { label: "תאריך", icon: CalendarDays },
  { label: "שעה", icon: Clock },
  { label: "פרטים", icon: User },
];

const Booking = () => {
  // Read URL search params to get pre-selected service
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ===== STATE MANAGEMENT =====
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);

  // הגבלת מספר ימים קדימה לפי הגדרת האדמין
  const maxAdvanceDays = parseInt(localStorage.getItem("maxAdvanceDays") ?? "30");

  // Normalize range so "today" stays selectable all day long
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const maxBookingDate = new Date(todayStart);
  maxBookingDate.setDate(maxBookingDate.getDate() + maxAdvanceDays);
  maxBookingDate.setHours(23, 59, 59, 999);

  // Load services, therapists and blocked dates on mount
  useEffect(() => {
    Promise.all([getServices(), getTherapists(), getBlockedDates(), getWeeklySchedule()]).then(([svcData, therapistData, blocked, weekly]) => {
      setServices(svcData);
      setTherapists(therapistData.filter((t) => t.isActive));
      setBlockedDates(blocked);
      setWeeklySchedule(weekly);
      // If a service was passed via URL, pre-select it and go to step 1
      const preSelected = searchParams.get("service");
      if (preSelected && svcData.find((s) => s.id === preSelected)) {
        setSelectedServiceId(preSelected);
        setCurrentStep(1);
      }
    });
  }, [searchParams]);

  // Sync blocked dates from DB so calendar always reflects latest admin changes
  useEffect(() => {
    let mounted = true;

    const refreshBlockedDates = async () => {
      const data = await getBlockedDates();
      if (mounted) setBlockedDates(data);
    };

    const interval = setInterval(refreshBlockedDates, 30_000);

    if (!isSupabaseConfigured) {
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }

    const channel = supabase
      .channel("blocked-dates-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocked_dates" },
        () => {
          refreshBlockedDates();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // If selected date becomes fully blocked, clear the selection immediately
  useEffect(() => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const isFullyBlocked = blockedDates.some((b) => b.date === dateStr && b.blockedHours === null);
    if (!isFullyBlocked) return;

    setSelectedDate(undefined);
    setSelectedTime(null);
    if (currentStep > 2) setCurrentStep(2);
    toast.info("התאריך שנבחר נחסם ואינו זמין יותר");
  }, [blockedDates, selectedDate, currentStep]);

  // When date, therapist or refreshKey changes, refetch slots
  useEffect(() => {
    if (selectedDate && selectedServiceId && selectedTherapistId) {
      setLoadingSlots(true);
      setSelectedTime(null);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      getAvailableSlots(dateStr, selectedServiceId, selectedTherapistId).then((slots) => {
        setTimeSlots(slots);
        setLoadingSlots(false);
      });
    }
  }, [selectedDate, selectedServiceId, selectedTherapistId, slotsRefreshKey]);

  // רענון אוטומטי מהיר בזמן בחירת שעה + realtime אם Supabase פעיל
  useEffect(() => {
    if (!selectedDate || !selectedServiceId || !selectedTherapistId) return;

    // Poll fallback כל 15 שניות
    const interval = setInterval(() => {
      setSlotsRefreshKey((k) => k + 1);
    }, 15_000);

    if (!isSupabaseConfigured) {
      return () => clearInterval(interval);
    }

    // Realtime: כל שינוי בטבלת appointments ביום/מטפלת הנבחרים מרענן סלוטים
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const channel = supabase
      .channel(`slots-${dateStr}-${selectedTherapistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `date=eq.${dateStr}`,
        },
        () => {
          setSlotsRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedServiceId, selectedTherapistId]);

  // Get the currently selected service and therapist objects for display
  const selectedService = services.find((s) => s.id === selectedServiceId);
  const selectedTherapist = therapists.find((t) => t.id === selectedTherapistId);

  // מטפלות שמסוגלות לטפל בשירות הנבחר
  const eligibleTherapists = therapists.filter(
    (t) => !selectedServiceId || t.serviceIds.includes(selectedServiceId)
  );

  /**
   * Handles selecting a service — sets the service and advances to step 1
   */
  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setSelectedTherapistId(null);
    setSelectedDate(undefined);
    setSelectedTime(null);
    setCurrentStep(1);
  };

  /**
   * Handles selecting a therapist — sets the therapist and advances to step 2
   */
  const handleSelectTherapist = (therapistId: string) => {
    setSelectedTherapistId(therapistId);
    setCurrentStep(2);
  };

  /**
   * Handles selecting a date — advances to step 3 (time selection)
   */
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) setCurrentStep(3);
  };

  /**
   * Handles selecting a time slot — advances to step 4 (contact form)
   */
  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep(4);
  };

  /**
   * Handles the final form submission — creates the booking
   */
  const handleFormSubmit = async (data: { clientName: string; clientPhone: string; notes?: string }) => {
    if (!selectedServiceId || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    try {
      await createBooking({
        serviceId: selectedServiceId,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedTime,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        notes: data.notes || "",
        therapistId: selectedTherapistId,
      });

      setBookingComplete(true);
      toast.success("הבקשה התקבלה — ממתינה לאישור מהסטודיו 💅");
    } catch {
      toast.error("משהו השתבש. נסו שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Navigate back one step in the booking flow
   */
  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // ===== SUCCESS SCREEN =====
  if (bookingComplete) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">הבקשה נשלחה בהצלחה</h2>
          <p className="mb-2 text-muted-foreground">
            {selectedService?.name}
            {selectedTherapist && ` · ${selectedTherapist.name}`}
            {" · "}{selectedDate && format(selectedDate, "EEEE, d MMMM yyyy", { locale: he })} בשעה {selectedTime}
          </p>
          <p className="mb-8 text-sm text-muted-foreground">נעדכן אתכם לאחר אישור התור. תודה על הסבלנות!</p>
          <Button variant="hero" onClick={() => navigate("/")}>חזרה לדף הבית</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] py-8">
      <div className="container mx-auto max-w-3xl px-4">
        {/* Page heading */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold">הזמינו תור</h1>
          <p className="text-muted-foreground">עקבו אחרי השלבים להשלמת ההזמנה</p>
        </div>

        {/* ===== STEP PROGRESS BAR ===== */}
        <div className="mb-10 flex items-center justify-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <button
                onClick={() => { if (i < currentStep) setCurrentStep(i); }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all",
                  i < currentStep && "bg-primary text-primary-foreground cursor-pointer",
                  i === currentStep && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  i > currentStep && "bg-muted text-muted-foreground"
                )}
              >
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              {/* Connector line between steps */}
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 w-6 sm:w-10 transition-colors", i < currentStep ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        {/* Back button (visible after step 0) */}
        {currentStep > 0 && (
          <Button variant="ghost" size="sm" onClick={goBack} className="mb-4 gap-1">
            <ArrowRight className="h-4 w-4" />חזרה
          </Button>
        )}

        {/* ===== STEP CONTENT ===== */}
        <AnimatePresence mode="wait">
          {/* STEP 0: Select a service */}
          {currentStep === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="mb-4 text-xl font-semibold">בחרו שירות</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                {services.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onBook={handleSelectService}
                    index={index}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 1: Select a therapist */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="mb-1 text-xl font-semibold">בחרו מטפלת</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                תור ל: {selectedService?.name}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">

                {eligibleTherapists.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTherapist(t.id)}
                    className={cn(
                      "rounded-lg border-2 p-4 text-start transition-all hover:border-primary",
                      selectedTherapistId === t.id ? "border-primary bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t.serviceIds.length} שירותים
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Pick a date */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="mb-1 text-xl font-semibold">בחרו תאריך</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {selectedService?.name}{selectedTherapist ? ` · ${selectedTherapist.name}` : ""}
              </p>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    if (date < todayStart || date > maxBookingDate) return true;

                    // ימים לא פעילים לפי שעות העבודה השגרתיות
                    const day = weeklySchedule.find((d) => d.dayOfWeek === date.getDay());
                    if (day && !day.isWorkingDay) return true;

                    const dateStr = format(date, "yyyy-MM-dd");
                    return blockedDates.some((b) => b.date === dateStr && b.blockedHours === null);
                  }}
                  modifiers={{
                    blocked: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      return blockedDates.some((b) => b.date === dateStr && b.blockedHours === null);
                    },
                    closed: (date) => {
                      const day = weeklySchedule.find((d) => d.dayOfWeek === date.getDay());
                      return !!day && !day.isWorkingDay;
                    },
                  }}
                  modifiersClassNames={{
                    blocked: "bg-zinc-300/70 text-zinc-500 line-through opacity-70",
                    closed: "bg-zinc-400/80 text-zinc-600 opacity-80",
                  }}
                  locale={he}
                  className="rounded-lg border border-border bg-card p-3 shadow-card pointer-events-auto"
                />
              </div>
              {(blockedDates.some((b) => b.blockedHours === null) || weeklySchedule.some((d) => !d.isWorkingDay)) && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  ימים מעומעמים אינם זמינים להזמנה
                </p>
              )}
            </motion.div>
          )}

          {/* STEP 3: Select a time slot */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="mb-1 text-xl font-semibold">בחרו שעה</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedService?.name}
                    {selectedService && ` (${selectedService.duration} דק')`}
                    {selectedTherapist ? ` · ${selectedTherapist.name}` : ""}
                    {" — "}{selectedDate && format(selectedDate, "EEEE, d MMMM yyyy", { locale: he })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSlotsRefreshKey((k) => k + 1)}
                  disabled={loadingSlots}
                  className="shrink-0 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1 transition-colors"
                  title="רענן שעות פנויות"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={cn("h-4 w-4", loadingSlots && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  רענן
                </button>
              </div>
              <TimeSlotPicker slots={timeSlots} selectedTime={selectedTime} onSelect={handleTimeSelect} isLoading={loadingSlots} />
            </motion.div>
          )}

          {/* STEP 4: Contact form */}
          {currentStep === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="mx-auto max-w-md"
            >
              <h2 className="mb-1 text-xl font-semibold">הפרטים שלכם</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {selectedService?.name}
                {selectedTherapist ? ` · ${selectedTherapist.name}` : ""}
                {" — "}{selectedDate && format(selectedDate, "EEE, d MMM", { locale: he })} בשעה {selectedTime}
              </p>
              <div className="rounded-lg border border-border bg-card p-6 shadow-card">
                <BookingForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Booking;
