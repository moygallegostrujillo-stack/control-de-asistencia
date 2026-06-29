# ============================================================
# Realtime Service — Dockerfile (Railway / Render / Fly.io)
# ============================================================
# Este Dockerfile permite desplegar el mini-service de Socket.io
# en cualquier plataforma que soporte contenedores.
#
# Vercel NO soporta WebSockets persistentes (es serverless),
# por lo que el servicio realtime debe ir en Railway/Render/Fly.
# ============================================================

FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependencias
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copiar código
COPY index.ts ./

# Variables de entorno (se inyectan en runtime)
ENV PORT=3003
ENV NODE_ENV=production

# Exponer puerto
EXPOSE 3003

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Arrancar
CMD ["bun", "index.ts"]
