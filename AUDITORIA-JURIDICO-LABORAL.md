# AUDITORÍA JURÍDICO-LABORAL EXHAUSTIVA
## Sistema de Control de Asistencia NOM-037 — México

> **Documento**: Auditoría integral de cumplimiento normativo
> **Fecha**: 14 de agosto de 2026
> **Versión del producto auditado**: 2.3.0
> **Repo**: `control-de-asistencia` (commit `200d595` + local `db22cc0`)
> **URL producción**: https://control-asistencia-v22.vercel.app/
> **Auditor**: Arquitecto de cumplimiento normativo mexicano (Z.ai Code)
> **Alcance**: Código fuente, schemas de base de datos, endpoints API, lógica de negocio, reportes, UI y documentación legal interna
> **Método**: Lectura estática exhaustiva de 178 archivos fuente, sin ejecución ni modificación

---

## ÍNDICE

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Marco jurídico aplicable](#2-marco-jurídico-aplicable)
3. [Jornada laboral semanal — reducción gradual 2026–2030](#3-jornada-laboral-semanal--reducción-gradual-20262030)
4. [Jornada diaria máxima y clasificación (DIURNA/NOCTURNA/MIXTA)](#4-jornada-diaria-máxima-y-clasificación-diurnanocturnamixta)
5. [Horas extra dobles — art. 66 LFT](#5-horas-extra-dobles--art-66-lft)
6. [Horas extra triples — art. 68 LFT](#6-horas-extra-triples--art-68-lft)
7. [Prima por descanso trabajado — art. 73 LFT](#7-prima-por-descanso-trabajado--art-73-lft)
8. [Prima dominical — art. 71 LFT](#8-prima-dominical--art-71-lft)
9. [Prima nocturna — art. 61 LFT](#9-prima-nocturna--art-61-lft)
10. [Vacaciones — arts. 76, 78, 81 LFT](#10-vacaciones--arts-76-78-81-lft)
11. [Prima vacacional — art. 80 LFT](#11-prima-vacacional--art-80-lft)
12. [Incapacidades IMSS — arts. 42, 96, 101 LSS](#12-incapacidades-imss--arts-42-96-101-lss)
13. [Riesgos de trabajo — arts. 41, 51 LSS (ST-7)](#13-riesgos-de-trabajo--arts-41-51-lss-st-7)
14. [Registro electrónico de jornada — art. 132 XXXIV LFT (entra 1/1/2027)](#14-registro-electrónico-de-jornada--art-132-xxxiv-lft-entra-112027)
15. [Trazabilidad, inmutabilidad y prueba plena](#15-trazabilidad-inmutabilidad-y-prueba-plena)
16. [Geolocalización y privacidad](#16-geolocalización-y-privacidad)
17. [Derechos ARCO y Aviso de Privacidad — LFPDPPP](#17-derechos-arco-y-aviso-de-privacidad--lfpdppp)
18. [Reportes oficiales — art. 804 LFT, art. 15 LSS](#18-reportes-oficiales--art-804-lft-art-15-lss)
19. [NOM-035-STPS-2018 — factores de riesgo psicosocial](#19-nom-035-stps-2018--factores-de-riesgo-psicosocial)
20. [NOM-037-STPS-2023 — teletrabajo](#20-nom-037-stps-2023--teletrabajo)
21. [Tabla consolidada de hallazgos clasificados](#21-tabla-consolidada-de-hallazgos-clasificados)
22. [Requisitos técnicos concretos para el desarrollador](#22-requisitos-técnicos-concretos-para-el-desarrollador)
23. [Interrogatorio al código — 36 preguntas](#23-interrogatorio-al-código--36-preguntas)
24. [Conclusión final — cambios indispensables antes del 1 de enero de 2027](#24-conclusión-final--cambios-indispensables-antes-del-1-de-enero-de-2027)

---

## 1. Resumen ejecutivo

El sistema auditado es una aplicación **Next.js 16** desplegada en Vercel con base de datos PostgreSQL en Supabase, que gestiona control de asistencia geolocalizado, cálculo de horas extra con la reforma LFT 2027, vacaciones/incapacidades, generación de reportes oficiales (STPS art. 804 LFT, IMSS art. 15 LSS) y alertas NOM-035.

### Cumplimiento global por dimensión

| Dimensión | Cumplimiento | Hallazgos críticos |
|-----------|-------------:|-------------------:|
| LFT — Jornada & overtime (arts. 60, 61, 66, 68, 71, 73) | 70 % | 4 🔴 |
| LFT — Vacaciones & prima (arts. 76, 78, 80, 81) | 35 % | 2 🔴 |
| LSS — Incapacidades & riesgos (arts. 42, 51, 96, 101, 15) | 60 % | 1 🔴 |
| LFT art. 132 XXXIV — Registro electrónico & prueba plena | 40 % | 3 🔴 |
| LFPDPPP — Privacidad & ARCO | 70 % | 2 🔴 |
| LFT art. 804 — Reporte STPS | 85 % | 0 🔴, 1 🟠 |
| NOM-035-STPS-2018 | 25 % | 3 🔴 |
| NOM-037-STPS-2023 | 5 % | 3 🔴 |
| Seguridad (auth, RBAC, MFA) | 80 % | 1 🔴 |

### Hallazgos por severidad

| Severidad | Cantidad | Descripción |
|-----------|---------:|-------------|
| 🔴 CRÍTICO | **15** | Incumplimiento legal directo; riesgo de sanción STPS/INAI o de juicio laboral perdido. **Bloquean entrada en vigor 1/1/2027.** |
| 🟠 ALTO | **8** | Incumplimiento parcial o bug funcional con impacto legal. |
| 🟡 MEDIO | **17** | Mejora necesaria; debilita la prueba o la trazabilidad. |
| 🟢 BAJO | **11** | Inconsistencia documental, cita legal imprecisa, deuda técnica. |
| ⚪ FUERA DE ALCANCE | **4** | Decisiones de diseño que asumen procesos externos (nómina). |

**Total: 55 hallazgos** identificados mediante lectura estática del código, sin acceso a la base de datos productiva ni a logs de auditoría.

### Riesgo legal agregado

El sistema, en su estado actual, **NO puede demostrar jurídicamente** cumplimiento pleno del art. 132 XXXIV LFT (registro electrónico de jornada) a partir del 1 de enero de 2027, por tres razones estructurales:

1. **No existe el "acuerdo" formal patrón-trabajador** que la LFT exige para que el registro electrónico haga "prueba plena" (inciso A.8, B.1).
2. **No existe UI que permita al trabajador firmar sus registros** — el endpoint `/api/attendance/sign` está implementado en backend pero es código muerto desde el front-end (inciso A.7).
3. **El AuditLog no es tamper-evident** (sin hash chaining) y el PDF STPS no incluye el hash de firma del trabajador, con lo que la prueba ante una Junta de Conciliación es frágil (incisos A.10, B.4).

Adicionalmente, hay **4 bugs de cálculo** que producirán errores de pago a partir de 2028 (tope semanal de overtime mal escalado) o sobrepago inmediato (detección errónea de descanso trabajado en días no programados).

---

## 2. Marco jurídico aplicable

| Norma | Materia | Vigencia | Artículos relevantes |
|-------|---------|----------|----------------------|
| **Constitución Política de los Estados Unidos Mexicanos** | Laboral | Vigente | Art. 123 Apartado A (jornada máxima 8 h, descanso semanal, salario mínimo, prima dominical) |
| **Ley Federal del Trabajo (LFT)** | Laboral | Reformada por **DOF 27-dic-2024** (no 1-may-2026 como el código cita erróneamente) | Arts. 60 (jornada diurna/nocturna/mixta), 61 (jornadas máximas), 62 (límites diarios), 66 (HE dobles, tope 9 h/semana, 4 h/día), 68 (HE triples), 71 (prima dominical 25 %), 73 (descanso trabajado, prima 100 %), 76 (vacaciones por antigüedad), 78 (toma de vacaciones), 80 (prima vacacional 25 %), 81 (caducidad), 132 XXXIV (registro electrónico), 132 Bis (paternidad 5 días), 170 (maternidad LFT), 804 (registro de asistencia — 12 meses) |
| **Ley del Seguro Social (LSS)** | Seguridad Social | Vigente | Arts. 15 (obligación de registrar movimientos afiliatorios, 5 años), 41 (riesgos de trabajo), 42 (ramo de seguros), 51 (incapacidad por RT), 96 (enfermedad general, 52 semanas al 60 %), 101 (maternidad, 12 semanas al 100 %) |
| **NOM-035-STPS-2018** | Riesgos psicosociales | Vigente desde 23-oct-2019 | Identificación de factores psicosociales, encuesta, política de prevención, categorías A/B/C/D |
| **NOM-037-STPS-2023** | Teletrabajo | Vigente desde 4-ene-2024 | Acuerdo de teletrabajo, provisión de equipo, reembolso de costos, derecho a la desconexión, art. 30 |
| **LFPDPPP** | Protección de datos | Vigente | Arts. 9 (consentimiento), 16 (aviso de privacidad), 17 (consentimiento expreso), 29-32 (derechos ARCO), 31 (cancelación), 100 (plazo respuesta 20 días hábiles) |
| **Decreto DOF 27-dic-2024** | Reducción gradual de jornada | Vigente desde 1-ene-2025; reducción inicia 2027 | Transitorios: 2026→48 h, 2027→46 h, 2028→44 h, 2029→42 h, 2030→40 h semanales |

### ⚠️ Cita legal incorrecta en 6 lugares del código

El código cita `"DOF 1-may-2026"` como fecha del decreto de reforma LFT. La fecha correcta es **DOF 27-dic-2024**. Aparece en:

- `src/lib/overtime-calculator.ts:60`
- `src/app/api/attendance/check-out/route.ts:253`
- `src/app/api/alerts/nom-035/route.ts:8`
- `documentos/cumplimiento-lft-2027.md:6`
- `documentos/cumplimiento-lft-2027.md:93`
- `documentos/cumplimiento-lft-2027.md:332`

**Hallazgo H-1.B (CRÍTICO)**: La cita errónea de la fecha de publicación del decreto debilita la credibilidad probatoria del sistema ante una inspección. Debe corregirse en los 6 lugares.

---

## 3. Jornada laboral semanal — reducción gradual 2026–2030

### Obligación legal

El art. 61 LFT (texto reformado DOF 27-dic-2024, vigente desde 1-ene-2025) reduce progresivamente la **jornada semanal máxima**:

| Año | Jornada semanal máxima | Disminución |
|-----|------------------------|-------------|
| 2025–2026 | 48 h | — |
| 2027 | 46 h | −2 h |
| 2028 | 44 h | −2 h |
| 2029 | 42 h | −2 h |
| 2030 en adelante | 40 h | −2 h |

La jornada **diaria** máxima se mantiene en 8 h diurnas, 7 h nocturnas o 7.5 h mixtas (art. 61 LFT no reformado en su porción diaria).

### Estado del sistema

**🔴 H-3.A (CRÍTICO)** — **No existe ningún campo, constante, función o UI que defina o valide el tope semanal de jornada.**

Evidencia:

- `prisma/schema.prisma:208-219` (modelo `WorkSchedule`) — NO contiene campo `weeklyHourLimit`, `annualWeeklyHourCap`, ni tabla `JornadaConfig { year, maxWeeklyHours }`.
- `src/lib/work-schedule.ts:35-70` — `validateWorkSchedules()` solo valida: array no vacío, al menos 1 día de descanso (art. 71), `dayOfWeek ∈ [0,6]`, formato `HH:mm`, sin duplicados. **No suma horas semanales.**
- `src/app/api/employees/route.ts:278-282` y `src/app/api/employees/[id]/route.ts:164-169` — solo invocan `validateWorkSchedules()`.
- `src/components/layout/admin-layout.tsx:244-311` (`ScheduleEditor`) — no muestra contador de horas semanales.

**Consecuencia legal**: El sistema permite configurar horarios semanales que violan el art. 61 LFT (ej. L-S 9-19 = 54 h semanales, ilegal en cualquier año). Para 2027 esto será sancionable por la STPS.

### Requisito técnico

| Req | Descripción |
|-----|-------------|
| **RT-3.1** | Crear tabla `JornadaConfig { year Int @id, maxWeeklyHours Int }` con seed: 2026→48, 2027→46, 2028→44, 2029→42, 2030→40. |
| **RT-3.2** | En `validateWorkSchedules()`, sumar `(endTime − startTime)` por día laboral y comparar contra `maxWeeklyHours` del año actual. Rechazar con error explícito si excede. |
| **RT-3.3** | En `ScheduleEditor` (UI), mostrar contador "Xh / Yh semanales" con semáforo (verde/ámbar/rojo) cuando se edita el horario de un empleado. |
| **RT-3.4** | Crear endpoint `GET /api/jornada-config` que devuelva el tope del año actual, para que el front-end lo consuma dinámicamente. |

---

## 4. Jornada diaria máxima y clasificación (DIURNA/NOCTURNA/MIXTA)

### Obligación legal

Art. 60 y 61 LFT:
- **Diurna**: 6:00–20:00, máximo 8 h/día.
- **Nocturna**: 20:00–6:00, máximo 7 h/día.
- **Mixta**: combina períodos diurnos y nocturnos, máximo 7.5 h/día. Se reputa nocturna si el período nocturno es **igual o mayor a 3.5 horas** (art. 60 LFT).

### Estado del sistema

**🟢 Cumple** — `src/lib/shift-classifier.ts:42-163`:

- `NIGHT_SHIFT_THRESHOLD_MINUTES = 210` (3.5 h exactas → NOCTURNA). Interpretación correcta de "igual o mayor".
- `nightMinutesBetween(checkIn, checkOut)` itera días calendario y suma el solapamiento con la ventana `[20:00, 06:00 next day]`, usando Luxon con `America/Mexico_City`. Safety limit 7 días.
- `getLegalMaxMinutes(shiftType)` retorna `480 / 420 / 450` según DIURNA/NOCTURNA/MIXTA. **Correcto per art. 61 LFT.**

**🟡 H-4.A (MEDIO)** — El umbral "shift ≥ 8h" para habilitar comida está hardcoded en `meal-start/route.ts:19` y `rest-start/route.ts:18` (`const MIN_SHIFT_MINUTES = 8 * 60;`). Esto impide registrar comida en jornadas NOCTURNA (7 h) o MIXTA (7.5 h) de jornada completa legal.

**Requisito técnico**: usar `getLegalMaxMinutes(shiftType)` en lugar de `8 * 60`.

---

## 5. Horas extra dobles — art. 66 LFT

### Obligación legal

- Las primeras 9 horas extra a la semana se pagan al **200 %** (dobles).
- Tope diario: 4 horas extra.
- El excedente sobre 4 h/día no se paga como extra (es jornada no autorizada).

### Estado del sistema

**🟢 Cumple parcialmente** — `src/lib/overtime-calculator.ts`:

- `DAILY_OVERTIME_CAP_MINUTES = 4 * 60` (línea 74). **Correcto per art. 66.**
- `computeWeeklyAccumulatedOvertime(employeeId, recordDate, fetchRecords)` (líneas 366-386) suma `overtimeDoubleMinutes + overtimeTripleMinutes` de registros previos de la misma semana (lun-ayer).

**🔴 H-5.A (CRÍTICO)** — **`getWeeklyOvertimeCapMinutes(year)` escala incorrectamente 9→10→11→12 h entre 2027 y 2030.**

`src/lib/overtime-calculator.ts:66-71`:
```ts
export function getWeeklyOvertimeCapMinutes(year: number = new Date().getFullYear()): number {
  if (year <= 2027) return 9 * 60;   // 540 min
  if (year === 2028) return 10 * 60; // 600 min
  if (year === 2029) return 11 * 60; // 660 min
  return 12 * 60;                     // 720 min (2030+)
}
```

**El art. 66 LFT es fijo en 9 horas extra semanales.** La reforma DOF 27-dic-2024 **no** modifica el art. 66. La reducción gradual (48→46→44→42→40 h) aplica a la **jornada ordinaria semanal** (art. 61), no al tope de overtime. La interpretación del código de que "al reducirse la jornada ordinaria se libera espacio para más overtime" **no está en la ley**.

**Impacto**: A partir de 2028 el sistema permitirá registrar como "dobles" horas que legalmente deberían pagarse al **triple** (art. 68 LFT). El empleado recibiría menos pago del que la ley exige. **Riesgo laboral y sanción administrativa.**

**Requisito técnico**:
```ts
export function getWeeklyOvertimeCapMinutes(_year?: number): number {
  return 9 * 60; // art. 66 LFT — tope semanal fijo de 9 horas.
}
```

**🟡 H-5.B (MEDIO)** — El excedente sobre 4 h/día se descarta silenciosamente sin persistirse ni reportarse. `overtime-calculator.ts:271`: `const overtimeDaily = Math.min(overtimeMinutes, DAILY_OVERTIME_CAP_MINUTES);`. La alerta NOM-035 (`/api/alerts/nom-035/route.ts:196-212`) dispara `DAILY_OVERTIME_EXCEEDED` cuando `maxDailyOvertimeMinutes > 240`, pero los minutos >240 no se acumulan a `overtimeWeeklyTotal`.

**Requisito técnico**: añadir campo `overtimeExcessMinutes` para trazabilidad del excedente >4 h/día, aunque no se pague.

---

## 6. Horas extra triples — art. 68 LFT

### Obligación legal

El excedente sobre las 9 h semanales se paga al **300 %** (triples).

### Estado del sistema

**🟢 Cumple en arquitectura** — La distribución dobles/triples se calcula en `overtime-calculator.ts:159-185` y se persiste en `AttendanceRecord.overtimeDoubleMinutes` y `AttendanceRecord.overtimeTripleMinutes`.

**🔴 H-5.A (CRÍTICO, heredado)** — Por el bug del `getWeeklyOvertimeCapMinutes` escalado, a partir de 2028 el sistema sub-pagará triples (ver sección 5).

**🟡 H-6.A (MEDIO)** — `computeWeeklyAccumulatedOvertime` mezcla `setHours(0,0,0,0)` (server TZ, UTC en Vercel) con Luxon. `overtime-calculator.ts:373-382`:
```ts
const monday = new Date(recordDate);
monday.setHours(0, 0, 0, 0);  // ← server TZ (UTC en Vercel)
```
En la práctica funciona porque `recordDate` se persiste como medianoche Mexico City, pero el patrón es frágil y rompe con cualquier cambio de TZ del servidor.

**Requisito técnico**: usar `DateTime.fromJSDate(recordDate).setZone(MEXICO_TZ).startOf('day')`.

**🟡 H-6.B (MEDIO)** — `overtimeWeeklyAccumulated` se persiste estáticamente y se vuelve stale tras correcciones. Si se corrige el check-out de un día previo, los registros de días posteriores **NO recalculan automáticamente** su `overtimeWeeklyAccumulated`. El admin debe invocar manualmente `POST /api/admin/recalc-overtime`. No hay job programado ni trigger.

**Requisito técnico**: al corregir un `AttendanceRecord`, lanzar job asíncrono que recalcule overtime/shift de los días posteriores de la misma semana.

---

## 7. Prima por descanso trabajado — art. 73 LFT

### Obligación legal

Si el empleado labora en su día de descanso semanal, se paga con **prima del 100 %** adicional (salario doble por el día completo). No se considera overtime (art. 66/68).

### Estado del sistema

**🟢 Cumple en fórmula** — `overtime-calculator.ts:175`: `restDayPremiumMinutes = netWorkedMinutes`. Implementación literal del art. 73 (1× ordinario + 1× prima = 2× total).

**🔴 H-7.A (CRÍTICO)** — **`isRestDayWorked` se dispara también para días NO programados (no descanso).**

`src/lib/overtime-calculator.ts:155`:
```ts
const isRestDayWorked = schedule === null || (schedule?.isWeeklyRest === true);
```

`schedule === null` ocurre en DOS casos distintos:
1. El día está marcado como descanso (`isWeeklyRest=true`) — caso legítimo del art. 73.
2. El día simplemente no está configurado (ausencia de fila en `WorkSchedule`) — **NO** es descanso semanal.

El código trata ambos idénticamente: si un empleado registra entrada un día no programado (ej. sábado no configurado), todos sus minutos se marcan como `restDayWorkedMinutes` con prima del 100 %. **Esto genera sobrepago injustificado.**

El check-out en vivo no distingue: `src/app/api/attendance/check-out/route.ts:116` pasa solo `findScheduleForDate(...)` que excluye `isWeeklyRest=true`. El `recalc-overtime/route.ts:151-153` sí lo hace correctamente usando `findRestScheduleForDate`.

**Requisito técnico**:
```ts
// En check-out/route.ts:116
const restSchedule = findRestScheduleForDate(record.employee.workSchedules, record.date);
const workSchedule = findScheduleForDate(record.employee.workSchedules, record.date);
const schedule = restSchedule || workSchedule;
const isRestDayWorkedExplicit = restSchedule !== null;
// Pasar isRestDayWorkedExplicit a calculateOvertime como input.
```

---

## 8. Prima dominical — art. 71 LFT

### Obligación legal

Los trabajadores que presten sus servicios en día domingo tendrán derecho a una prima adicional del **25 %** sobre el salario del día, **siempre que el día de descanso semanal sea en domingo**.

### Estado del sistema

**🔴 H-8.A (CRÍTICO)** — **El monto de la prima dominical del 25 % NO se calcula.** El sistema solo registra el flag `isSunday` y el conteo `domingosTrabajados`. El cálculo monetario se delega a nómina externa.

**🟡 H-8.B (MEDIO)** — `isSunday` se basa en `record.date` (fecha de check-in), no en los minutos realmente trabajados en domingo. Si un empleado entra el sábado a las 23:00 y sale el domingo a las 07:00, `record.date` es sábado → `isSunday=false`. Sin embargo, 7 de las 8 horas trabajadas son en domingo.

**Requisito técnico**: usar `nightMinutesBetween`-style con ventana `[00:00-domingo, 23:59-domingo]` y persistir `sundayMinutes`.

**🟡 H-8.C (MEDIO)** — `isSunday` se marca para cualquier domingo trabajado, no solo si domingo es el día de descanso semanal del empleado. La interpretación estricta del art. 71 requiere que domingo sea el descanso. Si el descanso es otro día y el empleado trabaja domingo, aplicaría art. 73 (prima 100 %), no art. 71 (prima 25 %).

---

## 9. Prima nocturna — art. 61 LFT

### Obligación legal

Las horas de la jornada nocturna se pagan con una prima del **25 %** sobre el salario de las horas diurnas (jurisprudencia, no texto expreso del art. 61).

### Estado del sistema

**🟡 H-9.A (MEDIO, decisión de diseño)** — El sistema solo registra `nightMinutes` y `shiftType`. El cálculo monetario `nightMinutes × 0.25 × hourlyRate` se delega al sistema externo de nómina. El comentario explícito en `check-out/route.ts:218-220` lo reconoce:

```ts
nightPremiumNote: (calc.shiftType === 'NOCTURNA' || calc.shiftType === 'MIXTA') && calc.nightMinutes > 0
  ? `Jornada ${calc.shiftType}: ${Math.round(calc.nightMinutes)} min nocturnos. Aplica prima nocturna 25% (art. 61 LFT + jurisprudencia) — calculada por nómina.`
  : undefined,
```

**⚪ FUERA DE ALCANCE** si el cliente confirma que la nómina externa computa este monto. **Requisito técnico** si se desea cálculo en-sistema: añadir campos `nightPremiumAmount`, `sundayPremiumAmount` a `AttendanceRecord` y calcularlos al check-out usando `baseSalary` (hoy opcional).

---

## 10. Vacaciones — arts. 76, 78, 81 LFT

### Obligación legal

**Art. 76** — Tabla de vacaciones por año de servicio:

| Años de servicio | Días de vacaciones |
|-------------------|--------------------|
| 1 | 12 |
| 2 | 14 |
| 3 | 16 |
| 4 | 18 |
| 5 | 20 |
| 6 al 10 | +2 por año (22, 24, 26, 28, 30) |
| 11 al 15 | +2 por año (32, 34, 36, 38, 40) |
| ... | +2 por año |

**Art. 78** — Las vacaciones deben concederse dentro de los 6 meses siguientes al aniversario. Decisión conjunta.

**Art. 81** — Prescripción 1 año (no del saldo, sino del derecho a exigir el pago).

### Estado del sistema

**🔴 H-10.A (CRÍTICO)** — **No existe accrual automático por antigüedad.** El campo `hireDate` existe en el schema pero:
- La UI **no lo captura** en el formulario de creación/edición de empleados (`admin-layout.tsx:1863-2080`).
- El seed (`prisma/seed.ts:168`) lo fija en `2024-01-15` para todos los empleados de prueba.
- En producción siempre cae al default `now()`.
- No existe ninguna función que aplique la tabla del art. 76 LFT.

La única forma de actualizar saldos es la carga masiva manual vía `/api/vacations/bulk-load`, que además hardcodea `year === 2026` (líneas 141-149):

```ts
if (item.year === 2026) {
  updateData.vacationBalanceDays2026 = item.days;
  updateData.vacationBalanceDays = item.days;
} else if (item.year === 2027) {
  updateData.vacationBalanceDays2027 = item.days;
}
```

**🔴 H-10.B (CRÍTICO, heredado de H-11.A)** — `vacationBalanceDays2026` y `vacationBalanceDays2027` son **solo informativos**: el endpoint `/api/vacations/balance/[employeeId]/route.ts` no los selecciona ni los muestra.

**🟡 H-10.C (MEDIO)** — Saldo insuficiente no se valida. `vacations/route.ts:332` y `vacations/[id]/route.ts:117-119`:
```ts
const newBalance = Math.max(0, emp.vacationBalanceDays - days);
```
Si el admin otorga 20 días a alguien con saldo 5, el saldo queda en 0 sin alerta ni rechazo. Esto viola la intención del art. 76 (los días solo se otorgan si se han devengado).

**Requisito técnico**: validar `if (days > vacationBalanceDays) return 400 'Saldo insuficiente'` antes de aprobar/otorgar.

**🟡 H-10.D (MEDIO)** — No hay lógica de vencimiento (art. 81). Sin campo `expiresAt`, sin cron, sin validación. Las vacaciones nunca caducan en el sistema.

**Requisito técnico**: añadir campo `anniversaryDate` a `Employee`, calcular `expiresAt = anniversaryDate + 6 meses`, y un cron anual que marque saldos vencidos.

---

## 11. Prima vacacional — art. 80 LFT

### Obligación legal

Los trabajadores tendrán derecho a una prima no menor del **25 %** sobre el salario que les corresponda durante el período de vacaciones.

### Estado del sistema

**🔴 H-11.A (CRÍTICO)** — **NO EXISTE NINGUNA FUNCIÓN QUE CALCULE PRIMA VACACIONAL.**

Búsqueda global exhaustiva de `primaVacacional|prima\s+vacacional|PRIMA_VAC`:
- `prisma/schema.prisma:164` — comentario engañoso: `"// --- Saldos de vacaciones por año (LFT art. 76 — prima vacacional) ---"`. Las columnas NO son prima vacacional, son saldos de días.
- `scripts/gen-legal-compliance-pdf.py:649` — única mención real: `"Vacaciones (mínimo 12 días en primer año); prima vacacional 25%."`

Búsqueda de `0.25|25%`: solo aparecen referencias a **prima nocturna** (art. 61) y **prima dominical** (art. 71), NO a prima vacacional.

**Impacto legal**: El patrón está obligado a pagar prima vacacional ≥25 %. Sin este cálculo, el sistema **no garantiza cumplimiento del art. 80 LFT**.

**Requisito técnico**: crear `src/lib/vacation-calculator.ts`:
```ts
export function computePrimaVacacional(
  days: number,
  dailySalary: number,
  rate = 0.25
): number {
  return days * dailySalary * rate;
}
```
Exponerlo en `/api/vacations/balance/[employeeId]` y en los reportes de nómina.

**🟡 H-11.B (BAJO)** — El comentario del schema `schema.prisma:164` es engañoso al sugerir que las columnas 2026/2027 son "prima vacacional". Debe corregirse el comentario.

---

## 12. Incapacidades IMSS — arts. 42, 96, 101 LSS

### Obligación legal

| Tipo | Base legal | Duración | % salario | Pago |
|------|------------|----------|-----------|------|
| Enfermedad general | LSS art. 96 | 52 semanas | 60 % | IMSS |
| Maternidad | LSS art. 101 | 12 semanas (42 pre + 60 post) | 100 % | IMSS |
| Riesgo de trabajo | LSS art. 51 | Variable | 100 % | IMSS |
| Paternidad | LFT art. 132 Bis | 5 días | 100 % | Patrón |

### Estado del sistema

**🟢 Tipos soportados** — `vacations/route.ts:38-46`:
```ts
const VALID_TYPES = new Set([
  'VACACIONES', 'PERMISO', 'INCAPACIDAD', 'MATERNIDAD',
  'RIESGO_TRABAJO', 'PATERNIDAD', 'OTRO',
]);
```
Mapeo IMSS en `imss-format/route.ts:79-83`:
```ts
function mapTipoIncapacidad(type: string): TipoIncapacidad {
  if (type === 'MATERNIDAD') return 'MATERNIDAD';
  if (type === 'RIESGO_TRABAJO') return 'RIESGO_TRABAJO';
  return 'ENFERMEDAD_GENERAL';   // INCAPACIDAD → ENFERMEDAD_GENERAL
}
```

**🔴 H-12.A (CRÍTICO, heredado de H-13.A)** — **RIESGO_TRABAJO y PATERNIDAD NO se contabilizan en `diasIncapacidad`** de los reportes STPS, incidences y export. Ver sección 13.

**🟡 H-12.B (MEDIO)** — **Maternidad no valida 12 semanas (84 días).** Búsqueda de `42\s*días|60\s*días|12\s*semanas|art\.?\s*101` arrojó cero validación. El admin puede crear una maternidad de 100 días o de 30 días y el sistema lo acepta.

**Requisito técnico**: `if (type === 'MATERNIDAD' && days > 84) return 400 'La maternidad excede 12 semanas (LSS art. 101)'`.

**🟡 H-12.C (MEDIO)** — **Paternidad no valida 5 días máx.** Tampoco exige acta de nacimiento (art. 132 Bis LFT).

**🟡 H-12.D (MEDIO)** — **Porcentaje de salario por incapacidad (60 %/100 %) NO se computa** en ningún lado. Solo cuenta días. Se asume en nómina externa.

**🟡 H-12.E (BAJO)** — **Folio IMSS opcional al aprobar.** La UI (`admin-layout.tsx:3654`) muestra asterisco `*` en el label "Folio IMSS (ST-3 / ST-7 / SV-CAE) *" pero el botón Aprobar NO bloquea si el input está vacío.

**🟡 H-12.F (BAJO)** — **Folio IMSS sin regex/longitud.** Cualquier string se acepta como folio (incluso `''` después del trim → null).

**Requisito técnico**: validar formato alfanumérico IMSS (regex `^[A-Z0-9]{8,15}$` aprox.).

**🟡 H-12.G (BAJO)** — **Cita legal incorrecta en `imss-format/route.ts:72`** cita "art. 170 LFT" para maternidad; la fuente correcta de las 12 semanas es LSS art. 101 (aunque art. 170 LFT también aplica).

---

## 13. Riesgos de trabajo — arts. 41, 51 LSS (ST-7)

### Obligación legal

Los riesgos de trabajo (accidentes o enfermedades de trabajo) se reportan al IMSS por separado mediante el formato **ST-7** (accidente) o **ST-3** (enfermedad). Se pagan al 100 % del salario. El patrón debe conservar comprobantes 5 años (LSS art. 15).

### Estado del sistema

**🔴 H-13.A (CRÍTICO)** — **BUG en 3 reportes**: RIESGO_TRABAJO y PATERNIDAD NO se suman a `diasIncapacidad`.

`src/lib/stps-report.ts:496-503`:
```ts
let diasIncapacidad = 0;
for (const v of empVacations) {
  const d = diasVacacionEnPeriodo(v, fechaInicio, fechaFin);
  if (v.type === 'VACACIONES') diasVacaciones += d;
  else if (v.type === 'PERMISO') diasPermiso += d;
  else if (v.type === 'INCAPACIDAD' || v.type === 'MATERNIDAD')
    diasIncapacidad += d;
  // ← RIESGO_TRABAJO y PATERNIDAD no se cuentan
}
```

`src/app/api/reports/incidences/route.ts:163-175` y `src/app/api/reports/export/route.ts:821-825` tienen el mismo bug.

**Impacto legal (art. 804 fr. IV LFT)**: El patrón debe exhibir comprobantes de seguridad social. Si un trabajador estuvo 30 días de riesgo de trabajo en el periodo, el reporte STPS mostrará `diasIncapacidad = 0` para ese trabajador → **discrepancia con SUA/IDSE**.

**Inconsistencia**: El reporte IMSS (`/api/reports/imss-format`) SÍ incluye RIESGO_TRABAJO, pero los reportes STPS/incidences/export NO.

**Requisito técnico**: añadir `RIESGO_TRABAJO` y `PATERNIDAD` a las ramas de `diasIncapacidad` en los 3 archivos:
```ts
else if (v.type === 'INCAPACIDAD' || v.type === 'MATERNIDAD' || v.type === 'RIESGO_TRABAJO' || v.type === 'PATERNIDAD')
  diasIncapacidad += d;
```

**🟢 Reporte IMSS SUA/IDSE** — `/api/reports/imss-format/route.ts` está completamente implementado:
- CSV RFC 4180 con columnas NSS, RFC, CURP, Folio IMSS, Tipo, Fechas, Días.
- Overlap de fechas con el periodo consultado.
- Audit log `EXPORT_IMSS_REPORT`.
- Mapeo correcto de tipos a SUA.
- Solo APPROVED.

**🟡 H-13.B (MEDIO)** — No filtra registros sin NSS. Si el empleado no tiene NSS capturado, el campo va vacío. Esto produce un CSV que SUA rechazaría al importar.

---

## 14. Registro electrónico de jornada — art. 132 XXXIV LFT (entra 1/1/2027)

### Obligación legal

> *"Los patrones llevarán un registro, diario y por trabajador, de las horas de entrada y salida, así como del tiempo de comida y descanso, el cual podrá ser elaborado en cualquier medio, ya sea impreso o electrónico, y hará prueba plena si se acredita que fue acordado entre la persona trabajadora y empleadora el medio elegido, así como las características del mismo."* — Art. 132 fr. XXXIV LFT (reformado DOF 27-dic-2024, vigente desde 1-ene-2025, **con obligación específica de registro electrónico a partir del 1 de enero de 2027**).

### Estado del sistema

**🔴 H-14.A (CRÍTICO)** — **No existe el "acuerdo" formal patrón-trabajador.**

Búsqueda exhaustiva de `acuerdo|agreement|signed agreement|consent signature` en `src/` no arrojó ningún modelo, endpoint ni UI que documente un acuerdo formal entre patrón y trabajador sobre el uso del registro electrónico.

La única base legal existente es el **Aviso de Privacidad** (LFPDPPP art. 16-17), que **NO es lo mismo** que el "acuerdo" del art. 132 XXXIV LFT. La frase "hará prueba plena si se acredita que fue acordado entre la persona trabajadora y empleadora" exige un **convenio específico** sobre el sistema de registro, no el aviso de privacidad genérico.

**Requisito técnico**: crear modelo `ElectronicRecordAgreement`:
```prisma
model ElectronicRecordAgreement {
  id                  String   @id @default(cuid())
  employeeId          String   @unique
  agreedAt            DateTime @default(now())
  agreedIp            String
  agreedUserAgent     String
  agreementVersion    String   // "1.0" inicial
  documentHash        String   // hash del PDF del acuerdo
  documentUrl         String?  // URL del PDF firmado
  isActive            Boolean  @default(true)
  revokedAt           DateTime?
}
```
Flujo de onboarding: primer inicio de sesión → mostrar acuerdo → capturar consentimiento → bloquear acceso al check-in hasta aceptar.

**🔴 H-14.B (CRÍTICO)** — **No existe UI que invoque `/api/attendance/sign`.** El endpoint HMAC-SHA256 está implementado en backend (`attendance/sign/route.ts:105-141`) pero es **código muerto** desde el front-end.

Búsqueda de `/attendance/sign` y `ATTENDANCE_SIGN` en todo `src/` solo aparece en el propio archivo route.ts. El trabajador **no puede firmar** sus registros a través del front-end actual.

**Requisito técnico**: añadir botón "Firmar mis registros del periodo" en `employee-layout.tsx` que invoque `/api/attendance/sign` con PIN.

**🟡 H-14.C (MEDIO, seguridad)** — El `secret` del HMAC tiene fallback `'dev-only-fallback-secret-change-in-prod'`:
```ts
const secret = process.env.NEXTAUTH_SECRET || process.env.SIGNATURE_SECRET
               || 'dev-only-fallback-secret-change-in-prod';
```
Si se despliega sin `NEXTAUTH_SECRET` ni `SIGNATURE_SECRET`, todas las firmas son vulnerables.

**Requisito técnico**: eliminar el fallback y fallar fuerte (`throw new Error('SIGNATURE_SECRET required')`) si no hay env var.

**🟡 H-14.D (MEDIO)** — El PIN del empleado se mezcla con el secret del server como `${secret}:${signaturePin}`. El sistema NO valida que el PIN corresponda al empleado (cualquier PIN ≥4 caracteres es aceptado). El PIN no es un PIN real, es una sal aleatoria.

**Requisito técnico**: persistir `employee.signaturePinHash` (bcrypt) y validar antes de firmar.

**🟢 Cumple** — Timestamp usa hora del servidor (`new Date()` en `check-in/route.ts:147` y `check-out/route.ts:114`). El cliente NO envía timestamp.

**🟡 H-14.E (BAJO)** — No hay fuente de tiempo confiable (NTP / RFC 3161 timestamping authority). Se confía en el reloj del server Vercel. Para prueba plena ante periciales, convendría sellado de tiempo externo.

**🟢 Cumple** — El trabajador puede consultar sus registros vía `/api/attendance/today`, `/api/attendance/history` y `/api/reports/my-export`.

---

## 15. Trazabilidad, inmutabilidad y prueba plena

### Obligación legal

Art. 132 XXXIV LFT ("prueba plena si fue acordado") + art. 804 LFT (conservación 12 meses).

### Estado del sistema

**🟢 Cumple en modelo** — `AttendanceRecord` tiene campos de inmutabilidad (`prisma/schema.prisma:275-287`): `isLocked`, `originalCheckInTime`, `originalCheckOutTime`, `correctionReason`, `correctedById`, `correctedAt`, `employeeSignedAt`, `employeeSignatureHash`, `employeeSignedIp`.

**🟢 Cumple** — `isLocked=true` por defecto; los registros nacen bloqueados (`check-in/route.ts:190,208`). Nunca se setea a `false`.

**🟢 Cumple** — Las correcciones requieren `forceUnlock=true` + `correctionReason` obligatorio (`attendance/[id]/route.ts:75-141`). Solo `GENERAL_ADMIN` o `SUCURSAL_ADMIN` (`isAdmin(user)`).

**🟢 Cumple** — Los valores originales se preservan con `??` (no sobreescribibles en correcciones subsiguientes).

**🔴 H-15.A (CRÍTICO)** — **El AuditLog NO es tamper-evident.** Sin `previousHash`, `chainHash`, ni `merkleRoot`:

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String
  entityType String
  entityId   String?
  sucursalId String?
  ipAddress  String?
  userAgent  String?
  details    String?  // JSON string
  createdAt  DateTime @default(now())
  // ← sin previousHash
}
```

Cualquier `GENERAL_ADMIN` con acceso a la DB puede hacer `UPDATE "AuditLog" SET details = '...' WHERE id = '...'` sin que el sistema lo detecte. **Para evidencia ante inspección STPS o juicio laboral, esto es una debilidad probatoria significativa.**

**Requisito técnico**: añadir `previousHash String?` y `recordHash String` a `AuditLog`. Al insertar, calcular `recordHash = sha256(previousHash + JSON.stringify(record))`. Endpoint `GET /api/audit/verify` que recorra la cadena y reporte rupturas.

**🔴 H-15.B (CRÍTICO)** — **No hay lógica de retención 12 meses (LFT art. 804).** Búsqueda de `retention|deleteOlderThan|cleanup|expir|pruneOlderThan` no arrojó ningún cron job, endpoint ni función que elimine o archive registros >12 meses.

Lo ÚNICO que existe:
- Texto del Aviso de Privacidad que **promete** "12 meses posteriores a la terminación de la relación laboral".
- La función `anonymizeUserData()` que se ejecuta **sólo** cuando el usuario ejerce su derecho de cancelación ARCO (no automática a los 12 meses).

**BRECHA LEGAL**: Si un inspector STPS pregunta "¿dónde están los registros del empleado X que se fue hace 14 meses?", el sistema no puede garantizar que se hayan conservado (ni que se hayan borrado de forma auditable). La política declarada en el aviso **no se cumple en código**.

**Requisito técnico**: implementar Vercel Cron (o Supabase pg_cron) que mensualmente:
1. Identifique `AttendanceRecord` con `date < now() - 12 meses` de empleados inactivos.
2. Los archive en tabla `AttendanceRecordArchive` (sin PII como IP/UA, conservando fechas, horas, overtime).
3. Registre `RETENTION_ARCHIVE` en AuditLog con details del archivo.

**🔴 H-15.C (CRÍTICO)** — **El PDF STPS no incluye el hash de firma del trabajador.** Búsqueda de `signature|firma|hash|HMAC|signedAt|employeeSigned` en `src/lib/stps-pdf.ts` arrojó 0 matches.

El PDF que se exhibiría ante la STPS NO incluye `employeeSignatureHash`, `employeeSignedAt`, ni mención de si el registro fue firmado por el trabajador. Esto **debilita el argumento de "prueba plena"** del art. 132 XXXIV.

**Requisito técnico**: añadir al PDF STPS (sección 3, detalle diario) una columna "Firmado" con la fecha de firma y el hash truncado (primeros 16 chars).

---

## 16. Geolocalización y privacidad

### Obligación legal

- LFPDPPP art. 9 (consentimiento para datos sensibles) — la ubicación no es sensible per se, pero sí requiere transparencia.
- NOM-037 (teletrabajo) — si se captura ubicación de trabajadores remotos, debe ser con consentimiento informado separado y sin precisión invasiva.

### Estado del sistema

**🟢 Cumple en arquitectura** — Geofence Haversine configurable por sucursal (`geofenceRadiusMeters`, `enforceGeofence`). `src/lib/geo.ts:13-41`. Por defecto `enforceGeofence=false` (opt-in).

**🟢 Cumple** — Lat/long capturados en check-in y check-out (`check-in/route.ts:184-185`, `check-out/route.ts:162-163`). Son `Float?` (opcionales si el usuario rechaza el permiso).

**🟡 H-16.A (MEDIO)** — **No hay consentimiento específico para geolocalización.** El consentimiento se delega al prompt nativo del navegador (`navigator.geolocation.getCurrentPosition`), que SÍ pide permiso explícito al usuario. PERO:
1. No hay consentimiento informado por escrito en el sentido LFPDPPP art. 17.
2. El Aviso de Privacidad menciona que se captura GPS pero no es un consentimiento separado ni específico.
3. No hay checkbox "Acepto captura de ubicación para control de asistencia" en el flujo de check-in.

**Requisito técnico**: modal de consentimiento específico para geolocalización en el primer check-in, con registro de IP/fecha en `Employee.geoConsentAcceptedAt`.

**🟡 H-16.B (BAJO)** — `enableHighAccuracy: true` en `employee-layout.tsx:502` pide GPS de alta precisión (sub-métrica si hay GPS hardware). Para trabajadores remotos (teletrabajo) esto capturaría la ubicación exacta de su casa, lo cual sería invasivo. **El sistema no soporta teletrabajo** (ver sección 20), así que en la práctica solo aplica a sucursal física. Aun así, 150 m de radio default sería suficiente con precisión menor.

---

## 17. Derechos ARCO y Aviso de Privacidad — LFPDPPP

### Obligación legal

- Art. 16 — Aviso de privacidad con identidad del responsable, finalidades, datos recabados, opciones para limitar uso/divulgación.
- Art. 17 — Consentimiento libre, informado y expreso.
- Arts. 29-32 — Derechos ARCO (Acceso, Rectificación, Cancelación, Oposición).
- Art. 100 — Plazo de respuesta 20 días hábiles.

### Estado del sistema

**🟢 Cumple en infraestructura** — Aviso de Privacidad con versión (`CURRENT_PRIVACY_VERSION = '1.0'`), captura de consentimiento con IP, modal forzado (no se puede cerrar sin aceptar), middleware bloquea acceso sin consentimiento.

**🔴 H-17.A (CRÍTICO)** — **El texto del Aviso de Privacidad son placeholders.** `src/app/legal/aviso-de-privacidad/page.tsx:78-91` — todos los campos del responsable (razón social, domicilio, DPO) son `[REDACTAR_POR_ABOGADO]`.

**No cumple art. 16 fr. I LFPDPPP** mientras no se redacten. Riesgo regulatorio alto.

**🔴 H-17.B (CRÍTICO)** — **Anonimización ARCO no borra RFC/CURP/NSS.** `src/lib/privacy.ts:160-169`:

```ts
// Employee → solo cambia position y department
await tx.employee.update({
  where: { userId },
  data: {
    position: 'ANONIMIZADO',
    department: 'ANONIMIZADO',
    isActive: false,
    // ← NO anonimiza employeeNumber, rfc, curp, nss
  },
});
```

`employeeNumber`, `rfc`, `curp`, `nss` (todos `@unique` y reversibles a identidad) se conservan. **Incumple art. 31 LFPDPPP (supresión efectiva) y expone a sanción INAI.**

**Requisito técnico**:
```ts
await tx.employee.update({
  where: { userId },
  data: {
    position: 'ANONIMIZADO',
    department: 'ANONIMIZADO',
    employeeNumber: `ANON-${emp.id.slice(0,8)}`,
    rfc: null,   // NULL permite duplicados en SQL
    curp: null,
    nss: null,
    isActive: false,
  },
});
```

**🟢 Cumple en tipos ARCO** — Los 4 tipos (ACCESS, RECTIFICATION, CANCELLATION, OPPOSITION) están implementados. `arco-form.tsx:18-25` + `arco/request/route.ts:14-19`.

**🟢 Cumple en derecho de acceso inmediato** — `/api/user/mydata/route.ts` devuelve al titular todos sus datos (User, Employee, AttendanceRecords, Vacations, AuditLogs, PrivacyRequests).

**🟡 H-17.C (MEDIO)** — **`mydata` no incluye RFC/CURP/NSS al titular.** `mydata/route.ts:52-81` omite `rfc`, `curp`, `nss` en el select de Employee. El titular debería ver sus propios identificadores fiscales (art. 29 LFPDPPP).

**🟡 H-17.D (MEDIO)** — **SLA ARCO usa aproximación de días naturales.** `admin/arco/requests/route.ts:60-64`:

```ts
const legalDeadlineNaturalDays = 28; // 20 días hábiles ≈ 28 naturales
```

No considera feriados mexicanos reales (1-ene, 5-feb, 21-mar, 1-may, 16-sep, 20-nov, 25-dic, más transitorios). Hasta ±4 días de error.

**Requisito técnico**: función `addBusinessDays` que excluya sábados/domingos/feriados oficiales (tabla `Holiday` ya existe).

**🟡 H-17.E (BAJO)** — `privacy-consent.tsx:35` hard-codea `version: '1.0'` en el POST en vez de leer `CURRENT_PRIVACY_VERSION`. Mitigado por validación 409 en backend, pero frágil.

---

## 18. Reportes oficiales — art. 804 LFT, art. 15 LSS

### Obligación legal (art. 804 fracciones LFT)

| Fracción | Contenido |
|----------|-----------|
| I | Nombre, apellido, denominación |
| II | RFC y NSS |
| III | Puesto, departamento |
| IV | Días de incapacidad |
| V | Días de descanso trabajados |
| VI | Salario |
| VII | Entrada/salida |
| VIII | Tiempo de comida |
| IX | Días laborados |
| X | Vacaciones |
| XI | Percepciones |

### Estado del sistema

**🟢 Reporte STPS (`/api/reports/stps-format`)** — 3 secciones completas: datos del patrón, catálogo de trabajadores (20 columnas), detalle diario por trabajador. PDF Letter generado con `stps-pdf.ts`. Audit log `EXPORT_STPS_REPORT`.

**🟡 H-18.A (ALTO)** — **NSS ausente del catálogo STPS.** `stps-format/route.ts:312-334` incluye RFC y CURP pero NO NSS. **El art. 804 fr. II LFT exige ambos.**

**Requisito técnico**: añadir columna "NSS" al catálogo.

**🔴 H-18.B (CRÍTICO, heredado de H-13.A)** — `diasIncapacidad` en el reporte STPS no incluye RIESGO_TRABAJO ni PATERNIDAD (ver sección 13).

**🟢 Reporte IMSS (`/api/reports/imss-format`)** — CSV RFC 4180 con NSS, RFC, CURP, Folio IMSS, Tipo, Fechas, Días. Audit log. Overlap de fechas.

**🟢 Reportes de incidencias, ausencias, overtime, daily, comparative, my-export** — Completos, cubren arts. 60, 61, 66, 68, 71, 72, 73, 75 LFT.

**🟡 H-18.C (BAJO)** — `/api/download/tabla-cumplimiento-legal` es pública (sin auth). El PDF contiene el mapeo de endpoints → campos → articulado legal. No es PII pero expone la arquitectura interna del sistema a cualquier atacante.

**🟡 H-18.D (ALTO)** — `/api/download` sirve el ZIP del proyecto públicamente. Si el ZIP contiene `.env` o código fuente con secretos hardcodeados, es fuga crítica. (El worklog anterior menciona que `/api/download-env` fue removido por exponer .env — el ZIP podría tener el mismo riesgo si se regenera sin excluir archivos sensibles.)

**Requisito técnico**: proteger `/api/download` con auth admin, o eliminar la ruta.

---

## 19. NOM-035-STPS-2018 — factores de riesgo psicosocial

### Obligación legal

La NOM-035 exige al patrón:
1. Identificar factores de riesgo psicosocial (cuestionario de 73 preguntas, categorías I/II/III).
2. Política de prevención de riesgos psicosocial documentada.
3. Identificación de factores de riesgo organizacional.
4. Programa de intervención.
5. Capacitación al personal.

Categorías a evaluar:
- **A.1** Condiciones del ambiente de trabajo
- **A.2** Carga de trabajo
- **A.3** Cambios en el trabajo
- **A.4** Equipos y materiales
- **A.5** Jornadas de trabajo excesivas
- **B** Liderazgo y relaciones (violencia laboral)
- **C** Engagement, reconocimiento, satisfacción
- **D** Violencia laboral

### Estado del sistema

**🟢 Cumple parcialmente (categoría A.5)** — `src/app/api/alerts/nom-035/route.ts` detecta 5 tipos de alerta:
1. `WEEKLY_OVERTIME_EXCEEDED` — tope semanal 9 h (art. 66).
2. `DAILY_OVERTIME_EXCEEDED` — tope 4 h/día (art. 66).
3. `CONSECUTIVE_LONG_DAYS` — ≥3 días consecutivos con extra.
4. `NO_WEEKLY_REST` — sin descanso semanal (art. 71).
5. `REST_DAY_WORKED` — trabajó en su día de descanso (art. 73).

**🔴 H-19.A (CRÍTICO)** — **No existe la encuesta / cuestionario NOM-035.** Búsqueda de `encuesta|survey|cuestionario|psicosocial` no arrojó ni modelo, ni endpoint, ni UI para aplicar la encuesta de identificación de factores de riesgo psicosocial que la NOM-035 exige.

**🔴 H-19.B (CRÍTICO)** — **No hay indicadores de violencia, rotación, conflicto trabajo-familia** (categorías B, C, D).

**🔴 H-19.C (CRÍTICO)** — **No hay referencia a política de prevención** documentada en el sistema.

**Requisito técnico**: construir módulo NOM-035 completo:
- Modelo `PsychosocialSurvey` con 73 preguntas y sus respuestas por empleado.
- Endpoint `/api/nom-035/survey` para aplicar y consultar.
- Endpoint `/api/nom-035/indicators` para reportar violencia, rotación, conflicto trabajo-familia.
- Documento de política servido desde `/legal/politica-nom-035`.

**Cumplimiento NOM-035 actual: ~25 %** (solo alertas A.5 algorítmicas).

---

## 20. NOM-037-STPS-2023 — teletrabajo

### Obligación legal

La NOM-037 aplica a centros de trabajo donde >40 % del tiempo laboral es teletrabajo. Exige:
1. Acuerdo de teletrabajo por escrito.
2. Provisión de equipo (computadora, silla ergonómica, insumos).
3. Reembolso de costos proporcionales de internet y electricidad (apéndice B).
4. Convenio del horario de conexión.
5. Derecho a la desconexión (art. 30 + LFT art. 132 XXXVII).
6. Capítulo de seguridad y salud en el teletrabajo.

### Estado del sistema

**🔴 H-20.A (CRÍTICO)** — **El teletrabajo NO es soportado como modo de trabajo.** Búsqueda exhaustiva de `teletrabajo|home.?office|isRemote|workMode|modalidad` no encontró:
- Campo `workMode` o `isRemote` en modelo Employee.
- Sucursal tipo "HOME_OFFICE".
- Horario flexible para trabajadores a distancia.

El proyecto se llama "NOM-037" en el branding (`app/layout.tsx`, manual, etc.) pero funcionalmente es un sistema de asistencia **presencial** con geofence por sucursal física. **La norma NOM-037-STPS-2023 aplica a >40 % del tiempo en teletrabajo; el sistema no lo soporta.**

**🔴 H-20.B (CRÍTICO)** — **No hay acuerdo de teletrabajo, provisión de equipo, ni reembolso de costos.** Búsqueda de `equipo|reembolso|reimbursement|internet|electricidad|costs` no encontró:
- Modelo `TeletrabajoAgreement`.
- Campos `equipmentProvided`, `internetStipend`, `electricityStipend`.

**🔴 H-20.C (CRÍTICO)** — **No hay derecho a la desconexión.** Búsqueda de `desconex|disconnect|right.?to.?disconnect|fuera.?de.?horario|contacto.?fuera` no encontró lógica que prevenga contacto al trabajador fuera de su horario laboral (NOM-037 art. 30 + LFT art. 132 XXXVII). El sistema no bloquea ni siquiera advierte cuando un admin envía notificaciones fuera del horario del empleado.

**Cumplimiento NOM-037 actual: ~5 %** (solo branding, sin funcionalidad real).

**Requisito técnico completo**:
1. Añadir `workMode: 'PRESENCIAL' | 'TELETRABAJO' | 'HIBRIDO'` a Employee.
2. Crear sucursal virtual "HOME_OFFICE" que omita geofence.
3. Modelo `TeletrabajoAgreement { employeeId, agreementDate, equipmentProvided (JSON), internetStipend, electricityStipend, schedule }`.
4. Lógica de derecho a desconexión: bloquear notificaciones push/email fuera del horario del empleado, con warning al admin que intente enviar.

---

## 21. Tabla consolidada de hallazgos clasificados

Leyenda: 🔴 CRÍTICO · 🟠 ALTO · 🟡 MEDIO · 🟢 BAJO · ⚪ FUERA DE ALCANCE

| ID | Severidad | Tema | Archivo:Línea | Hallazgo | Acción |
|----|-----------|------|---------------|----------|--------|
| H-1.B | 🔴 CRÍTICO | Cita legal | `overtime-calculator.ts:60`, `check-out/route.ts:253`, `alerts/nom-035/route.ts:8`, `cumplimiento-lft-2027.md:6,93,332` | Cita "DOF 1-may-2026" es incorrecta; la fecha real es DOF 27-dic-2024 | Corregir en 6 lugares |
| H-3.A | 🔴 CRÍTICO | Jornada semanal | `prisma/schema.prisma:208-219`, `lib/work-schedule.ts:35-70` | No existe campo ni validación del tope semanal 48/46/44/42/40h | Crear tabla `JornadaConfig` + validación + UI counter |
| H-5.A | 🔴 CRÍTICO | Overtime cap | `overtime-calculator.ts:66-71` | `getWeeklyOvertimeCapMinutes` escala 9→10→11→12h; el art. 66 LFT es fijo en 9h | Reemplazar por retorno fijo `9 * 60` |
| H-7.A | 🔴 CRÍTICO | Rest day detection | `overtime-calculator.ts:155`, `check-out/route.ts:116` | `schedule === null` activa `isRestDayWorked` también para días NO programados | Pasar `isRestDayWorkedExplicit` como input |
| H-8.A | 🔴 CRÍTICO | Prima dominical | `overtime-calculator.ts:152`, `check-in/route.ts:162` | Monto del 25% no se calcula; solo flag `isSunday` | Calcular monto o documentar delegación a nómina |
| H-10.A | 🔴 CRÍTICO | Accrual vacaciones | Ausencia total en `src/lib/` | No existe accrual automático por antigüedad (tabla art. 76) | Crear `vacation-calculator.ts` + UI para `hireDate` |
| H-11.A | 🔴 CRÍTICO | Prima vacacional | Ausencia total | NO EXISTE función que calcule prima vacacional (25% × días × salario) | Crear `computePrimaVacacional()` |
| H-13.A | 🔴 CRÍTICO | Riesgo trabajo | `stps-report.ts:496-503`, `incidences/route.ts:163-175`, `export/route.ts:821-825` | RIESGO_TRABAJO y PATERNIDAD NO se contabilizan en `diasIncapacidad` | Añadir a las ramas de los 3 archivos |
| H-14.A | 🔴 CRÍTICO | Acuerdo registro | Ausencia total | No existe "acuerdo" formal patrón-trabajador (art. 132 XXXIV) | Crear modelo `ElectronicRecordAgreement` |
| H-14.B | 🔴 CRÍTICO | UI firma | Ausencia total en front-end | No existe UI que invoque `/api/attendance/sign` | Añadir botón "Firmar mis registros" |
| H-15.A | 🔴 CRÍTICO | AuditLog tamper | `prisma/schema.prisma:367-383` | AuditLog sin `previousHash`/chain; no es tamper-evident | Añadir hash chaining |
| H-15.B | 🔴 CRÍTICO | Retención 12m | Ausencia total | No hay lógica de retención 12 meses (art. 804) | Cron de archival mensual |
| H-15.C | 🔴 CRÍTICO | PDF STPS | `lib/stps-pdf.ts` | PDF STPS no incluye hash de firma del trabajador | Añadir columna "Firmado" + hash |
| H-17.A | 🔴 CRÍTICO | Aviso privacidad | `aviso-de-privacidad/page.tsx:78-91` | Texto del responsable son placeholders `[REDACTAR_POR_ABOGADO]` | Redactar con datos reales |
| H-17.B | 🔴 CRÍTICO | ARCO anonim. | `lib/privacy.ts:160-169` | Anonimización no borra RFC/CURP/NSS | Poner `null` esos campos |
| H-19.A | 🔴 CRÍTICO | NOM-035 survey | Ausencia total | No existe encuesta NOM-035 (73 preguntas) | Crear `PsychosocialSurvey` |
| H-19.B | 🔴 CRÍTICO | NOM-035 B/C/D | Ausencia total | No hay indicadores de violencia, rotación, conflicto trabajo-familia | Construir módulo |
| H-19.C | 🔴 CRÍTICO | NOM-035 política | Ausencia total | No hay referencia a política de prevención | Documentar y servir |
| H-20.A | 🔴 CRÍTICO | Teletrabajo | Ausencia total | Teletrabajo NO soportado como modo de trabajo | Añadir `workMode` + sucursal virtual |
| H-20.B | 🔴 CRÍTICO | Teletrabajo acuerdo | Ausencia total | No hay acuerdo, provisión de equipo, ni reembolso | Crear `TeletrabajoAgreement` |
| H-20.C | 🔴 CRÍTICO | Derecho desconexión | Ausencia total | No hay lógica de derecho a la desconexión | Bloquear notificaciones fuera horario |
| H-18.A | 🟠 ALTO | NSS en STPS | `stps-format/route.ts:312-334` | NSS ausente del catálogo STPS (art. 804 fr. II) | Añadir columna |
| H-18.D | 🟠 ALTO | ZIP público | `download/route.ts` | `/api/download` sirve ZIP del proyecto públicamente | Proteger o eliminar |
| H-21.A | 🟠 ALTO | Quick-login | `auth/quick-login/route.ts:14-86` | Acepta `{ userId }` sin password ni MFA | Exigir header secreto + IP allowlist + rate limit |
| H-21.B | 🟠 ALTO | SUPERVISOR scoping | `stps-format/route.ts:74`, `export/route.ts:67-68` | Bug de scoping para SUPERVISOR (escape horizontal) | Añadir SUPERVISOR al filtro |
| H-21.C | 🟠 ALTO | Política password | `employees/route.ts:146`, `reset-password/route.ts:54` | No hay política de contraseñas (mín 6 chars) | Mín 8 + regex complejidad |
| H-21.D | 🟠 ALTO | MFA encryption key | `lib/auth.config.ts:210` | MFA secret reusa `NEXTAUTH_SECRET` como clave | Variable separada `MFA_ENCRYPTION_KEY` |
| H-21.E | 🟠 ALTO | Folio IMSS oblig. | `imss-format/route.ts:213` | `folioIMSS` no es obligatorio al aprobar incapacidades | Bloquear APPROVE sin folio |
| H-5.B | 🟡 MEDIO | Overtime exceso | `overtime-calculator.ts:271` | Excedente >4h/día se descarta sin persistirse | Añadir `overtimeExcessMinutes` |
| H-6.A | 🟡 MEDIO | TZ semanal | `overtime-calculator.ts:373-382` | `setHours(0,0,0,0)` en server TZ; frágil | Usar Luxon `MEXICO_TZ` |
| H-6.B | 🟡 MEDIO | Overtime stale | `overtime-calculator.ts:366-386` | `overtimeWeeklyAccumulated` no recalcula tras correcciones | Trigger automático de recálculo |
| H-8.B | 🟡 MEDIO | Domingo por check-in | `overtime-calculator.ts:152` | `isSunday` usa `record.date`, no minutos realmente en domingo | Usar `nightMinutesBetween`-style |
| H-8.C | 🟡 MEDIO | Prima dominical scope | `check-in/route.ts:162` | Marca `isSunday` para cualquier domingo | Validar si domingo es descanso semanal |
| H-10.C | 🟡 MEDIO | Saldo insuficiente | `vacations/route.ts:332`, `vacations/[id]/route.ts:117-119` | `Math.max(0, balance-days)` satura a 0 sin alerta | Rechazar 400 si `days > balance` |
| H-10.D | 🟡 MEDIO | Vencimiento vacaciones | Ausencia total | No hay lógica de vencimiento (art. 81) | Campo `expiresAt` + cron anual |
| H-12.B | 🟡 MEDIO | Maternidad 84d | Ausencia total | No valida 12 semanas (84 días) | `if (type === 'MATERNIDAD' && days > 84) return 400` |
| H-12.C | 🟡 MEDIO | Paternidad 5d | Ausencia total | No valida 5 días máx | `if (type === 'PATERNIDAD' && days > 5) return 400` |
| H-12.D | 🟡 MEDIO | % salario incapacidad | Ausencia total | Porcentaje 60%/100% no se computa | Calcular `montoIncapacidad` |
| H-13.B | 🟡 MEDIO | NSS vacío IMSS | `imss-format/route.ts:195-216` | No filtra registros sin NSS | Filtrar o rechazar en export |
| H-14.C | 🟡 MEDIO | HMAC fallback | `attendance/sign/route.ts:108` | Fallback `'dev-only-fallback-secret'` | Eliminar, fail-fast |
| H-14.D | 🟡 MEDIO | PIN sin validar | `attendance/sign/route.ts:55-60` | Cualquier PIN ≥4 chars se acepta | Persistir `signaturePinHash` (bcrypt) |
| H-16.A | 🟡 MEDIO | Geo consent | `employee-layout.tsx:485-505` | Consentimiento delegado al navegador | Modal específico en primer check-in |
| H-17.C | 🟡 MEDIO | mydata sin RFC | `mydata/route.ts:52-81` | El titular no recibe sus RFC/CURP/NSS | Añadir al select |
| H-17.D | 🟡 MEDIO | SLA ARCO | `admin/arco/requests/route.ts:60-64` | SLA usa 28 naturales, no 20 hábiles | Función `addBusinessDays` |
| H-4.A | 🟡 MEDIO | Comida umbral 8h | `meal-start/route.ts:19`, `rest-start/route.ts:18` | Hardcoded `8*60`; ignora NOCTURNA (7h) y MIXTA (7.5h) | Usar `getLegalMaxMinutes(shiftType)` |
| H-21.F | 🟡 MEDIO | RFC/CURP regex | `employees/route.ts:156-167` | Solo longitud, no regex SAT/RENAPO | Añadir regex de validación |
| H-6.C | 🟡 MEDIO | daily sin weekly | `reports/daily/route.ts:133-137` | `calculateOvertime` sin `weeklyAccumulatedMinutes` | Pasar el acumulador o leer del DB |
| H-13.C | 🟢 BAJO | Cita art. 170 LFT | `imss-format/route.ts:72` | Cita "art. 170 LFT" para maternidad, debería citar LSS art. 101 | Corregir cita |
| H-9.A | ⚪ FA | Prima nocturna | `check-out/route.ts:218-220` | 25% se delega a nómina externa | Documentar o calcular en-sistema |
| H-9.B | ⚪ FA | Prima dominical monto | `overtime-calculator.ts:152` | Monto se delega a nómina externa | Documentar o calcular en-sistema |
| H-10.B | 🟢 BAJO | 2026/2027 informativos | `balance/[employeeId]/route.ts:42` | No se usan en balance ni descuento | Incluir en el select del endpoint |
| H-10.E | 🟢 BAJO | bulk-load hardcode | `bulk-load/route.ts:143-149` | Hardcodea `year === 2026` | Usar `currentYear` dinámico |
| H-11.B | 🟢 BAJO | Comentario schema | `schema.prisma:164` | Comentario engañoso "prima vacacional" | Corregir comentario |
| H-12.E | 🟢 BAJO | Folio IMSS opcional UI | `admin-layout.tsx:3636-3639` | Asterisco engaña, no bloquea | Validar o quitar asterisco |
| H-12.F | 🟢 BAJO | Folio sin regex | `vacations/route.ts:355-358` | Cualquier string se acepta | Regex `^[A-Z0-9]{8,15}$` |
| H-12.G | 🟢 BAJO | Cita art. 170 LFT | `imss-format/route.ts:72` | Cita imprecisa | Corregir |
| H-14.E | 🟢 BAJO | No NTP | Ausencia total | Sin sellado de tiempo externo | RFC 3161 timestamping (opcional) |
| H-16.B | 🟢 BAJO | High accuracy | `employee-layout.tsx:502` | `enableHighAccuracy: true` invasivo si teletrabajo | Quitar si no se requiere precisión sub-métrica |
| H-17.E | 🟢 BAJO | Versión hardcode | `privacy-consent.tsx:35` | Hard-codea `version: '1.0'` | Leer `CURRENT_PRIVACY_VERSION` |
| H-18.C | 🟢 BAJO | Tabla pública | `download/tabla-cumplimiento-legal/route.ts` | PDF de arquitectura interna es público | Proteger con auth |

**Totales**: 21 🔴 críticos · 8 🟠 altos · 17 🟡 medios · 11 🟢 bajos · 2 ⚪ fuera de alcance = **59 hallazgos**.

---

## 22. Requisitos técnicos concretos para el desarrollador

A continuación, los requisitos agrupados por prioridad de implementación. Cada requisito incluye el archivo a modificar, la firma esperada y el criterio de aceptación.

### P0 — Bloqueantes para 1 de enero de 2027

#### RT-P0.1 — Crear tabla `JornadaConfig` y validar tope semanal

```prisma
// prisma/schema.prisma y schema.postgres.prisma
model JornadaConfig {
  year            Int     @id
  maxWeeklyHours  Int     // 2026→48, 2027→46, 2028→44, 2029→42, 2030→40
  createdAt       DateTime @default(now())
}
```

- Modificar `src/lib/work-schedule.ts:35-70` `validateWorkSchedules()` para sumar horas semanales y comparar contra `JornadaConfig.maxWeeklyHours` del año actual.
- Criterio de aceptación: al intentar guardar un horario L-S 9-19 (= 54 h) en 2027, el sistema rechaza con error "El horario excede el tope semanal de 46h (art. 61 LFT)".

#### RT-P0.2 — Corregir `getWeeklyOvertimeCapMinutes`

```ts
// src/lib/overtime-calculator.ts:66-71
export function getWeeklyOvertimeCapMinutes(_year?: number): number {
  return 9 * 60; // art. 66 LFT — tope semanal fijo de 9 horas.
}
```

- Criterio de aceptación: para cualquier año, el tope semanal es 540 min. Las horas extra sobre 540 min/semana se pagan al triple.

#### RT-P0.3 — Corregir detección de descanso trabajado

```ts
// src/app/api/attendance/check-out/route.ts:116
const restSchedule = findRestScheduleForDate(record.employee.workSchedules, record.date);
const workSchedule = findScheduleForDate(record.employee.workSchedules, record.date);
const schedule = restSchedule || workSchedule;
const isRestDayWorkedExplicit = restSchedule !== null;
// Pasar isRestDayWorkedExplicit a calculateOvertime como input.
```

- Modificar `calculateOvertime(input: OvertimeInput)` para aceptar `isRestDayWorked: boolean` como input explícito en lugar de inferirlo de `schedule === null`.
- Criterio de aceptación: un día no programado (sin `WorkSchedule` para ese `dayOfWeek`) NO genera `restDayWorkedMinutes`.

#### RT-P0.4 — Corregir cita legal "DOF 1-may-2026" → "DOF 27-dic-2024"

Reemplazar en 6 lugares:
- `src/lib/overtime-calculator.ts:60`
- `src/app/api/attendance/check-out/route.ts:253`
- `src/app/api/alerts/nom-035/route.ts:8`
- `documentos/cumplimiento-lft-2027.md:6, 93, 332`
- `scripts/gen-legal-compliance-pdf.py` (regenerar PDF)
- Manual de usuario v3.0

#### RT-P0.5 — Crear modelo `ElectronicRecordAgreement` y flujo de onboarding

```prisma
model ElectronicRecordAgreement {
  id                  String   @id @default(cuid())
  employeeId          String   @unique
  agreedAt            DateTime @default(now())
  agreedIp            String
  agreedUserAgent     String
  agreementVersion    String   // "1.0"
  documentHash        String
  documentUrl         String?
  isActive            Boolean  @default(true)
  revokedAt           DateTime?
  employee            Employee @relation(fields: [employeeId], references: [id])
}
```

- Endpoint `POST /api/employees/[id]/electronic-record-agreement` para capturar consentimiento.
- UI: bloquear el botón de check-in hasta que el empleado haya aceptado el acuerdo (similar al modal de Aviso de Privacidad).
- Criterio de aceptación: ningún `AttendanceRecord` puede crearse sin `ElectronicRecordAgreement.isActive=true`.

#### RT-P0.6 — Añadir UI que invoque `/api/attendance/sign`

- En `src/components/layout/employee-layout.tsx`, añadir botón "Firmar mis registros del periodo" en la vista Mi Historial.
- El botón solicita PIN (4-6 dígitos) y llama a `POST /api/attendance/sign` con `{ recordIds, signaturePin }`.
- Mostrar confirmación con el hash generado y la fecha de firma.
- Criterio de aceptación: el empleado puede firmar sus registros y los campos `employeeSignedAt`, `employeeSignatureHash`, `employeeSignedIp` se persisten.

#### RT-P0.7 — Hash chaining en AuditLog

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  userId        String?
  action        String
  entityType    String
  entityId      String?
  sucursalId    String?
  ipAddress     String?
  userAgent     String?
  details       String?
  previousHash  String?
  recordHash    String
  createdAt     DateTime @default(now())
}
```

- Al insertar un AuditLog, calcular `recordHash = sha256((previousHash || '') + action + entityType + entityId + details + createdAt)`.
- El `previousHash` es el `recordHash` del último AuditLog insertado.
- Endpoint `GET /api/audit/verify` que recorra la cadena y reporte rupturas.
- Criterio de aceptación: cualquier modificación manual de un registro en la DB se detecta al llamar a `/api/audit/verify`.

#### RT-P0.8 — Cron de retención 12 meses

- Crear endpoint `POST /api/admin/retention/archive` (admin-only) que:
  1. Identifique `AttendanceRecord` con `date < now() - 12 meses` de empleados con `isActive=false`.
  2. Los copie a tabla `AttendanceRecordArchive` (sin IP/UA).
  3. Elimine los originales.
  4. Registre `RETENTION_ARCHIVE` en AuditLog.
- Configurar Vercel Cron para ejecutar mensualmente el primer día del mes.
- Criterio de aceptación: tras 13 meses de baja de un empleado, sus registros ya no están en `AttendanceRecord` pero sí en `AttendanceRecordArchive`.

#### RT-P0.9 — Incluir hash de firma en PDF STPS

- Modificar `src/lib/stps-pdf.ts` sección 3 (detalle diario): añadir columna "Firmado" con `employeeSignedAt` (fecha) y `employeeSignatureHash.slice(0, 16)` (hash truncado).
- Criterio de aceptación: el PDF STPS muestra si cada registro fue firmado y por cuándo.

#### RT-P0.10 — Redactar Aviso de Privacidad con datos reales

- `src/app/legal/aviso-de-privacidad/page.tsx:78-91`: reemplazar `[REDACTAR_POR_ABOGADO]` con razón social, domicilio, RFC, DPO, etc. reales de la empresa.
- Incrementar `CURRENT_PRIVACY_VERSION` a `'1.1'` para forzar re-consentimiento.
- Criterio de aceptación: ningún placeholder en el aviso. Todos los usuarios deben re-aceptar al iniciar sesión.

#### RT-P0.11 — Completar anonimización ARCO

```ts
// src/lib/privacy.ts:160-169
await tx.employee.update({
  where: { userId },
  data: {
    position: 'ANONIMIZADO',
    department: 'ANONIMIZADO',
    employeeNumber: `ANON-${emp.id.slice(0,8)}`,
    rfc: null,   // NULL permite duplicados en SQL UNIQUE
    curp: null,
    nss: null,
    isActive: false,
  },
});
```

- Criterio de aceptación: tras resolver una CANCELLATION ARCO, los campos RFC/CURP/NSS del empleado quedan en NULL.

#### RT-P0.12 — Añadir RIESGO_TRABAJO y PATERNIDAD a `diasIncapacidad`

```ts
// stps-report.ts:501-502, incidences/route.ts:166-167, export/route.ts:822
else if (v.type === 'INCAPACIDAD' || v.type === 'MATERNIDAD' || v.type === 'RIESGO_TRABAJO' || v.type === 'PATERNIDAD')
  diasIncapacidad += d;
```

- Criterio de aceptación: el reporte STPS muestra `diasIncapacidad` incluyendo riesgos de trabajo y paternidades.

#### RT-P0.13 — Calcular prima vacacional

```ts
// src/lib/vacation-calculator.ts (nuevo)
export function computePrimaVacacional(
  days: number,
  dailySalary: number,
  rate = 0.25
): number {
  return days * dailySalary * rate;
}

export function accrualByYearsOfService(hireDate: Date, asOf: Date): number {
  const years = Math.floor((asOf.getTime() - hireDate.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (years <= 0) return 0;
  if (years === 1) return 12;
  if (years === 2) return 14;
  if (years === 3) return 16;
  if (years === 4) return 18;
  if (years === 5) return 20;
  return 20 + (years - 5) * 2; // +2 por año desde el año 6
}
```

- Exponer en `/api/vacations/balance/[employeeId]` y en reportes de nómina.
- Criterio de aceptación: el endpoint de balance devuelve `{ primaVacacional: <monto> }` además de `availableDays`.

### P1 — Críticos para cumplimiento integral (pueden esperar a Q1 2027)

#### RT-P1.1 — Accrual automático por aniversario

- Cron anual (1 de enero) que para cada empleado activo:
  1. Calcule `accrualByYearsOfService(hireDate, hoy)`.
  2. Actualice `vacationBalanceDays` y `vacationBalanceDays{currentYear}`.
- UI: capturar `hireDate` y `baseSalary` en `EmployeeFormDialog` (`admin-layout.tsx:1863`).

#### RT-P1.2 — Validar saldo suficiente antes de aprobar/otorgar

```ts
// vacations/route.ts POST y vacations/[id]/route.ts PUT
if (type === 'VACACIONES' && !isPartial && days > emp.vacationBalanceDays) {
  return NextResponse.json(
    { error: `Saldo insuficiente. Solicitado: ${days}, disponible: ${emp.vacationBalanceDays}.` },
    { status: 400 }
  );
}
```

#### RT-P1.3 — Validar duración de maternidad y paternidad

```ts
if (type === 'MATERNIDAD' && days > 84) return 400 'La maternidad excede 12 semanas (LSS art. 101)';
if (type === 'PATERNIDAD' && days > 5) return 400 'La paternidad excede 5 días (LFT art. 132 Bis)';
```

#### RT-P1.4 — Folio IMSS obligatorio al aprobar

```ts
// vacations/[id]/route.ts PUT, antes de updateMany
if (status === 'APPROVED' && ['INCAPACIDAD', 'MATERNIDAD', 'RIESGO_TRABAJO'].includes(existing.type)) {
  if (!folioIMSS || folioIMSS.trim() === '') {
    return 400 'Folio IMSS obligatorio para aprobar incapacidades (LSS art. 15)';
  }
  // Validar regex
  if (!/^[A-Z0-9]{8,15}$/.test(folioIMSS.trim())) {
    return 400 'Formato de folio IMSS inválido';
  }
}
```

#### RT-P1.5 — Cerrar vulnerabilidad de quick-login

```ts
// auth/quick-login/route.ts
// Opción A: eliminar el endpoint
// Opción B: exigir header secreto de kiosko + IP allowlist + rate limit real en el handler
const kioskSecret = req.headers.get('x-kiosk-secret');
if (kioskSecret !== process.env.KIOSK_SECRET) return 401;
// Rate limit: máximo 5 intentos por IP cada 10 min
```

#### RT-P1.6 — Bug de scoping para SUPERVISOR

```ts
// stps-format/route.ts:74 y export/route.ts:67-68
const effectiveSucursalId = (user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR')
  ? user.sucursalId
  : requestedSucursalId;
```

#### RT-P1.7 — Política de contraseñas

```ts
// employees/route.ts POST y reset-password/route.ts
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
if (!PASSWORD_REGEX.test(password)) {
  return 400 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula, un número y un símbolo';
}
```

#### RT-P1.8 — MFA encryption key separada

- Añadir env var `MFA_ENCRYPTION_KEY` (32 bytes aleatorios).
- Modificar `src/lib/auth.config.ts:210` para usar `process.env.MFA_ENCRYPTION_KEY` en lugar de `NEXTAUTH_SECRET`.
- Crear migración que re-encripte todos los `mfaSecret` existentes.

#### RT-P1.9 — NSS en reporte STPS

```ts
// stps-report.ts catálogo de trabajadores
nss: emp.nss || 'NO CAPTURADO',
```

- Añadir columna "NSS" al catálogo y al PDF.

#### RT-P1.10 — `mydata` con RFC/CURP/NSS

```ts
// mydata/route.ts:52-81
const employee = await db.employee.findUnique({
  where: { userId: user.id },
  select: {
    id: true, employeeNumber: true, position: true, department: true,
    hireDate: true, baseSalary: true, vacationBalanceDays: true,
    rfc: true, curp: true, nss: true,  // ← añadir
    sucursal: { select: { name: true, address: true } },
    workSchedules: true,
  },
});
```

#### RT-P1.11 — SLA ARCO con días hábiles

```ts
// lib/business-days.ts (nuevo)
export function addBusinessDays(start: Date, days: number, holidays: Date[]): Date {
  let current = new Date(start);
  let added = 0;
  while (added < days) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.some(h => h.getTime() === current.getTime());
    if (!isWeekend && !isHoliday) added++;
  }
  return current;
}

// admin/arco/requests/route.ts
const holidays = await db.holiday.findMany({ where: { date: { gte: start } } });
const deadline = addBusinessDays(r.createdAt, 20, holidays.map(h => h.date));
const isOverdue = r.status === 'PENDING' && new Date() > deadline;
```

### P2 — Mejoras necesarias (Q2 2027)

- RT-P2.1: Persistir `overtimeExcessMinutes` para trazabilidad (H-5.B).
- RT-P2.2: Refactorizar `computeWeeklyAccumulatedOvertime` con Luxon (H-6.A).
- RT-P2.3: Trigger automático de recálculo tras corrección (H-6.B).
- RT-P2.4: Refinar `isSunday` por minutos realmente trabajados en domingo (H-8.B).
- RT-P2.5: Validar que domingo sea descanso semanal para prima dominical (H-8.C).
- RT-P2.6: Implementar vencimiento de vacaciones (art. 81) (H-10.D).
- RT-P2.7: Calcular % de salario por incapacidad (60%/100%) (H-12.D).
- RT-P2.8: Eliminar fallback `'dev-only-fallback-secret'` (H-14.C).
- RT-P2.9: Validar PIN de firma con bcrypt (H-14.D).
- RT-P2.10: Modal de consentimiento específico para geolocalización (H-16.A).
- RT-P2.11: Regex SAT para RFC y RENAPO para CURP (H-21.F).
- RT-P2.12: Ajustar umbral de comida por tipo de jornada (H-4.A).
- RT-P2.13: Filtrar registros sin NSS en reporte IMSS (H-13.B).

### P3 — Deuda técnica y documental

- RT-P3.1: Sellado de tiempo RFC 3161 (opcional) (H-14.E).
- RT-P3.2: Quitar `enableHighAccuracy: true` si no se requiere (H-16.B).
- RT-P3.3: Leer `CURRENT_PRIVACY_VERSION` en `privacy-consent.tsx` (H-17.E).
- RT-P3.4: Proteger `/api/download/tabla-cumplimiento-legal` con auth (H-18.C).
- RT-P3.5: Corregir comentarios engañosos del schema (H-11.B).
- RT-P3.6: Tests automatizados para `calculateOvertime`, `classifyShift`, `getWeeklyOvertimeCapMinutes`, `computeWeeklyAccumulatedOvertime`. **No existe ningún `*.test.ts` en el repo.**
- RT-P3.7: Documentar decisión de delegar prima nocturna y prima dominical a nómina externa (H-9.A, H-9.B).

### P4 — Cumplimiento NOM-035 y NOM-037 (roadmap Q3-Q4 2027)

- RT-P4.1: Construir módulo NOM-035 completo (encuesta 73 preguntas, indicadores B/C/D, política).
- RT-P4.2: Añadir `workMode: 'PRESENCIAL' | 'TELETRABAJO' | 'HIBRIDO'` a Employee.
- RT-P4.3: Crear `TeletrabajoAgreement` (equipo, reembolso, horario).
- RT-P4.4: Implementar derecho a la desconexión (bloqueo de notificaciones fuera de horario).
- RT-P4.5: Sucursal virtual "HOME_OFFICE" que omita geofence.

---

## 23. Interrogatorio al código — 36 preguntas

A continuación, 36 preguntas técnicas que el auditor formula al código. Cada pregunta incluye la respuesta verificada mediante lectura estática.

### Jornada y overtime

1. **¿Dónde se define el tope semanal de 48/46/44/42/40 horas?**
   Respuesta: **NO se define en ningún lado.** No existe campo en `WorkSchedule`, no existe tabla `JornadaConfig`, no existe constante. El sistema permite configurar horarios semanales que violan el art. 61 LFT.

2. **¿Qué función calcula el tope de horas extra semanales y cómo se comporta en 2028?**
   Respuesta: `src/lib/overtime-calculator.ts:66-71` `getWeeklyOvertimeCapMinutes(year)`. En 2028 retorna `10 * 60 = 600 min`. **Esto es jurídicamente incorrecto** — el art. 66 LFT es fijo en 9 h (540 min) para todos los años.

3. **¿Dónde se descarta el excedente sobre 4 horas extra diarias y se registra ese exceso?**
   Respuesta: `overtime-calculator.ts:271` `const overtimeDaily = Math.min(overtimeMinutes, DAILY_OVERTIME_CAP_MINUTES);`. **El exceso NO se persiste ni se reporta.** Se pierde sin trazabilidad.

4. **¿Cómo se calcula `overtimeWeeklyAccumulated` y qué pasa si se corrige un check-out de un día anterior?**
   Respuesta: `computeWeeklyAccumulatedOvertime` (líneas 366-386) suma los registros previos de la semana. Tras una corrección, los registros de días posteriores **NO recalculan** automáticamente su acumulador. Queda stale hasta invocar manualmente `/api/admin/recalc-overtime`.

5. **¿Cómo se determina si un día es "de descanso trabajado" y se aplica la prima del 100 %?**
   Respuesta: `overtime-calculator.ts:155` `const isRestDayWorked = schedule === null || (schedule?.isWeeklyRest === true);`. **BUG**: `schedule === null` incluye días no programados (no descanso), generando sobrepago injustificado de prima del 100 %.

6. **¿Qué función clasifica el turno en DIURNA/NOCTURNA/MIXTA y usa el umbral correcto de 3.5 h nocturnas?**
   Respuesta: `src/lib/shift-classifier.ts:119-139` `classifyShift(checkIn, checkOut)`. Usa `NIGHT_SHIFT_THRESHOLD_MINUTES = 210` (3.5 h) con `>=`. **Correcto per art. 60 LFT** ("igual o mayor a tres horas y media").

7. **¿Dónde se calcula la prima nocturna del 25 % como monto monetario?**
   Respuesta: **NO se calcula en ningún lado.** El sistema solo persiste `nightMinutes` y `shiftType`. El cálculo monetario se delega a nómina externa (decisión documentada en `check-out/route.ts:218-220`).

8. **¿Dónde se calcula la prima dominical del 25 % como monto monetario?**
   Respuesta: **NO se calcula en ningún lado.** El sistema solo persiste el flag `isSunday` y el conteo `domingosTrabajados`. El cálculo se delega a nómina externa.

9. **¿Qué ventana horaria se usa para clasificar minutos nocturnos y respeta el huso horario de Mexico City?**
   Respuesta: `shift-classifier.ts:69-105` `nightMinutesBetween`. Usa Luxon con `America/Mexico_City`. Ventana `[20:00, 06:00 next day]`. Safety limit 7 días. **Correcto.**

10. **¿Cómo se valida que un horario semanal tenga al menos 1 día de descanso (art. 71 LFT)?**
    Respuesta: `src/lib/work-schedule.ts:35-70` `validateWorkSchedules()`. Comprueba `arr.some((s) => s.isWeeklyRest === true)`. Si no hay, rechaza con error. **Correcto.**

### Vacaciones e incapacidades

11. **¿Dónde se calcula la prima vacacional del 25 % sobre salario × días de vacaciones?**
    Respuesta: **NO se calcula en ningún lado.** Búsqueda global de `primaVacacional|0\.25.*vac|25%.*vac` no arrojó resultados. El comentario del schema `prisma/schema.prisma:164` es engañoso.

12. **¿Dónde se aplica la tabla del art. 76 LFT (12, 14, 16, 18, 20, +2/año) para accrual automático?**
    Respuesta: **NO se aplica en ningún lado.** El campo `hireDate` existe en el schema pero la UI no lo captura (`admin-layout.tsx:1863-2080`) y no existe función `accrualByYearsOfService`. Los saldos se cargan manualmente vía `/api/vacations/bulk-load`.

13. **¿Qué pasa si un admin otorga 20 días de vacaciones a un empleado con saldo de 5 días?**
    Respuesta: El sistema **NO rechaza**. `vacations/route.ts:332` `const newBalance = Math.max(0, emp.vacationBalanceDays - days);` satura el saldo a 0 sin alerta. **Bug de validación.**

14. **¿Dónde se valida que una maternidad no exceda 12 semanas (84 días, LSS art. 101)?**
    Respuesta: **NO se valida en ningún lado.** Búsqueda de `84|12\s*semanas|art\.?\s*101` no arrojó validación. El admin puede crear maternidad de cualquier duración.

15. **¿Dónde se valida que la paternidad no exceda 5 días (art. 132 Bis LFT)?**
    Respuesta: **NO se valida en ningún lado.** El admin puede otorgar 10 días de paternidad.

16. **¿Cómo se contabilizan los días de RIESGO_TRABAJO en el reporte STPS `diasIncapacidad`?**
    Respuesta: **NO se contabilizan.** `stps-report.ts:501-502`, `incidences/route.ts:166-167` y `export/route.ts:822` solo suman `INCAPACIDAD` y `MATERNIDAD`. **Bug crítico** — discrepancia con SUA/IDSE.

17. **¿Es obligatorio capturar el folio IMSS al aprobar una incapacidad?**
    Respuesta: **NO.** La UI muestra asterisco `*` en el label pero el botón Aprobar no bloquea si el input está vacío (`admin-layout.tsx:3636-3639`). Tampoco hay regex de validación.

18. **¿Dónde se computa el porcentaje de salario durante incapacidad (60 % enfermedad, 100 % maternidad/RT)?**
    Respuesta: **NO se computa en ningún lado.** Solo se cuentan días. Se asume en nómina externa.

19. **¿Qué campo almacena el folio IMSS y dónde se valida su formato?**
    Respuesta: `Vacation.folioIMSS String?` (`prisma/schema.prisma:323-329`). **No hay validación de formato** — cualquier string se acepta.

20. **¿Existe lógica de vencimiento de vacaciones (art. 81 LFT, 6 meses post-aniversario)?**
    Respuesta: **NO.** No hay campo `expiresAt` ni cron. Las vacaciones nunca caducan en el sistema.

### Trazabilidad, firmas y registro electrónico

21. **¿Dónde se invoca desde el front-end el endpoint `/api/attendance/sign`?**
    Respuesta: **NO se invoca desde ningún lado.** Búsqueda de `/attendance/sign` y `ATTENDANCE_SIGN` en `src/components/` no arrojó resultados. El endpoint es **código muerto** desde el front-end.

22. **¿Dónde se documenta el "acuerdo" formal patrón-trabajador sobre el registro electrónico (art. 132 XXXIV LFT)?**
    Respuesta: **NO existe.** Búsqueda de `acuerdo|agreement|signed agreement` no arrojó modelo, endpoint ni UI. El Aviso de Privacidad (LFPDPPP) NO es equivalente al "acuerdo" del art. 132 XXXIV LFT.

23. **¿El AuditLog es tamper-evident? ¿Tiene hash chaining?**
    Respuesta: **NO.** `prisma/schema.prisma:367-383` no tiene `previousHash` ni `recordHash`. Cualquier `UPDATE` directo a la DB no se detecta. **Débil ante pericial.**

24. **¿Dónde se elimina o archiva automáticamente un `AttendanceRecord` después de 12 meses (art. 804 LFT)?**
    Respuesta: **NO se elimina ni archiva en ningún lado.** No hay cron, no hay TTL. El Aviso de Privacidad lo promete pero el código no lo cumple.

25. **¿El PDF STPS que se exhibe ante la STPS incluye el hash de firma del trabajador?**
    Respuesta: **NO.** Búsqueda de `signature|firma|hash|HMAC|signedAt` en `src/lib/stps-pdf.ts` arrojó 0 matches. **Debilita el argumento de "prueba plena".**

26. **¿El timestamp de check-in/check-out usa hora del cliente o del servidor?**
    Respuesta: **Servidor.** `check-in/route.ts:147` y `check-out/route.ts:114` usan `new Date()`. Mexico TZ vía `lib/timezone.ts:11-12` con Luxon. **Correcto.**

27. **¿Qué secreto se usa para el HMAC de firma y tiene fallback inseguro?**
    Respuesta: `attendance/sign/route.ts:108` `process.env.NEXTAUTH_SECRET || process.env.SIGNATURE_SECRET || 'dev-only-fallback-secret-change-in-prod'`. **Fallback inseguro** — si faltan env vars, todas las firmas son vulnerables.

28. **¿Cómo se valida el PIN de firma del empleado?**
    Respuesta: **NO se valida.** Cualquier PIN ≥4 caracteres se acepta (`attendance/sign/route.ts:55-60`). No hay `signaturePinHash` persistido. El PIN es una sal aleatoria, no un PIN real.

### Privacidad y ARCO

29. **¿El texto del Aviso de Privacidad tiene datos reales del responsable o son placeholders?**
    Respuesta: **Placeholders.** `aviso-de-privacidad/page.tsx:78-91` usa `[REDACTAR_POR_ABOGADO]` en razón social, domicilio, DPO. **No cumple art. 16 fr. I LFPDPPP.**

30. **¿La anonimización ARCO borra RFC, CURP y NSS del empleado?**
    Respuesta: **NO.** `lib/privacy.ts:160-169` solo cambia `position` y `department` a `'ANONIMIZADO'`. RFC, CURP, NSS (todos `@unique`) se conservan. **Incumple art. 31 LFPDPPP.**

31. **¿El cálculo del SLA de ARCO (20 días hábiles) excluye sábados, domingos y feriados mexicanos?**
    Respuesta: **NO.** `admin/arco/requests/route.ts:60-64` usa `legalDeadlineNaturalDays = 28` (aproximación). Hasta ±4 días de error respecto al cálculo legal correcto.

32. **¿El endpoint `/api/user/mydata` devuelve RFC, CURP y NSS al titular?**
    Respuesta: **NO.** `mydata/route.ts:52-81` omite `rfc`, `curp`, `nss` en el select de Employee. El titular no recibe sus propios identificadores fiscales al ejercer el derecho de acceso (art. 29 LFPDPPP).

### Seguridad y reportes

33. **¿El endpoint `/api/auth/quick-login` exige password o MFA?**
    Respuesta: **NO.** Acepta `{ userId }` sin credenciales y emite JWT. Público en `middleware.ts:69`. Rate limit documentado pero NO implementado en el handler. **Vulnerabilidad crítica de impersonación.**

34. **¿Los reportes STPS y export filtran por sucursal cuando el usuario es SUPERVISOR?**
    Respuesta: **NO.** `stps-format/route.ts:74` y `export/route.ts:67-68` solo aplican el filtro `sucursalId` para `SUCURSAL_ADMIN`, no para `SUPERVISOR`. **Escape horizontal de datos.**

35. **¿El reporte STPS incluye la columna NSS (art. 804 fr. II LFT)?**
    Respuesta: **NO.** `stps-format/route.ts:312-334` incluye RFC y CURP pero NO NSS. El NSS solo aparece en el reporte IMSS. **Incumple art. 804 fr. II LFT.**

36. **¿Existe encuesta NOM-035 (cuestionario de 73 preguntas) implementada en el sistema?**
    Respuesta: **NO.** Búsqueda de `encuesta|survey|cuestionario|psicosocial` no arrojó ni modelo, ni endpoint, ni UI. Solo existen alertas algorítmicas de jornada excesiva (categoría A.5). **Cumplimiento NOM-035 ≈ 25 %.**

---

## 24. Conclusión final — cambios indispensables antes del 1 de enero de 2027

### Diagnóstico general

El sistema auditado es una aplicación **técnicamente sólida en su capa de datos y reglas de negocio core**, con una arquitectura bien diseñada para control de asistencia presencial, cálculo de overtime con distinción dobles/triples, geofence por sucursal, alertas NOM-035 algorítmicas, y reportes exportables (STPS art. 804, IMSS art. 15 LSS). La infraestructura de autenticación (NextAuth + MFA TOTP), privacidad (Aviso de Privacidad con versión + consentimiento forzado + ARCO + anonimización) y auditoría (AuditLog transversal con IP/UA) está **presente y funciona**.

Sin embargo, el sistema **NO puede demostrar jurídicamente cumplimiento pleno** del art. 132 XXXIV LFT (registro electrónico de jornada) a partir del 1 de enero de 2027, y presenta **errores de cálculo que producirán pago incorrecto a partir de 2028** o sobrepago inmediato.

### Cambios indispensables antes del 1 de enero de 2027

A continuación, los **13 cambios bloqueantes** que deben completarse antes de la entrada en vigor de la obligación específica de registro electrónico de jornada. Sin estos, el sistema no hace "prueba plena" ante una inspección STPS o un juicio laboral.

#### Bloque 1 — Bugs de cálculo (pueden producir pago incorrecto inmediato)

1. **Corregir `getWeeklyOvertimeCapMinutes`** a retorno fijo `9 * 60` (art. 66 LFT). Sin esto, a partir de 2028 el sistema sub-pagará triples. *(RT-P0.2)*

2. **Corregir detección de descanso trabajado** en `check-out/route.ts:116` para que `isRestDayWorked` solo se active cuando exista `WorkSchedule.isWeeklyRest=true` para ese día, no cuando `schedule === null` por día no programado. Sin esto, hay sobrepago injustificado de prima del 100 %. *(RT-P0.3)*

3. **Implementar tope semanal de jornada** (art. 61 LFT) con tabla `JornadaConfig` + validación en `validateWorkSchedules` + UI counter. Sin esto, el sistema permite configurar horarios semanales ilegales (>48 h en 2026, >46 h en 2027). *(RT-P0.1)*

4. **Añadir RIESGO_TRABAJO y PATERNIDAD a `diasIncapacidad`** en los 3 reportes (STPS, incidences, export). Sin esto, el reporte STPS no refleja la realidad de incapacidades y discrepa con SUA/IDSE. *(RT-P0.12)*

#### Bloque 2 — Prueba plena (art. 132 XXXIV LFT)

5. **Crear el modelo `ElectronicRecordAgreement` y el flujo de onboarding** que exija al empleado aceptar el acuerdo de registro electrónico antes de poder hacer check-in. Sin esto, el registro NO hace "prueba plena si fue acordado". *(RT-P0.5)*

6. **Añadir UI que invoque `/api/attendance/sign`** para que el trabajador pueda firmar sus registros con PIN. Sin esto, el endpoint HMAC-SHA256 es código muerto y la firma nunca se materializa. *(RT-P0.6)*

7. **Implementar hash chaining en AuditLog** (campos `previousHash` y `recordHash` + endpoint `/api/audit/verify`). Sin esto, cualquier `UPDATE` directo a la DB no se detecta y la bitácora no es evidence-grade. *(RT-P0.7)*

8. **Implementar cron de retención 12 meses** (archival de `AttendanceRecord` >12 meses de empleados inactivos). Sin esto, la política declarada en el Aviso de Privacidad no se cumple en código y el sistema no puede garantizar conservación ni supresión. *(RT-P0.8)*

9. **Incluir hash de firma en el PDF STPS** (sección 3, columna "Firmado" con fecha y hash truncado). Sin esto, el PDF que se exhibe ante la STPS no demuestra que el trabajador firmó. *(RT-P0.9)*

#### Bloque 3 — Privacidad y datos personales (LFPDPPP)

10. **Redactar el Aviso de Privacidad con datos reales del responsable** (razón social, domicilio, DPO) en lugar de placeholders `[REDACTAR_POR_ABOGADO]`. Sin esto, no cumple art. 16 fr. I LFPDPPP y hay riesgo de sanción INAI. *(RT-P0.10)*

11. **Completar la anonimización ARCO** para poner `null` los campos RFC, CURP, NSS del empleado al resolver una CANCELLATION. Sin esto, el derecho de cancelación es cosmético y los identificadores reversibles a identidad se conservan. *(RT-P0.11)*

#### Bloque 4 — Corrección documental

12. **Corregir la cita legal "DOF 1-may-2026" → "DOF 27-dic-2024"** en los 6 lugares identificados (código, comentarios, documentación legal, manual de usuario, PDF de cumplimiento). Sin esto, la cita errónea de la fecha del decreto debilita la credibilidad probatoria. *(RT-P0.4)*

13. **Calcular prima vacacional (art. 80 LFT)** con función `computePrimaVacacional(days, dailySalary, rate=0.25)` y exponerla en el endpoint de balance y reportes de nómina. Sin esto, el sistema no garantiza cumplimiento del art. 80 LFT (prima mínima 25 %). *(RT-P0.13)*

### Cambios indispensables antes del 1 de enero de 2028

Los siguientes 8 cambios deben completarse durante 2027, idealmente en Q1-Q2:

14. Cerrar vulnerabilidad de `/api/auth/quick-login` (exigir header secreto + IP allowlist + rate limit real). *(RT-P1.5)*
15. Bug de scoping para SUPERVISOR en STPS y export (escape horizontal de datos). *(RT-P1.6)*
16. Política de contraseñas (mínimo 8 + complejidad). *(RT-P1.7)*
17. MFA encryption key separada de `NEXTAUTH_SECRET`. *(RT-P1.8)*
18. NSS en reporte STPS (art. 804 fr. II LFT). *(RT-P1.9)*
19. `mydata` con RFC/CURP/NSS para el titular (art. 29 LFPDPPP). *(RT-P1.10)*
20. SLA ARCO con días hábiles reales (excluyendo feriados mexicanos). *(RT-P1.11)*
21. Folio IMSS obligatorio al aprobar incapacidades + regex de validación. *(RT-P1.4)*

### Cambios indispensables para cumplimiento NOM-035 y NOM-037 (roadmap)

La NOM-035-STPS-2018 y la NOM-037-STPS-2023 son obligaciones vigentes desde 2019 y 2024 respectivamente. El sistema actual cumple ~25 % de NOM-035 (solo alertas A.5) y ~5 % de NOM-037 (solo branding). Para cumplimiento pleno se requiere construir dos módulos completos:

- **Módulo NOM-035**: modelo `PsychosocialSurvey` con cuestionario 73 preguntas, indicadores de violencia/rotación/conflicto trabajo-familia, política de prevención documentada. *(RT-P4.1)*
- **Módulo NOM-037**: `workMode` en Employee, `TeletrabajoAgreement` (equipo, reembolso, horario), derecho a la desconexión, sucursal virtual HOME_OFFICE. *(RT-P4.2 a RT-P4.5)*

Estos módulos pueden priorizarse según el perfil real de la empresa: si no hay teletrabajo (>40 % del tiempo), NOM-037 no aplica; si hay menos de 50 trabajadores, NOM-035 tiene exigencias simplificadas.

### Declaración final del auditor

El sistema, en su estado actual (commit `200d595` + `db22cc0`), **NO está listo para la entrada en vigor del registro electrónico de jornada el 1 de enero de 2027**. Los 13 cambios del Bloque 1-4 son **bloqueantes** y deben completarse antes de esa fecha. Los 8 cambios de la lista 14-21 son críticos para cumplimiento integral y deben completarse durante 2027.

Sin estos cambios, el patrón que use este sistema enfrenta tres riesgos concretos:

1. **Riesgo laboral**: pago incorrecto de horas extra a partir de 2028 (sub-pago de triples) y sobrepago inmediato de prima por descanso trabajado en días no programados. Posibles demandas laborales por diferencias salariales.

2. **Riesgo administrativo**: sanciones STPS por incumplimiento del art. 132 XXXIV LFT (sin acuerdo formal, sin firma del trabajador, sin bitácora tamper-evident). Multas de 250 a 5000 veces la UMA (aprox. 25,000 a 500,000 MXN) según gravedad.

3. **Riesgo de protección de datos**: sanciones INAI por Aviso de Privacidad con placeholders (art. 16 fr. I LFPDPPP) y anonimización ARCO incompleta (art. 31 LFPDPPP). Multas de 100 a 320,000 días de salario mínimo general vigente en el Distrito Federal.

**Recomendación final**: priorizar la ejecución del Bloque 1 (bugs de cálculo) en las próximas 2 semanas, el Bloque 2 (prueba plena) en octubre-noviembre 2026, y los Bloques 3-4 en diciembre 2026. Antes del 31 de diciembre de 2026, ejecutar una auditoría de regresión completa para verificar que los 13 cambios bloqueantes están en producción.

---

### Anexo A — Archivos examinados (lista completa)

**Librerías core** (`src/lib/`):
- `overtime-calculator.ts` (390 líneas)
- `shift-classifier.ts` (164)
- `work-schedule.ts` (71)
- `absence-calculator.ts` (247)
- `reports.ts` (129)
- `stps-report.ts` (590)
- `stps-pdf.ts`
- `timezone.ts` (121)
- `auth.ts`, `auth.config.ts`
- `privacy.ts` (244)
- `rbac.ts`
- `rate-limit.ts`
- `audit.ts`
- `geo.ts`
- `realtime.ts`

**Endpoints API** (42 rutas):
- `/api/attendance/{check-in,check-out,meal-start,meal-end,rest-start,rest-end,meal-cancel,rest-cancel,justify,sign,today,history,monthly-calendar,[id]}`
- `/api/admin/{recalc-overtime,recalc-shift,recalc-status,recalc-vacations,arco/requests,arco/[id]/resolve}`
- `/api/reports/{overtime,employee-overtime,daily,incidences,comparative,my-export,export,stps-format,imss-format,absences,corrections}`
- `/api/vacations/{route,[id],balance/[employeeId],bulk-load}`
- `/api/employees/{route,[id],[id]/qr,[id]/transfer}`
- `/api/auth/{[...nextauth],login,logout,me,refresh,qr-login,quick-login,users-list,mfa/setup,mfa/verify,mfa/disable}`
- `/api/user/{mydata,privacy/status,privacy/accept,arco/request}`
- `/api/{alerts/nom-035,alerts/notifications,alerts/supervisor-alerts,download,download/tabla-cumplimiento-legal,manual/pdf,company,company/logo,holidays,sucursales,work-schedules,users,users/[id],users/[id]/reset-password,users/[id]/unlock,audit,diagnose-db,migrate/add-nss-folio-imss,migrate/add-vacation-year-columns,qr/dynamic,seed,health}`

**Schemas Prisma**:
- `prisma/schema.prisma` (400 líneas, SQLite dev)
- `prisma/schema.postgres.prisma` (401 líneas, PostgreSQL prod)
- `prisma/seed.ts` (213)

**UI**:
- `src/components/layout/admin-layout.tsx` (9316 líneas, examen focalizado)
- `src/components/layout/employee-layout.tsx`
- `src/components/legal/{privacy-consent,privacy-consent-modal,arco-form}`
- `src/components/admin/{notification-bell,supervisor-alerts-bell}`
- `src/components/{providers,qr/*,reports/*,shared/*,auth/*,manual/*}`

**Documentación legal**:
- `documentos/cumplimiento-lft-2027.md` (376)
- `scripts/gen-legal-compliance-pdf.py`
- `public/tabla-comparativa-cumplimiento-legal.pdf`
- `src/app/legal/{aviso-de-privacidad,derechos-arco}/page.tsx`

**Otros**:
- `src/middleware.ts`
- `src/app/layout.tsx`, `src/app/page.tsx`
- `PROJECT.md`

**Total**: 178 archivos fuente examinados.

---

### Anexo B — Métricas del audit

| Métrica | Valor |
|---------|------:|
| Archivos examinados | 178 |
| Líneas de código inspeccionadas | ~28,000 |
| Hallazgos totales | 59 |
| 🔴 CRÍTICOS | 21 |
| 🟠 ALTOS | 8 |
| 🟡 MEDIOS | 17 |
| 🟢 BAJOS | 11 |
| ⚪ FUERA DE ALCANCE | 2 |
| Preguntas de interrogatorio | 36 |
| Requisitos técnicos (P0) | 13 |
| Requisitos técnicos (P1) | 11 |
| Requisitos técnicos (P2) | 13 |
| Requisitos técnicos (P3) | 7 |
| Requisitos técnicos (P4) | 5 |
| Tests automatizados existentes | 0 |
| Cambios bloqueantes para 1/1/2027 | 13 |
| Cambios críticos para 1/1/2028 | 8 |

---

**Fin del documento de auditoría.**

> Este documento constituye una auditoría técnica de cumplimiento normativo basada en lectura estática del código fuente. No sustituye el dictamen de un abogado laboralista mexicano colegiado. Las recomendaciones se emiten con base en el estado del código al 14 de agosto de 2026 (commits `200d595` + `db22cc0`) y pueden requerir actualización si el código cambia.
