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
