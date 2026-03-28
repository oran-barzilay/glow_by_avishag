/**
 * TimeSlotPicker Component
 * Displays available time slots for a selected date.
 * Slots are rendered as clickable buttons — available ones are selectable,
 * unavailable ones are greyed out.
 */

import { motion } from "framer-motion";
import { TimeSlot } from "@/services/types";
import { cn } from "@/lib/utils";

interface TimeSlotPickerProps {
  /** Array of time slots to display */
  slots: TimeSlot[];
  /** The currently selected time (or null if none selected) */
  selectedTime: string | null;
  /** Callback when a time slot is clicked */
  onSelect: (time: string) => void;
  /** Whether the slots are still loading */
  isLoading: boolean;
}

export function TimeSlotPicker({
  slots,
  selectedTime,
  onSelect,
  isLoading,
}: TimeSlotPickerProps) {
  // Show a loading skeleton while fetching slots
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  // If no slots are available for this date
  if (slots.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        אין משבצות פנויות בתאריך זה. נסו יום אחר.
      </p>
    );
  }

  /** Display time in 24-hour format (common in Hebrew locale). */
  const formatTime = (time: string): string => time;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot, index) => (
        <motion.button
          key={slot.time}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          onClick={() => slot.available && onSelect(slot.time)}
          disabled={!slot.available}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-all duration-200",
            // Available & not selected
            slot.available && slot.time !== selectedTime &&
              "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5 cursor-pointer",
            // Selected state
            slot.time === selectedTime &&
              "border-primary bg-primary text-primary-foreground shadow-soft",
            // Unavailable/disabled state
            !slot.available &&
              "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/50 line-through"
          )}
        >
          {formatTime(slot.time)}
        </motion.button>
      ))}
    </div>
  );
}
