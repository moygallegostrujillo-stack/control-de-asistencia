# Cumplimiento LFPDPPP — MVP Implementado

> **Estado:** MVP funcional (versión 1.0)  
> **Fecha:** 2026-07-21  
> **Marco legal:** Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)  
> **Aviso:** Este documento es técnico. **El Aviso de Privacidad definitivo debe ser redactado por un abogado mexicano colegiado y registrado ante el INAI en el REPS antes de salir a producción.**

---

## 1. Alcance del MVP

El MVP cubre los puntos mínimos viables para que el sistema de Control de Asistencia pueda considerarse **cumplidor** de la LFPDPPP como **encargado** de datos personales (art. 2 fr. XII). El responsable del tratamiento sigue siendo la empresa cliente (ej. Marlui).

### 1.1 Puntos implementados

| # | Punto legal | Implementación |
|---|---|---|
| 1 | Consentimiento informado y expreso (art. 17) | `POST /api/user/privacy/accept` + modal bloqueante + página `/legal/aviso-de-privacidad` |
| 2 | Versión del aviso trazable | `CURRENT_PRIVACY_VERSION = '1.0'` en `src/lib/privacy.ts`; si cambia, fuerza re-consentimiento |
| 3 | Evidencia probatoria del consentimiento | `User.privacyAcceptedAt`, `privacyAcceptedVersion`, `privacyAcceptedIp` + `AuditLog` con acción `PRIVACY_CONSENT_ACCEPT` |
| 4 | Bloqueo de acceso sin consentimiento | `src/middleware.ts` redirige a `/legal/aviso-de-privacidad?required=1` |
| 5 | Derecho de Acceso (art. 29) | `GET /api/user/mydata` retorna todos los datos personales del usuario |
| 6 | Derecho de Rectificación (art. 30) | `POST /api/user/arco/request` con `type=RECTIFICATION` |
| 7 | Derecho de Cancelación (art. 31) | `POST /api/user/arco/request` con `type=CANCELLATION` + anonimización en resolución |
| 8 | Derecho de Oposición (art. 32) | `POST /api/user/arco/request` con `type=OPPOSITION` |
| 9 | Gestión de solicitudes ARCO (DPO) | `GET /api/admin/arco/requests` + `PATCH /api/admin/arco/[id]/resolve` |
| 10 | Plazo legal 20 días hábiles (art. 100) | El endpoint admin calcula `daysRemaining` y marca `isOverdue` |
| 11 | Aviso de Privacidad conforme a art. 16 | Página `/legal/aviso-de-privacidad` con 9 secciones (placeholders `[REDACTAR_POR_ABOGADO]`) |
| 12 | Anonimización tras cancelación | `lib/privacy.ts → anonymizeUserData` suprime datos identificativos, conserva registros anonimizados por LFT art. 804 |

### 1.2 Conflicto legislativo LFPDPPP vs LFT — Decisión de diseño

**Conflicto:** 
- LFPDPPP art. 31 (derecho de cancelación) ordena **suprimir** los datos personales.
- LFT art. 804 obliga a **conservar** los registros de asistencia por 12 meses posteriores a la terminación de la relación laboral (propósitos probatorios: demandas laborales, auditorías IMSS, visitas STPS).

**Decisión adoptada (documentada en `src/lib/privacy.ts`):**
1. Se **SUPRIMEN** los datos personales identificativos del `User` (email → hash único, name → "Usuario Anonimizado", passwordHash → `__ANONYMIZED__`, MFA → null, IP de consentimiento → null).
2. Se **ANONIMIZAN** los campos del `Employee` (position, department → "ANONIMIZADO").
3. Se **CONSERVAN** los `AttendanceRecord` (jornada, horas extra, prima, status) para cumplimiento LFT art. 804, **pero** se anonimizan IPs y User-Agents asociados.
4. Se **SUPRIMEN** los `WorkSchedule`, `Vacation`, `DynamicQR` (no tienen valor probatorio LFT).
5. Se **ANONIMIZAN** las IPs en `AuditLog` (se conserva el registro de la acción, no la IP del actor).
6. La anonimización es **IRREVERSIBLE** y se registra como `PRIVACY_ANONYMIZATION` en el AuditLog.

Esta decisión se documenta explícitamente en:
- `src/lib/privacy.ts` (comentarios del módulo)
- `PATCH /api/admin/arco/[id]/resolve` (campo `legalReference` en AuditLog)
- El aviso de privacidad (sección 8 — Conservación y Supresión)

---

## 2. Modelo de datos (Prisma)

### 2.1 Campos agregados a `User`

```prisma
privacyAcceptedAt        DateTime?
privacyAcceptedVersion   String?
privacyAcceptedIp        String?
```

### 2.2 Modelo nuevo `PrivacyRequest`

```prisma
model PrivacyRequest {
  id              String   @id @default(cuid())
  userId          String
  type            String   // ACCESS | RECTIFICATION | CANCELLATION | OPPOSITION
  status          String   @default("PENDING") // PENDING | IN_PROGRESS | RESOLVED | REJECTED
  requestDetails  String?  // JSON: { fields?: string[], reason?: string }
  resolutionNotes String?
  createdAt       DateTime @default(now())
  resolvedAt      DateTime?
  resolvedById    String?
  user          User     @relation("PrivacyRequester", ...)
  resolvedBy    User?    @relation("PrivacyRequestResolver", ...)
  @@index([userId, status, type, createdAt])
}
```

---

## 3. Endpoints

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/user/privacy/accept` | Registra consentimiento (versión, IP, timestamp) | Sesión |
| GET | `/api/user/privacy/status` | Estado de consentimiento del usuario actual | Sesión |
| GET | `/api/user/mydata` | Derecho de acceso — descarga JSON con todos los datos personales | Sesión |
| POST | `/api/user/arco/request` | Crea una solicitud ARCO (ACCESS/RECT/CANCEL/OPP) | Sesión |
| GET | `/api/admin/arco/requests` | Lista solicitudes ARCO (con días restantes y flag `isOverdue`) | GENERAL_ADMIN |
| PATCH | `/api/admin/arco/[id]/resolve` | Resuelve o rechaza una solicitud; si es CANCELLATION+RESOLVED, anonimiza | GENERAL_ADMIN |

Todos los endpoints:
- Usan `getAuthUser()` de `src/lib/auth.ts`.
- Registran mutaciones en `AuditLog` vía `lib/audit.ts`.
- Manejan errores con códigos HTTP correctos (400/401/403/404/409/500).
- Sanitizan logs de error (`error?.code || 'UNKNOWN'`) — no loguean contexto sensible.

---

## 4. Páginas / UI

| Ruta | Tipo | Descripción |
|---|---|---|
| `/legal/aviso-de-privacidad` | Server Component | Aviso de Privacidad completo (9 secciones conforme art. 16 LFPDPPP) con placeholders `[REDACTAR_POR_ABOGADO]` |
| `/legal/derechos-arco` | Server Component | Catálogo visual de los 4 derechos ARCO + formulario de solicitud |
| Modal `PrivacyConsentModal` | Client Component | Modal bloqueante que aparece al primer login o cuando cambia la versión |

### Componentes reutilizables (`src/components/legal/`)
- `privacy-consent.tsx` — Checkbox + botones aceptar/rechazar para la página del aviso.
- `privacy-consent-modal.tsx` — Modal bloqueante (Dialog de shadcn/ui) para el layout principal.
- `arco-form.tsx` — Formulario de creación de solicitud ARCO.

---

## 5. Middleware (protección)

`src/middleware.ts` ahora valida **dos capas**:

1. **Autenticación** (igual que antes) — JWT NextAuth o cookie legacy.
2. **Consentimiento LFPDPPP** — si el usuario NO ha aceptado la versión vigente:
   - Rutas API → 403 con `{ code: 'PRIVACY_CONSENT_REQUIRED', currentVersion }`.
   - Páginas → redirect a `/legal/aviso-de-privacidad?required=1`.

**Rutas exceptuadas** (definidas en `PRIVACY_PUBLIC_PATHS` de `src/lib/privacy.ts`):
- `/legal/*` — páginas legales.
- `/api/user/privacy/accept` y `/api/user/privacy/status` — el usuario necesita poder aceptar y consultar.
- `/api/user/mydata` — el derecho de acceso se puede ejercer aunque no se haya aceptado el aviso (es derecho del titular previo al consentimiento).
- `/api/auth/*` — login, logout, MFA.
- `/api/health`, `/api/seed`.

---

## 6. Variables de entorno (.env)

No se agregaron variables nuevas en este MVP. La configuración existente es suficiente:

```env
NEXTAUTH_SECRET="..."   # ya existente — firma el JWT que lleva el flag privacyAccepted
NEXTAUTH_URL="..."       # ya existente
DATABASE_URL="..."       # ya existente — Supabase PostgreSQL
```

**Para producción (Vercel):**
1. Después de `prisma db push` (o `prisma migrate`) en Supabase, los nuevos campos y la tabla `PrivacyRequest` se crean automáticamente.
2. El flag `privacyAccepted` se hidrata en el JWT al hacer login. **Importante:** todos los usuarios existentes deberán aceptar el aviso en su próximo login (porque `privacyAcceptedAt` empezará en NULL).
3. No hay migración de datos — los usuarios existentes simplemente verán el modal al primer acceso.

---

## 7. Próximos pasos

### 7.1 Antes de salir a producción (OBLIGATORIO)
- [ ] **Contratar abogado mexicano** para redactar el texto definitivo del Aviso de Privacidad (reemplazar todos los `[REDACTAR_POR_ABOGADO]`).
- [ ] **Registrar el aviso en el REPS del INAI** (Registro de Personas Acreditadas) — obligatorio si la empresa trata datos personales sensibles a gran escala.
- [ ] **Designar un DPO** (Data Protection Officer / Encargado de Datos Personales) y publicar su contacto en el aviso.
- [ ] **Política de retención de IPs**: implementar cron job mensual que anonimice IPs de `AttendanceRecord` y `AuditLog` con más de 12 meses (Brecha #9 del reporte de auditoría).
- [ ] **Política de rate limiting** en `/api/auth/login`, `/api/auth/qr-login`, `/api/user/arco/request` (Brecha #7).
- [ ] **Cabeceras de seguridad** CSP, HSTS, Referrer-Policy (Brecha #6).

### 7.2 Mejoras funcionales futuras
- [ ] **Notificación por email al DPO** cuando se cree una solicitud ARCO (ahora solo genera AuditLog).
- [ ] **Exportación PDF** del derecho de acceso (`/api/user/mydata` ahora devuelve JSON; debería también ofrecer PDF firmado).
- [ ] **Dashboard del DPO** en `/admin/arco` con gráficas de solicitudes por tipo y estado.
- [ ] **Cron de expiración**: solicitudes PENDING > 20 días hábiles → alerta automática al DPO.

---

## 8. Referencias legales

| Artículo | Materia | Implementación |
|---|---|---|
| LFPDPPP art. 2 fr. XII | Definición de "encargado" | El sistema es "encargado"; la empresa cliente es "responsable" |
| LFPDPPP art. 8 | Derechos ARCO | Endpoints `/api/user/arco/*` y `/api/admin/arco/*` |
| LFPDPPP art. 12 | Supresión tras finalidad | Anonimización tras 12 meses (pendiente cron) |
| LFPDPPP art. 15 | Aviso de privacidad simplificado | Pendiente — por ahora solo versión integral |
| LFPDPPP art. 16 | Contenido del aviso | Página `/legal/aviso-de-privacidad` con 9 secciones |
| LFPDPPP art. 17 | Consentimiento informado | Modal bloqueante + `privacyAcceptedAt/Version/Ip` |
| LFPDPPP art. 29 | Derecho de acceso | `GET /api/user/mydata` |
| LFPDPPP art. 30 | Derecho de rectificación | `POST /api/user/arco/request` type=RECTIFICATION |
| LFPDPPP art. 31 | Derecho de cancelación | Anonimización (conflicto con LFT art. 804) |
| LFPDPPP art. 32 | Derecho de oposición | `POST /api/user/arco/request` type=OPPOSITION |
| LFPDPPP art. 100 | Plazo 20 días hábiles | Cálculo en `/api/admin/arco/requests` |
| LFPDPPP art. 63 | Sanciones INAI | Hasta 20,000 días de salario mínimo — justifica el MVP |
| LFT art. 804 | Conservación 12 meses | Anonimización preserva registros probatorios |

---

## 9. Archivos creados / modificados

### Creados (11)
- `src/lib/privacy.ts` — Constantes y anonimización.
- `src/app/api/user/privacy/accept/route.ts`
- `src/app/api/user/privacy/status/route.ts`
- `src/app/api/user/mydata/route.ts`
- `src/app/api/user/arco/request/route.ts`
- `src/app/api/admin/arco/requests/route.ts`
- `src/app/api/admin/arco/[id]/resolve/route.ts`
- `src/app/legal/aviso-de-privacidad/page.tsx`
- `src/app/legal/derechos-arco/page.tsx`
- `src/components/legal/privacy-consent.tsx`
- `src/components/legal/privacy-consent-modal.tsx`
- `src/components/legal/arco-form.tsx`
- `documentos/cumplimiento-lfpdppp.md` (este archivo)

### Modificados (3)
- `prisma/schema.prisma` — Agrega 3 campos a `User` + tabla `PrivacyRequest`.
- `src/middleware.ts` — Validación de consentimiento LFPDPPP.
- `src/lib/auth.ts` — JWT incluye `privacyAccepted` y `privacyVersion`.
