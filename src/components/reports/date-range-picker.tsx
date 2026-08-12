'use client';

// ============================================================
// <DateRangePicker /> — Selector de rango de fechas reutilizable
// ------------------------------------------------------------
// Componente compartido para todos los reportes del sistema.
// Incluye presets rápidos (Hoy, Ayer, Esta semana, Este mes,
// Mes pasado, Este año, Personalizado) que calculan el rango
// en zona America/Mexico_City (no UTC) para evitar desfases.
//
// Uso:
//   <DateRangePicker
//     value={{ start: '2026-08-01', end: '2026-08-31' }}
//     onChange={(v) => setRange(v)}
//   />
//
// Props opcionales:
//   • allowPresets (default true) — muestra los chips de presets
//   • allowSingleDate (default false) — permite usar solo `start`
//     como "fecha única" (para reportes que muestran UN día).
//     En ese modo, los presets son: Hoy, Ayer (sin rangos).
//   • maxRangeDays (opcional) — si se establece, muestra advertencia
//     cuando el rango excede el límite (no bloquea).
// ============================================================

import { useMemo } from 'react';
import { DateTime } from 'luxon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MEXICO_TZ } from '@/lib/timezone';

export interface DateRangeValue {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  allowPresets?: boolean;
  allowSingleDate?: boolean;
  className?: string;
  /** Etiquetas personalizadas para los inputs (default: "Desde" / "Hasta") */
  startLabel?: string;
  endLabel?: string;
}

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Devuelve la fecha ISO "YYYY-MM-DD" de hoy en zona México. */
function todayMexicoISO(): string {
  return DateTime.now().setZone(MEXICO_TZ).toFormat('yyyy-MM-dd');
}

/** Convierte un DateTime (luxon, en Mexico TZ) a 'YYYY-MM-DD'. */
function toISO(dt: DateTime): string {
  return dt.toFormat('yyyy-MM-dd');
}

interface PresetDef {
  id: string;
  label: string;
  compute: () => DateRangeValue;
}

/**
 * Lista de presets para modo rango (default).
 * Todos los rangos se calculan en zona America/Mexico_City.
 */
const RANGE_PRESETS: PresetDef[] = [
  {
    id: 'today',
    label: 'Hoy',
    compute: () => {
      const today = todayMexicoISO();
      return { start: today, end: today };
    },
  },
  {
    id: 'yesterday',
    label: 'Ayer',
    compute: () => {
      const y = DateTime.now().setZone(MEXICO_TZ).minus({ days: 1 });
      const iso = toISO(y);
      return { start: iso, end: iso };
    },
  },
  {
    id: 'this-week',
    label: 'Esta semana',
    compute: () => {
      const now = DateTime.now().setZone(MEXICO_TZ);
      const start = now.startOf('week'); // lunes
      const end = start.plus({ days: 6 }); // domingo
      return { start: toISO(start), end: toISO(end) };
    },
  },
  {
    id: 'this-month',
    label: 'Este mes',
    compute: () => {
      const now = DateTime.now().setZone(MEXICO_TZ);
      const start = now.startOf('month');
      const end = now.endOf('month');
      return { start: toISO(start), end: toISO(end) };
    },
  },
  {
    id: 'last-month',
    label: 'Mes pasado',
    compute: () => {
      const now = DateTime.now().setZone(MEXICO_TZ);
      const start = now.minus({ months: 1 }).startOf('month');
      const end = now.minus({ months: 1 }).endOf('month');
      return { start: toISO(start), end: toISO(end) };
    },
  },
  {
    id: 'this-year',
    label: 'Este año',
    compute: () => {
      const now = DateTime.now().setZone(MEXICO_TZ);
      const start = now.startOf('year');
      const end = now.endOf('year');
      return { start: toISO(start), end: toISO(end) };
    },
  },
];

/**
 * Presets para modo fecha única (allowSingleDate=true).
 * Solo aplica el rango a `start`; el input "Hasta" no se muestra.
 */
const SINGLE_PRESETS: PresetDef[] = [
  {
    id: 'today',
    label: 'Hoy',
    compute: () => {
      const today = todayMexicoISO();
      return { start: today, end: today };
    },
  },
  {
    id: 'yesterday',
    label: 'Ayer',
    compute: () => {
      const y = DateTime.now().setZone(MEXICO_TZ).minus({ days: 1 });
      const iso = toISO(y);
      return { start: iso, end: iso };
    },
  },
];

/** Descripción legible del rango actual (ej. "Agosto 2026" o "01/08 → 31/08/2026"). */
function describeRange(v: DateRangeValue): string {
  try {
    const start = DateTime.fromFormat(v.start, 'yyyy-MM-dd', { zone: MEXICO_TZ });
    const end = DateTime.fromFormat(v.end, 'yyyy-MM-dd', { zone: MEXICO_TZ });
    if (!start.isValid || !end.isValid) return '';
    if (v.start === v.end) {
      return `${start.toFormat('dd')} ${MESES_ES[start.month - 1]} ${start.year}`;
    }
    if (start.month === end.month && start.year === end.year) {
      return `${start.toFormat('dd')} → ${end.toFormat('dd')} ${MESES_ES[end.month - 1]} ${end.year}`;
    }
    return `${start.toFormat('dd/MM/yyyy')} → ${end.toFormat('dd/MM/yyyy')}`;
  } catch {
    return '';
  }
}

export function DateRangePicker({
  value,
  onChange,
  allowPresets = true,
  allowSingleDate = false,
  className,
  startLabel,
  endLabel,
}: DateRangePickerProps) {
  const presets = allowSingleDate ? SINGLE_PRESETS : RANGE_PRESETS;

  // Detectar qué preset coincide con el valor actual (para resaltarlo).
  const activePresetId = useMemo(() => {
    for (const p of presets) {
      const pv = p.compute();
      if (pv.start === value.start && pv.end === value.end) return p.id;
    }
    return null;
  }, [value.start, value.end, presets]);

  const applyPreset = (p: PresetDef) => {
    onChange(p.compute());
  };

  const handleStartChange = (newStart: string) => {
    if (allowSingleDate) {
      onChange({ start: newStart, end: newStart });
    } else {
      // Si la nueva start > end, ajustar end a start.
      const newEnd = newStart > value.end ? newStart : value.end;
      onChange({ start: newStart, end: newEnd });
    }
  };

  const handleEndChange = (newEnd: string) => {
    // Si newEnd < start, ajustar start a newEnd.
    const newStart = newEnd < value.start ? newEnd : value.start;
    onChange({ start: newStart, end: newEnd });
  };

  const description = describeRange(value);

  return (
    <div className={cn('space-y-2', className)}>
      {allowPresets && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                activePresetId === p.id
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{startLabel || 'Desde'}</Label>
          <Input
            type="date"
            value={value.start}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-40"
          />
        </div>
        {!allowSingleDate && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{endLabel || 'Hasta'}</Label>
            <Input
              type="date"
              value={value.end}
              onChange={(e) => handleEndChange(e.target.value)}
              className="w-40"
            />
          </div>
        )}
        {description && (
          <span className="text-xs text-muted-foreground pb-2">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
