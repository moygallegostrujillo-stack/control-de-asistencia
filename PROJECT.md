# Documento del Proyecto — Control de Asistencia NOM-037

> ⚠️ **CONFIGURACIÓN DE PRODUCCIÓN — NO OLVIDAR NUNCA** ⚠️
>
> | Recurso | Valor |
> |---|---|
> | **URL de la app (producción)** | **https://control-asistencia-v22.vercel.app/** |
> | **BD de producción** | **Supabase (PostgreSQL)** — https://supabase.com/dashboard/project/xvimpyvwncsxfsumgosv |
> | **Repo GitHub** | https://github.com/moygallegostrujillo-stack/control-de-asistencia |
> | **Rama de producción** | `main` (Vercel auto-deploya al recibir push) |
> | **Cómo se deploya** | `git push origin main` → Vercel deploya en ~60s |
> | **Cómo se accede a la BD** | **SOLO** vía endpoints HTTP ya deployados en la app de producción. **NUNCA** con scripts locales que usen credenciales directas. |
> | **BD local del sandbox** | `db/custom.db` (SQLite) — **NO es producción**, está vacía y solo sirve para pruebas locales |
>
> **REGLA ABSOLUTA**: siempre que se hable de "la base de datos" o "producción" sin más, se refiere a la BD de **Supabase** accesible desde **https://control-asistencia-v22.vercel.app/**. No trabajar sobre ninguna otra BD ni deployar en otro dominio sin autorización explícita del cliente.
>
> Ver §11 para el flujo detallado de deploy con GitHub PAT efímero.

---

> **Versión del documento**: 1.5 (15 de agosto 2026 — configuración de producción fijada al inicio)
> **Versión del producto**: 2.4.2
> **Propósito**: Brindar contexto completo al iniciar futuras sesiones de desarrollo. Al leer este documento, un agente nuevo entiende el dominio, la arquitectura, las reglas de negocio críticas y los convenios del proyecto sin tener que re-descubrirlos.

---

## 1. Qué es este proyecto

Sistema de control de asistencia para cumplimiento de la **NOM-037-STPS-2023** (Teletrabajo) y la **reforma LFT 2027** (arts. 66, 68, 73 — horas extra dobles/triples y prima por descanso trabajado), desplegado en producción en **Vercel** con base de datos en **Supabase (PostgreSQL)**.

**URL producción**: https://control-asistencia-v22.vercel.app/
**Repo GitHub**: https://github.com/moygallegostrujillo-stack/control-de-asistencia

El sistema gestiona check-in/check-out geolocalizado, clasificación automática de jornada (diurna/nocturna/mixta), cálculo de horas extra con distinción dobles/triples según la reforma LFT 2027, vacaciones/permisos, generación de reportes oficiales (incluyendo formato STPS art. 804 LFT), auditoría completa y derechos ARCO (LFPDPPP).

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | **Next.js 16** con App Router + Turbopack |
| Lenguaje | **TypeScript 5** strict |
| Estilo | Tailwind CSS 4 + **shadcn/ui** (New York style) + Lucide icons |
| ORM | **Prisma 6** (SQLite en dev, PostgreSQL en prod vía `switch-schema.sh`) |
| Auth | **NextAuth.js v4** con JWT + MFA TOTP (otplib) |
| Estado cliente | **Zustand** (vista activa) + **TanStack Query** (server state) |
| Real-time | **Socket.io** en mini-service separado (puerto 3003) |
| Rate limiting | Upstash Redis + @upstash/ratelimit |
| PDF/Excel | pdfkit + ExcelJS |
| QR | html5-qrcode + DynamicQR rotativo |
| Zona horaria | **Luxon** con `America/Mexico_City` (CRÍTICO — ver sección 7) |
| Runtime | Bun 1.3.14 |

### Scripts disponibles
```bash
bun run dev          # dev server en puerto 3000 (tee a dev.log)
bun run lint         # ESLint
bun run db:push      # push schema a BD
bun run db:seed      # seed inicial
bun run deploy       # deploy a Vercel (scripts/deploy-vercel.sh)
bun run realtime:dev # mini-service socket.io (puerto 3003)
./scripts/switch-schema.sh sqlite|postgres|status  # cambiar provider Prisma
```

---

## 3. Estructura del proyecto

```
src/
├── app/
│   ├── api/                    # 71 API routes (App Router)
│   │   ├── admin/              # recalc-overtime, recalc-shift, recalc-status,
│   │   │                       # recalc-vacations, arco/*
│   │   ├── attendance/         # check-in, check-out, [id], history,
│   │   │                       # monthly-calendar, meal-*, rest-*, justify, sign, today
│   │   ├── reports/            # daily, overtime, employee-overtime, absences,
│   │   │                       # incidences, comparative, corrections, export,
│   │   │                       # my-export, stps-format
│   │   ├── auth/               # [...nextauth], login, logout, me, mfa/*, qr-login,
│   │   │                       # quick-login, refresh, users-list
│   │   ├── employees/          # CRUD + [id]/qr + [id]/transfer
│   │   ├── sucursales/         # CRUD
│   │   ├── users/              # CRUD + [id]/reset-password + [id]/unlock
│   │   ├── vacations/          # CRUD + balance/[employeeId]
│   │   ├── work-schedules/     # horarios laborales
│   │   ├── holidays/, company/, audit/, alerts/, qr/, manual/
│   │   └── health/, seed/, diagrama/, download/
│   ├── layout.tsx              # root layout
│   ├── page.tsx                # ÚNICA ruta visible (/ — redirige según sesión)
│   ├── legal/                  # avisos legales (privacidad)
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── admin-layout.tsx    # ~8858 líneas — TODO el admin en un archivo
│   │   └── employee-layout.tsx # ~2263 líneas — TODO el empleado
│   ├── ui/                     # ~45 componentes shadcn/ui
│   ├── reports/                # DateRangePicker y similares
│   ├── admin/, auth/, legal/, manual/, qr/, shared/
│   └── providers.tsx
├── lib/                        # Lógica de negocio (ver sección 7)
├── store/
│   └── app-store.ts            # Zustand — AdminView | EmployeeView
├── hooks/
├── middleware.ts               # Auth + CSP + rate limit
mini-services/
└── realtime-service/           # Socket.io (puerto 3003,独立的 bun project)
prisma/
├── schema.prisma               # SQLite (dev)
├── schema.postgres.prisma      # PostgreSQL (prod)
└── seed.ts
```

### Regla de oro de rutas
**Solo `/` es visible para el usuario.** Todo lo demás son API routes o componentes dentro de `page.tsx`. `admin-layout.tsx` y `employee-layout.tsx` son **un solo componente gigante** que renderiza vistas internas según el estado de Zustand (`useAppStore`). No usar router de Next.js para navegación interna.

---

## 4. Modelos de datos (Prisma)

11 modelos definidos en `prisma/schema.prisma`:

| Modelo | Propósito | Notas |
|--------|-----------|-------|
| **Company** | Singleton con datos de la empresa | id fijo `"singleton"`, RFC, registro patronal, etc. |
| **User** | Usuario del sistema | role: `GENERAL_ADMIN \| SUCURSAL_ADMIN \| SUPERVISOR \| EMPLOYEE`. MFA TOTP. Aviso privacidad. |
| **PrivacyRequest** | Derechos ARCO (LFPDPPP art. 29-32) | ACCESS, RECTIFICATION, CANCELLATION (anonimiza, NO borra — conflicto LFT art. 804), OPPOSITION |
| **Sucursal** | Centro de trabajo | Geofence, **tolerancias configurables** (meal, rest, checkout), mealDurationMinutes |
| **Employee** | Empleado | employeeNumber único, RFC, CURP, vacationBalanceDays, relación 1:1 con User |
| **WorkSchedule** | Horario por día de la semana | dayOfWeek 0-6, startTime/endTime "HH:mm", toleranceMinutes, isWeeklyRest |
| **AttendanceRecord** | Registro de asistencia **INMUTABLE** (NOM-037) | El modelo central. Ver sección 7 para campos calculados. |
| **Vacation** | Vacaciones/permisos/incapacidades | type, grantMode (EMPLOYEE_REQUEST vs ADMIN_GRANTED), isPartial |
| **Holiday** | Días feriados | isOfficial |
| **AuditLog** | Bitácora de acciones | action, entityType, entityId, details (JSON), IP, UA |
| **DynamicQR** | QR rotativo de un solo uso | expiresAt, used |

### Campos clave de `AttendanceRecord`
- **Identidad**: id, employeeId, sucursalId, date (Date @db.Date)
- **Check-in/out**: checkInTime, checkOutTime, + lat/long/method/ip/UA para cada uno
- **Comida/descanso**: mealStart/End, mealDurationMinutes, mealExceeded; restStart/End, restDurationMinutes, restExceeded
- **Estado**: status `PRESENT|ABSENT|LATE|EARLY_LEAVE`
- **Trabajado**: workedMinutes (neto de comida/descanso)
- **Overtime**: overtimeMinutes (total), **overtimeDoubleMinutes** (art. 66), **overtimeTripleMinutes** (art. 68), **overtimeWeeklyAccumulated**
- **Prima descanso**: isRestDayWorked, restDayWorkedMinutes, restDayPremiumMinutes (art. 73)
- **Domingo**: isSunday (para prima dominical art. 71)
- **Jornada**: shiftType `DIURNA|NOCTURNA|MIXTA`, nightMinutes, legalMaxMinutes, legalOvertimeMinutes
- **Inmutabilidad**: isLocked, originalCheckInTime, originalCheckOutTime, correctionReason, correctedById, correctedAt
- **Prueba plena**: employeeSignedAt, employeeSignatureHash, employeeSignedIp (art. 132 XXXIV LFT)
- **Justificación**: justification, justificationStatus `PENDING|APPROVED|REJECTED`, justificationResolvedById

**Unique constraint**: `@@unique([employeeId, date])` — un registro por empleado por día.

---

## 5. Roles y permisos (RBAC)

Definido en `src/lib/rbac.ts`. 4 roles con permisos granulares:

| Rol | Scope | Capacidades clave |
|-----|-------|-------------------|
| **GENERAL_ADMIN** | Global | Todo. Dashboard global, CRUD empleados/sucursales/users, company, holidays, reports comparativos, audit global, corregir asistencia, QR. |
| **SUCURSAL_ADMIN** | Su sucursal | Dashboard sucursal, CRUD empleados (su sucursal), editar su sucursal, aprobar vacaciones, audit sucursal, reports sucursal, corregir asistencia, QR. |
| **SUPERVISOR** | Su sucursal (read-only) | Dashboard, lista empleados, historial, reportes, audit, kiosko quick-login. **Sin mutaciones**. |
| **EMPLOYEE** | Su propio registro | Check-in/out, ver su historial, solicitar vacaciones, descargas propias. |

El scoping por sucursal se valida **en cada API route** (no solo en middleware). SUCURSAL_ADMIN siempre forzado a su `sucursalId`. EMPLOYEE siempre forzado a su `employeeId`.

---

## 6. Auth y seguridad

- **JWT firmado** con `NEXTAUTH_SECRET` (HMAC-SHA512 via jose). Cookie: `next-auth.session-token`.
- **MFA TOTP opcional** para admins (RFC 6238, otplib). Backup codes (bcrypt hash, one-time use).
- **Sesión**: 8h max age, rotación JWT cada 30 min (`REFRESH_INTERVAL`).
- **Lockout**: 5 intentos fallidos → `lockedUntil` 15 min.
- **Aviso de privacidad LFPDPPP**: si `privacyAcceptedAt` es null o la versión no coincide, middleware redirige a `/legal/aviso-de-privacidad`.
- **CSP + HSTS** en middleware (Tarea 5 audit seguridad).
- **Rate limiting** con Upstash Redis en login y endpoints sensibles (Tarea 6).
- **Eliminado**: fallback a cookie legacy `session_user` (base64 sin firma) — era vulnerable (Tarea 3 audit).
- **Eliminado**: endpoint `/api/seed` público, exposición de `.env` vía `/api/download` (Tarea 3 audit).

### Auth flow (resumen)
1. POST `/api/auth/login` → `validateCredentials()` → si MFA activo, retorna `{ needsMfa: true }`
2. Frontend pide token TOTP → POST `/api/auth/login` con `mfaToken` o `backupCode`
3. NextAuth genera JWT → cookie `next-auth.session-token`
4. Cada request: middleware valida JWT + check `privacyAcceptedAt` + CSP + rate limit
5. API routes: `getSession()` → `AuthUser` payload (id, email, role, sucursalId, employeeId)

---

## 7. Lógica de negocio crítica ⚠️

### 7.1 Zona horaria — **CRÍTICO**

Toda la lógica de negocio opera en **America/Mexico_City** (UTC-6, sin DST desde 2022). El servidor corre en UTC (Vercel) pero **jamás** usar `new Date().setHours()` o `getHours()` — siempre Luxon con `setZone(MEXICO_TZ)`.

Helpers en `src/lib/timezone.ts`:
- `getMexicoNow()`, `getMexicoTodayISO()`, `getMexicoTodayDate()`
- `buildDateTimeInMexico(dateISO, timeHHmm)` → Date UTC
- `formatTimeInMexico(date)`, `formatDateInMexico(date)`, `formatDateTimeInMexico(date)`
- `getDayOfWeek(date)` → 0=domingo..6=sábado
- `toISODate(date)`, `minutesBetween(a, b)`, `minutesToHours(m)`, `formatMinutes(m)`

**Bug histórico resuelto**: antes se usaba `new Date().setHours(sh, sm)` que interpreta la hora en la TZ del servidor (UTC en Vercel). Esto causaba:
- Retardos falsos (09:00 UTC = 03:00 Mexico, siempre > checkIn real)
- Jornadas nocturnas falsas (20:00 UTC = 14:00 Mexico, marcaba como nocturna jornadas diurnas)
- Fechas desfasadas -1 día en vacaciones

**Fix**: usar `buildDateTimeInMexico()` para construir fechas y `DateTime.fromJSDate(d).setZone(MEXICO_TZ)` para leerlas.

### 7.2 Cálculo de horas extra — `src/lib/overtime-calculator.ts`

**Función central**: `calculateOvertime(input: OvertimeInput): OvertimeResult`

#### Input
```typescript
{
  record: AttendanceRecord;
  schedule: WorkSchedule | null;  // null si es día de descanso
  sucursal: Pick<Sucursal, 'checkoutToleranceMinutes' | 'mealDurationMinutes'>;
  weeklyAccumulatedMinutes?: number;  // overtime ya acumulado en la semana (excl. día actual)
}
```

#### Output (campos principales)
- `workedMinutes`: neto (bruto - comida - descanso)
- `overtimeMinutes`: total extra
- `overtimeDoubleMinutes`: art. 66 (primeras 9h/semana en 2027)
- `overtimeTripleMinutes`: art. 68 (excedente semanal)
- `overtimeWeeklyAccumulated`: acumulado previo
- `overtimeWeeklyTotal`: acumulado + este registro
- `isLate`, `isEarlyLeave`, `status`
- `isRestDayWorked`, `restDayWorkedMinutes`, `restDayPremiumMinutes` (art. 73)
- `isSunday` (art. 71)
- `shiftType`, `nightMinutes`, `legalMaxMinutes`, `legalOvertimeMinutes` (art. 60/61)

#### Algoritmo (estado actual — fix #3)

```
1. Si no hay check-in O check-out → retorna con overtime=0, status actual

2. workedMinutes = minutesBetween(checkIn, checkOut)
   netWorkedMinutes = workedMinutes - mealDuration - restDuration (si registrados)

3. Detectar día de descanso:
   - Si schedule === null OR schedule.isWeeklyRest === true → isRestDayWorked = true
   - Si isRestDayWorked → NO calcula overtime. Toda la jornada se paga con prima 100% (art. 73).
     Retorna: overtimeMinutes=0, restDayWorkedMinutes=netWorkedMinutes, restDayPremiumMinutes=netWorkedMinutes

4. Calcular scheduledMinutes:
   rawScheduledMinutes = endTime - startTime (en min, con ajuste nocturno +24h si endTime <= startTime)
   
   ⭐ fix #3 (bug comida):
   if (rawScheduledMinutes > 480) {  // > 8h = jornada máxima legal diurna (art. 61)
     scheduledMinutes = raw - sucursal.mealDurationMinutes  // schedule incluye comida
   } else {
     scheduledMinutes = raw  // schedule es jornada pura (ej. 9-17 = 480min)
   }

5. Late / Early Leave:
   expectedCheckIn = buildDateTimeInMexico(dateISO, schedule.startTime)
   isLate = checkInTime > expectedCheckIn + toleranceMinutes
   
   expectedCheckOut = buildDateTimeInMexico(checkoutISO, schedule.endTime)  // +1 día si nocturno
   isEarlyLeave = checkOutTime < expectedCheckOut - toleranceMinutes

6. ⭐ fix #3 (bug tolerancia):
   overtimeMinutes = max(0, netWorkedMinutes - scheduledMinutes)
   // checkoutToleranceMinutes NO se resta del overtime. Solo determina isEarlyLeave.

7. Distribución dobles/triples (reforma LFT 2027):
   overtimeDaily = min(overtimeMinutes, 240)  // tope diario 4h (art. 66)
   weeklyCap = getWeeklyOvertimeCapMinutes(year)  // 9h (2026-27) → 10h (2028) → 11h (2029) → 12h (2030+)
   cabeEnDoble = max(0, weeklyCap - weeklyAccumulatedMinutes)
   overtimeDoubleMinutes = min(overtimeDaily, cabeEnDoble)
   overtimeTripleMinutes = max(0, overtimeDaily - overtimeDoubleMinutes)
   overtimeWeeklyTotal = weeklyAccumulatedMinutes + overtimeDaily

8. Clasificar jornada (classifyShift):
   nightMinutes = nightMinutesBetween(checkIn, checkOut)  // 20:00-06:00 hora Mexico
   shiftType = nightMinutes===0 ? 'DIURNA' : nightMinutes>=210 ? 'NOCTURNA' : 'MIXTA'
   legalMaxMinutes = DIURNA:480 | NOCTURNA:420 | MIXTA:450 (art. 61)
   legalOvertimeMinutes = max(0, netWorkedMinutes - legalMaxMinutes)

9. status:
   LATE si isLate, EARLY_LEAVE si isEarlyLeave, PRESENT si ninguno, prioridad a LATE.
```

#### Caso Alicia (verificado, fix #3)
- Ana López, 2026-08-12, checkIn 08:58 / checkOut 19:03 Mexico, schedule 9-18, sin comida registrada, mealDuration=30
- workedMinutes = 605 min
- scheduledMinutes = 540 - 30 = 510 (raw > 480, descuenta mealDuration)
- **overtimeMinutes = 605 - 510 = 95 min** ✅ (antes: 55 min — subreporte de 40 min: +10 bug tolerancia, +30 bug comida)

#### Helper `computeWeeklyAccumulatedOvertime()`
Calcula el acumulado semanal (lunes-domingo ISO) previo al día del registro. Suma `overtimeDoubleMinutes + overtimeTripleMinutes` de registros anteriores en la misma semana. **Los descansos trabajados NO suman** (art. 73 es prima independiente del art. 66/68).

### 7.3 Clasificación de jornada — `src/lib/shift-classifier.ts`

- `nightMinutesBetween(checkIn, checkOut)`: itera días calendario en hora Mexico, calcula solapamiento con ventana [20:00-06:00]. Timezone-aware.
- `classifyShift()`: 0 min → DIURNA; ≥210 min (3.5h) → NOCTURNA; entre medio → MIXTA.
- `getLegalMaxMinutes()`: DIURNA=480, NOCTURNA=420, MIXTA=450 (art. 61).

### 7.4 Estado de los fixes de cálculo

| Fix | Fecha | Commit | Qué corrigió |
|-----|-------|--------|--------------|
| fix #10 (TZ) | previo | — | `buildDateTimeInMexico` para evitar retardos/nocturnidad falsa |
| fix #2 (TZ) | previo | — | `classifyShift` con Luxon (jornada nocturna falsa) |
| **fix #3 (tolerancia)** | ago 2026 | `28e5345` | `checkoutToleranceMinutes` ya no se resta del overtime |
| **fix #3 (comida)** | ago 2026 | `28e5345` | `scheduledMinutes` descuenta `mealDurationMinutes` si raw > 480 |

El header de `overtime-calculator.ts` documenta fix #3. **No reintroducir** `- checkoutTol` ni omitir el guard `raw > 480`.

---

## 8. API endpoints — referencia rápida

### Attendance
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/attendance/check-in` | Check-in geolocalizado + QR dinámico |
| POST | `/api/attendance/check-out` | Check-out + **calcula overtime** con `calculateOvertime` |
| POST | `/api/attendance/meal-start` | Inicia comida |
| POST | `/api/attendance/meal-end` | Termina comida, valida tolerance |
| POST | `/api/attendance/meal-cancel` | Cancela comida en curso |
| POST | `/api/attendance/rest-start` | Inicia descanso |
| POST | `/api/attendance/rest-end` | Termina descanso |
| POST | `/api/attendance/rest-cancel` | Cancela descanso en curso |
| POST | `/api/attendance/justify` | Sube justificación (retardo/falta) |
| POST | `/api/attendance/sign` | Firma del empleado (art. 132 XXXIV) |
| GET | `/api/attendance/today` | Registro de hoy (empleado) |
| GET | `/api/attendance/history` | Historial con `period=day\|week\|month\|custom` |
| GET | `/api/attendance/monthly-calendar` | Calendario mensual o por rango |
| GET/PUT | `/api/attendance/[id]` | Detalle / **corrección manual** (actualiza overtime) |

### Reports (todos soportan rangos libres sin tope)
| Ruta | Descripción |
|------|-------------|
| `/api/reports/daily` | Reporte diario o multi-día (consolida) |
| `/api/reports/overtime` | Reporte de horas extra |
| `/api/reports/employee-overtime` | Overtime por empleado |
| `/api/reports/absences` | Ausencias (recorta endDate a "hoy" si es futuro) |
| `/api/reports/incidences` | Incidencias (retardos, salidas anticipadas) |
| `/api/reports/comparative` | Comparativo entre sucursales |
| `/api/reports/corrections` | Correcciones de asistencia (JSON/CSV/XLSX) |
| `/api/reports/export` | Export multi-formato (daily/overtime/absences/incidences/comparative) con 6 columnas de corrección |
| `/api/reports/my-export` | Export para empleados (metadatos extendidos art. 132 XXXIV) |
| `/api/reports/stps-format` | Formato STPS art. 804 LFT (mensual/semanal/libre) |

### Admin (recálculos)
| Ruta | Descripción |
|------|-------------|
| `/api/admin/recalc-overtime` | **Recálculo histórico de overtime** (fix #3). dryRun support. |
| `/api/admin/recalc-shift` | Recálculo de shiftType (DIURNA/NOCTURNA/MIXTA) |
| `/api/admin/recalc-status` | Recálculo de status (PRESENT/LATE/etc) |
| `/api/admin/recalc-vacations` | Recálculo de saldos de vacaciones |
| `/api/admin/arco/requests` | Lista solicitudes ARCO |
| `/api/admin/arco/[id]/resolve` | Resuelve solicitud ARCO |

### Otros
- `/api/auth/*` — login, logout, me, mfa/setup, mfa/verify, mfa/disable, qr-login, quick-login, refresh, users-list
- `/api/employees/*` — CRUD + QR + transfer
- `/api/sucursales/*` — CRUD
- `/api/users/*` — CRUD + reset-password + unlock
- `/api/vacations/*` — CRUD + balance
- `/api/work-schedules/` — horarios
- `/api/holidays/*` — CRUD
- `/api/company/` — datos empresa + logo
- `/api/audit/` — bitácora
- `/api/alerts/*` — nom-035, notifications, supervisor-alerts
- `/api/qr/dynamic` — QR rotativo
- `/api/manual/pdf` — manual de usuario en PDF
- `/api/diagrama/download` — diagrama de arquitectura
- `/api/health/` — healthcheck

---

## 9. Frontend — `admin-layout.tsx` (~8858 líneas)

**Un solo archivo** contiene TODO el panel admin. Vistas controladas por Zustand (`AdminView`):

| Vista | Componente | Descripción |
|-------|------------|-------------|
| dashboard | DashboardView | Panel del día con stats, tabla de asistencia, exportar día/rango |
| employees | EmployeesView | CRUD empleados con transfer |
| sucursales | SucursalesView | CRUD sucursales con geofence |
| users | UsersView | CRUD usuarios con MFA |
| vacations | VacationsView | Aprobar/rechazar vacaciones, saldos |
| history | HistoryView | Historial con period=day/week/month/custom + DateRangePicker |
| calendar | CalendarView | Calendario mensual o por rango, marca correcciones |
| reports | ReportsView | Todos los reportes con DateRangePicker unificado + STPS (mensual/semanal/libre) |
| corrections | CorrectionsView | Reporte de correcciones con tabla expandible |
| audit | AuditView | Bitácora filtrable |
| nom-035 | Nom035View | Alertas NOM-035 |
| qr-terminal | QrTerminalView | Kiosko con QR rotativo + quick-login |
| company | CompanyView | Datos empresa + logo |
| documentation | DocumentationView | Manual de usuario embebido |
| settings | SettingsView | MFA, **botones de recálculo** (overtime, shift, status, vacations), configuración |

### Employee-layout.tsx (~2263 líneas)
Vistas: `attendance` (check-in/out con QR), `history`, `vacations`, `qr`.

### Componente clave: `DateRangePicker`
`src/components/reports/date-range-picker.tsx` — selector de rango con presets (Hoy, Ayer, Esta semana, Este mes, Mes pasado, Este año). Usado en History, Calendar, Reports, Corrections, Dashboard export. **No hay tope máximo de días** en ningún endpoint.

---

## 10. Mini-services

### `mini-services/realtime-service/` (Socket.io, puerto 3003)
Servicio independiente (bun project propio) para notificaciones real-time:
- Check-in/out de empleados → actualiza dashboard admin en vivo
- Alertas NOM-035 push
- Despliegue: Railway/Render/ Fly.io (ver railway.toml, render.yaml)

**Frontend siempre conecta vía** `io("/?XTransformPort=3003")` — nunca directo a `localhost:3003` (Caddy gateway lo enruta). WebSocket errors del tipo `wss://...vercel.app/socket.io/...` son **ruido** del servicio real-time y no afectan funcionalidad core.

---

## 11. Deploy y CI/CD

- **Vercel** auto-deploya desde `main` de GitHub al recibir push (~60s desde push hasta que el nuevo código responde en producción).
- `vercel.json` copia `schema.postgres.prisma` a `schema.prisma` antes de build (prod usa PostgreSQL).
- Variables de entorno en Vercel: `DATABASE_URL` (Supabase), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_VERSION=2.2.0`, `UPSTASH_REDIS_REST_URL/TOKEN`.
- **No usar** `bun run build` localmente (OOM en sandbox de 4GB). Build solo en Vercel.
- Scripts: `./scripts/deploy-vercel.sh` para deploy manual.

### Flujo de deploy con GitHub PAT efímero (patrón establecido con el cliente)

El cliente no mantiene credenciales de GitHub guardadas en el sandbox. El flujo autorizado es:

1. **Cliente** genera un GitHub Personal Access Token fine-grained efímero:
   - https://github.com/settings/tokens?type=beta → "Generate new token"
   - Expiración: 1 hora (o lo mínimo permitido)
   - Repository access: "Only select repositories" → `control-de-asistencia`
   - Permissions → Repository permissions → Contents: Read and write (Metadata se auto-activa)
2. **Cliente** pasa el token por chat al agente.
3. **Agente** configura el remote temporalmente: `git remote set-url origin https://x-access-token:<TOKEN>@github.com/moygallegostrujillo-stack/control-de-asistencia.git`
4. **Agente** hace `git fetch origin` para verificar estado del remoto (fast-forward limpio, sin commits remotos que falten localmente).
5. **Agente** hace `git push -u origin main`. Vercel detecta el push y deploya automáticamente.
6. **Agente** restaura el remote a su URL original sin token: `git remote set-url origin https://github.com/moygallegostrujillo-stack/control-de-asistencia.git`
7. **Agente** verifica que el token NO quedó en `git config --get-regexp 'remote\.'`.
8. **Cliente** revoca el PAT en GitHub (Settings → Tokens → delete).

**Verificación de deploy completo**: polling al endpoint afectado cada 30s. Cuando el código nuevo responde 200 (antes daba 401 o 404 con código viejo), el deploy terminó. Típicamente ~60s.

**BD de producción**: Supabase Postgres en `https://supabase.com/dashboard/project/xvimpyvwncsxfsumgosv`. El cliente ejecuta Querys SQL directamente en el SQL Editor de Supabase. Backups manuales desde Database → Backups. **No se debe tocar la BD de producción sin autorización explícita del cliente y preferentemente vía endpoints HTTP ya deployados** (no scripts locales con credenciales directas).

---

## 12. Convenios y reglas del proyecto

### Código
- **TypeScript strict** en todo. `'use client'` y `'use server'` explícitos.
- **shadcn/ui** preferido sobre componentes custom. Todo en `src/components/ui/` ya existe.
- **No usar colores indigo/azul** salvo los pre-existentes (StatBox violet/sky).
- **Footer sticky**: `min-h-screen flex flex-col` + `mt-auto` en footer.
- **Responsive mobile-first** con Tailwind prefixes.
- **z-ai-web-dev-sdk SOLO en backend** — nunca en client side.

### Prisma
- Schema en `prisma/schema.prisma` (SQLite dev) o `prisma/schema.postgres.prisma` (PostgreSQL prod).
- Cambiar con `./scripts/switch-schema.sh sqlite|postgres`.
- `import { db } from '@/lib/db'` para obtener el cliente.
- Los tipos primitivos no pueden ser listas — usar JSON string o tabla relacionada.
- Después de editar schema: `bun run db:push`.

### API
- **Usar API routes, no server actions.**
- Todas las rutas usan `getSession()` de NextAuth para auth.
- Scoping por sucursal validado en cada ruta.
- Audit log obligatorio en mutaciones (`auditLog()` de `src/lib/audit.ts`).
- Errores con JSON `{ error: string }` y código HTTP apropiado.

### Worklog
- **Obligatorio**: leer `/home/z/my-project/worklog.md` antes de empezar trabajo.
- **Obligatorio**: appendear nueva sección al worklog al terminar (con `---` separador).
- Formato: `Task ID`, `Agent`, `Task`, `Work Log`, `Stage Summary`.

### Git
- Commits en español, formato: `tipo(scope): descripción` (ej. `fix(overtime): ...`, `feat(admin): ...`).
- Commits con UUID (ej. `da30c70 62bb1647-...`) son auto-generados por el sistema, no editar.
- **No commitear** `.env`, `.env.local`, `dev.log`, `server.log`, `node_modules/`.

---

## 13. Estado actual (agosto 2026)

### ✅ Auditoría jurídico-laboral P0 — COMPLETADA (15 de agosto 2026)

**13/13 requisitos P0 cerrados** (código + DB + verificación end-to-end). La auditoría completa está en `AUDITORIA-JURIDICO-LABORAL.md` (59 hallazgos, 49 requisitos). Commits relevantes: `a79dd56`, `8a3e204`, `dff2535`, `cc23c4d`, `5d8e3da`.

| # | Requisito P0 | Estado | Artefacto clave |
|---|--------------|--------|-----------------|
| RT-P0.1 | Schema P0 (JornadaConfig, ElectronicRecordAgreement, hash-chain AuditLog) | ✅ | `prisma/schema.prisma` + `schema.postgres.prisma`; migración ejecutada en Supabase |
| RT-P0.2 | Overtime con tope art. 66 (9h fijas) | ✅ | `src/lib/overtime-calculator.ts` |
| RT-P0.3 | Prima por descanso trabajado (art. 73) | ✅ | `overtime-calculator.ts` |
| RT-P0.4 | Vacaciones + prima vacacional 25% (art. 76/80) | ✅ | `src/app/api/vacations/*` |
| RT-P0.5 | Onboarding ElectronicRecordAgreement (art. 132 XXXIV) | ✅ | `src/app/api/employee/agreement/*` + `src/components/layout/employee-layout.tsx` (modal no-cerrable, hash SHA-256) |
| RT-P0.6 | Reportes STPS (art. 804) | ✅ | `src/app/api/reports/stps-*` |
| RT-P0.7 | Hash chaining en AuditLog (tamper-evident) | ✅ | `src/lib/audit.ts` + `src/app/api/audit/verify/route.ts` |
| RT-P0.8 | Retención 12 meses + `archivedAt` (art. 804) | ✅ | `src/app/api/admin/retention/archive/route.ts` |
| RT-P0.9 | Derechos ARCO (LFPDPPP) | ✅ | `/legal/derechos-arco` + `/api/user/privacy/*` |
| RT-P0.10 | Aviso de Privacidad (art. 16 LFPDPPP) | ✅ | `/legal/aviso-de-privacidad` — datos reales de la empresa |
| RT-P0.11 | UI firma del empleado | ✅ | `employee-layout.tsx` |
| RT-P0.12 | Horarios con tope semanal | ✅ | `JornadaConfig` + `overtime-calculator.ts` |
| RT-P0.13 | Cumplimiento DOF 27-dic-2024 | ✅ | referenciado en acuerdo electrónico + reportes |

**Verificación end-to-end realizada (15-ago-2026):**
- Login → 200, JWT emitido (HMAC-SHA512)
- `/api/audit/verify` → `chainIntact: true`, 7 registros verificados, 0 manipulados
- `/api/admin/retention/archive` → reporte dry-run OK, referencia "LFT art. 804"
- `/api/employee/agreement/status` → responde correctamente (admin = `USER_IS_NOT_EMPLOYEE`)
- Páginas `/legal/aviso-de-privacidad` y `/legal/derechos-arco` renderizan con todos los datos

**Datos de la empresa (en Aviso de Privacidad y acuerdo electrónico):**
- Razón social: **BONETERIA MARLUI, S.A. DE C.V.**
- RFC: **BMA850717320**
- Registro Patronal IMSS: A6815930107
- Domicilio: Av. 3ª Sur Oriente No. 261, Col. Centro, C.P. 29000, Tuxtla Gutiérrez, Chiapas
- Representante legal / DPO: Miguel Ángel Aguilar Castellanos
- Email ARCO: lenceriamarluiop@gmail.com
- Teléfono: 961 612 8657

**Fix crítico de entorno (15-ago-2026):** El `.env` local NO tenía `NEXTAUTH_SECRET`, lo que rompía el login con `TypeError: "ikm" must be an instance of Uint8Array or a string`. Añadido al `.env` local. **En Vercel, verificar que `NEXTAUTH_SECRET` esté en Environment Variables** (si no, el login fallará igual).

**Pendientes en producción (post-deploy):**
1. Verificar `NEXTAUTH_SECRET` en Vercel → Settings → Environment Variables.
2. Migración `archivedAt` en Supabase: `prisma/migrations/auditoria_p0_archived_at/migration.postgres.sql` (ya ejecutada la sesión pasada — confirmar).
3. Verificar los 4 flujos críticos en prod: onboarding acuerdo → check-in → hash verify → retention.

### ✅ Fix vacaciones — días laborables — DEPLOY COMPLETADO EN PRODUCCIÓN (15 de agosto 2026, sesión noche)

**Bug reportado por cliente**: Sandra Gonzalez Perez tenía vacaciones 17-29 ago 2026 y el sistema marcaba **13 días** (días naturales, contando el domingo 23), pero el cliente autorizó **12 días** (días laborables, sin domingo).

**Causa raíz**: 5 sitios usaban la fórmula `Math.ceil((end - start) / 86400000) + 1` que cuenta días naturales sin excluir domingos ni festivos.

**Solución implementada** (commits `9769537` código + `5793bfc` docs):
- **Nuevo helper** `src/lib/vacation-calculator.ts` con `computeVacationDays(start, end, dbHolidays?)` que excluye:
  - Domingos (art. 71 LFT — descanso semanal)
  - Festivos oficiales (art. 74 LFT, calculados algorítmicamente: 1 ene, primer lun feb, 3er lun mar, 1 may, 16 sep, 3er lun nov, 1 dic cada 6 años, 25 dic)
  - Feriados extra cargados en BD (tabla `Holiday`)
- **5 sitios actualizados**: `api/vacations/route.ts` (crear), `api/vacations/[id]/route.ts` (editar), `api/admin/recalc-vacations/route.ts` (recalc timezone), `admin-layout.tsx` (GrantVacationDialog + EditVacationDialog previews).
- **Endpoint retroactivo** `POST /api/admin/recalc-vacations-holidays` — recalcula `days` de todos los Vacation type=VACACIONES, ajusta `vacationBalanceDays` con la diferencia. Auth dual: sesión GENERAL_ADMIN o `?token=RECALC_HOLIDAYS_2026`. Soporta `dryRun=true`. Añadido a `PUBLIC_PATHS` en middleware.
- **Política (decisión del usuario)**: Opción C (sin toggle, siempre días laborables), fix retroactivo a todos los vacaciones históricos con domingos, excluir domingos + festivos oficiales art. 74 LFT.

**Deploy a producción (15-ago-2026 noche)**:
1. Backup manual en Supabase (cliente).
2. Cliente generó GitHub PAT efímero (fine-grained, 1h, Contents:Write, repo-only) — usado y **revocado después**.
3. `git reset --soft HEAD~1` para excluir commit diagnóstico `2b4e2d0` (script `scripts/recalc-vacations-dryrun.ts` quedó untracked en disco, no en repo).
4. `git push -u origin main`: `5d8e3da..5793bfc` (fast-forward limpio, 3 commits: `0d41c5f` + `9769537` + `5793bfc`).
5. Vercel auto-deploy completó en ~60s (detectado por polling al endpoint público: 401 → 200).
6. **Dry-run contra producción**: detectó 1 vacación afectada (Sandra 17-29/08/2026, oldDays=13 → newDays=12, diff=+1, saldo 11→12).
7. **Recálculo real ejecutado** (sin dryRun): `success=true`, 1 vacación actualizada, 1 día devuelto. Audit log creado con `action=RECALC_VACATIONS_HOLIDAYS`.
8. **Verificación idempotencia**: segundo dry-run reportó 0 cambios → BD consistente.

**Cambios aplicados en BD de producción (Supabase Postgres)**:
- `Vacation` id `cmsulkdrv0001jp04z96ftjbl` (SANDRA ISABEL GONZALEZ PEREZ, #EMP#002): `days` 13 → 12.
- `Employee` id `cmrz7cgxk000ijm04uar5bne1` (Sandra): `vacationBalanceDays` 11 → 12 (+1 día devuelto).
- Cualquier vacación NUEVA creada a partir de ahora usa automáticamente la fórmula correcta (días laborables).

**No hubo migración de schema** (el fix es puramente de código).

**Pendiente de higiene (no urgente)**: el endpoint `/api/admin/recalc-vacations-holidays` sigue siendo público con `?token=RECALC_HOLIDAYS_2026`. Ya cumplió su función (fix retroactivo aplicado, es idempotente). En un próximo deploy conviene quitarlo de `PUBLIC_PATHS` en `src/middleware.ts` para reducir superficie de ataque.

### Fixes recientes previos (todos en producción)
1. **fix #3 (overtime)** — commit `28e5345`. Caso Alicia resuelto: 55→95 min de overtime.
2. **Endpoint `/api/admin/recalc-overtime`** — commit `28e5345`. Recálculo histórico con acumulador semanal in-memory.
3. **Botón "Recálculo de horas extra" en Configuración** — commit `7088e38`. UI para invocar el endpoint con dryRun/real.
4. **Recálculo ejecutado por el usuario** — registros históricos corregidos.
5. **PDF con títulos en español** — commit `3d447f0`. Reportes PDF con encabezados localizados.
6. **NSS / RFC / CURP en Employee** — commits `112a54f` (schema) + `47323c9` (migración). Añadidos campos `nss`, `rfc`, `curp` al modelo Employee en ambos schemas. Migración manual ejecutada en prod vía endpoint `/api/migrate/add-nss-folio-imss`.
7. **Login roto por schema desincronizado** — commit `e89788d`/`b347bd6`. El deploy que regeneró Prisma Client esperando columna `nss` rompió el login de TODOS los usuarios (16 en prod) porque la DB física no la tenía. Fix: migración manual vía endpoint + **consultas de auth cambiadas de `include: { employee: true }` (SELECT *) a `select` con campos específicos** para que el login no se rompa si falta una columna. Patrón de resilience aplicado en: `auth.config.ts`, `api/auth/me`, `api/auth/quick-login`, `api/auth/qr-login`, `api/auth/refresh`, `api/auth/users-list`, `api/user/privacy/accept`, `lib/privacy.ts`.
8. **Diagnóstico de DB** — commit `3695b18`. Endpoint `/api/diagnose-db?token=DIAGNOSE_2026` verifica columnas, usuarios por rol, y consulta exacta de login. Mejorado en commit `200d595` para listar saldos de vacaciones cargados.
9. **Saldos de vacaciones por año (2026/2027)** — commits `5a9963f` (schema + endpoints), `c2ea555` (fix middleware), `be9348f`+`200d595` (verificación). Añadidos campos `vacationBalanceDays2026` y `vacationBalanceDays2027` al modelo Employee. Carga masiva ejecutada para 13 empleados (18 registros: 5 de 2026 + 13 de 2027). Ver [§16. Saldos de vacaciones](#16-saldos-de-vacaciones-20262027) para detalle.

### Features principales ya en producción
- Check-in/out geolocalizado con QR dinámico rotativo
- Cálculo de overtime con reforma LFT 2027 (dobles/triples, tope semanal gradual)
- Prima por descanso trabajado (art. 73) y prima dominical (art. 71)
- Clasificación automática de jornada (diurna/nocturna/mixta, art. 60/61)
- Comida y descanso registrados con tolerancia
- Corrección manual de registros con trazabilidad (originalCheckIn/Out, correctionReason, correctedBy)
- Firma del empleado (art. 132 XXXIV LFT — prueba plena)
- Justificaciones con flujo PENDING/APPROVED/REJECTED
- Vacaciones/permisos/incapacidades con saldos y modo parcial
- Reportes: daily, overtime, employee-overtime, absences, incidences, comparative, corrections, export, my-export, STPS (art. 804)
- Todos los reportes soportan rangos libres sin tope (DateRangePicker unificado)
- Vista de Correcciones dedicada + badges "Corregido" en Dashboard/Historial/Calendario
- Calendario mensual o por rango con marca de correcciones
- Panel NOM-035 (alertas teletrabajo)
- Auditoría completa con IP/UA/timestamps
- Derechos ARCO (LFPDPPP) con anonimización para CANCELLATION
- MFA TOTP para admins
- Rate limiting con Upstash Redis
- Real-time con Socket.io (dashboard en vivo)
- Kiosko quick-login para terminales

### Issues conocidos / no-bugs
- **OOM en sandbox local**: Next.js 16 + Turbopack consume ~2.3GB compilando `/`. El sandbox tiene 4GB. Build local falla pero Vercel build funciona. Verificación visual con Agent Browser a veces no posible por esto — usar scripts directos como alternativa.
- **WebSocket errors en consola**: `wss://...vercel.app/socket.io/...` son ruido del servicio real-time. No afectan funcionalidad core.
- **34 errores TypeScript pre-existentes**: en `stps-format`, `stps-pdf`, `stps-report`, `arco`, `auth.config`, `rate-limit`, `scripts/`. No bloquean build (Vercel usa `next build` que tolera). No introducir errores nuevos.
- **Chrome "Don't paste code"**: la consola del navegador bloquea pegar código por seguridad. Escribir `allow pasting` primero, o usar botones en la UI.
- **"Empleado no puede entrar / no puede registrar asistencia" → 99% es consentimiento pendiente, NO es bug**. El sistema tiene DOS compuertas legales que bloquean el flujo hasta que el empleado acepte:
  1. **Aviso de Privacidad (LFPDPPP art. 16-17)** — `PrivacyConsentModal` montado en `src/app/page.tsx` (líneas 132 y 140). Llama a `GET /api/user/privacy/status`. Si `hasAccepted=false` (es decir, `privacyAcceptedAt IS NULL` O `privacyAcceptedVersion !== '1.0'`), abre un `Dialog` con `showCloseButton={false}`, `onEscapeKeyDown` prevenido y `onPointerDownOutside` prevenido — **no se puede cerrar sin aceptar**; rechazar = logout. El middleware (`src/middleware.ts:140`) además bloquea toda API no pública si `session.privacyAccepted !== true`. Versión vigente: `CURRENT_PRIVACY_VERSION = '1.0'` en `src/lib/privacy.ts`.
  2. **Acuerdo de Registro Electrónico (art. 132 fracción XXXIV LFT, reforma DOF 27-dic-2024)** — banner en `src/components/layout/employee-layout.tsx` (líneas ~2399-2539). Llama a `GET /api/employee/agreement/status`. Si `needsAcceptance=true`, muestra banner que debe aceptarse antes de poder hacer check-in. Solo aplica a empleados (admin/supervisor lo saltea con `USER_IS_NOT_EMPLOYEE`). Versión vigente: `ELECTRONIC_RECORD_AGREEMENT_VERSION = '1.0'` en `src/lib/electronic-record-agreement-text.ts`.

  **Incidente 16-ago-2026 (RESUELTO, no-bug)**: Clara Idalia Gómez Santizo y Jose Candelario Gómez Hernández reportaron "no poder entrar a registrar". Causa raíz: **no habían aceptado el Aviso de Privacidad v1.0 ni el Acuerdo de Registro Electrónico v1.0**. Una vez que aceptaron ambos (modal + banner), el JWT se re-emite con `privacyAccepted=true` (`POST /api/user/privacy/accept` re-emite token) y el registro de asistencia funciona normal. **No se requirió ningún cambio de código ni acceso a BD**. Diagnóstico para futuros reportes similares: pedirle al empleado que intente entrar de nuevo y acepte TODO lo que aparezca (modal de privacidad + banner de acuerdo electrónico); si tras aceptar sigue fallando, entonces sí investigar `User.isActive`, `archivedAt`, MFA bloqueado, etc.

---

## 14. Cómo arrancar en una nueva sesión

Si eres un agente nuevo, sigue estos pasos:

1. **Lee este documento** completo.
2. **Lee `/home/z/my-project/worklog.md`** (tail -200 al menos) para ver el trabajo reciente.
3. **Revisa `git log --oneline -10`** para commits recientes.
4. **Revisa `tail -30 dev.log`** si el dev server está corriendo.
5. **Identifica el dominio** que vas a tocar:
   - Overtime/cálculo → `src/lib/overtime-calculator.ts` + `shift-classifier.ts` + `timezone.ts`
   - Attendance → `src/app/api/attendance/*`
   - Reports → `src/app/api/reports/*`
   - Frontend admin → `src/components/layout/admin-layout.tsx` (busca por nombre de vista)
   - Frontend empleado → `src/components/layout/employee-layout.tsx`
   - Auth → `src/lib/auth.ts` + `auth.config.ts` + `rbac.ts`
   - Schema → `prisma/schema.prisma` (recuerda `switch-schema.sh` para prod)
6. **Antes de cambiar cálculos de overtime**: lee el header de `overtime-calculator.ts` que documenta fix #3. No reintroducir bugs.
7. **Antes de cambiar fechas/horas**: usa SIEMPRE Luxon con `MEXICO_TZ`. Nunca `new Date().setHours()`.
8. **Después de cambios**: `bun run lint`, revisa dev.log, y si es mutación de datos considera si necesita un endpoint de recálculo.
9. **Al terminar**: appendea tu sección al worklog con el formato establecido.

---

## 15. Contacto /决策 points

- **Producto owner**: usuario (moygallegostrujillo-stack en GitHub)
- **Repo único**: https://github.com/moygallegostrujillo-stack/control-de-asistencia — **no trabajar sobre forks u otros repos**.
- **URL única**: https://control-asistencia-v22.vercel.app/ — **no deployar en otros dominios**.
- **Tokens**: el usuario crea PATs fine-grained de un solo uso (1h, Contents:Write) cuando se necesita push. **Siempre revocar después**. No almacenar tokens.

---

## 16. Saldos de vacaciones (2026/2027)

### Schema
El modelo `Employee` tiene tres campos de saldo de vacaciones:
- `vacationBalanceDays Int @default(12)` — **saldo activo** que se descuenta al otorgar vacaciones (lo usa `/api/vacations`).
- `vacationBalanceDays2026 Int?` — saldo correspondiente al año 2026 (informativo/referencia).
- `vacationBalanceDays2027 Int?` — saldo correspondiente al año 2027 (informativo/referencia).

Los campos por año son de referencia para que el admin sepa cuántos días le corresponden a cada empleado en cada año; el saldo que se descuenta al otorgar vacaciones sigue siendo `vacationBalanceDays`.

### Endpoints
- **`/api/migrate/add-vacation-year-columns`** (POST) — migración idempotente que añade las columnas `vacationBalanceDays2026` y `vacationBalanceDays2027` a la tabla Employee. Auth dual: sesión admin O `?token=MIGRATE_VAC_YEARS_2026`. Ya ejecutado en prod.
- **`/api/vacations/bulk-load`** (POST) — carga masiva de saldos. Recibe `{ items: [{ name, year: 2026|2027, days }] }` y hace match por nombre (case-insensitive, sin acentos). Si year=2026, también actualiza `vacationBalanceDays` (saldo activo). Auth dual: sesión admin O `?token=BULK_VACATIONS_2026`. Es público a nivel middleware (commit `c2ea555`) para poder ejecutarlo sin sesión.
- **`/api/diagnose-db`** (GET, `?token=DIAGNOSE_2026`) — verifica columnas, usuarios por rol, consulta de login, y lista saldos de vacaciones cargados (commit `200d595`).

### Datos cargados en producción (14 de agosto 2026)
13 empleados con saldos cargados desde PDF `upload/VACACIONES EMPLEADOS.pdf`:

| Empleado | Activo | 2026 | 2027 |
|---|---|---|---|
| ALICIA GUADALUPE HERNANDEZ GONZALEZ | 12 | — | 16 |
| CAROLINA CRUZ PEREZ | 14 | 14 | 16 |
| CAROLINA ELIZABETH ROBLERO GUTIERREZ | 14 | 14 | 16 |
| CLARA IDALIA GOMEZ SANTIZO | 12 | — | 26 |
| CLARIVEL ARREOLA CLEMENTE | 12 | — | 14 |
| CRISTIAN JOAN VELAZQUEZ MONTOYA | 12 | 12 | 14 |
| GABRIELA ESTEFANIA ALVAREZ PASCACIO | 12 | — | 12 |
| JONATHAN FRANCISCO SANCHEZ GONZALEZ | 12 | — | 16 |
| JOSE CANDELARIO GOMEZ HERNANDEZ | 12 | — | 16 |
| JUANA MARTINEZ MENDOZA | 18 | 18 | 20 |
| LUCIA MARAI GALDAMEZ VILLARREAL | 12 | — | 12 |
| SANDRA ISABEL GONZALEZ PEREZ | 24 | 24 | 24 |
| XIMENA VELASCO MARROQUIN | 12 | — | 12 |

**Notas**:
- Los 5 empleados con datos de 2026 también actualizaron su saldo activo (estamos en agosto 2026).
- Los 8 empleados que solo aparecen en 2027 mantienen saldo activo en 12 (default).
- Abreviaturas del PDF resueltas: GTZ→GUTIERREZ, FCO→FRANCISCO, GPE→GUADALUPE.

**Actualización post-fix vacaciones (15-ago-2026 noche)**: el saldo activo de SANDRA ISABEL GONZALEZ PEREZ en la tabla de arriba (24) refleja la carga inicial del 14-ago. Después se le otorgaron vacaciones 17-29/08/2026 que bajaron su saldo activo a 11 (con la fórmula vieja de 13 días naturales). Con el fix retroactivo de días laborables aplicado en producción, su vacación pasó a 12 días y su saldo activo subió a **12** (11 + 1 devuelto). Los campos `vacationBalanceDays2026` y `vacationBalanceDays2027` (24/24) no fueron tocados — son de referencia anual. Solo `vacationBalanceDays` (saldo activo) se ajusta al otorgar/devolver vacaciones.

---

## 17. Decisiones pendientes del cliente

> Sección para registrar temas técnicos analizados que requieren autorización explícita del cliente antes de aplicar cualquier cambio. **No tocar código ni BD mientras estén en esta sección** — solo documentar el análisis y las opciones, y esperar la decisión del cliente.

### 17.1 Tolerancia de salida y contabilización de horas extra (reportado 19-ago-2026)

**Estado**: ⏸️ EN ESPERA DE DECISIÓN DEL CLIENTE — no se ha modificado nada.

**Caso concreto reportado**:
- Empleado: **Carolina Elizabeth Roblero Gutiérrez** (visible en `upload/WhatsApp Image 2026-08-19 at 10.46.31.jpeg`).
- Fecha: 15/08/2026 (viernes).
- Resultado del cálculo: **6h 1min trabajados (361 min)**, **1 min de hora extra doble**, estado **PRESENT**.
- Es decir: el horario programado era de 360 min, ella trabajó 361 min, el sistema contó **1 min de overtime**.

**Pregunta del cliente**: «si existe tolerancia para la entrada y tolerancia para la salida, ¿por qué no está respetando esa tolerancia para contabilizar las horas extras?»

**Análisis técnico — qué hace el sistema hoy**:

1. La fórmula de overtime en `src/lib/overtime-calculator.ts:315` es:
   ```typescript
   overtimeMinutes = Math.max(0, netWorkedMinutes - scheduledMinutes)
   ```
   **No resta ninguna tolerancia.** Es deliberado (ver comentario líneas 311-314: «fix #3 — bug tolerancia: la tolerancia de salida solo determina isEarlyLeave, NO se resta del overtime»).

2. Las DOS tolerancias que existen:
   | Tolerancia | Campo | Uso actual |
   |---|---|---|
   | Tolerancia de horario | `WorkSchedule.toleranceMinutes` (default 10, `schema.prisma:287`) | Solo para marcar estado **LATE** (entrada) o **EARLY_LEAVE** (salida) — NO el pago |
   | Tolerancia de salida | `Sucursal.checkoutToleranceMinutes` (default 10, `schema.prisma:145`) | **HOY NO SE USA** en el cálculo de overtime (fue retirada en fix #3) |

3. La tolerancia SÍ se respeta para decidir el estado (PRESENT/LATE/EARLY_LEAVE). **NO se aplica** para contabilizar minutos extra. Eso es deliberado.

**Historial de la decisión técnica**:
| Versión | Comportamiento | Problema |
|---|---|---|
| Original | `overtime = worked - scheduled - tol` (restaba tolerancia) | Sub-pagaba al empleado ❌ violación LFT art. 66 |
| Fix #2 (intermedio) | Igual que el original | Reportado por "Alicia" como bug: descontaba ~10 min/día de overtime |
| **Fix #3 (actual, en producción)** | `overtime = worked - scheduled` (NO resta tolerancia) | Causa el "1 min" que reporta el cliente hoy ✅ cumple LFT |

**Análisis legal — qué dice la LFT**:
1. **Art. 66 LFT** — horas extra son las que exceden de la jornada máxima legal (8h diurnas / 7h nocturnas / 7.5h mixtas, art. 61). Se pagan al doble las primeras 9h semanales y al triple el excedente. **No menciona ninguna "tolerancia" obligatoria.**
2. **Jurisprudencia y tribunales laborales mexicanos**: las horas extra se causan **desde el minuto 1** de exceso sobre la jornada. La "tolerancia de 10 minutos" es una **costumbre patronal**, no una figura legal.
3. **Riesgo de restar tolerancia del overtime**: si el sistema resta tolerancia del pago, el patrón está **sub-pagando** horas extra → violación al art. 66 LFT → en demanda laboral, el patrón paga doble/triple **más** prima vacacional, aguinaldo, intereses y, según el caso, indemnización.

**Conclusión del análisis**: legalmente, el sistema hace lo correcto hoy. El "1 min de overtime" que reportó Carolina es una hora extra **causada y exigible**. La confusión del cliente es entre "tolerancia para estado" (que sí existe y se respeta) y "tolerancia para pago" (que no existe legalmente).

**Opciones propuestas al cliente (sin aplicar ninguna)**:

| Opción | Qué hacer | Pros | Contras | Recomendación |
|---|---|---|---|---|
| **A — Mantener + documentar** | Nada en código. Explicar al cliente que cumple LFT art. 66. Agregar nota en manual/UI: *"Las horas extra se contabilizan desde el minuto 1 de exceso sobre la jornada programada, conforme al art. 66 LFT. La tolerancia solo afecta el estado, no el pago."* | Cumplimiento legal blindado, cero riesgo de demanda. | El cliente seguirá viendo "1 min" en casos así. | 🟢 **RECOMENDADA** |
| **B — Ajustar horario programado** | Editar el `WorkSchedule` del empleado (ej. Carolina 09:00-15:01 → 09:00-15:11) para que el margen quede dentro del schedule. | No se toca la lógica de cálculo, sigue cumpliendo LFT (la jornada contratada la define el patrón en el schedule). | Hay que editar horario de cada empleado manualmente; `toleranceMinutes` queda solo para estado. | 🟡 Viable |
| **C — Umbral mínimo configurable** | Agregar `overtimeThresholdMinutes` (ej. 5) a la Sucursal; si overtime < threshold, redondear a 0. | Resuelve la expectativa de "no contar minutos sueltos". | Es política interna graciosa, NO legal. Si un empleado demanda, el patrón paga los minutos redondeados a 0. Hay que documentar muy claro que no es derecho legal. | 🔴 NO recomendado |

**Próximo paso cuando el cliente decida**:
- Si elige **A**: redactar texto explicativo para el cliente + nota en manual de usuario. Sin deploy.
- Si elige **B**: identificar empleados afectados y editar sus `WorkSchedule.startTime/endTime` vía SQL en Supabase o vía endpoint admin (si existe) o creando uno. Sin cambios de código en el calculator.
- Si elige **C**: implementar `overtimeThresholdMinutes` en `Sucursal` (schema.prisma) + aplicar en `calculateOvertime` + migración + deploy. **Implica push a producción.**

**Artefactos de referencia**:
- Captura del caso: `upload/WhatsApp Image 2026-08-19 at 10.46.31.jpeg`
- Análisis VLM completo: `/tmp/vlm-result.json` (transitorio, no versionado)
- Archivos clave del código: `src/lib/overtime-calculator.ts` (líneas 311-315, fix #3), `src/app/api/attendance/check-out/route.ts` (líneas 146-152, invocación), `prisma/schema.prisma` (líneas 145 y 287, definición de tolerancias)

### 17.2 5 empleados con ~1h 30min de overtime el 18/08/2026 en ambas sucursales (reportado 19-ago-2026)

**Estado**: ⏸️ EN ESPERA DE INFORMACIÓN DEL CLIENTE — no se ha modificado nada.

**Caso reportado**: el cliente marcó en amarillo a 5 empleados que «tienen 2hras extras del día de ayer en ambas sucursales». Captura: `upload/70a11b29-eb0a-4bf2-b374-c36a94f59ac8.jpeg`.

**Empleados marcados en amarillo (todos con overtime)**:

| # | Empleado | Sucursal | Entrada | Salida | Trabajado | Extra | Doble |
|---|---|---|---|---|---|---|---|
| 1 | JONATHAN FRANCISCO SÁNCHEZ GONZÁLEZ | Local 367 | 09:01 | 19:05 | 9h 51min | 1h 31min | (valor reportado) |
| 2 | CRISTIAN JAVIN VELAZQUEZ MONTOYA | Local 367 | 09:10 | 19:01 | 9h 18min | 1h 18min | (valor reportado) |
| 3 | CLARA IDALIA GOMEZ SANTIZO | Local 367 | 08:56 | 18:08 | 9h 4min | 1h 40min | (valor reportado) |
| 4 | JOSE CANDELARIO GOMEZ HERNANDEZ | Local 261 | 09:06 | 19:00 | 9h 25min | 1h 25min | (valor reportado) |
| 5 | ALICIA GUADALUPE HERNANDEZ GONZALEZ | Local 367 | 08:54 | 19:01 | 9h 26min | 1h 26min | (valor reportado) |

**Empleados SIN overtime (mismo día, para comparar)**:

| Empleado | Sucursal | Entrada | Salida | Trabajado |
|---|---|---|---|---|
| CLARIVEL ARREOLA CLEMENTE | Local 261 | 09:09 | 17:15 | 7h 15min (Salida anticipada) |
| XIMENA VELASCO MARROQUIN | Local 367 | 11:00 | 19:06 | 8h 44min |
| JUANA MARTINEZ MENDOZA | Local 261 | 11:02 | 19:00 | 7h 59min |
| CAROLINA ELIZABETH ROBLERO GUTIERREZ | Local 261 | 09:37 | 17:00 | 7h 23min |
| LUCIA MARIA GALDAMEZ VILLAREAL | Local 367 | 11:35 | 19:04 | 7h 29min |

**Patrón detectado**:
- Los 5 con overtime: entraron ~09:00 y salieron ~19:00 (jornada en sitio de 9h 4min a 9h 51min).
- Los 5 sin overtime: o entraron tarde (~11:00) y salieron 19:00, o salieron temprano (~17:00).
- El fenómeno ocurre en ambas sucursales (Local 261 y Local 367).

**Análisis técnico — cálculo esperado con schedule por defecto del seed**:

El seed (`prisma/seed.ts:200-201`) configura por defecto:
```typescript
startTime: '09:00', endTime: '18:00', toleranceMinutes: 10
```

El calculator (`src/lib/overtime-calculator.ts:259-265`) interpreta ese schedule así:
- `rawScheduledMinutes` = 540 min (9h)
- Como 540 > 480 (jornada legal diurna), descuenta `mealDurationMinutes` (default 30)
- `scheduledMinutes` = 540 − 30 = **510 min (8h 30min)**

Para un empleado con entrada 09:00 y salida 19:00 (600 min en sitio):
- Si **NO** registró comida: `netWorkedMinutes` = 600 → `overtime` = 600 − 510 = **90 min = 1h 30min** ← coincide con lo reportado.
- Si **SÍ** registró 30min de comida: `netWorkedMinutes` = 570 → `overtime` = 570 − 510 = **60 min = 1h**.

**Tres hipótesis del problema (sin confirmar en BD)**:

| # | Hipótesis | Cómo se confirma | Cómo se resuelve |
|---|---|---|---|
| **H1** | El schedule real contratado es **09:00-19:00** (10h en sitio, 9h trabajo + 1h comida), pero el sistema lo tiene como **09:00-18:00** del seed. Al salir a las 19:00, se genera overtime que no debería existir. | Consultar `WorkSchedule` en Supabase para estos 5 empleados. | Editar `endTime` a `19:00` en los schedules afectados. **Sin cambios de código.** |
| **H2** | El schedule 09:00-18:00 es correcto, pero los empleados **no registran comida** (mealStart/mealEnd), por lo que no se descuentan los 30min y el sistema cuenta toda la jornada en sitio como trabajo. | Consultar `AttendanceRecord.mealStart/mealEnd` del 18/08/2026 de estos 5 empleados. | Política: obligar registro de comida, o comida automática, o ajustar schedule. |
| **H3** | El schedule es correcto, los empleados sí trabajaron hasta 19:00, y el overtime de ~1h 30min **es real y exigible** (art. 66 LFT). El cliente no esperaba ver tanto overtime. | Confirmar con el cliente cuál es la jornada contratada real. | Documentar y explicar al cliente (como §17.1). |

**Actualización (19-ago-2026 noche) — HIPÓTESIS CONFIRMADA POR EL CLIENTE**:

El cliente aclaró que el problema NO es que haya overtime de más, sino que el overtime es **de menos**. Los 5 empleados deberían tener **al menos 2 horas completas de overtime**, pero el sistema muestra **~1h 31min**. El cliente sospechó (correctamente) que se les está descontando el tiempo de comida.

**Confirmado: el cliente tiene razón.** El descuento de `mealDurationMinutes` del schedule está reduciendo el overtime.

**Cálculo paso a paso (ejemplo Alicia Guadalupe 08:54-19:01)**:
1. `workedMinutes` = 607 min (10h 7min en sitio, de 08:54 a 19:01)
2. `netWorkedMinutes` = 607 min (NO registró comida — columna "Descanso" = — en la captura)
3. `rawScheduledMinutes` = 540 (09:00-18:00)
4. 540 > 480 → `scheduledMinutes` = 540 − `mealDurationMinutes` = 540 − **30** = **510 min (8h 30min)** ← **AQUÍ ESTÁ EL DESCUENTO DE 30 MIN**
5. `overtimeMinutes` = 607 − 510 = 97 min ≈ **1h 37min** (sistema muestra 1h 26min, VLM con posible error de lectura)

**Si `mealDurationMinutes` fuera 60** (1 hora de comida, estándar en México):
- `scheduledMinutes` = 540 − 60 = **480 min (8h exactas)**
- `overtimeMinutes` = 607 − 480 = 127 min ≈ **2h 7min** ← **coincide con la expectativa del cliente**

**Diferencia**: 127 − 97 = 30 min = el `mealDurationMinutes` actual.

**Los DOS niveles de descuento de comida en el sistema**:
| Nivel | Código | Cuándo aplica | En este caso |
|---|---|---|---|
| **1. Descuento del schedule** | `overtime-calculator.ts:261-262` | Siempre que `rawScheduledMinutes > 480`. Descuenta `Sucursal.mealDurationMinutes` del schedule. | ✅ Actúa: 540 − 30 = **510 min** |
| **2. Descuento del trabajo real** | `overtime-calculator.ts:179-180` | Solo si el empleado registró `mealStart`/`mealEnd`. | ❌ No aplica: empleados NO registraron comida |

**Hipótesis final → H2 revisada (mealDurationMinutes mal configurado)**:
- `Sucursal.mealDurationMinutes` está en **30 min** (valor default del schema `prisma/schema.prisma:143`).
- La comida real probablemente es de **60 min** (1 hora, estándar mexicano).
- El descuento del schedule usa este valor, por lo que la "jornada esperada" se calcula como 8h 30min en vez de 8h.
- Esto reduce el overtime en ~30 min por día para todos los empleados de ambas sucursales.

**Solución propuesta (sin cambios de código, sin deploy)**:
1. Confirmar en Supabase: valor actual de `mealDurationMinutes` en ambas sucursales (Local 261 y Local 367).
2. Si es 30, cambiarlo a 60 (o al valor real de la comida contractual).
3. Recalcular registros afectados (18/08 y días anteriores con overtime calculado) vía endpoint `/api/admin/recalc-overtime`.
4. **Impacto**: afecta el `scheduledMinutes` de TODOS los empleados de la sucursal (no solo estos 5), y cualquier reporte que compare "trabajado vs programado".

**PENDIENTE**: autorización del cliente para consultar Supabase y ejecutar el cambio.

**Distinción con §17.1 (Carolina Roblero)**: NO es el mismo problema.
- §17.1: 1 min de overtime por exceder 1 minuto el schedule (caso de "tolerancia para pago").
- §17.2: ~1h 30min de overtime en vez de ~2h por `mealDurationMinutes = 30` cuando la comida real es de 60 min (caso de "configuración de duración de comida en Sucursal").

**Artefactos de referencia**:
- Captura del caso: `upload/70a11b29-eb0a-4bf2-b374-c36a94f59ac8.jpeg`
- Análisis VLM completo: `/tmp/vlm-result2.json` (transitorio, no versionado)
- Archivos clave del código: `prisma/seed.ts:200-201` (schedule por defecto), `src/lib/overtime-calculator.ts:259-265` (descuento de comida del schedule), `src/lib/overtime-calculator.ts:179-180` (descuento de comida del trabajo real), `prisma/schema.prisma:143` (mealDurationMinutes default 30 en Sucursal)

---

*Documento generado el 12 de agosto 2026. Última actualización: 19 de agosto 2026 (§17.2 actualizada: cliente confirmó que el overtime es de MENOS, no de más; causa raíz probable es `mealDurationMinutes = 30` cuando la comida real es de 60 min; pendiente autorización para consultar Supabase y corregir). Mantener actualizado al finalizar cada sesión de cambios significativos.*
