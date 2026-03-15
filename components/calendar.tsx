"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  type Assignment,
  loadAssignments,
  saveAssignments,
  getDayDiff,
  formatYMD,
} from "@/lib/assignments";

declare global {
  interface Window {
    electronAPI?: {
      openEditor: () => void;
      closeEditor: () => void;
      notifyAssignmentsChanged: () => void;
      onAssignmentsChanged: (callback: () => void) => void;
    };
  }
}

const PRESET_COLORS = ["#ff3c00", "#4a9eff", "#7fff4a", "#ff4af5", "#ffe74a"];

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const WIDGET_DAYS_KEY = "college-widget-days";
type WidgetDays = 7 | 14 | 30;
const DAY_OPTIONS: WidgetDays[] = [7, 14, 30];

function loadWidgetDays(): WidgetDays {
  if (typeof window === "undefined") return 7;
  try {
    const val = parseInt(localStorage.getItem(WIDGET_DAYS_KEY) || "7", 10);
    return ([7, 14, 30] as number[]).includes(val) ? (val as WidgetDays) : 7;
  } catch {
    return 7;
  }
}

function saveWidgetDays(days: WidgetDays): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WIDGET_DAYS_KEY, String(days));
  } catch {}
}

const CalendarComponent: React.FC = () => {
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [isOverlayClosing, setIsOverlayClosing] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [widgetDays, setWidgetDays] = useState<WidgetDays>(7);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTime, setFormTime] = useState("23:59");
  const [formColor, setFormColor] = useState("#ff3c00");
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI);
    setAssignments(loadAssignments());
    setWidgetDays(loadWidgetDays());
  }, []);

  // Listen for assignment changes from widget
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI?.onAssignmentsChanged(() => {
      setAssignments(loadAssignments());
    });
  }, [isElectron]);

  // Close day picker on outside click
  useEffect(() => {
    if (!dayPickerOpen) return;
    const close = () => setDayPickerOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [dayPickerOpen]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build 42-cell grid. Week starts Monday.
  const buildGrid = useCallback(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDow = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells: { dateStr: string; day: number; isCurrentMonth: boolean }[] = [];

    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const d = new Date(currentYear, currentMonth - 1, day);
      cells.push({
        dateStr: formatYMD(d.getFullYear(), d.getMonth(), day),
        day,
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: formatYMD(currentYear, currentMonth, d),
        day: d,
        isCurrentMonth: true,
      });
    }

    let nextDay = 1;
    while (cells.length < 42) {
      const d = new Date(currentYear, currentMonth + 1, nextDay);
      cells.push({
        dateStr: formatYMD(d.getFullYear(), d.getMonth(), nextDay),
        day: nextDay,
        isCurrentMonth: false,
      });
      nextDay++;
    }

    return cells;
  }, [currentYear, currentMonth]);

  const cells = buildGrid();

  const openOverlay = (dateStr: string) => {
    setSelectedDate(dateStr);
    setFormName("");
    setFormSubject("");
    setFormTime("23:59");
    setFormColor("#ff3c00");
    setTimePickerOpen(false);
    setOverlayOpen(true);
  };

  const closeOverlay = () => {
    setTimePickerOpen(false);
    setIsOverlayClosing(true);
    setTimeout(() => {
      setIsOverlayClosing(false);
      setOverlayOpen(false);
      setSelectedDate(null);
    }, 260);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (overlayOpen) {
          closeOverlay();
        } else if (isElectron) {
          window.electronAPI?.closeEditor();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlayOpen, isElectron]);

  const handleSave = () => {
    if (!selectedDate || !formName.trim()) return;
    const newAssignment: Assignment = {
      id: `${Date.now()}-${Math.random()}`,
      date: selectedDate,
      name: formName.trim(),
      subject: formSubject.trim(),
      color: formColor,
      time: formTime,
    };
    const updated = [...assignments, newAssignment];
    setAssignments(updated);
    saveAssignments(updated);
    window.electronAPI?.notifyAssignmentsChanged();
    closeOverlay();
  };

  const handleDeleteAssignment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = assignments.filter((a) => a.id !== id);
    setAssignments(updated);
    saveAssignments(updated);
    window.electronAPI?.notifyAssignmentsChanged();
  };

  const todayStr = formatYMD(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&display=swap');

        html, body {
          height: 100%;
          width: 100%;
          overflow: hidden;
          overscroll-behavior: none;
          margin: 0;
          padding: 0;
          background: #000;
        }

        .cal-root {
          background-color: #000;
          color: #e0e0e0;
          height: 100dvh;
          width: 100vw;
          display: flex;
          align-items: stretch;
          justify-content: center;
          padding: 2rem 2.25rem;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .cal-container {
          position: relative;
          z-index: 2;
          width: min(100%, 1200px);
          height: 100%;
          padding: 0;
          box-sizing: border-box;
          display: flex;
          background: #000;
          border: 1px solid rgba(224, 224, 224, 0.08);
          border-radius: 40px;
          box-shadow: 0 24px 72px rgba(0, 0, 0, 0.38);
          overflow: hidden;
        }

        .cal-wrapper {
          width: 100%;
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          row-gap: 0.35rem;
          padding: 1.1rem 1.2rem 1.2rem;
          box-sizing: border-box;
        }

        /* Header */
        .cal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid rgba(224, 224, 224, 0.1);
          -webkit-app-region: drag;
        }

        .cal-header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          -webkit-app-region: no-drag;
        }

        .cal-close-btn {
          background: none;
          border: 1px solid rgba(224, 224, 224, 0.15);
          border-radius: 4px;
          color: rgba(224, 224, 224, 0.4);
          font-family: monospace;
          font-size: 0.7rem;
          cursor: pointer;
          width: 24px;
          height: 24px;
          padding: 0;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
        }

        .cal-close-btn:hover {
          color: #ff3c00;
          border-color: rgba(255, 60, 0, 0.4);
          background: rgba(255, 60, 0, 0.06);
        }

        .cal-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
          -webkit-app-region: no-drag;
        }

        .cal-month-title {
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: clamp(1.2rem, 3vw, 1.8rem);
          letter-spacing: 0.08em;
          color: #e0e0e0;
        }

        .cal-year {
          font-family: monospace;
          font-size: 0.85rem;
          color: rgba(224, 224, 224, 0.4);
          letter-spacing: 0.1em;
          margin-left: 0.5rem;
        }

        .cal-nav-btn {
          background: none;
          border: 1px solid rgba(224, 224, 224, 0.15);
          color: #e0e0e0;
          font-family: monospace;
          font-size: 1rem;
          cursor: pointer;
          padding: 0.3rem 0.7rem;
          transition: border-color 0.2s, color 0.2s;
          line-height: 1;
        }

        .cal-nav-btn:hover {
          border-color: rgba(224, 224, 224, 0.4);
          color: #ff3c00;
        }

        /* Day range picker button */
        .cal-days-btn-wrap {
          position: relative;
          -webkit-app-region: no-drag;
        }

        .cal-days-btn {
          background: #e0e0e0;
          color: #0a0a0a;
          border: none;
          padding: 0.55rem 1.1rem;
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          clip-path: polygon(0 0, 100% 0, 100% 70%, 85% 100%, 0 100%);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }

        .cal-days-btn:hover,
        .cal-days-btn.open {
          background: #ff3c00;
          color: #0a0a0a;
          transform: translateY(-2px);
        }

        .cal-days-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          background: #111;
          border: 1px solid rgba(224, 224, 224, 0.12);
          border-radius: 12px;
          padding: 0.4rem;
          z-index: 60;
          display: flex;
          flex-direction: column;
          gap: 2px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
          animation: daysFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          min-width: 90px;
        }

        @keyframes daysFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cal-days-option {
          background: transparent;
          border: none;
          color: rgba(224, 224, 224, 0.45);
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: 0.58rem;
          letter-spacing: 0.1em;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          text-align: left;
          width: 100%;
        }

        .cal-days-option:hover {
          background: rgba(224, 224, 224, 0.06);
          color: #e0e0e0;
        }

        .cal-days-option.selected {
          background: rgba(255, 60, 0, 0.12);
          color: #ff3c00;
        }

        /* Day labels row */
        .cal-day-labels {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          margin-bottom: 0;
        }

        .cal-day-label {
          font-family: monospace;
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          color: rgba(224, 224, 224, 0.35);
          text-align: center;
          padding: 0.4rem 0;
          border-bottom: 1px solid rgba(224, 224, 224, 0.08);
        }

        /* Grid */
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          grid-template-rows: repeat(6, minmax(0, 1fr));
          border-left: 1px solid rgba(224, 224, 224, 0.1);
          border-top: 1px solid rgba(224, 224, 224, 0.1);
          min-height: 0;
        }

        .cal-cell {
          position: relative;
          border-right: 1px solid rgba(224, 224, 224, 0.1);
          border-bottom: 1px solid rgba(224, 224, 224, 0.1);
          min-height: 0;
          padding: 0.5rem 0.4rem 0.35rem;
          box-sizing: border-box;
          transition: background 0.15s;
          overflow: hidden;
          cursor: pointer;
        }

        .cal-cell:hover {
          background: rgba(224, 224, 224, 0.04);
        }

        .cal-cell.is-today {
          background: rgba(224, 224, 224, 0.12);
        }

        .cal-cell.other-month {
          opacity: 0.3;
        }

        .cal-date-num {
          position: absolute;
          top: 0.35rem;
          right: 0.45rem;
          font-family: monospace;
          font-size: 0.85rem;
          line-height: 1;
          color: #e0e0e0;
        }

        .cal-date-num.urgent {
          color: #ff3c00;
        }

        .cal-dday-label {
          position: absolute;
          top: 0.35rem;
          left: 0.4rem;
          font-family: monospace;
          font-size: 0.6rem;
          letter-spacing: 0.08em;
          color: #ff3c00;
          line-height: 1;
        }

        .cal-assignments {
          position: absolute;
          bottom: 0.3rem;
          left: 0.35rem;
          right: 0.35rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .cal-assignment-item {
          display: flex;
          align-items: center;
          gap: 4px;
          max-width: 100%;
        }

        .cal-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .cal-assignment-name {
          font-family: monospace;
          font-size: 0.55rem;
          letter-spacing: 0.04em;
          color: rgba(224, 224, 224, 0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .cal-delete-btn {
          background: none;
          border: 1px solid rgba(224, 224, 224, 0.12);
          border-radius: 3px;
          color: rgba(224, 224, 224, 0.3);
          font-size: 0.55rem;
          cursor: pointer;
          padding: 0;
          width: 14px;
          height: 14px;
          line-height: 1;
          flex-shrink: 0;
          font-family: monospace;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cal-delete-btn:hover {
          color: #ff3c00;
          border-color: rgba(255, 60, 0, 0.4);
          background: rgba(255, 60, 0, 0.06);
        }

        /* Overlay */
        .cal-overlay-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 50;
        }

        .cal-overlay-panel {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: min(420px, 100vw);
          background: #0f0f0f;
          border-left: 1px solid rgba(224, 224, 224, 0.15);
          z-index: 51;
          display: flex;
          flex-direction: column;
          padding: 2.5rem 2rem;
          box-sizing: border-box;
          animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          overflow-y: auto;
        }

        .cal-overlay-panel.closing {
          animation: slideOutRight 0.26s cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        @keyframes slideOutRight {
          from { transform: translateX(0);    opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }

        .overlay-title {
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          color: #e0e0e0;
          margin-bottom: 0.35rem;
        }

        .overlay-date-label {
          font-family: monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          color: #ff3c00;
          margin-bottom: 2rem;
        }

        .overlay-field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-bottom: 1.4rem;
        }

        .overlay-label {
          font-family: monospace;
          font-size: 0.6rem;
          letter-spacing: 0.14em;
          color: rgba(224, 224, 224, 0.4);
          text-transform: uppercase;
        }

        .overlay-input {
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(224, 224, 224, 0.15);
          color: #e0e0e0;
          font-family: monospace;
          font-size: 0.85rem;
          padding: 0.4rem 0;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .overlay-input:focus {
          border-bottom-color: rgba(224, 224, 224, 0.5);
        }

        .overlay-input::placeholder {
          color: rgba(224, 224, 224, 0.2);
        }

        /* Color picker row */
        .color-palette {
          display: flex;
          gap: 0.6rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .color-swatch {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid transparent;
          transition: transform 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }

        .color-swatch:hover {
          transform: scale(1.15);
        }

        .color-swatch.selected {
          border-color: #e0e0e0;
        }

        .color-custom-input {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid rgba(224, 224, 224, 0.2);
          cursor: pointer;
          padding: 0;
          background: none;
          overflow: hidden;
          flex-shrink: 0;
        }

        /* Overlay actions */
        .overlay-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: auto;
          padding-top: 1.5rem;
        }

        .overlay-save-btn {
          background: #e0e0e0;
          color: #0a0a0a;
          border: none;
          padding: 0.7rem 1.4rem;
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          clip-path: polygon(0 0, 100% 0, 100% 70%, 85% 100%, 0 100%);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }

        .overlay-save-btn:hover {
          background: #ff3c00;
          transform: translateY(-2px);
        }

        .overlay-cancel-btn {
          background: transparent;
          color: rgba(224, 224, 224, 0.4);
          border: 1px solid rgba(224, 224, 224, 0.12);
          padding: 0.7rem 1.2rem;
          font-family: monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }

        .overlay-cancel-btn:hover {
          color: #e0e0e0;
          border-color: rgba(224, 224, 224, 0.3);
        }

        /* Existing assignments in overlay */
        .overlay-existing {
          margin-bottom: 1.5rem;
        }

        .overlay-existing-title {
          font-family: monospace;
          font-size: 0.6rem;
          letter-spacing: 0.14em;
          color: rgba(224, 224, 224, 0.35);
          margin-bottom: 0.6rem;
          text-transform: uppercase;
        }

        .overlay-existing-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0;
          border-bottom: 1px solid rgba(224, 224, 224, 0.06);
        }

        .overlay-existing-name {
          font-family: monospace;
          font-size: 0.7rem;
          color: rgba(224, 224, 224, 0.65);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .overlay-existing-time {
          font-family: monospace;
          font-size: 0.6rem;
          color: rgba(224, 224, 224, 0.3);
          flex-shrink: 0;
          line-height: 1;
        }

        .overlay-existing-del {
          background: none;
          border: 1px solid rgba(224, 224, 224, 0.12);
          border-radius: 4px;
          color: rgba(224, 224, 224, 0.25);
          font-family: monospace;
          font-size: 0.55rem;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .overlay-existing-del:hover {
          color: #ff3c00;
          border-color: rgba(255, 60, 0, 0.4);
          background: rgba(255, 60, 0, 0.06);
        }

        .overlay-divider {
          border: none;
          border-top: 1px solid rgba(224, 224, 224, 0.08);
          margin: 1.5rem 0;
        }

        .time-picker-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(224, 224, 224, 0.15);
          padding-bottom: 0.4rem;
          transition: border-color 0.2s;
          position: relative;
        }

        .time-display {
          font-family: monospace;
          font-size: 0.85rem;
          color: #e0e0e0;
          padding: 0.4rem 0;
          flex: 1;
          letter-spacing: 0.04em;
        }

        .time-display .time-period {
          font-size: 0.65rem;
          color: rgba(224, 224, 224, 0.45);
          margin-left: 0.35rem;
          letter-spacing: 0.08em;
        }

        .time-clock-btn {
          background: none;
          border: 1px solid rgba(224, 224, 224, 0.12);
          border-radius: 6px;
          color: rgba(224, 224, 224, 0.4);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
          flex-shrink: 0;
          padding: 0;
        }

        .time-clock-btn:hover,
        .time-clock-btn.active {
          color: #ff3c00;
          border-color: rgba(255, 60, 0, 0.4);
          background: rgba(255, 60, 0, 0.06);
        }

        .time-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #151515;
          border: 1px solid rgba(224, 224, 224, 0.12);
          border-radius: 12px;
          padding: 0.75rem;
          z-index: 60;
          display: flex;
          gap: 0.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          animation: timeFadeIn 0.18s ease;
        }

        @keyframes timeFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .time-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .time-col-label {
          font-family: monospace;
          font-size: 0.45rem;
          letter-spacing: 0.16em;
          color: rgba(224, 224, 224, 0.3);
          text-align: center;
          padding-bottom: 0.3rem;
          text-transform: uppercase;
        }

        .time-col-scroll {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 160px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(224, 224, 224, 0.08) transparent;
        }

        .time-col-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .time-col-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .time-col-scroll::-webkit-scrollbar-thumb {
          background: rgba(224, 224, 224, 0.08);
          border-radius: 2px;
        }

        .time-option {
          background: transparent;
          border: none;
          color: rgba(224, 224, 224, 0.5);
          font-family: monospace;
          font-size: 0.75rem;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          text-align: center;
          white-space: nowrap;
        }

        .time-option:hover {
          background: rgba(224, 224, 224, 0.06);
          color: #e0e0e0;
        }

        .time-option.selected {
          background: rgba(255, 60, 0, 0.12);
          color: #ff3c00;
        }

        .overlay-add-title {
          font-family: monospace;
          font-size: 0.6rem;
          letter-spacing: 0.14em;
          color: rgba(224, 224, 224, 0.35);
          margin-bottom: 1rem;
          text-transform: uppercase;
        }

        @media (max-height: 860px) {
          .cal-root {
            padding: 1.35rem 1.5rem;
          }

          .cal-container {
            border-radius: 32px;
          }

          .cal-wrapper {
            padding: 0.9rem 1rem 1rem;
          }

          .cal-header {
            padding-bottom: 0.75rem;
          }

          .cal-month-title {
            font-size: clamp(1rem, 2.3vw, 1.5rem);
          }

          .cal-year {
            font-size: 0.75rem;
          }

          .cal-day-label {
            padding: 0.25rem 0;
          }

          .cal-cell {
            padding: 0.4rem 0.3rem 0.25rem;
          }

          .cal-date-num {
            top: 0.3rem;
            right: 0.35rem;
            font-size: 0.75rem;
          }

          .cal-dday-label {
            top: 0.3rem;
            left: 0.3rem;
            font-size: 0.52rem;
          }

          .cal-assignment-name {
            font-size: 0.5rem;
          }
        }

        @media (max-width: 920px) {
          .cal-header {
            flex-wrap: wrap;
            align-items: flex-start;
          }

          .cal-header-right {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>

      <div className="cal-root">

        <div className="cal-container">
          <div className="cal-wrapper">
            {/* Header */}
            <div className="cal-header">
              <div className="cal-header-left">
                <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
                  &#8592;
                </button>
                <div>
                  <span className="cal-month-title">{MONTH_NAMES[currentMonth]}</span>
                  <span className="cal-year">{currentYear}</span>
                </div>
                <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
                  &#8594;
                </button>
              </div>

              <div className="cal-header-right">
                {/* Day range picker */}
                <div className="cal-days-btn-wrap">
                  <button
                    className={`cal-days-btn${dayPickerOpen ? " open" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDayPickerOpen(!dayPickerOpen);
                    }}
                  >
                    [ {widgetDays}D ]
                  </button>
                  {dayPickerOpen && (
                    <div className="cal-days-dropdown" onClick={(e) => e.stopPropagation()}>
                      {DAY_OPTIONS.map((d) => (
                        <button
                          key={d}
                          className={`cal-days-option${widgetDays === d ? " selected" : ""}`}
                          onClick={() => {
                            setWidgetDays(d);
                            saveWidgetDays(d);
                            setDayPickerOpen(false);
                            window.electronAPI?.notifyAssignmentsChanged();
                          }}
                        >
                          {d}D
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isElectron && (
                  <button
                    className="cal-close-btn"
                    onClick={() => window.electronAPI?.closeEditor()}
                    aria-label="Close"
                  >
                    x
                  </button>
                )}
              </div>
            </div>

            {/* Day labels */}
            <div className="cal-day-labels">
              {DAY_LABELS.map((label) => (
                <div key={label} className="cal-day-label">
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="cal-grid">
              {cells.map((cell) => {
                const cellAssignments = assignments.filter((a) => a.date === cell.dateStr);
                const isToday = cell.dateStr === todayStr;
                const isOtherMonth = !cell.isCurrentMonth;

                let minDiff: number | null = null;
                cellAssignments.forEach((a) => {
                  const diff = getDayDiff(a.date);
                  if (minDiff === null || diff < minDiff) minDiff = diff;
                });

                const isUrgent = minDiff !== null && minDiff >= 0 && minDiff <= 3;
                const dDayLabel =
                  minDiff !== null && minDiff >= 0 && minDiff <= 7
                    ? `D-${minDiff}`
                    : null;

                let cellClass = "cal-cell";
                if (isToday) cellClass += " is-today";
                if (isOtherMonth) cellClass += " other-month";

                return (
                  <div
                    key={cell.dateStr}
                    className={cellClass}
                    onClick={() => openOverlay(cell.dateStr)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openOverlay(cell.dateStr);
                    }}
                  >
                    {dDayLabel && (
                      <span className="cal-dday-label">{dDayLabel}</span>
                    )}

                    <span className={`cal-date-num${isUrgent ? " urgent" : ""}`}>
                      {cell.day}
                    </span>

                    {cellAssignments.length > 0 && (
                      <div className="cal-assignments">
                        {cellAssignments.slice(0, 3).map((a) => (
                          <div key={a.id} className="cal-assignment-item">
                            <div
                              className="cal-dot"
                              style={{ background: a.color }}
                            />
                            <span className="cal-assignment-name">{a.name}</span>
                            <button
                              className="cal-delete-btn"
                              onClick={(e) => handleDeleteAssignment(a.id, e)}
                              aria-label={`Delete ${a.name}`}
                            >
                              x
                            </button>
                          </div>
                        ))}
                        {cellAssignments.length > 3 && (
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.5rem",
                              color: "rgba(224,224,224,0.3)",
                              letterSpacing: "0.06em",
                            }}
                          >
                            +{cellAssignments.length - 3} MORE
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment overlay */}
      {overlayOpen && selectedDate && (
        <>
          <div className="cal-overlay-backdrop" onClick={closeOverlay} />
          <div className={`cal-overlay-panel${isOverlayClosing ? " closing" : ""}`} role="dialog" aria-modal="true">
            <div className="overlay-title">ASSIGNMENT</div>
            <div className="overlay-date-label">{selectedDate}</div>

            {assignments.filter((a) => a.date === selectedDate).length > 0 && (
              <div className="overlay-existing">
                <div className="overlay-existing-title">Existing</div>
                {assignments
                  .filter((a) => a.date === selectedDate)
                  .map((a) => (
                    <div key={a.id} className="overlay-existing-item">
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: a.color,
                          flexShrink: 0,
                        }}
                      />
                      <span className="overlay-existing-name">{a.name}</span>
                      {a.time && (
                        <span className="overlay-existing-time">{a.time}</span>
                      )}
                      <button
                        className="overlay-existing-del"
                        onClick={(e) => handleDeleteAssignment(a.id, e)}
                        aria-label={`Delete ${a.name}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                <hr className="overlay-divider" />
              </div>
            )}

            <div className="overlay-add-title">Add New</div>

            <div className="overlay-field">
              <label className="overlay-label" htmlFor="cal-form-name">
                Assignment Name
              </label>
              <input
                id="cal-form-name"
                className="overlay-input"
                type="text"
                placeholder="e.g. Final Report"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="overlay-field">
              <label className="overlay-label" htmlFor="cal-form-subject">
                Subject
              </label>
              <input
                id="cal-form-subject"
                className="overlay-input"
                type="text"
                placeholder="e.g. Computer Science"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>

            <div className="overlay-field">
              <div className="overlay-label">Deadline Time</div>
              {(() => {
                const h24 = parseInt(formTime.split(":")[0], 10);
                const min = formTime.split(":")[1];
                const isPM = h24 >= 12;
                const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                const displayTime = `${h12}:${min}`;
                const period = isPM ? "PM" : "AM";

                const setTimeParts = (newPeriod: string, newH12: number, newMin: string) => {
                  let h = newH12;
                  if (newPeriod === "AM") {
                    if (h === 12) h = 0;
                  } else {
                    if (h !== 12) h += 12;
                  }
                  setFormTime(`${String(h).padStart(2, "0")}:${newMin}`);
                };

                return (
                  <div className="time-picker-row">
                    <div className="time-display">
                      {displayTime}
                      <span className="time-period">{period}</span>
                    </div>
                    <button
                      type="button"
                      className={`time-clock-btn${timePickerOpen ? " active" : ""}`}
                      onClick={() => setTimePickerOpen(!timePickerOpen)}
                      aria-label="Open time picker"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </button>

                    {timePickerOpen && (
                      <div className="time-dropdown">
                        <div className="time-col">
                          <div className="time-col-label">Period</div>
                          <div className="time-col-scroll">
                            {["AM", "PM"].map((p) => (
                              <button
                                key={p}
                                type="button"
                                className={`time-option${period === p ? " selected" : ""}`}
                                onClick={() => { setTimeParts(p, h12, min); }}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="time-col">
                          <div className="time-col-label">Hour</div>
                          <div className="time-col-scroll">
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                              <button
                                key={h}
                                type="button"
                                className={`time-option${h12 === h ? " selected" : ""}`}
                                onClick={() => { setTimeParts(period, h, min); }}
                              >
                                {h}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="time-col">
                          <div className="time-col-label">Min</div>
                          <div className="time-col-scroll">
                            {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                              <button
                                key={m}
                                type="button"
                                className={`time-option${min === m ? " selected" : ""}`}
                                onClick={() => { setTimeParts(period, h12, m); }}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="overlay-field">
              <div className="overlay-label">Subject Color</div>
              <div className="color-palette">
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-swatch${formColor === c ? " selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => setFormColor(c)}
                    role="radio"
                    aria-checked={formColor === c}
                    aria-label={`Color ${c}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setFormColor(c);
                    }}
                  />
                ))}
                <input
                  type="color"
                  className="color-custom-input"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  title="Custom color"
                  aria-label="Custom color picker"
                />
              </div>
            </div>

            <div className="overlay-actions">
              <button
                className="overlay-save-btn"
                onClick={handleSave}
                disabled={!formName.trim()}
              >
                SAVE
              </button>
              <button className="overlay-cancel-btn" onClick={closeOverlay}>
                CANCEL
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default CalendarComponent;
