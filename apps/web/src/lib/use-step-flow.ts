"use client";

import { useCallback, useState } from "react";

/**
 * Generic multi-step workflow state: current step, step validation, completion and restart.
 * Business rules stay outside — the caller passes `validate(step)` returning error ids (empty =
 * valid) and receives lifecycle callbacks (used for analytics).
 */
export function useStepFlow({
  steps,
  validate,
  onStart,
  onStepComplete,
  onComplete,
  initialComplete = false,
}: {
  steps: number;
  validate: (step: number) => string[];
  onStart?: () => void;
  onStepComplete?: (step: number) => void;
  onComplete?: () => void;
  initialComplete?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [complete, setComplete] = useState(initialComplete);
  const [started, setStarted] = useState(initialComplete);

  /** Marks the flow as started (first interaction). */
  const touch = useCallback(() => {
    if (started) return;
    setStarted(true);
    onStart?.();
  }, [started, onStart]);

  /** Validates the current step; advances or completes when valid. Returns whether it moved on. */
  const next = useCallback(() => {
    const stepErrors = validate(step);
    setErrors(stepErrors);
    if (stepErrors.length > 0) return false;
    touch();
    onStepComplete?.(step);
    if (step === steps - 1) {
      setComplete(true);
      onComplete?.();
    } else {
      setStep(step + 1);
    }
    return true;
  }, [validate, step, steps, touch, onStepComplete, onComplete]);

  const back = useCallback(() => {
    setErrors([]);
    setStep((current) => Math.max(0, current - 1));
  }, []);

  const restart = useCallback(() => {
    setErrors([]);
    setComplete(false);
    setStep(0);
  }, []);

  /** Clears the error of one field once it is answered. */
  const clearError = useCallback((id: string) => setErrors((current) => current.filter((e) => e !== id)), []);

  return { step, errors, complete, started, next, back, restart, touch, clearError, isFirst: step === 0, isLast: step === steps - 1 };
}
