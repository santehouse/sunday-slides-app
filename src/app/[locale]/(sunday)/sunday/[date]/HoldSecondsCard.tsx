"use client";

import { useState, useTransition } from "react";
import { DurationStepper } from "@/components/ui/DurationStepper";
import { StatCard } from "@/components/ui/StatCard";
import { updateHoldSecondsAction } from "./actions";

export function HoldSecondsCard({ sundayId, initialSeconds }: { sundayId: string; initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [, startTransition] = useTransition();

  function handleChange(next: number) {
    const previous = seconds;
    setSeconds(next); // optimistic
    startTransition(async () => {
      try {
        const confirmed = await updateHoldSecondsAction(sundayId, next);
        setSeconds(confirmed);
      } catch {
        setSeconds(previous);
      }
    });
  }

  return (
    <StatCard>
      <DurationStepper value={seconds} onChange={handleChange} size="lg" />
    </StatCard>
  );
}
