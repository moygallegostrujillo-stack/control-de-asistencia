'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, X, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/fetch-helper';
import { useAppStore } from '@/store/app-store';

interface Alert {
  id: string;
  type: 'RETARDOS_RECURRENTES' | 'AUSENCIA_CONSECUTIVA' | 'EXCESO_DESCANSO' | 'SALIDAS_TEMPRANO' | 'SIN_CHECKOUT';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalName: string;
  count: number;
}

interface AlertsResponse {
  alerts: Alert[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    byType: Record<string, number>;
  };
  days: number;
}

const SEVERITY_CONFIG = {
  critical: {
    label: 'Crítica',
    badgeCls: 'bg-rose-100 text-rose-700 border-rose-200',
    dotCls: 'bg-rose-500',
    iconCls: 'text-rose-500',
  },
  warning: {
    label: 'Advertencia',
    badgeCls: 'bg-amber-100 text-amber-700 border-amber-200',
    dotCls: 'bg-amber-500',
    iconCls: 'text-amber-500',
  },
  info: {
    label: 'Info',
    badgeCls: 'bg-sky-100 text-sky-700 border-sky-200',
    dotCls: 'bg-sky-500',
    iconCls: 'text-sky-500',
  },
};

const TYPE_LABELS: Record<string, string> = {
  RETARDOS_RECURRENTES: 'Retardos recurrentes',
  AUSENCIA_CONSECUTIVA: 'Ausencia consecutiva',
  EXCESO_DESCANSO: 'Exceso de descanso',
  SALIDAS_TEMPRANO: 'Salidas temprano',
  SIN_CHECKOUT: 'Sin registro de salida',
};

export function SupervisorAlertsBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<{ total: number; critical: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setPreselectedEmployeeId, setAdminView } = useAppStore();

  async function loadAlerts() {
    setLoading(true);
    try {
      const res = await authFetch('/api/alerts/supervisor-alerts?days=7');
      if (!res.ok) return;
      const data: AlertsResponse = await res.json();
      setAlerts(data.alerts);
      setSummary(data.summary);
      setLastChecked(new Date());
    } catch {
      // Silencioso — no interrumpir al usuario
    } finally {
      setLoading(false);
    }
  }

  // Cargar al montar y luego cada 2 minutos
  useEffect(() => {
    loadAlerts();
    intervalRef.current = setInterval(loadAlerts, 120_000); // 2 min
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const total = summary?.total ?? 0;
  const critical = summary?.critical ?? 0;

  if (total === 0 && !loading) {
    return null; // No mostrar nada si no hay alertas
  }

  function handleAlertClick(alert: Alert) {
    setOpen(false);
    // Navegar al calendario del empleado
    setPreselectedEmployeeId(alert.employeeId);
    setAdminView('calendar');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => { if (!open) loadAlerts(); }}
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
                critical > 0 ? 'bg-rose-500' : 'bg-amber-500'
              )}
            >
              {total > 9 ? '9+' : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('h-4 w-4', critical > 0 ? 'text-rose-500' : 'text-amber-500')} />
            <span className="font-medium text-sm">Alertas de asistencia</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && alerts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando alertas…</div>
          ) : alerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              No hay alertas críticas. Todo en orden.
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map((alert) => {
                const cfg = SEVERITY_CONFIG[alert.severity];
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => handleAlertClick(alert)}
                    className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-2"
                  >
                    <div className={cn('mt-1 h-2 w-2 rounded-full shrink-0', cfg.dotCls)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{alert.employeeName}</span>
                        <Badge variant="outline" className={cn('text-[10px] py-0 px-1.5', cfg.badgeCls)}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {TYPE_LABELS[alert.type]} · {alert.sucursalName}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {lastChecked && (
          <div className="p-2 border-t text-center text-[10px] text-muted-foreground">
            Actualizado: {lastChecked.toLocaleTimeString('es-MX')}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
