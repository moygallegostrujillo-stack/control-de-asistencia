import { NextRequest, NextResponse } from 'next/server';
import { validateDynamicQR } from '@/lib/qr';

export async function POST(request: NextRequest) {
  try {
    const { qrCode } = await request.json();

    if (!qrCode) {
      return NextResponse.json({ error: 'Código QR es requerido' }, { status: 400 });
    }

    const { valid, expired } = await validateDynamicQR(qrCode);
    if (!valid) {
      return NextResponse.json({ 
        error: expired ? 'El código QR ha expirado. Solicite uno nuevo.' : 'Código QR inválido' 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      message: 'Código QR válido',
      qrValid: true 
    });
  } catch (error) {
    console.error('QR login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
