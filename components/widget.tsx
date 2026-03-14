"use client";

import React, { useState, useEffect } from "react";
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

type WidgetThemeMode = "black" | "glass";

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

  const refresh = () => setAssignments(loadAssignments());

  useEffect(() => {
    refresh();
    setThemeMode(loadWidgetTheme());
    window.electronAPI?.onAssignmentsChanged(refresh);
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
      return diff >= 0 && diff <= 7;
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
          background: transparent !important;
          overflow: hidden;
        }

        .widget-root {
          --widget-bg: rgba(20, 20, 20, 0.92);
          --widget-border: rgba(255, 255, 255, 0.08);
          --widget-divider: rgba(255, 255, 255, 0.06);
          --widget-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
          background: var(--widget-bg);
          color: var(--title-color);
          display: flex;
          flex-direction: column;
          font-family: monospace;
          cursor: pointer;
          user-select: none;
          position: relative;
          isolation: isolate;
          border: 1px solid var(--widget-border);
          border-radius: 16px;
          box-sizing: border-box;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
          box-shadow: var(--widget-shadow);
        }

        .widget-root::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--widget-overlay);
          pointer-events: none;
          z-index: 0;
        }

        .widget-root > * {
          position: relative;
          z-index: 1;
        }

        .widget-root.mode-glass {
          --widget-bg:
            linear-gradient(160deg, rgba(246, 249, 255, 0.16), rgba(133, 184, 255, 0.05)),
            rgba(15, 22, 34, 0.28);
          --widget-border: rgba(255, 255, 255, 0.26);
          --widget-divider: rgba(255, 255, 255, 0.18);
          --widget-shadow:
            0 18px 40px rgba(8, 13, 26, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.24);
          --widget-overlay:
            radial-gradient(circle at top left, rgba(135, 206, 250, 0.28), transparent 32%),
            radial-gradient(circle at bottom right, rgba(255, 176, 123, 0.22), transparent 30%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 44%);
          --title-color: #f5f9ff;
          --subtitle-color: rgba(230, 240, 255, 0.68);
          --date-color: rgba(219, 233, 255, 0.64);
          --today-color: #8be9ff;
          --item-hover: rgba(255, 255, 255, 0.08);
          --name-color: rgba(244, 248, 255, 0.92);
          --time-color: rgba(214, 227, 248, 0.72);
          --empty-color: rgba(232, 240, 255, 0.5);
          --scrollbar-thumb: rgba(255, 255, 255, 0.22);
          --button-bg: rgba(255, 255, 255, 0.1);
          --button-border: rgba(255, 255, 255, 0.2);
          --button-text: rgba(244, 248, 255, 0.85);
          --button-hover-bg: rgba(139, 233, 255, 0.2);
          --button-hover-border: rgba(139, 233, 255, 0.36);
          --button-hover-text: #f8fcff;
          --theme-btn-bg: rgba(255, 255, 255, 0.1);
          --theme-btn-border: rgba(255, 255, 255, 0.16);
          --theme-btn-text: rgba(240, 246, 255, 0.86);
          --theme-btn-hover-bg: rgba(255, 255, 255, 0.16);
          --theme-btn-hover-border: rgba(255, 255, 255, 0.24);
          --theme-btn-hover-text: #ffffff;
          backdrop-filter: blur(28px) saturate(180%);
        }

        .widget-header {
          padding: 14px 16px 10px;
          border-bottom: 1px solid var(--widget-divider);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
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
        }

        .widget-subtitle {
          font-size: 0.55rem;
          letter-spacing: 0.1em;
          color: var(--subtitle-color);
          margin-top: 2px;
        }

        .widget-theme-btn {
          -webkit-app-region: no-drag;
          background: var(--theme-btn-bg);
          border: 1px solid var(--theme-btn-border);
          border-radius: 999px;
          color: var(--theme-btn-text);
          font-family: var(--font-geist-sans), "Segoe UI", sans-serif;
          font-weight: 700;
          font-size: 0.48rem;
          letter-spacing: 0.12em;
          padding: 7px 10px;
          cursor: pointer;
          transition: all 0.2s;
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
        }

        .widget-date-label.is-today {
          color: var(--today-color);
        }

        .widget-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 16px;
          transition: background 0.12s;
        }

        .widget-item:hover {
          background: var(--item-hover);
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
          color: var(--name-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .widget-time {
          font-size: 0.55rem;
          color: var(--time-color);
          flex-shrink: 0;
        }

        .widget-badge {
          font-size: 0.5rem;
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
          border-top: 1px solid var(--widget-divider);
          text-align: center;
          -webkit-app-region: no-drag;
        }

        .widget-open-btn {
          background: var(--button-bg);
          border: 1px solid var(--button-border);
          border-radius: 8px;
          color: var(--button-text);
          font-family: var(--font-geist-sans), "Segoe UI", sans-serif;
          font-weight: 700;
          font-size: 0.5rem;
          letter-spacing: 0.1em;
          padding: 6px 16px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          backdrop-filter: none;
        }

        .widget-open-btn:hover {
          color: var(--button-hover-text);
          border-color: var(--button-hover-border);
          background: var(--button-hover-bg);
        }
      `}</style>

      <div
        className={`widget-root ${isGlassMode ? "mode-glass" : "mode-black"}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          window.electronAPI?.openEditor();
        }}
      >
        <div className="widget-header">
          <div className="widget-heading">
            <div className="widget-title">CALENDAR</div>
            <div className="widget-subtitle">UPCOMING 7 DAYS</div>
          </div>
          <button
            type="button"
            className="widget-theme-btn"
            onClick={toggleThemeMode}
          >
            {isGlassMode ? "BLACK MODE" : "GLASS MODE"}
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
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.electronAPI?.openEditor();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            OPEN EDITOR
          </button>
        </div>
      </div>
    </>
  );
};

export default WidgetComponent;
