# Guía de Deploy — Control de Asistencia NOM-037 v2.2

Esta guía te lleva paso a paso desde un repo local hasta una app funcionando en producción en Vercel con base de datos en Supabase.

---

## Arquitectura final

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Navegador     │ ───▶ │  Vercel (Next.js)│ ───▶ │  Supabase (PG)  │
│   (usuario)     │      │  iad1 (US East)  │      │  aws-1-us-east-1│
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Railway/Render   │
                         │ (Socket.io RT)   │
                         └──────────────────┘
```

- **Vercel** hospeda la app Next.js (región `iad1` — US East).
- **Supabase** hospeda PostgreSQL (región `aws-1-us-east-1` — misma zona que Vercel para mínima latencia).
- **Railway/Render** (opcional) hospeda el mini-service Socket.io para real-time (alertas push a admin cuando hay check-in/out). Si no lo configuras, la app funciona igual, sólo sin pushes en tiempo real (los admins ven los cambios al refrescar).

---

## ✅ Pre-requisitos

1. **Cuenta Vercel** — https://vercel.com/signup (puede ser login con GitHub).
2. **Cuenta Supabase** — https://supabase.com (plan free es suficiente).
3. **Repo en GitHub** (recomendado) — para auto-deploy en cada push.
   - Alternativa: Vercel CLI (`bunx vercel`) desde tu máquina.
4. **Bun instalado localmente** — https://bun.sh (sólo si vas a probar el build local).

---

## 🚀 Pasos del deploy

### Paso 1 — Crear proyecto en Supabase

1. Entra a https://supabase.com/dashboard y haz clic en **New Project**.
2. **Name**: `control-asistencia` (o el que prefieras).
3. **Database Password**: genera una segura y guárdala (no la pierdas).
4. **Region**: `US East (N. Virginia)` — `aws-1-us-east-1` (misma región que Vercel para mínima latencia).
5. **Plan**: Free.
6. Espera ~2 min a que el proyecto se cree.

#### Obtener las URLs de conexión

Entra a **Project Settings → Database → Connection string**:

- **Transaction pooler** (puerto `6543`, con `?pgbouncer=true`):
  ```
  postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
  → Esta es tu `DATABASE_URL`.

- **Session mode** (puerto `5432`, sin pgbouncer):
  ```
  postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
  ```
  → Esta es tu `DIRECT_URL`.

> ⚠️ **Si tu password tiene caracteres especiales** (`@`, `#`, `?`, `/`, etc.) debes URL-encodearlos. Por ejemplo `??` se convierte en `%3F%3F`.

---

### Paso 2 — Generar secrets

En tu terminal local:

```bash
# NEXTAUTH_SECRET (para firmar JWT de sesión)
openssl rand -base64 32

# QR_HMAC_SECRET (para firmar QRs dinámicos de check-in)
openssl rand -base64 32
```

Copia ambos valores. Los necesitarás en el Paso 4.

---

### Paso 3 — Subir el repo a GitHub

```bash
# En la raíz del proyecto
git init
git add .
git commit -m "Initial commit: Control de Asistencia NOM-037 v2.2"
git branch -M main
git remote add origin https://github.com/tu-usuario/control-asistencia.git
git push -u origin main
```

> Si ya tienes el repo, simplemente `git push` con los últimos cambios.

---

### Paso 4 — Crear el proyecto en Vercel

#### Opción A — Vía dashboard (recomendada)

1. Entra a https://vercel.com/new
2. Importa el repo de GitHub.
3. Vercel detecta Next.js automáticamente. **NO cambies** los campos:
   - Framework: Next.js
   - Build Command: el de `vercel.json` (se usa automáticamente)
   - Install Command: `bun install` (se usa automáticamente)
4. **Antes de hacer clic en Deploy**, expande **Environment Variables** y agrega estas 6 variables (en los 3 entornos: Production, Preview, Development):

   | Nombre | Valor |
   |--------|-------|
   | `DATABASE_URL` | `postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `DIRECT_URL` | `postgresql://postgres.xxxxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
   | `NEXTAUTH_SECRET` | (el que generaste con `openssl rand`) |
   | `NEXTAUTH_URL` | `https://tu-proyecto.vercel.app` (lo verás después del primer deploy; si no lo sabes aún, pon `https://placeholder.vercel.app` y lo actualizas después) |
   | `QR_HMAC_SECRET` | (el que generaste con `openssl rand`) |
   | `NODE_ENV` | `production` |

5. Haz clic en **Deploy**.
6. El primer build tarda ~2-3 min (incluye `prisma db push` que crea las 10 tablas y `bun run prisma/seed.ts` que carga datos demo).

#### Opción B — Vía Vercel CLI

```bash
# 1. Login (abre navegador para autenticar)
bunx vercel login

# 2. Link el repo local a un proyecto Vercel
bunx vercel link

# 3. Setear env vars (te las pedirá interactivamente)
bunx vercel env add DATABASE_URL production
bunx vercel env add DIRECT_URL production
bunx vercel env add NEXTAUTH_SECRET production
bunx vercel env add NEXTAUTH_URL production
bunx vercel env add QR_HMAC_SECRET production
bunx vercel env add NODE_ENV production

# 4. Deploy a producción
bunx vercel --prod
```

> ⚠️ **NUNCA** pegues tu token de Vercel en chats, scripts, o archivos que se commiteen. Usa `vercel login` interactivo o variables de entorno del SO.

---

### Paso 5 — Actualizar NEXTAUTH_URL

Después del primer deploy, Vercel te da una URL como `https://control-asistencia-xxx.vercel.app`.

1. Ve a **Vercel Dashboard → tu proyecto → Settings → Environment Variables**.
2. Edita `NEXTAUTH_URL` y pon la URL real de tu deploy.
3. **Redeploy**: en la pestaña "Deployments", haz clic en los `...` del último deploy → **Redeploy**.

---

### Paso 6 — Verificar el deploy

Abre la URL de Vercel. Debes ver:

- ✅ Pantalla de login "Control de Asistencia".
- ✅ Login con `admin@control.com` / `Admin#2025` → dashboard admin con 4 KPIs.
- ✅ Vista Empleados: 8 empleados demo cargados.
- ✅ Vista Reportes: 5 reportes con export CSV/XLSX funcional.
- ✅ Vista NOM-035: panel de alertas.
- ✅ Login con `ana.lopez@control.com` / `Empleado#2025` → vista empleado con 4 tabs.

Si algo falla, revisa los logs en **Vercel Dashboard → tu proyecto → Logs**.

---

## 🔐 Cuentas demo (creadas por el seed)

| Rol | Email | Password |
|-----|-------|----------|
| Admin General | `admin@control.com` | `Admin#2025` |
| Admin Matriz | `admin.matriz@control.com` | `Admin#2025` |
| Admin Sucursal 1 | `admin.suc1@control.com` | `Admin#2025` |
| Empleado | `ana.lopez@control.com` | `Empleado#2025` |
| Empleado | `carlos.mendez@control.com` | `Empleado#2025` |
| Empleado | (otros 6) | `Empleado#2025` |

> 🔴 **IMPORTANTE** — En producción real debes:
> 1. Cambiar los passwords de los admins.
> 2. Eliminar los empleados demo.
> 3. Cargar tus empleados reales vía el formulario de alta o vía script SQL.

---

## 🔄 Cómo funciona el build en Vercel

El `vercel.json` tiene este `buildCommand`:

```bash
cp prisma/schema.postgres.prisma prisma/schema.prisma \
  && prisma generate \
  && prisma db push --accept-data-loss \
  && bun run prisma/seed.ts \
  && next build
```

Pasos:

1. **Copia** `schema.postgres.prisma` sobre `schema.prisma` (localmente usamos SQLite, en Vercel usamos PostgreSQL).
2. **`prisma generate`** genera el cliente TypeScript para PostgreSQL.
3. **`prisma db push`** crea/actualiza las 10 tablas en Supabase (idempotente).
4. **`bun run prisma/seed.ts`** carga datos demo (idempotente vía upserts — seguro correr multiples veces).
5. **`next build`** compila la app Next.js.

Cada deploy deja la DB consistente y actualizada. Si no quieres que el seed corra en cada deploy (porque ya tienes datos reales), edita el `buildCommand` en `vercel.json` y quita `&& bun run prisma/seed.ts`.

---

## 🧰 Comandos útiles para desarrollo local

```bash
# Iniciar dev server (http://localhost:3000)
bun run dev

# Verificar calidad de código
bun run lint

# Cambiar schema a PostgreSQL (para probar queries de prod en local)
./scripts/switch-schema.sh postgres

# Volver a SQLite (desarrollo)
./scripts/switch-schema.sh sqlite

# Ver status actual del schema
./scripts/switch-schema.sh status

# Push del schema a la DB (después de cambiar de provider)
bun run db:push

# Cargar datos demo
bun run db:seed
```

---

## 🐛 Troubleshooting

### Error: `Can't reach database server at ...:5432`

**Causa**: Vercel no puede conectar a Supabase.

**Solución**:
1. Verifica que las variables `DATABASE_URL` y `DIRECT_URL` están bien seteadas en Vercel.
2. Verifica que tu proyecto Supabase esté activo (no pausado).
3. Verifica que el password no tenga caracteres especiales sin URL-encodear.
4. Asegúrate de que la región de Supabase es `aws-1-us-east-1` (misma que Vercel `iad1`).

---

### Error: `PrismaClientInitializationError: Schema engine permission`

**Causa**: El usuario de Supabase no tiene permisos para crear tablas.

**Solución**: Usa el usuario `postgres` (no un usuario custom) en la connection string.

---

### Error: `NEXTAUTH_URL` mismatch en redirect

**Causa**: `NEXTAUTH_URL` no coincide con la URL real de Vercel.

**Solución**: Actualiza `NEXTAUTH_URL` en Vercel → Settings → Env Vars con la URL final (`https://tu-proyecto.vercel.app` sin slash final) y redeploy.

---

### Build exitoso pero login falla con 401

**Causa**: `NEXTAUTH_SECRET` no está seteado o cambió entre deploys.

**Solución**: Verifica que `NEXTAUTH_SECRET` esté seteado en production environment. Genera uno nuevo con `openssl rand -base64 32` si lo perdiste.

---

### Build timeout (>10 min)

**Causa**: `prisma db push` o `seed.ts` están colgados.

**Solución**:
1. Verifica conexión a Supabase desde tu máquina local: `bun run db:push` (con esquema postgres localmente).
2. Si la DB está muy grande, considera quitar el seed del buildCommand y correrlo manualmente vía Vercel CLI:
   ```bash
   bunx vercel env pull .env.production.local
   ./scripts/switch-schema.sh postgres
   bun run db:push
   bun run db:seed
   ```

---

### Datos demo se cargan en cada deploy

**Comportamiento esperado**: el seed es idempotente (upserts), no duplica datos.

**Si quieres desactivar el seed en producción** (cuando ya tienes datos reales):
1. Edita `vercel.json` y quita `&& bun run prisma/seed.ts` del `buildCommand`.
2. Commit + push → Vercel redeploy automáticamente.

---

### Las tablas no se crean / datos no se cargan

**Síntoma**: Login falla, dashboard vacío, KPIs en 0.

**Causa**: `prisma db push` falló silenciosamente o `seed.ts` no corrió.

**Diagnóstico**:
1. En Vercel Dashboard → Deployments → clic en el último → revisa el log del build.
2. Busca las líneas `🌱 Iniciando seed v2.2...` y `✅ Seed completado`.

**Solución manual** (vía Vercel CLI):
```bash
bunx vercel env pull .env.vercel
# cargar variables manualmente
source .env.vercel
./scripts/switch-schema.sh postgres
bun run db:push
bun run db:seed
```

---

## 📦 Estructura del proyecto (relevantes para deploy)

```
.
├── prisma/
│   ├── schema.prisma             # SQLite (dev local) — se sobrescribe en Vercel
│   ├── schema.sqlite.prisma      # backup SQLite
│   ├── schema.postgres.prisma    # backup PostgreSQL (se usa en Vercel)
│   └── seed.ts                   # seed idempotente (upserts)
├── scripts/
│   └── switch-schema.sh          # alt. entre SQLite/PostgreSQL local
├── src/
│   ├── app/                      # App Router (Next.js 16)
│   │   ├── page.tsx              # página principal (única ruta)
│   │   ├── layout.tsx            # layout raíz
│   │   └── api/                  # API routes (REST)
│   ├── components/layout/        # admin-layout + employee-layout
│   ├── lib/                      # auth, db, timezone, overtime-calculator, etc.
│   └── store/                    # Zustand stores
├── vercel.json                   # config de deploy (buildCommand, region, env)
├── next.config.ts                # Next.js config
└── package.json                  # scripts y dependencias
```

---

## ✅ Checklist final antes de reportar "deployed"

- [ ] URL de Vercel responde 200 OK.
- [ ] Login con `admin@control.com` funciona.
- [ ] Dashboard muestra 8 empleados demo.
- [ ] Vista Reportes → export XLSX descarga un archivo válido.
- [ ] Login con `ana.lopez@control.com` funciona y muestra las 4 tabs del empleado.
- [ ] No hay errores en Vercel Logs.
- [ ] `NEXTAUTH_URL` coincide con la URL final.
- [ ] (Opcional) Servicio realtime en Railway/Render configurado.

Si todo lo anterior está en verde, el deploy está completo. 🎉
