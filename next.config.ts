import type { NextConfig } from "next";

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
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;
