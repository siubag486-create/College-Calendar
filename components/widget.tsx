"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import {
  type Assignment,
  loadAssignments,
  getDayDiff,
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

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WIDGET_THEME_KEY = "college-widget-theme";
const WIDGET_DAYS_KEY = "college-widget-days";

type WidgetThemeMode = "black" | "glass";
type WidgetDays = 7 | 14 | 30;

function loadWidgetDays(): WidgetDays {
  if (typeof window === "undefined") return 7;
  try {
    const val = parseInt(localStorage.getItem(WIDGET_DAYS_KEY) || "7", 10);
    return ([7, 14, 30] as number[]).includes(val) ? (val as WidgetDays) : 7;
  } catch {
    return 7;
  }
}

function getDateLabel(dateStr: string): string {
  const diff = getDayDiff(dateStr);
  if (diff === 0) return "TODAY";
  if (diff === 1) return "TOMORROW";
  const d = new Date(dateStr);
  const dayName = DAY_NAMES[d.getDay()];
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dayName} ${mm}/${dd}`;
}

function getDdayBadge(diff: number): string | null {
  if (diff < 0) return null;
  if (diff === 0) return "D-0";
  if (diff <= 7) return `D-${diff}`;
  return null;
}

function loadWidgetTheme(): WidgetThemeMode {
  if (typeof window === "undefined") return "black";

  try {
    return localStorage.getItem(WIDGET_THEME_KEY) === "glass" ? "glass" : "black";
  } catch {
    return "black";
  }
}

function saveWidgetTheme(mode: WidgetThemeMode): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(WIDGET_THEME_KEY, mode);
  } catch {
    // silently fail
  }
}

const WidgetComponent: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [themeMode, setThemeMode] = useState<WidgetThemeMode>("black");
  const [widgetDays, setWidgetDays] = useState<WidgetDays>(7);

  const refresh = () => {
    setAssignments(loadAssignments());
    setWidgetDays(loadWidgetDays());
  };
  const syncInitialState = () => {
    setAssignments(loadAssignments());
    setThemeMode(loadWidgetTheme());
    setWidgetDays(loadWidgetDays());
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(syncInitialState);
    window.electronAPI?.onAssignmentsChanged(refresh);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const isGlassMode = themeMode === "glass";

  const toggleThemeMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const nextMode: WidgetThemeMode = isGlassMode ? "black" : "glass";
    setThemeMode(nextMode);
    saveWidgetTheme(nextMode);
  };

  const upcoming = assignments
    .filter((a) => {
      const diff = getDayDiff(a.date);
      return diff >= 0 && diff <= widgetDays;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

  // Group by date
  const grouped: { date: string; items: Assignment[] }[] = [];
  for (const a of upcoming) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === a.date) {
      last.items.push(a);
    } else {
      grouped.push({ date: a.date, items: [a] });
    }
  }

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: rgba(0,0,0,0.01) !important;
          overflow: hidden;
        }

        .widget-root *:lang(ko),
        .widget-root {
          --widget-bg: rgba(14, 14, 14, 0.97);
          --widget-border: rgba(255, 255, 255, 0.10);
          --widget-divider: rgba(255, 255, 255, 0.06);
          --widget-shadow:
            0 4px 16px rgba(0, 0, 0, 0.5),
            0 12px 40px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3);
          --widget-overlay:
            radial-gradient(circle at top right, rgba(255, 60, 0, 0.08), transparent 38%);
          --title-color: #e0e0e0;
          --subtitle-color: rgba(224, 224, 224, 0.3);
          --date-color: rgba(224, 224, 224, 0.35);
          --today-color: #ff3c00;
          --item-hover: rgba(224, 224, 224, 0.04);
          --name-color: rgba(224, 224, 224, 0.75);
          --time-color: rgba(224, 224, 224, 0.3);
          --empty-color: rgba(224, 224, 224, 0.2);
          --scrollbar-thumb: rgba(224, 224, 224, 0.1);
          --button-bg: rgba(255, 255, 255, 0.06);
          --button-border: rgba(255, 255, 255, 0.1);
          --button-text: rgba(224, 224, 224, 0.5);
          --button-hover-bg: rgba(255, 60, 0, 0.08);
          --button-hover-border: rgba(255, 60, 0, 0.3);
          --button-hover-text: #ff3c00;
          --theme-btn-bg: rgba(255, 255, 255, 0.05);
          --theme-btn-border: rgba(255, 255, 255, 0.1);
          --theme-btn-text: rgba(224, 224, 224, 0.52);
          --theme-btn-hover-bg: rgba(255, 255, 255, 0.1);
          --theme-btn-hover-border: rgba(255, 255, 255, 0.16);
          --theme-btn-hover-text: #f7f7f7;
          width: 100vw;
          height: 100vh;
          color: var(--title-color);
          display: flex;
          font-family: 'Do Hyeon', monospace;
          -webkit-text-stroke: 0.3px transparent;
          letter-spacing: 0.02em;
          cursor: pointer;
          user-select: none;
          position: relative;
          isolation: isolate;
          padding: 0;
          box-sizing: border-box;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
        }

        .widget-root::before {
          content: "";
          position: absolute;
          inset: 0;
          background: transparent;
          pointer-events: none;
          z-index: 0;
        }

        .widget-panel {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--widget-bg);
          border: 1px solid var(--widget-border);
          border-radius: 16px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          z-index: 1;
          box-shadow: var(--widget-shadow);
          transition: background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease, border-radius 0.4s ease;
        }

        .widget-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--widget-overlay);
          pointer-events: none;
          z-index: 0;
        }

        .widget-panel > * {
          position: relative;
          z-index: 1;
        }

        .widget-root.mode-glass {
          --widget-bg: rgba(255, 255, 255, 0.78);
          --widget-border: rgba(255, 255, 255, 0.20);
          --widget-divider: rgba(255, 255, 255, 0.10);
          --widget-shadow:
            0 4px 24px rgba(0, 0, 0, 0.12),
            0 1px 3px rgba(0, 0, 0, 0.08);
          --widget-overlay: none;
          --title-color: rgba(0, 0, 0, 0.88);
          --subtitle-color: rgba(0, 0, 0, 0.45);
          --date-color: rgba(0, 0, 0, 0.40);
          --today-color: #ff3c00;
          --item-hover: rgba(0, 0, 0, 0.04);
          --name-color: rgba(0, 0, 0, 0.75);
          --time-color: rgba(0, 0, 0, 0.40);
          --empty-color: rgba(0, 0, 0, 0.35);
          --scrollbar-thumb: rgba(0, 0, 0, 0.12);
          --button-bg: rgba(0, 0, 0, 0.05);
          --button-border: rgba(0, 0, 0, 0.12);
          --button-text: rgba(0, 0, 0, 0.55);
          --button-hover-bg: rgba(0, 0, 0, 0.08);
          --button-hover-border: rgba(0, 0, 0, 0.22);
          --button-hover-text: rgba(0, 0, 0, 0.85);
          --theme-btn-bg: rgba(0, 0, 0, 0.05);
          --theme-btn-border: rgba(0, 0, 0, 0.12);
          --theme-btn-text: rgba(0, 0, 0, 0.55);
          --theme-btn-hover-bg: rgba(0, 0, 0, 0.08);
          --theme-btn-hover-border: rgba(0, 0, 0, 0.22);
          --theme-btn-hover-text: rgba(0, 0, 0, 0.85);
        }

        .widget-root.mode-glass .widget-panel {
          backdrop-filter: blur(30px) saturate(140%);
          -webkit-backdrop-filter: blur(30px) saturate(140%);
          border-radius: 24px;
        }

        .widget-header {
          padding: 14px 16px 10px;
          border-bottom: 1px solid var(--widget-divider);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          transition: border-color 0.4s ease;
        }

        .widget-heading {
          -webkit-app-region: drag;
          min-width: 0;
          flex: 1;
        }

        .widget-title {
          font-family: var(--font-geist-sans), "Segoe UI", sans-serif;
          font-weight: 700;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          color: var(--title-color);
          transition: color 0.4s ease;
        }

        .widget-subtitle {
          font-size: 0.55rem;
          letter-spacing: 0.1em;
          color: var(--subtitle-color);
          margin-top: 2px;
          transition: color 0.4s ease;
        }

        .widget-theme-btn {
          -webkit-app-region: no-drag;
          background: var(--theme-btn-bg);
          border: 1px solid var(--theme-btn-border);
          border-radius: 999px;
          color: var(--theme-btn-text);
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
          flex-shrink: 0;
        }

        .widget-theme-btn:hover {
          background: var(--theme-btn-hover-bg);
          border-color: var(--theme-btn-hover-border);
          color: var(--theme-btn-hover-text);
        }

        .widget-body {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
          -webkit-app-region: no-drag;
        }

        .widget-body::-webkit-scrollbar {
          width: 3px;
        }
        .widget-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .widget-body::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: 2px;
        }

        .widget-date-group {
          margin-bottom: 4px;
        }

        .widget-date-label {
          font-size: 0.5rem;
          letter-spacing: 0.16em;
          color: var(--date-color);
          padding: 4px 16px 2px;
          text-transform: uppercase;
          transition: color 0.4s ease;
        }

        .widget-date-label.is-today {
          color: var(--today-color);
        }

        .widget-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          margin: 0 8px;
          border-radius: 12px;
          transition:
            background 0.12s,
            border-color 0.12s;
        }

        .widget-root.mode-glass .widget-item {
          border: 1px solid transparent;
        }

        .widget-item:hover {
          background: var(--item-hover);
        }

        .widget-root.mode-glass .widget-item:hover {
          border-color: rgba(255, 255, 255, 0.1);
        }

        .widget-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .widget-name {
          flex: 1;
          min-width: 0;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--name-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.4s ease;
        }

        .widget-time {
          font-size: 0.55rem;
          color: var(--time-color);
          flex-shrink: 0;
          transition: color 0.4s ease;
        }

        .widget-badge {
          font-size: 0.62rem;
          letter-spacing: 0.06em;
          color: var(--today-color);
          flex-shrink: 0;
          font-weight: bold;
        }

        .widget-badge.urgent {
          color: var(--today-color);
        }

        .widget-empty {
          padding: 24px 16px;
          text-align: center;
          font-size: 0.6rem;
          color: var(--empty-color);
          letter-spacing: 0.12em;
        }

        .widget-footer {
          padding: 8px 16px;
          border-top: none;
          text-align: center;
          -webkit-app-region: no-drag;
        }

        .widget-open-btn {
          background: var(--button-bg);
          border: 1px solid var(--button-border);
          border-radius: 10px;
          color: var(--button-text);
          font-family: var(--font-geist-sans), "Segoe UI", sans-serif;
          font-weight: 700;
          font-size: 0.5rem;
          letter-spacing: 0.1em;
          padding: 8px 16px;
          cursor: pointer;
          transition: background 0.4s ease, border-color 0.4s ease, color 0.4s ease;
          width: 100%;
        }

        .widget-root.mode-glass .widget-open-btn,
        .widget-root.mode-glass .widget-theme-btn {
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }

        .widget-open-btn:hover {
          color: var(--button-hover-text);
          border-color: var(--button-hover-border);
          background: var(--button-hover-bg);
        }
      `}</style>

      <div
        className={`widget-root ${isGlassMode ? "mode-glass" : "mode-black"}`}
      >
        <div className="widget-panel">
          <div className="widget-header">
            <div className="widget-heading">
              <div className="widget-title">CALENDAR</div>
              <div className="widget-subtitle">UPCOMING {widgetDays} DAYS</div>
            </div>
            <button
              type="button"
              className="widget-theme-btn"
              onClick={toggleThemeMode}
            >
              {isGlassMode ? <Moon size={10} /> : <Sun size={10} />}
            </button>
          </div>

          <div className="widget-body">
            {grouped.length === 0 ? (
              <div className="widget-empty">NO UPCOMING ASSIGNMENTS</div>
            ) : (
              grouped.map((group) => {
                const diff = getDayDiff(group.date);
                const isToday = diff === 0;
                return (
                  <div key={group.date} className="widget-date-group">
                    <div className={`widget-date-label${isToday ? " is-today" : ""}`}>
                      {getDateLabel(group.date)}
                    </div>
                    {group.items.map((a) => {
                      const badge = getDdayBadge(getDayDiff(a.date));
                      const isUrgent = diff <= 1;
                      return (
                        <div key={a.id} className="widget-item">
                          <div className="widget-dot" style={{ background: a.color }} />
                          <span className="widget-name">{a.name}</span>
                          <span className="widget-time">{a.time}</span>
                          {badge && (
                            <span className={`widget-badge${isUrgent ? " urgent" : ""}`}>
                              {badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="widget-footer">
            <button
              type="button"
              className="widget-open-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.electronAPI?.openEditor();
              }}
            >
              OPEN EDITOR
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WidgetComponent;
