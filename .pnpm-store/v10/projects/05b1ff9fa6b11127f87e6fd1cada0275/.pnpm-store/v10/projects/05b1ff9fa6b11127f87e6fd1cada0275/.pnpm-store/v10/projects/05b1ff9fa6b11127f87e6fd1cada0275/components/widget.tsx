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

const WidgetComponent: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const refresh = () => setAssignments(loadAssignments());

  useEffect(() => {
    refresh();
    window.electronAPI?.onAssignmentsChanged(refresh);
  }, []);

  // Get upcoming assignments (today + next 7 days), sorted by date then time
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&display=swap');

        html, body {
          margin: 0;
          padding: 0;
          background: transparent !important;
          overflow: hidden;
        }

        .widget-root {
          width: 100vw;
          height: 100vh;
          background: rgba(20, 20, 20, 0.92);
          color: #e0e0e0;
          display: flex;
          flex-direction: column;
          font-family: monospace;
          cursor: pointer;
          user-select: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-sizing: border-box;
          overflow: hidden;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .widget-header {
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          -webkit-app-region: drag;
        }

        .widget-title {
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          color: #e0e0e0;
        }

        .widget-subtitle {
          font-size: 0.55rem;
          letter-spacing: 0.1em;
          color: rgba(224, 224, 224, 0.3);
          margin-top: 2px;
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
          background: rgba(224, 224, 224, 0.1);
          border-radius: 2px;
        }

        .widget-date-group {
          margin-bottom: 4px;
        }

        .widget-date-label {
          font-size: 0.5rem;
          letter-spacing: 0.16em;
          color: rgba(224, 224, 224, 0.35);
          padding: 4px 16px 2px;
          text-transform: uppercase;
        }

        .widget-date-label.is-today {
          color: #ff3c00;
        }

        .widget-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 16px;
          transition: background 0.12s;
        }

        .widget-item:hover {
          background: rgba(224, 224, 224, 0.04);
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
          color: rgba(224, 224, 224, 0.75);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .widget-time {
          font-size: 0.55rem;
          color: rgba(224, 224, 224, 0.3);
          flex-shrink: 0;
        }

        .widget-badge {
          font-size: 0.5rem;
          letter-spacing: 0.06em;
          color: #ff3c00;
          flex-shrink: 0;
          font-weight: bold;
        }

        .widget-badge.urgent {
          color: #ff3c00;
        }

        .widget-empty {
          padding: 24px 16px;
          text-align: center;
          font-size: 0.6rem;
          color: rgba(224, 224, 224, 0.2);
          letter-spacing: 0.12em;
        }

        .widget-footer {
          padding: 8px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          text-align: center;
          -webkit-app-region: no-drag;
        }

        .widget-open-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(224, 224, 224, 0.5);
          font-family: 'Syncopate', sans-serif;
          font-weight: 700;
          font-size: 0.5rem;
          letter-spacing: 0.12em;
          padding: 6px 16px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          backdrop-filter: blur(8px);
        }

        .widget-open-btn:hover {
          color: #ff3c00;
          border-color: rgba(255, 60, 0, 0.3);
          background: rgba(255, 60, 0, 0.08);
        }
      `}</style>

      <div
        className="widget-root"
        onClick={(e) => {
          // Only open editor if clicking on the body area (not the button)
          if ((e.target as HTMLElement).closest(".widget-footer")) return;
          window.electronAPI?.openEditor();
        }}
      >
        <div className="widget-header">
          <div className="widget-title">CALENDAR</div>
          <div className="widget-subtitle">UPCOMING 7 DAYS</div>
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
            className="widget-open-btn"
            onClick={() => window.electronAPI?.openEditor()}
          >
            OPEN EDITOR
          </button>
        </div>
      </div>
    </>
  );
};

export default WidgetComponent;
