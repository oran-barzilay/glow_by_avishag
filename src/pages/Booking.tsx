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
import { getServices, getAvailableSlots, createBooking, getTherapists } from "@/services/api";
import { Service, TimeSlot, Therapist } from "@/services/types";
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
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);

  // הגבלת מספר ימים קדימה לפי הגדרת האדמין
  const maxAdvanceDays = parseInt(localStorage.getItem("maxAdvanceDays") ?? "30");
  const maxBookingDate = new Date();
  maxBookingDate.setDate(maxBookingDate.getDate() + maxAdvanceDays);

  // Load services and therapists on mount
  useEffect(() => {
    Promise.all([getServices(), getTherapists()]).then(([svcData, therapistData]) => {
      setServices(svcData);
      setTherapists(therapistData.filter((t) => t.isActive));
      // If a service was passed via URL, pre-select it and go to step 1
      const preSelected = searchParams.get("service");
      if (preSelected && svcData.find((s) => s.id === preSelected)) {
        setSelectedServiceId(preSelected);
        setCurrentStep(1);
      }
    });
  }, [searchParams]);

  // When date or therapist changes, refetch slots
  useEffect(() => {
    if (selectedDate && selectedServiceId) {
      setLoadingSlots(true);
      setSelectedTime(null); // Reset time when date changes
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      getAvailableSlots(dateStr, selectedServiceId, selectedTherapistId).then((slots) => {
        setTimeSlots(slots);
        setLoadingSlots(false);
      });
    }
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
  const handleSelectTherapist = (therapistId: string | null) => {
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                {/* אפשרות "לא משנה" */}
                <button
                  type="button"
                  onClick={() => handleSelectTherapist(null)}
                  className={cn(
                    "rounded-lg border-2 p-4 text-start transition-all hover:border-primary",
                    selectedTherapistId === null ? "border-primary bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className="font-semibold">לא משנה</div>
                  <div className="text-sm text-muted-foreground mt-1">הראשונה הפנויה</div>
                </button>

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
                  disabled={(date) => date < new Date() || date > maxBookingDate}
                  locale={he}
                  className="rounded-lg border border-border bg-card p-3 shadow-card pointer-events-auto"
                />
              </div>
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
              <h2 className="mb-1 text-xl font-semibold">בחרו שעה</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {selectedService?.name}
                {selectedService && ` (${selectedService.duration} דק')`}
                {selectedTherapist ? ` · ${selectedTherapist.name}` : ""}
                {" — "}{selectedDate && format(selectedDate, "EEEE, d MMMM yyyy", { locale: he })}
              </p>
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
