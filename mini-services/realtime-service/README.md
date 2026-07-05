# 🚀 Realtime Service — Socket.io

Microservicio de WebSockets para **Control de Asistencia NOM-037 v2.2**.

Maneja la comunicación en tiempo real entre los API routes de Next.js (en Vercel) y los navegadores de los admins (que reciben notificaciones instantáneas de check-in, check-out, vacaciones, etc.).

---

## 📋 ¿Por qué existe?

**Vercel es serverless** → no puede mantener conexiones WebSocket persistentes.

Por eso el servicio realtime va en **Railway** o **Render** (contenedores Docker que sí soportan WebSockets).

---

## 🔧 Eventos que maneja

| Evento | Dirección | Payload |
|--------|-----------|---------|
| `attendance:check-in` | API → admins | `{ employeeId, employeeName, time, method }` |
| `attendance:check-out` | API → admins | `{ employeeId, employeeName, time, workedMinutes }` |
| `attendance:break-start` | API → admins | `{ employeeId, time }` |
| `attendance:break-end` | API → admins | `{ employeeId, durationMinutes, exceeded }` |
| `vacation:requested` | API → admins | `{ vacationId, employeeName, days }` |
| `vacation:status` | API → empleado | `{ vacationId, status, approvedBy }` |
| `emit` (interno) | API → server | `{ event, payload, room }` |

---

## 🏠 Desarrollo local

```bash
cd mini-services/realtime-service
bun install
NEXTAUTH_SECRET="tu-secreto" bun run dev
```

Servidor corre en http://localhost:3003

Health check: http://localhost:3003/health

---

## ☁️ Deploy en Railway (recomendado)

### Automático desde GitHub

1. Sube el repo a GitHub
2. Ve a https://railway.app → **New Project**
3. **Deploy from GitHub repo** → selecciona tu repo
4. **Root Directory**: `mini-services/realtime-service`
5. Railway detecta automáticamente el `Dockerfile`
6. Añade variables de entorno (ver abajo)
7. Genera un dominio público en Settings → Networking

### Manual con Railway CLI

```bash
npm i -g @railway/cli
railway login
railway init  # crear proyecto
railway up    # deploy
railway domain  # obtener URL pública
```

### Variables de entorno

| Variable | Required | Default | Descripción |
|----------|----------|---------|-------------|
| `NEXTAUTH_SECRET` | ✅ | — | Mismo valor que en Vercel (para validar JWT) |
| `CORS_ORIGIN` | ✅ en prod | `*` en dev | URL de la app Vercel: `https://xxx.vercel.app` |
| `PORT` | ❌ | `3003` | Railway lo asigna automáticamente |
| `NODE_ENV` | ❌ | `development` | Setear a `production` |

---

## 🐳 Deploy con Docker (cualquier plataforma)

```bash
# Build
docker build -t control-asistencia-realtime .

# Run
docker run -p 3003:3003 \
  -e NEXTAUTH_SECRET="tu-secreto" \
  -e CORS_ORIGIN="https://tu-app.vercel.app" \
  -e NODE_ENV=production \
  control-asistencia-realtime

# Test
curl http://localhost:3003/health
```

Compatible con:
- **Fly.io**: `fly launch` (detecta Dockerfile)
- **Render**: New → Web Service → Docker
- **DigitalOcean App Platform**: Components → Docker
- **AWS ECS / Fargate**: tarea con la imagen
- **Google Cloud Run**: `gcloud run deploy` (¡pero Cloud Run no soporta WebSocket persistente!)

---

## 📊 Monitoreo

### Health endpoint

```bash
curl https://tu-realtime.up.railway.app/health
```

Respuesta:
```json
{
  "status": "ok",
  "service": "realtime-service",
  "port": 3003,
  "connections": 3,
  "uptime": 3600.5
}
```

### Logs

```bash
railway logs  # Railway
# o
docker logs <container-id>  # Docker
```

Verás mensajes como:
```
[+] Cliente conectado: admin@control.com (hQbfLNHVNQGh7reeAAAB)
    → unido a room admin:global
[emit] attendance:check-in → admin:global
[-] Cliente desconectado: admin@control.com (transport close)
```

---

## 🔒 Seguridad

- **JWT validation**: cada cliente debe enviar `auth: { token }` con su JWT de NextAuth
- **CORS configurable**: solo orígenes en `CORS_ORIGIN` pueden conectarse
- **No sensible data en logs**: solo email + sucursal, nunca tokens ni passwords
- **Rate limit**: no implementado (innecesario — auth required + Railway DDoS protection)

---

## 💰 Costos Railway

| Plan | Precio | Recomendado para |
|------|--------|------------------|
| Hobby (free) | $5 credit | Testing, < 500h/mes |
| Developer | $5/mes | Producción pequeña (<1000 conexiones) |
| Pro | $20/mes | Producción grande (auto-scaling) |

**Estimación**: 50 usuarios activos = ~$5/mes (plan Developer)
