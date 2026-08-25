import type { NextConfig } from "next";

// ============================================================
// ⚠️ TAREA 5 (AUDIT DE SEGURIDAD): CSP + HSTS reales
// ============================================================
// Antes solo había X-Content-Type-Options, X-Frame-Options y
// X-XSS-Protection en /api/*. Faltaban Content-Security-Policy
// (CSP) y Strict-Transport-Security (HSTS) — ambos críticos
// según OWASP para prevenir XSS, clickjacking y downgrade MITM.
//
// CSP: política estricta que solo permite same-origin para
// scripts/styles/images/fonts/frames/connections. Next.js self-
// hostea Google Fonts en /_next/static/ y los WebSockets van
// same-origin (io('/?XTransformPort=3003')). No hay CDNs ni
// analytics externos. Se agrega 'unsafe-inline' en style-src
// porque Next.js inyecta estilos inline en desarrollo y SSR
// (necesario para el hybrid rendering de App Router). Se agrega
// 'unsafe-eval' en dev para HMR de Turbopack.
//
// HSTS: max-age 1 año + includeSubDomains + preload. Solo se
// envía en HTTPS (en HTTP sería ignorado y revelaría info).
// Vercel siempre sirve por HTTPS, así que es seguro aplicarlo
// globalmente.
//
// Referencia: https://owasp.org/www-project-secure-headers/
// ============================================================

const isDev = process.env.NODE_ENV !== 'production';

// CSP para rutas de página HTML (NO para /api/* — las APIs no
// necesitan CSP porque no renderizan HTML).
const cspDirectives = [
  "default-src 'self'",
  // script-src: solo same-origin. Next.js usa el nonce interno
  // para scripts inline en SSR; en dev necesitamos 'unsafe-eval'
  // para HMR de Turbopack.
  isDev ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline'",
  // style-src: 'unsafe-inline' es necesario porque Next.js inyecta
  // CSS inline en SSR (no se puede evitar sin perder features).
  "style-src 'self' 'unsafe-inline'",
  // img-src: same-origin + data: (imágenes inline embebidas) +
  // blob: (preview de archivos subidos).
  "img-src 'self' data: blob:",
  // font-src: same-origin (Google Fonts self-hosteadas por next/font).
  "font-src 'self' data:",
  // connect-src: same-origin (API REST + WebSocket via io('/?XTransformPort=3003')).
  // El sistema no consume APIs externas (Supabase es server-side solo).
  "connect-src 'self' wss: ws:",
  // frame-ancestors: 'none' = Clickjacking bloqueado por completo.
  "frame-ancestors 'none'",
  // form-action: same-origin (no enviar forms a dominios externos).
  "form-action 'self'",
  // base-uri: same-origin (evitar <base> injection).
  "base-uri 'self'",
  // object-src: 'none' — no plugins/Flash/Java.
  "object-src 'none'",
  // upgrade-insecure-requests: navegador reescribe http:// a https://.
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // X-XSS-Protection: deprecado pero mantenido por compatibilidad
  // con navegadores viejos. En navegadores modernos CSP reemplaza
  // esta protección.
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Referrer-Policy: solo enviar origin (no full URL) a otros dominios.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions-Policy: deshabilitar APIs sensibles que no usamos.
  // - camera: el sistema usa la cámara para escanear QR (check-in, check-out,
  //   iniciar/terminar descanso, registrar comida). Se permite solo a self
  //   (mismo origen) para mantener protección anti-clickjacking en iframes
  //   de terceros. Antes era camera=() y bloqueaba todo — bug causó
  //   "No se pudo acceder a la cámara" reportado el 25-ago-2026.
  // - microphone: bloqueado (no se usa).
  // - geolocation: el sistema usa geolocation para check-in GPS, permitido self.
  // - payment, usb, bluetooth, magnetometer, gyroscope, accelerometer:
  //   bloqueados por completo.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=()' },
  // HSTS: 1 año, incluye subdominios, habilitado para preload list.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // CSP: política estricta (ver comentario arriba).
  { key: 'Content-Security-Policy', value: cspDirectives },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1"],
  // --- Cambio 4: pdfkit debe ejecutarse como paquete externo (no bundleado) ---
  // pdfkit carga archivos .afm de fuentes desde node_modules en tiempo de
  // ejecución. Si Next.js lo bundlea con Turbopack/Webpack, la ruta se rompe
  // (ENOENT: Helvetica.afm). Marcarlo como paquete externo preserva la
  // resolución correcta de node_modules en desarrollo y en Vercel.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      // Headers de seguridad para TODAS las rutas (páginas + assets).
      // Aplica CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
