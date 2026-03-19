export interface Assignment {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  subject: string;
  color: string;
  time: string; // "HH:MM"
}

export const STORAGE_KEY = "college-assignments";

export function loadAssignments(): Assignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Assignment[];
  } catch {
    return [];
  }
}

export function saveAssignments(assignments: Assignment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // silently fail
  }
}

export function getDayDiff(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const NOTIF_ENABLED_KEY = "college-notif-enabled";
export const NOTIF_DAYS_KEY = "college-notif-days";
export const NOTIF_LAST_CHECK_KEY = "college-notif-last-check";

export function loadNotifSettings(): { enabled: boolean; days: number } {
  if (typeof window === "undefined") return { enabled: true, days: 1 };
  try {
    const enabled = localStorage.getItem(NOTIF_ENABLED_KEY) !== "false";
    const raw = parseInt(localStorage.getItem(NOTIF_DAYS_KEY) || "1", 10);
    const days = [1, 3, 5, 7].includes(raw) ? raw : 1;
    return { enabled, days };
  } catch {
    return { enabled: true, days: 1 };
  }
}

export function saveNotifSettings(enabled: boolean, days: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIF_ENABLED_KEY, String(enabled));
    localStorage.setItem(NOTIF_DAYS_KEY, String(days));
  } catch {}
}
