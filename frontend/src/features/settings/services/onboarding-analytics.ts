/**
 * Onboarding Analytics
 *
 * Tracks setup step completion and user actions during onboarding.
 * Stored in localStorage for now — can be sent to analytics backend later.
 */

interface OnboardingEvent {
  step: string;
  action: "started" | "completed" | "skipped" | "errored";
  timestamp: string;
  duration?: number; // ms spent on this step
}

const STORAGE_KEY = "ftm-onboarding-analytics";

function getEvents(): OnboardingEvent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as OnboardingEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvent(event: OnboardingEvent): void {
  const events = getEvents();
  events.push(event);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/** Track when a setup step is started */
export function trackStepStarted(step: string): void {
  saveEvent({ step, action: "started", timestamp: new Date().toISOString() });
}

/** Track when a setup step is completed */
export function trackStepCompleted(step: string, durationMs?: number): void {
  saveEvent({
    step,
    action: "completed",
    timestamp: new Date().toISOString(),
    duration: durationMs,
  });
}
