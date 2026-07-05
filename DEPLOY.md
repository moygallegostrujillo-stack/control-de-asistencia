# 🚀 Guía de Deploy — Control de Asistencia NOM-037 v2.2

Guía completa para desplegar el sistema en producción con **Vercel** (app Next.js) + **Railway** (servicio Socket.io realtime) + **Supabase** (PostgreSQL).

---

## 📋 Arquitectura de producción

```
┌─────────────────────────────────────────────────────────────┐
│                       NAVEGADOR                             │
│  (Empleado / Admin / Supervisor)                            │
└──────┬──────────────────────────────────┬───────────────────┘
       │                                  │
       │ HTTPS (Next.js)                  │ WSS (Socket.io)
       │                                  │
       ▼                                  ▼
┌─────────────────────┐         ┌─────────────────────────┐
│   VERCEL (Next.js)  │         │  RAILWAY (Socket.io)    │
│                     │  HTTP   │                         │
│  - App Router       │ ──────► │  - Eventos realtime     │
│  - API Routes       │  POST   │  - WebSocket persistente│
│  - Auth (NextAuth)  │ /emit   │  - Puerto 3003          │
│  - SSR/RSC          │         │                         │
└────────┬────────────┘         └─────────────────────────┘
         │
         │ Prisma (PostgreSQL)
         ▼
┌─────────────────────────────────────────┐
│           SUPABASE (PostgreSQL)         │
│                                         │
│  - 10 modelos (User, Employee, etc.)    │
│  - Connection pooler (pgbouncer)        │
│  - Backup automático                    │
└─────────────────────────────────────────┘
```

### ¿Por qué 3 servicios?

| Servicio | Por qué |
|----------|---------|
| **Vercel** | Serverless, ideal para Next.js. Auto-deploy desde GitHub. Plan free generoso. |
| **Railway** | Vercel NO soporta WebSockets persistentes (serverless). Railway es un contenedor Docker que mantiene el socket abierto. |
| **Supabase** | PostgreSQL gestionado con backup automático, auth (opcional), y dashboard SQL. Plan free: 500MB. |

---

## ✅ Prerrequisitos

Antes de empezar necesitas:

- [ ] **Cuenta de GitHub** con el código del proyecto en un repo
- [ ] **Cuenta de Vercel** (https://vercel.com — login con GitHub)
- [ ] **Cuenta de Railway** (https://railway.app — login con GitHub)
- [ ] **Cuenta de Supabase** (https://supabase.com — login con GitHub)
- [ ] **Bun** instalado localmente (https://bun.sh)
- [ ] **Vercel CLI** (`npm i -g vercel`)

---

## 🗺️ Pasos de deploy

### Paso 1: Crear base de datos en Supabase

1. Ve a https://supabase.com → **New Project**
2. Nombre: `control-asistencia`
3. Database password: **guárdala en un gestor de passwords**
4. Region: `US East (Virginia)` — recomendada para Vercel iad1
5. Wait ~2 min hasta que esté "Ready"

Una vez creado, obtén las URLs de conexión:

1. Dashboard → **Project Settings** → **Database**
2. En "Connection string", copia las dos URLs:

```
# Transaction pooler (para app serverless — Vercel)
postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Session mode (para migraciones Prisma)
postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### Paso 2: Configurar `.env` local

```bash
cd control-de-asistencia
cp .env.example .env
```

Edita `.env` con los valores reales:

```bash
DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-...pooler.supabase.com:5432/postgres"

# Generar con: openssl rand -base64 32
NEXTAUTH_SECRET="GENERAR_UNO_NUEVO_AQUI"
NEXTAUTH_URL="http://localhost:3000"  # Cambiar después a URL de Vercel
```

### Paso 3: Cambiar schema a PostgreSQL

```bash
./scripts/switch-schema.sh postgres
```

Esto copia `prisma/schema.postgres.prisma` a `prisma/schema.prisma` y regenera Prisma Client.

> 💡 Para volver a desarrollo local: `./scripts/switch-schema.sh sqlite`

### Paso 4: Sincronizar schema con Supabase

```bash
bun run db:push
```

Esto crea las 10 tablas en Supabase. La primera vez verás mensajes como:
```
🛑  We found changes that cannot be executed:
   - Added the required column `mfaSecret`...
```
Responde `y` para confirmar. En DB nueva esto es seguro.

### Paso 5: (Opcional) Cargar datos seed

```bash
bun run db:seed
```

Crea datos demo:
- 1 empresa singleton
- 2 sucursales (Matriz + Sucursal 1)
- 7 días feriados 2025
- 3 admins (1 GENERAL_ADMIN + 2 SUCURSAL_ADMIN)
- 8 empleados con horarios L-V 9-18

**Credenciales:**
| Usuario | Email | Password |
|---------|-------|----------|
| Admin General | `admin@control.com` | `Admin#2025` |
| Admin Matriz | `admin.matriz@control.com` | `Matriz#2025` |
| Admin Sucursal 1 | `admin.sucursal1@control.com` | `Suc1#2025` |
| Empleados | `EMP-001` a `EMP-008` | `Empleado#2025` |

> ⚠️ **Cambia estas passwords en producción** vía el panel admin.

### Paso 6: Deploy a Vercel

#### Opción A: Script automatizado (recomendado)

```bash
./scripts/deploy-vercel.sh
```

El script te guía paso a paso y configura todo automáticamente.

#### Opción B: Manual

```bash
# Login
vercel login

# Link proyecto
vercel link

# Configurar variables de entorno (una por una)
# Dashboard: https://vercel.com/dashboard → tu proyecto → Settings → Env Vars
# O vía CLI:
echo "postgresql://..." | vercel env add DATABASE_URL production preview development
echo "postgresql://..." | vercel env add DIRECT_URL production preview development
echo "tu-secreto" | vercel env add NEXTAUTH_SECRET production preview development
echo "https://tu-app.vercel.app" | vercel env add NEXTAUTH_URL production preview development

# Deploy a producción
vercel --prod
```

Anota la URL de producción (ej: `https://control-asistencia.vercel.app`).

### Paso 7: Deploy del servicio realtime en Railway

1. Ve a https://railway.app → **New Project**
2. Selecciona **Deploy from GitHub repo**
3. Elige tu repo y el directorio: `mini-services/realtime-service`
4. Railway detecta automáticamente el `Dockerfile`
5. En **Variables**, añade:

   | Variable | Valor |
   |----------|-------|
   | `NEXTAUTH_SECRET` | (mismo que en Vercel) |
   | `CORS_ORIGIN` | `https://control-asistencia.vercel.app` |
   | `NODE_ENV` | `production` |

6. Espera 1-2 min hasta que esté "Active"
7. En **Settings → Networking**, genera un dominio público:
   - Ej: `https://control-asistencia-realtime.up.railway.app`
8. Verifica el health check:
   ```bash
   curl https://control-asistencia-realtime.up.railway.app/health
   # → {"status":"ok","service":"realtime-service","port":3003,"connections":0}
   ```

### Paso 8: Conectar Vercel con Railway

Actualiza las variables de entorno en Vercel con la URL de Railway:

```bash
# Vía CLI
echo "https://control-asistencia-realtime.up.railway.app" | \
  vercel env add REALTIME_SERVICE_URL production preview development

echo "https://control-asistencia-realtime.up.railway.app" | \
  vercel env add NEXT_PUBLIC_REALTIME_URL production preview development

# Redeploy para que tome las nuevas vars
vercel --prod --yes
```

O vía Dashboard: https://vercel.com/dashboard → proyecto → Settings → Environment Variables.

### Paso 9: Verificación final

Abre tu URL de producción: `https://control-asistencia.vercel.app`

1. **Health check**: visita `/api/health` → debe retornar `{"status":"ok","version":"2.2.0"}`
2. **Login**: usa `admin@control.com` / `Admin#2025`
3. **Dashboard**: deben aparecer 11 items de navegación
4. **Realtime**: abre DevTools → Console → no debe haber errores `[realtime] Error de conexión`
5. **Test realtime**: haz check-in desde el portal empleado → admin debe ver toast instantáneo

---

## 🔧 Comandos útiles

### Cambiar entre schemas

```bash
./scripts/switch-schema.sh sqlite     # dev local
./scripts/switch-schema.sh postgres   # producción
./scripts/switch-schema.sh status     # ver actual
```

### Redeploy después de cambios

```bash
git add -A && git commit -m "fix: algo" && git push
# Vercel auto-deploya desde GitHub (si está conectado)
# O manual:
vercel --prod --yes
```

### Ver logs de Vercel

```bash
vercel logs [deployment-url]
# O en dashboard: proyecto → Deploys → click en deploy → Logs
```

### Ver logs de Railway

```bash
# Dashboard: proyecto → Settings → Logs
# O vía CLI:
railway logs
```

### Reset base de datos (⚠️ borra todo)

```bash
bun run db:reset   # solo en dev/staging, NUNCA en producción
```

---

## 🚨 Troubleshooting

### Error: `Environment variable not found: DIRECT_URL`

Estás usando schema PostgreSQL pero no configuraste `DIRECT_URL` en Vercel.

**Solución**:
```bash
echo "postgresql://..." | vercel env add DIRECT_URL production preview development
vercel --prod --yes
```

### Error: `Can't reach database server at ...:6543`

Supabase paused tu proyecto (plan free pausa tras 1 semana inactivo).

**Solución**: Dashboard Supabase → Settings → Resume Project.

### Realtime no conecta (errores en consola del navegador)

1. Verifica que Railway esté corriendo: `curl https://<tu-url>.up.railway.app/health`
2. Verifica `CORS_ORIGIN` en Railway = URL de Vercel (sin slash final)
3. Verifica `NEXT_PUBLIC_REALTIME_URL` en Vercel = URL de Railway
4. Redeploy Vercel: `vercel --prod --yes`
5. Abre DevTools → Network → busca `socket.io` → debe ser 101 (Switching Protocols)

### Login falla con "Error interno"

1. Revisa `vercel logs` para ver el error exacto
2. Probablemente `NEXTAUTH_SECRET` no está configurado o difiere entre Vercel y Railway
3. Deben ser **idénticos** en ambos servicios

### `prisma db:push` falla con "relation already exists"

Tu DB ya tenía tablas de un deploy previo. Opciones:

```bash
# Opción 1: Push destructivo (borra data)
bun run db:push --accept-data-loss

# Opción 2: Reset completo (solo en staging)
bun run db:reset

# Opción 3: Migración incremental (producción con data real)
bun run db:migrate dev --name add-mfa-fields
```

---

## 💰 Costos estimados

| Servicio | Plan free | Plan pago recomendado |
|----------|-----------|----------------------|
| **Vercel** | 100GB bandwidth, 100h build/mes | Pro $20/mes (1TB BW, build ilimitado) |
| **Railway** | $5 credit = ~500h | Developer $5/mes (siempre activo) |
| **Supabase** | 500MB DB, 50MB archivos | Pro $25/mes (8GB DB, 100GB archivos) |

**Total mínimo producción**: $0/mes (con plan free de todo)
**Producción recomendada**: ~$25-50/mes (Supabase Pro + Railway Developer)

---

## 🔒 Seguridad en producción

1. **NEXTAUTH_SECRET**: genera uno único con `openssl rand -base64 32`. NUNCA lo commitees.
2. **MFA TOTP**: actívalo para todos los admins desde el panel.
3. **Passwords seed**: cambia `Admin#2025`, `Matriz#2025`, etc. por passwords fuertes únicos.
4. **Supabase RLS**: opcional, pero recomendado para defensa en profundidad.
5. **Vercel DDoS Protection**: activo por defecto en plan free.
6. **HTTPS**: Vercel fuerza HTTPS automáticamente. Verifica que `NEXTAUTH_URL` use `https://`.

---

## 📚 Recursos adicionales

- [Diagrama del sistema](./public/diagrama/sistema.html) — visión mental completa
- [PDF del proyecto v2.2](./public/Proyecto-Asistencias-v2.2.pdf) — documento cliente
- [Vercel Docs](https://vercel.com/docs) — deployment Next.js
- [Railway Docs](https://docs.railway.app) — deployment Docker
- [Supabase Docs](https://supabase.com/docs) — PostgreSQL gestionado
- [Prisma + Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel) — guía oficial
- [NextAuth.js](https://next-auth.js.org/deployment) — deployment guide
