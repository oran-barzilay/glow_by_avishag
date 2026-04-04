/**
 * BookingForm Component
 * Contact form that collects the client's name, phone, and optional notes
 * before confirming the booking. Uses react-hook-form for form state management
 * and zod for validation.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TermsLink } from "@/components/TermsLink";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * Zod schema for validating the booking form.
 * - clientName: required, at least 2 characters
 * - clientPhone: required, basic phone format check
 * - notes: optional
 */
const bookingSchema = z.object({
  clientName: z.string().min(2, "יש להזין לפחות 2 תווים"),
  clientPhone: z.string().min(7, "נא להזין מספר טלפון תקין"),
  notes: z.string().optional(),
});

// TypeScript type inferred from the zod schema
type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  /** Callback when the form is submitted with valid data */
  onSubmit: (data: BookingFormValues & { termsAcceptedAt: string; termsAcceptedIp: string }) => void;
  /** Whether the form is in a loading/submitting state */
  isSubmitting: boolean;
  /** Prefilled phone from phone-identification step */
  initialPhone?: string;
  /** Prefilled client name if recognized */
  initialName?: string;
}

export function BookingForm({
  onSubmit,
  isSubmitting,
  initialPhone,
  initialName,
}: BookingFormProps) {
  // Initialize react-hook-form with zod validation
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      clientName: initialName ?? "",
      clientPhone: initialPhone ?? "",
      notes: "",
    },
  });

  useEffect(() => {
    form.setValue("clientPhone", initialPhone ?? "", { shouldValidate: true });
    if (initialName) {
      form.setValue("clientName", initialName, { shouldValidate: true });
    }
  }, [initialPhone, initialName, form]);

  const handleSubmit = async (data: BookingFormValues) => {
    // לכוד timestamp מדויק ברגע האישור
    const termsAcceptedAt = new Date().toISOString();

    // ניסיון לקבל IP ציבורי דרך שירות חיצוני (fallback: "unknown")
    let termsAcceptedIp = "unknown";
    try {
      const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
      const json = await res.json();
      termsAcceptedIp = json.ip ?? "unknown";
    } catch {
      // ממשיכים עם "unknown" אם הבקשה נכשלת
    }

    onSubmit({ ...data, termsAcceptedAt, termsAcceptedIp });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Client Name Field */}
        <FormField
          control={form.control}
          name="clientName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>שם מלא</FormLabel>
              <FormControl>
                <Input placeholder="לדוגמה: יעל כהן" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Phone Number Field */}
        <FormField
          control={form.control}
          name="clientPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>טלפון</FormLabel>
              <FormControl>
                <Input placeholder="לדוגמה: 050-1234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Optional Notes Field */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>הערות (אופציונלי)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="בקשות מיוחדות או העדפות..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <Button
          type="submit"
          variant="hero"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "שולחים..." : "אישור הזמנה"}
        </Button>

        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">
            <TermsLink text="באישור התור אני מסכים/ה לתקנון ולמדיניות הביטולים." />
          </p>
          <p className="mt-1 font-bold">
            ביטול פחות מ-24 שעות לפני מועד התור גורר תשלום מלא.
          </p>
        </div>
      </form>
    </Form>
  );
}
