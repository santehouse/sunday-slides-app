"use client";

import { useRef, useState, useTransition } from "react";
import { DurationStepper } from "@/components/ui/DurationStepper";
import { StatCard } from "@/components/ui/StatCard";
import { updateHoldSecondsAction } from "./actions";

export function HoldSecondsCard({ sundayId, initialSeconds }: { sundayId: string; initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [, startTransition] = useTransition();
  // Tapping +/- quickly fires overlapping server actions; without a sequence guard a slow
  // earlier response would overwrite the newer value and silently drop clicks.
  const requestId = useRef(0);

  function handleChange(next: number) {
    const previous = seconds;
    const id = ++requestId.current;
    setSeconds(next); // optimistic
    startTransition(async () => {
      try {
        const confirmed = await updateHoldSecondsAction(sundayId, next);
        if (id === requestId.current) setSeconds(confirmed);
      } catch {
        if (id === requestId.current) setSeconds(previous);
      }
    });
  }

  return (
    <StatCard className="h-[108px]">
      <DurationStepper value={seconds} onChange={handleChange} size="lg" />
    </StatCard>
  );
}
