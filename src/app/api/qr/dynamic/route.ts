import { NextResponse } from 'next/server';
import { generateDynamicQR } from '@/lib/qr';

export async function GET() {
  try {
    const result = await generateDynamicQR(5); // 5 minute expiry
    
    // Validate the result has the required fields
    if (!result.qrDataUrl) {
      throw new Error('QR image generation failed');
    }
    
    return NextResponse.json({
      code: result.code,
      qrDataUrl: result.qrDataUrl,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Dynamic QR error:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ 
      error: 'Error al generar código QR',
      details: message
    }, { status: 500 });
  }
}
