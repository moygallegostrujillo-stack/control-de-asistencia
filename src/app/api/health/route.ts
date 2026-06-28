// ============================================================
// /api/health
//   GET — Health check público (sin auth).
//          Devuelve { status, timestamp, version }.
//          Listado en PUBLIC_PATHS del middleware.
// ============================================================

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.2.0',
    });
  } catch (error) {
    console.error('GET /api/health error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
