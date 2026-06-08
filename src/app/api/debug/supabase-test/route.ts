import { NextResponse } from 'next/server';

export async function GET() {
  const isVercel = !!process.env.VERCEL;
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasSbUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSbKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET';
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'NOT SET';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'NOT SET';

  // Check for whitespace/encoding issues
  const sbKeyTrimmed = sbKey.trim();
  const keyHasNewlines = sbKey.includes('\n') || sbKey.includes('\r');
  const keyHasSpaces = sbKey !== sbKeyTrimmed;

  // Try to decode the JWT
  let jwtPayload = 'NOT_DECODABLE';
  try {
    const parts = sbKey.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64url').toString();
      jwtPayload = payload;
    }
  } catch { /* ignore */ }

  // Test Supabase connection
  let connectionTest = 'NOT_TESTED';
  let anonConnectionTest = 'NOT_TESTED';
  let keyValid = false;

  if (hasSbUrl && hasSbKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');

      // Test with service role key
      const supabase = createClient(sbUrl, sbKeyTrimmed, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data, error } = await supabase.from('users').select('id').limit(1);
      connectionTest = error ? `SERVICE_KEY_ERROR: ${error.message}` : `OK - ${data?.length || 0} users`;
      keyValid = !error;

      // Test with anon key
      if (hasAnonKey) {
        const anonClient = createClient(sbUrl, anonKey.trim(), {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: anonData, error: anonError } = await anonClient.from('users').select('id').limit(1);
        anonConnectionTest = anonError ? `ANON_KEY_ERROR: ${anonError.message}` : `OK - ${anonData?.length || 0} users`;
      }
    } catch (e: unknown) {
      connectionTest = `EXCEPTION: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Determine diagnosis
  let diagnosis = 'OK';
  let fixInstructions = '';
  
  if (!hasSbUrl || !hasSbKey) {
    diagnosis = 'MISSING_KEYS';
    fixInstructions = 'Las variables de entorno SUPABASE_SERVICE_ROLE_KEY y/o NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas en Vercel. Ve a https://vercel.com/dashboard, selecciona el proyecto, ve a Settings > Environment Variables, y agrega: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL. Obtén los valores desde https://supabase.com/dashboard > Project Settings > API.';
  } else if (connectionTest.includes('Invalid API key')) {
    diagnosis = 'INVALID_KEYS';
    fixInstructions = 'Las claves API de Supabase son inválidas (probablemente rotadas al pausar/restaurar el proyecto). Ve a https://supabase.com/dashboard, selecciona el proyecto, ve a Settings > API, copia las nuevas claves (anon key y service_role key), luego actualiza las variables de entorno en Vercel: https://vercel.com/dashboard > Proyecto > Settings > Environment Variables. Actualiza SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_ANON_KEY con las nuevas claves.';
  } else if (keyHasNewlines || keyHasSpaces) {
    diagnosis = 'KEY_FORMATTING';
    fixInstructions = 'Las claves API tienen espacios o saltos de línea. Limpia los valores en las variables de entorno de Vercel.';
  }

  return NextResponse.json({
    isVercel,
    hasDbUrl,
    hasSbUrl,
    hasSbKey,
    hasAnonKey,
    sbUrl,
    keyLength: sbKey.length,
    keyHasNewlines,
    keyHasSpaces,
    keyFirst30: sbKey.substring(0, 30),
    keyLast10: sbKey.substring(sbKey.length - 10),
    jwtPayload,
    anonKeyLength: anonKey.length,
    anonKeyFirst30: anonKey.substring(0, 30),
    connectionTest,
    anonConnectionTest,
    keyValid,
    diagnosis,
    fixInstructions,
  });
}
