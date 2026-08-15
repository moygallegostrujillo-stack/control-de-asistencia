// ============================================================
// src/lib/vacation-calculator.ts
//   Utilidades de cálculo de vacaciones y prima vacacional (LFT).
//
//   Cumple con:
//     - art. 76 LFT: días de vacaciones por año de servicio (tabla progresiva).
//     - art. 80 LFT: prima vacacional mínima del 25% sobre el salario.
//     - art. 81 LFT: caducidad del derecho (referencia para未来的 vencimiento).
//
//   RT-P0.13 (auditoría 14-ago-2026): implementación inicial.
//   Estas funciones no existían en el sistema. Antes los saldos de vacaciones
//   se cargaban manualmente vía /api/vacations/bulk-load sin accrual automático,
//   y la prima vacacional NO se calculaba en ningún lado.
// ============================================================

/**
 * Tabla del art. 76 LFT (reformada 2012, vigente desde 2013):
 *   Año 1 → 12 días
 *   Año 2 → 14 días
 *   Año 3 → 16 días
 *   Año 4 → 18 días
 *   Año 5 → 20 días
 *   Años 6 al 10 → aumentan en 2 días cada año (22, 24, 26, 28, 30)
 *   Años 11 al 15 → aumentan en 2 días cada año (32, 34, 36, 38, 40)
 *   ... y así sucesivamente, +2 días por cada año adicional.
 *
 * Fuente legal: art. 76 LFT (texto vigente post-reforma 2012).
 *
 * @param yearsOfService - Años completos de servicio (entero >= 0).
 * @returns Días de vacaciones que corresponden al año indicado. 0 si < 1 año.
 */
export function accrualByYearsOfService(yearsOfService: number): number {
  if (!Number.isFinite(yearsOfService) || yearsOfService < 1) {
    return 0;
  }
  const years = Math.floor(yearsOfService);
  if (years <= 0) return 0;
  if (years === 1) return 12;
  if (years === 2) return 14;
  if (years === 3) return 16;
  if (years === 4) return 18;
  if (years === 5) return 20;
  // A partir del año 6, aumentan 2 días por cada año adicional.
  // Año 6 → 22, año 7 → 24, ..., año 10 → 30, año 11 → 32, etc.
  return 20 + (years - 5) * 2;
}

/**
 * Calcula los años completos de servicio entre la fecha de ingreso y una
 * fecha de referencia (por defecto, hoy).
 *
 * @param hireDate - Fecha de ingreso del empleado.
 * @param asOf - Fecha de referencia (default: ahora).
 * @returns Años completos (entero >= 0). 0 si aún no cumple 1 año.
 */
export function computeYearsOfService(
  hireDate: Date,
  asOf: Date = new Date()
): number {
  if (!hireDate || !asOf || hireDate > asOf) return 0;
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000; // año juliano (con bisiesto)
  const diffMs = asOf.getTime() - hireDate.getTime();
  const years = Math.floor(diffMs / msPerYear);
  return Math.max(0, years);
}

/**
 * Calcula los días de vacaciones que le corresponden a un empleado según
 * su fecha de ingreso y una fecha de referencia.
 *
 * Wrapper conveniente que combina `computeYearsOfService` + `accrualByYearsOfService`.
 *
 * @param hireDate - Fecha de ingreso del empleado.
 * @param asOf - Fecha de referencia (default: ahora).
 * @returns Días de vacaciones correspondientes al año de servicio actual.
 */
export function computeVacationDays(
  hireDate: Date,
  asOf: Date = new Date()
): number {
  const years = computeYearsOfService(hireDate, asOf);
  return accrualByYearsOfService(years);
}

/**
 * Calcula la prima vacacional (LFT art. 80).
 *
 * Fórmula:
 *   primaVacacional = díasVacaciones × salarioDiario × tasa
 *
 * donde:
 *   - díasVacaciones: días de vacaciones que se van a disfrutar.
 *   - salarioDiario: salario diario del empleado (baseSalary / 30, o el
 *     salario integrado si se quiere calcular sobre CSD).
 *   - tasa: 0.25 (mínimo legal del 25%). Puede ser mayor si la empresa
 *     otorga una prima más alta por contrato colectivo o política interna.
 *
 * @param vacationDays - Días de vacaciones que se van a disfrutar.
 * @param dailySalary - Salario diario del empleado.
 * @param rate - Tasa de la prima (default 0.25, mínimo legal art. 80 LFT).
 * @returns Monto de la prima vacacional (en la misma unidad que dailySalary).
 */
export function computePrimaVacacional(
  vacationDays: number,
  dailySalary: number,
  rate: number = 0.25
): number {
  if (!Number.isFinite(vacationDays) || vacationDays < 0) return 0;
  if (!Number.isFinite(dailySalary) || dailySalary < 0) return 0;
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return vacationDays * dailySalary * rate;
}

/**
 * Calcula el salario diario a partir del salario mensual.
 *
 * Por convención mexicana (art. 60 LFT, jurisprudencia), el salario diario
 * se calcula dividiendo el salario mensual entre 30 días (mes comercial),
 * independientemente del número real de días del mes.
 *
 * @param monthlySalary - Salario mensual bruto.
 * @returns Salario diario (= monthlySalary / 30).
 */
export function computeDailySalary(monthlySalary: number): number {
  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) return 0;
  return monthlySalary / 30;
}

/**
 * Resultado completo del cálculo vacacional para un empleado.
 */
export interface VacationAccrualResult {
  yearsOfService: number;
  vacationDays: number;
  dailySalary: number;
  primaVacacional: number;
  primaVacacionalRate: number;
  legalReference: string;
}

/**
 * Calcula todo lo relacionado con vacaciones y prima vacacional para un
 * empleado, en una sola llamada.
 *
 * @param hireDate - Fecha de ingreso del empleado.
 * @param monthlySalary - Salario mensual bruto (opcional; si no se pasa, no se calcula prima).
 * @param asOf - Fecha de referencia (default: ahora).
 * @param primaRate - Tasa de la prima vacacional (default 0.25, mínimo legal art. 80 LFT).
 * @returns Objeto con años de servicio, días de vacaciones, prima vacacional, etc.
 */
export function computeVacationAccrual(
  hireDate: Date,
  monthlySalary?: number | null,
  asOf: Date = new Date(),
  primaRate: number = 0.25
): VacationAccrualResult {
  const yearsOfService = computeYearsOfService(hireDate, asOf);
  const vacationDays = accrualByYearsOfService(yearsOfService);
  const dailySalary =
    monthlySalary && monthlySalary > 0 ? computeDailySalary(monthlySalary) : 0;
  const primaVacacional = computePrimaVacacional(
    vacationDays,
    dailySalary,
    primaRate
  );
  return {
    yearsOfService,
    vacationDays,
    dailySalary,
    primaVacacional,
    primaVacacionalRate: primaRate,
    legalReference:
      'LFT art. 76 (vacaciones por antigüedad); art. 80 (prima vacacional mínima 25%)',
  };
}

/**
 * Valida que la duración de una incapacidad de maternidad no exceda
 * las 12 semanas (84 días naturales) establecidas por el art. 101 LSS.
 *
 * @param days - Días naturales de la incapacidad.
 * @returns `null` si OK, o un mensaje de error si excede el límite.
 */
export function validateMaternidadDuration(days: number): string | null {
  const MAX_MATERNIDAD_DAYS = 84; // 12 semanas × 7 días = 84 días (LSS art. 101)
  if (!Number.isFinite(days) || days <= 0) {
    return 'La duración de la maternidad debe ser mayor a 0 días.';
  }
  if (days > MAX_MATERNIDAD_DAYS) {
    return `La maternidad excede las 12 semanas (${MAX_MATERNIDAD_DAYS} días) establecidas por el art. 101 LSS.`;
  }
  return null;
}

/**
 * Valida que la duración de un permiso de paternidad no exceda
 * los 5 días establecidos por el art. 132 Bis LFT.
 *
 * @param days - Días naturales del permiso.
 * @returns `null` si OK, o un mensaje de error si excede el límite.
 */
export function validatePaternidadDuration(days: number): string | null {
  const MAX_PATERNIDAD_DAYS = 5; // art. 132 Bis LFT
  if (!Number.isFinite(days) || days <= 0) {
    return 'La duración del permiso de paternidad debe ser mayor a 0 días.';
  }
  if (days > MAX_PATERNIDAD_DAYS) {
    return `El permiso de paternidad excede los ${MAX_PATERNIDAD_DAYS} días establecidos por el art. 132 Bis LFT.`;
  }
  return null;
}
