// ============================================================
// STPS REPORT — Art. 804 Ley Federal del Trabajo
// ------------------------------------------------------------
// Construye el reporte de asistencia en formato STPS para que el
// patrón (Marlui) pueda exhibirlo ante una inspección laboral de
// la Secretaría del Trabajo y Previsión Social (STPS) o en un
// juicio laboral. El reporte incluye 3 secciones:
//
//   Sección 1 — Datos del patrón (empresa)
//   Sección 2 — Catálogo de trabajadores (+ resumen de
//               inasistencias, retardos, vacaciones y permisos)
//   Sección 3 — Detalle diario por trabajador
//
// Todos los campos opcionales (RFC, CURP, salario, etc.) que no
// estén capturados se marcan como "NO CAPTURADO" — el reporte se
// genera igual aunque falten datos (Cambio D del requerimiento).
//
// Referencias legales:
//   - Art. 804 LFT: obligación del patrón de conservar y exhibir
//     registros de asistencia cuando la autoridad lo requiera.
//   - Art. 132 LFT fracción XXXIV: los registros hacen prueba
//     plena cuando fueron acordados con el trabajador.
//   - NOM-037-STPS-2023: registros de asistencia electrónica.
//   - Art. 60 y 61 LFT: jornada diurna/nocturna/mixta y prima
//     nocturna del 25% (ya calculada al check-out).
// ============================================================

import { db } from './db';
import { DateTime } from 'luxon';
import {
  MEXICO_TZ,
  toISODate,
  formatTimeInMexico,
  minutesToHours,
} from './timezone';
import { isAbsentOnDate } from './absence-calculator';

/** Etiqueta para campos no capturados en el sistema. */
export const NO_CAPTURADO = 'NO CAPTURADO';

/** Tipo de periodo del reporte. */
export type TipoPeriodo = 'mensual' | 'semanal';

/** Resultado del cálculo del periodo. */
export interface PeriodoReporte {
  tipo: TipoPeriodo;
  fechaInicio: Date; // instante UTC del primer día (00:00 UTC)
  fechaFin: Date; // instante UTC del último día (23:59:59.999 UTC)
  descripcion: string; // ej. "Mensual: Julio 2026"
}

/** Sección 1 — Datos del patrón. */
export interface DatosPatron {
  razonSocial: string;
  rfc: string;
  registroPatronal: string;
  domicilioFiscal: string;
  representanteLegal: string;
  telefono: string;
  email: string;
  periodo: string; // descripción del periodo cubierto
}

/** Sección 2 — Catálogo de trabajadores (una fila por empleado). */
export interface FilaTrabajador {
  employeeId: string;
  numeroEmpleado: string;
  nombreCompleto: string;
  rfc: string;
  curp: string;
  puesto: string;
  departamento: string;
  sucursal: string;
  salarioBase: string; // formateado con 2 decimales o NO CAPTURADO
  diasTrabajados: number;
  totalHorasTrabajadas: number; // horas decimales
  totalHorasExtraDobles: number;
  totalHorasExtraTriples: number;
  totalMinutosNocturnos: number; // para prima nocturna (art. 61 LFT)
  diasDescansoTrabajados: number;
  diasVacacionesDisfrutados: number;
  // --- Cambio C: catálogo de inasistencias y retardos ---
  diasFaltaSinJustificar: number;
  diasLlegoTarde: number;
  diasSalioTemprano: number;
  totalRetardosMinutos: number;
  diasPermiso: number;
}

/** Sección 3 — Detalle diario por trabajador (una fila por día). */
export interface FilaDetalleDiario {
  fecha: string; // YYYY-MM-DD
  entrada: string; // HH:mm o '—'
  salida: string; // HH:mm o '—'
  tiempoComidaMin: number | string; // mealDurationMinutes o '—'
  totalHorasDia: number; // horas decimales
  horasExtraDobles: number;
  horasExtraTriples: number;
  minutosNocturnos: number;
  jornada: string; // DIURNA | NOCTURNA | MIXTA | '—'
  fueraGeofence: string; // 'Sí (Xm)' | 'No' | 'No aplica' | 'N/A'
  status: string; // PRESENTE | AUSENTE | RETRASO | SALIDA TEMPRANO
  descansoSemanalTrabajado: string; // 'Sí' | 'No'
}

/** Sección 3 — Detalle agrupado por empleado. */
export interface DetallePorEmpleado {
  employeeId: string;
  numero: string;
  nombre: string;
  filas: FilaDetalleDiario[];
}

/** Reporte STPS completo. */
export interface StpsReport {
  generadoEn: string; // ISO timestamp de generación
  periodo: PeriodoReporte;
  patron: DatosPatron;
  trabajadores: FilaTrabajador[];
  detalle: DetallePorEmpleado[];
}

// ============================================================
// Cálculo del periodo (mensual o semanal)
// ============================================================

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Calcula el rango de fechas del periodo.
 * - Mensual: del día 1 al último día del mes indicado.
 * - Semanal: de lunes a domingo de la semana ISO indicada.
 *
 * Los límites se construyen como instantes UTC (patrón consistente
 * con el resto del sistema: `date` se almacena como UTC de medianoche
 * de Mexico City).
 */
export function computePeriodo(
  periodo: TipoPeriodo,
  anio: number,
  mes?: number,
  semana?: number
): PeriodoReporte {
  if (periodo === 'mensual') {
    if (!mes || mes < 1 || mes > 12) {
      throw new Error('mes es requerido (1-12) cuando periodo=mensual');
    }
    const startLx = DateTime.fromObject(
      { year: anio, month: mes, day: 1 },
      { zone: MEXICO_TZ }
    ).startOf('day');
    const endLx = startLx.endOf('month');
    return {
      tipo: 'mensual',
      fechaInicio: new Date(`${startLx.toFormat('yyyy-MM-dd')}T00:00:00.000Z`),
      fechaFin: new Date(`${endLx.toFormat('yyyy-MM-dd')}T23:59:59.999Z`),
      descripcion: `Mensual: ${MESES_ES[mes - 1]} ${anio}`,
    };
  }

  // Semanal (ISO week)
  if (!semana || semana < 1 || semana > 53) {
    throw new Error('semana es requerida (1-53) cuando periodo=semanal');
  }
  const startLx = DateTime.fromObject(
    { weekYear: anio, weekNumber: semana },
    { zone: MEXICO_TZ }
  ).startOf('week'); // lunes
  if (!startLx.isValid) {
    throw new Error(`Semana ISO inválida: ${semana} de ${anio}`);
  }
  const endLx = startLx.plus({ days: 6 }).endOf('day'); // domingo
  return {
    tipo: 'semanal',
    fechaInicio: new Date(`${startLx.toFormat('yyyy-MM-dd')}T00:00:00.000Z`),
    fechaFin: new Date(`${endLx.toFormat('yyyy-MM-dd')}T23:59:59.999Z`),
    descripcion: `Semanal: Semana ${semana} de ${anio} (${startLx.toFormat('dd/MM/yyyy')} al ${endLx.toFormat('dd/MM/yyyy')})`,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Distancia Haversine en metros entre dos coordenadas.
 * Usada para calcular si el check-in estuvo fuera del geofence.
 */
function haversineMeters(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371000; // radio terrestre en metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evalúa si un registro de asistencia estuvo fuera del geofence
 * de la sucursal. Devuelve un texto legible para el reporte.
 */
function evaluarGeofence(
  record: any,
  sucursal: any
): string {
  // Si la sucursal no aplica geofence, no se evalúa.
  if (!sucursal?.enforceGeofence) return 'No aplica';
  // Si no hay coordenadas de la sucursal o del check-in, no se puede calcular.
  if (
    sucursal.latitude == null ||
    sucursal.longitude == null ||
    record.checkInLat == null ||
    record.checkInLong == null
  ) {
    return 'N/A';
  }
  const distancia = haversineMeters(
    sucursal.latitude,
    sucursal.longitude,
    record.checkInLat,
    record.checkInLong
  );
  const radio = sucursal.geofenceRadiusMeters ?? 150;
  if (distancia > radio) {
    return `Sí (${distancia}m)`;
  }
  return 'No';
}

/**
 * Calcula los minutos de retardo de un check-in comparando contra
 * la hora de inicio del horario programado del empleado para ese
 * día de la semana.
 *
 * Devuelve 0 si no hay schedule, no hay check-in, o el check-in
 * fue antes de la hora de inicio (no es retardo).
 */
function calcularMinutosRetardo(
  record: any,
  schedules: any[]
): number {
  if (!record.checkInTime) return 0;
  // dayOfWeek: 0=domingo..6=sábado (luxon weekday % 7)
  const dow = DateTime.fromJSDate(record.checkInTime)
    .setZone(MEXICO_TZ).weekday % 7;
  const schedule = schedules.find(
    (s) => s.dayOfWeek === dow && !s.isWeeklyRest
  );
  if (!schedule) return 0;
  // Construir la hora programada como instante UTC en Mexico TZ
  // usando la fecha del registro (no del check-in, que es la misma).
  const fechaISO = toISODate(record.date);
  const scheduledStart = DateTime.fromFormat(
    `${fechaISO} ${schedule.startTime}`,
    'yyyy-MM-dd HH:mm',
    { zone: MEXICO_TZ }
  ).toUTC().toJSDate();
  const diffMs = record.checkInTime.getTime() - scheduledStart.getTime();
  // Solo cuenta como retardo si llegó DESPUÉS de la hora programada.
  return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
}

/**
 * Cuenta los días calendario que un Vacation aprobado aporta al
 * periodo (intersección de [startDate, endDate] con el periodo).
 * Los permisos parciales (isPartial=true) no cuentan como días
 * completos — devuelven 0.
 */
function diasVacacionEnPeriodo(
  vac: any,
  periodoStart: Date,
  periodoEnd: Date
): number {
  if (vac.isPartial) return 0;
  const vStart = new Date(vac.startDate);
  const vEnd = new Date(vac.endDate);
  const overlapStart = vStart > periodoStart ? vStart : periodoStart;
  const overlapEnd = vEnd < periodoEnd ? vEnd : periodoEnd;
  if (overlapEnd < overlapStart) return 0;
  const ms = overlapEnd.getTime() - overlapStart.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================================
// Construcción del reporte STPS
// ============================================================

/**
 * Construye el reporte STPS completo para el periodo y sucursal
 * indicados.
 *
 * @param periodo  - Periodo calculado (mensual o semanal).
 * @param sucursalId - Si es null, incluye todas las sucursales.
 */
export async function buildStpsReport(
  periodo: PeriodoReporte,
  sucursalId: string | null
): Promise<StpsReport> {
  const { fechaInicio, fechaFin } = periodo;

  // --- Datos del patrón (Company singleton) ---
  const company = await db.company.findUnique({ where: { id: 'singleton' } });
  const patron: DatosPatron = {
    razonSocial: company?.razonSocial || NO_CAPTURADO,
    rfc: company?.rfc || NO_CAPTURADO,
    registroPatronal: company?.registroPatronal || NO_CAPTURADO,
    domicilioFiscal: company?.domicilioFiscal || NO_CAPTURADO,
    representanteLegal: company?.representanteLegal || NO_CAPTURADO,
    telefono: company?.telefono || NO_CAPTURADO,
    email: company?.email || NO_CAPTURADO,
    periodo: periodo.descripcion,
  };

  // --- Empleados activos de la(s) sucursal(es) ---
  const employeesWhere: any = { isActive: true };
  if (sucursalId) employeesWhere.sucursalId = sucursalId;
  const employees = await db.employee.findMany({
    where: employeesWhere,
    include: {
      user: { select: { id: true, name: true, email: true } },
      sucursal: {
        select: {
          id: true,
          name: true,
          codigoLocal: true,
          latitude: true,
          longitude: true,
          geofenceRadiusMeters: true,
          enforceGeofence: true,
        },
      },
    },
    orderBy: [{ sucursalId: 'asc' }, { employeeNumber: 'asc' }],
  });

  if (employees.length === 0) {
    return {
      generadoEn: new Date().toISOString(),
      periodo,
      patron,
      trabajadores: [],
      detalle: [],
    };
  }

  const employeeIds = employees.map((e) => e.id);

  // --- Cargar registros, horarios, vacaciones y feriados del periodo ---
  const [records, schedules, vacations, holidays] = await Promise.all([
    db.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: fechaInicio, lte: fechaFin },
      },
      include: {
        sucursal: {
          select: {
            latitude: true,
            longitude: true,
            geofenceRadiusMeters: true,
            enforceGeofence: true,
          },
        },
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    }),
    db.workSchedule.findMany({
      where: { employeeId: { in: employeeIds } },
    }),
    db.vacation.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: fechaFin },
        endDate: { gte: fechaInicio },
      },
    }),
    db.holiday.findMany({
      where: { date: { gte: fechaInicio, lte: fechaFin } },
    }),
  ]);

  // Indexar por empleado para acceso rápido
  const recordsByEmp: Record<string, any[]> = {};
  for (const r of records) {
    if (!recordsByEmp[r.employeeId]) recordsByEmp[r.employeeId] = [];
    recordsByEmp[r.employeeId].push(r);
  }
  const schedulesByEmp: Record<string, any[]> = {};
  for (const s of schedules) {
    if (!schedulesByEmp[s.employeeId]) schedulesByEmp[s.employeeId] = [];
    schedulesByEmp[s.employeeId].push(s);
  }
  const vacationsByEmp: Record<string, any[]> = {};
  for (const v of vacations) {
    if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
    vacationsByEmp[v.employeeId].push(v);
  }

  // Enumerar los días del periodo (en Mexico TZ) para cómputo de
  // inasistencias con la lógica unificada de absence-calculator.
  // Solo se cuentan inasistencias hasta HOY (no se pueden contar
  // como falta días que aún no ocurrieron). Si el periodo es del
  // pasado, se cuenta el periodo completo.
  const startLx = DateTime.fromMillis(fechaInicio.getTime()).setZone(MEXICO_TZ).startOf('day');
  const endLx = DateTime.fromMillis(fechaFin.getTime()).setZone(MEXICO_TZ).startOf('day');
  const todayLx = DateTime.now().setZone(MEXICO_TZ).startOf('day');
  const endAusenciasLx = endLx < todayLx ? endLx : todayLx;
  const diasPeriodo: DateTime[] = [];
  let cursor = startLx;
  while (cursor <= endAusenciasLx) {
    diasPeriodo.push(cursor);
    cursor = cursor.plus({ days: 1 });
  }

  // --- Construir catálogo de trabajadores (Sección 2) ---
  const trabajadores: FilaTrabajador[] = [];
  const detalle: DetallePorEmpleado[] = [];

  for (const emp of employees) {
    const empRecords = recordsByEmp[emp.id] || [];
    const empSchedules = schedulesByEmp[emp.id] || [];
    const empVacations = vacationsByEmp[emp.id] || [];

    // --- Métricas agregadas del periodo ---
    let diasTrabajados = 0;
    let totalWorkedMin = 0;
    let totalDoubleMin = 0;
    let totalTripleMin = 0;
    let totalNightMin = 0;
    let diasDescansoTrabajados = 0;
    let diasLlegoTarde = 0;
    let diasSalioTemprano = 0;
    let totalRetardosMin = 0;

    for (const r of empRecords) {
      // Día trabajado = tuvo check-in (no importa si LATE o EARLY_LEAVE)
      if (r.checkInTime) diasTrabajados += 1;
      totalWorkedMin += r.workedMinutes ?? 0;
      totalDoubleMin += r.overtimeDoubleMinutes ?? 0;
      totalTripleMin += r.overtimeTripleMinutes ?? 0;
      totalNightMin += r.nightMinutes ?? 0;
      if (r.isRestDayWorked) diasDescansoTrabajados += 1;
      if (r.status === 'LATE') {
        diasLlegoTarde += 1;
        totalRetardosMin += calcularMinutosRetardo(r, empSchedules);
      }
      if (r.status === 'EARLY_LEAVE') diasSalioTemprano += 1;
    }

    // --- Días de vacaciones y permisos en el periodo ---
    let diasVacaciones = 0;
    let diasPermiso = 0;
    for (const v of empVacations) {
      const d = diasVacacionEnPeriodo(v, fechaInicio, fechaFin);
      if (v.type === 'VACACIONES') diasVacaciones += d;
      else if (v.type === 'PERMISO') diasPermiso += d;
    }

    // --- Días que faltó sin justificar (cómputo dinámico) ---
    // Se usa la lógica unificada de absence-calculator, que ya
    // excluye feriados, vacaciones y días de descanso.
    let diasFaltaSinJustificar = 0;
    for (const dayLx of diasPeriodo) {
      const dayDate = dayLx.toUTC().toJSDate();
      const dow = dayLx.weekday % 7; // 0=domingo..6=sábado
      const result = isAbsentOnDate(dayDate, {
        employee: { id: emp.id, isActive: emp.isActive },
        schedules: empSchedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          isWeeklyRest: s.isWeeklyRest,
        })),
        records: empRecords,
        vacations: empVacations,
        holidays,
      });
      if (result.absent) diasFaltaSinJustificar += 1;
    }

    // RFC y CURP: ahora se leen del modelo Employee. Si el campo
    // está vacío (empleado viejo sin capturar), se marca como
    // NO CAPTURADO — el reporte se genera igual (Cambio D).
    trabajadores.push({
      employeeId: emp.id,
      numeroEmpleado: emp.employeeNumber,
      nombreCompleto: emp.user.name,
      rfc: emp.rfc || NO_CAPTURADO,
      curp: emp.curp || NO_CAPTURADO,
      puesto: emp.position || NO_CAPTURADO,
      departamento: emp.department || NO_CAPTURADO,
      sucursal: emp.sucursal.codigoLocal
        ? `${emp.sucursal.codigoLocal} — ${emp.sucursal.name}`
        : emp.sucursal.name,
      salarioBase:
        emp.baseSalary != null
          ? `$${emp.baseSalary.toFixed(2)} MXN`
          : NO_CAPTURADO,
      diasTrabajados,
      totalHorasTrabajadas: minutesToHours(totalWorkedMin),
      totalHorasExtraDobles: minutesToHours(totalDoubleMin),
      totalHorasExtraTriples: minutesToHours(totalTripleMin),
      totalMinutosNocturnos: totalNightMin,
      diasDescansoTrabajados,
      diasVacacionesDisfrutados: diasVacaciones,
      diasFaltaSinJustificar,
      diasLlegoTarde,
      diasSalioTemprano,
      totalRetardosMin,
      diasPermiso,
    });

    // --- Sección 3: detalle diario por trabajador ---
    const filas: FilaDetalleDiario[] = empRecords.map((r) => ({
      fecha: toISODate(r.date),
      entrada: r.checkInTime ? formatTimeInMexico(r.checkInTime) : '—',
      salida: r.checkOutTime ? formatTimeInMexico(r.checkOutTime) : '—',
      tiempoComidaMin: r.mealDurationMinutes ?? '—',
      totalHorasDia: minutesToHours(r.workedMinutes ?? 0),
      horasExtraDobles: minutesToHours(r.overtimeDoubleMinutes ?? 0),
      horasExtraTriples: minutesToHours(r.overtimeTripleMinutes ?? 0),
      minutosNocturnos: r.nightMinutes ?? 0,
      jornada: r.shiftType || '—',
      fueraGeofence: evaluarGeofence(r, r.sucursal),
      status: r.status,
      descansoSemanalTrabajado: r.isRestDayWorked ? 'Sí' : 'No',
    }));

    detalle.push({
      employeeId: emp.id,
      numero: emp.employeeNumber,
      nombre: emp.user.name,
      filas,
    });
  }

  return {
    generadoEn: new Date().toISOString(),
    periodo,
    patron,
    trabajadores,
    detalle,
  };
}
