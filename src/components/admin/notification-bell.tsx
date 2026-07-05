'use client';

// ============================================================
// NotificationBell — campana de alertas NOM-035 para el header del admin.
//
//   - Hace polling cada 60s a /api/alerts/nom-035?week=current.
//   - Muestra un badge con el total de alertas activas (HIGH+MEDIUM+LOW)
//     detectadas en la semana actual: exceso de horas extra, jornada
//     diaria excesiva, sobrecarga sostenida, o sin descanso semanal.
//   - Badge rojo si hay alertas HIGH, ámbar si solo MEDIUM/LOW.
//   - Dropdown con la lista de alertas (max 5), con dot rojo (HIGH),
//     ámbar (MEDIUM) o gris (LOW), título, descripción y tipo.
//   - Botón "Ver todas" navega a la vista NOM-035 del admin-layout.
//
// Nota: el hook de checkout (/api/attendance/check-out) también escribe
// entradas en el audit log con action=NOM035_ALERT_WEEKLY_OVERTIME
// cuando un empleado cruza el tope semanal. Eso queda como evidencia
// auditable en la vista de Auditoría, independiente de este badge.
// ============================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, Check, AlertTriangle } from 'lucide-react';

type AlertType =
  | 'WEEKLY_OVERTIME_EXCEEDED'
  | 'DAILY_OVERTIME_EXCEEDED'
  | 'CONSECUTIVE_LONG_DAYS'
  | 'NO_WEEKLY_REST';

type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface AlertItem {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  sucursalName: string;
  type: AlertType;
  level: AlertLevel;
  title: string;
  description: string;
  recommendation: string;
  legalReference: string;
}

interface AlertSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  weekStart: string;
  weekEnd: string;
  weeklyOvertimeCapMinutes: number;
  employeesChecked: number;
}

const TYPE_LABEL: Record<AlertType, string> = {
  WEEKLY_OVERTIME_EXCEEDED: 'Exceso horas extra',
  DAILY_OVERTIME_EXCEEDED: 'Jornada diaria excesiva',
  CONSECUTIVE_LONG_DAYS: 'Sobrecarga sostenida',
  NO_WEEKLY_REST: 'Sin descanso semanal',
};

interface Props {
  onViewAll?: () => void;
}

export function NotificationBell({ onViewAll }: Props) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/nom-035?week=current');
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts || []);
      setSummary(data.summary || null);
    } catch {
      // silent fail — keep last known state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000); // 60s
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const count = summary?.total || 0;
  const hasHigh = (summary?.high || 0) > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-zinc-100 transition-colors text-zinc-600 hover:text-zinc-900"
        aria-label={`Alertas NOM-035 (${count} activas)`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
              hasHigh ? 'bg-red-500' : 'bg-amber-500'
            }`}
            aria-hidden="true"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-zinc-200 z-50 overflow-hidden"
          role="dialog"
          aria-label="Lista de alertas NOM-035"
        >
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-zinc-900 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas NOM-035
              </span>
              <span className="text-xs text-zinc-500">
                Semana {summary?.weekStart ?? '—'} → {summary?.weekEnd ?? '—'}
              </span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">Cargando...</div>
            ) : alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
                <Check className="h-8 w-8 text-green-500" />
                Sin alertas activas
              </div>
            ) : (
              alerts.slice(0, 5).map((a, idx) => (
                <div key={`${a.employeeId}-${a.type}-${idx}`} className="px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                        a.level === 'HIGH' ? 'bg-red-500' : a.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-zinc-400'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900 truncate">{a.employeeName}</p>
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wide flex-shrink-0">
                          {TYPE_LABEL[a.type]}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{a.description}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {alerts.length > 0 && onViewAll && (
            <button
              type="button"
              onClick={() => { setOpen(false); onViewAll(); }}
              className="w-full px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 border-t border-zinc-100 font-medium"
            >
              Ver todas las alertas ({count})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
