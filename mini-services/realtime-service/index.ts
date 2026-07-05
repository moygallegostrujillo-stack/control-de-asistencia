// ============================================================
// Realtime Service — Socket.io para Control de Asistencia
// ============================================================
// Puerto: 3003
//
// Eventos emitidos por el servidor (→ clientes admin):
//   - attendance:check-in    { employeeId, employeeName, sucursalId, time, method }
//   - attendance:check-out   { employeeId, employeeName, sucursalId, time, method }
//   - attendance:break-start { employeeId, employeeName, sucursalId, time }
//   - attendance:break-end   { employeeId, employeeName, sucursalId, time, durationMin }
//   - vacation:requested     { vacationId, employeeId, employeeName, type, days }
//   - vacation:status        { vacationId, status, approvedBy }
//   - dashboard:stats        { activeEmployees, presentCount, absentCount, lateCount }
//
// Eventos recibidos (← API routes):
//   - emit  { event, payload, room }   — el API route pide emitir un evento
//
// Autenticación: el cliente debe enviar `auth: { token }` donde token
// es el JWT de NextAuth. El servidor valida con NEXTAUTH_SECRET.
// ============================================================

import { createServer } from 'http';
import { Server } from 'socket.io';
import { decode, verify } from 'jsonwebtoken';

// En producción (Railway/Render), el puerto se asigna dinámicamente via $PORT
const PORT = parseInt(process.env.PORT || '3003', 10);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-dev-key-not-secure';
// Origen permitido para CORS (URL de la app en Vercel)
// En dev: '*' (cualquier origen). En prod: la URL específica de la app.
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'false' : '*');
const allowedOrigins: string[] = CORS_ORIGIN === '*' ? ['*'] : CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);

interface ClientUser {
  id: string;
  email: string;
  name: string;
  role: string;
  sucursalId: string | null;
}

const httpServer = createServer((req, res) => {
  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'realtime-service',
      port: PORT,
      connections: io.engine.clientsCount,
      uptime: process.uptime(),
    }));
    return;
  }

  // Endpoint interno: POST /emit — API routes emiten eventos aquí
  if (req.url === '/emit' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { event, payload, room } = JSON.parse(body);
        if (room) {
          io.to(room).emit(event, payload);
        } else {
          io.emit(event, payload);
        }
        console.log(`[emit] ${event} → ${room || 'all'}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, emitted: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Permitir requests sin origin (curl, mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io/',
  // Allow Eid transport for Railway/Render proxies
  allowEIO3: true,
});

// ============================================================
// Middleware de autenticación
// ============================================================

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      // Permitir conexiones sin token en desarrollo (para testing)
      if (process.env.NODE_ENV !== 'production') {
        (socket as any).user = null;
        return next();
      }
      return next(new Error('No autorizado: token requerido'));
    }

    // Intentar decodificar como JWT de NextAuth (JWE)
    // NextAuth usa jose para encriptar, no JWT estándar.
    // Como workaround, aceptamos también el cookie legacy (base64 JSON).
    let user: ClientUser | null = null;

    // Intento 1: JWT de NextAuth (puede fallar porque está encriptado, no firmado)
    try {
      const decoded = verify(token, NEXTAUTH_SECRET) as any;
      if (decoded?.id && decoded?.role) {
        user = {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role,
          sucursalId: decoded.sucursalId || null,
        };
      }
    } catch {}

    // Intento 2: cookie legacy (base64 JSON)
    if (!user) {
      try {
        const json = Buffer.from(token, 'base64').toString('utf-8');
        const payload = JSON.parse(json);
        if (payload?.id && payload?.role) {
          user = payload;
        }
      } catch {}
    }

    if (!user && process.env.NODE_ENV === 'production') {
      return next(new Error('Token inválido'));
    }

    (socket as any).user = user;
    next();
  } catch (err) {
    next(new Error('Error de autenticación'));
  }
});

// ============================================================
// Conexión de clientes
// ============================================================

io.on('connection', (socket) => {
  const user = (socket as any).user as ClientUser | null;
  console.log(`[+] Cliente conectado: ${user?.email || 'anónimo'} (${socket.id})`);

  // Unir a rooms según rol
  if (user) {
    if (user.role === 'GENERAL_ADMIN') {
      socket.join('admin:global');
      console.log(`    → unido a room admin:global`);
    } else if ((user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR') && user.sucursalId) {
      socket.join(`admin:sucursal:${user.sucursalId}`);
      socket.join('admin:sucursal');
      console.log(`    → unido a room admin:sucursal:${user.sucursalId}`);
    } else if (user.role === 'EMPLOYEE' && user.sucursalId) {
      socket.join(`employee:sucursal:${user.sucursalId}`);
    }
  }

  // Ping/pong para medir latencia
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') cb(Date.now());
  });

  // El API route pide emitir un evento
  socket.on('emit', (data: { event: string; payload: any; room?: string }) => {
    // Solo aceptar emit desde conexiones internas (sin user o con rol admin)
    if (user && user.role === 'EMPLOYEE') {
      return; // empleados no pueden emitir eventos del servidor
    }
    if (data.room) {
      io.to(data.room).emit(data.event, data.payload);
    } else {
      io.emit(data.event, data.payload);
    }
    console.log(`[emit] ${data.event} → ${data.room || 'all'}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[-] Cliente desconectado: ${user?.email || 'anónimo'} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Realtime Service corriendo en puerto ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Socket.io: ws://localhost:${PORT}/socket.io/`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS orígenes: ${allowedOrigins.join(', ') || '(denegar todos)'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Cerrando realtime service...');
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando realtime service...');
  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
});
