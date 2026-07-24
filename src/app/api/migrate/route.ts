import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    // Check if break columns exist by trying to read a record with break fields
    const status: Record<string, unknown> = {
      breakColumns: { exists: false, details: 'No verificado' },
      sucursalTolerance: { exists: false, details: 'No verificado' },
    };

    // Test break columns by attempting a findMany with the break fields
    try {
      const testRecords = await db.attendanceRecord.findMany({ take: 1 });
      if (testRecords && testRecords.length > 0) {
        const testRecord = testRecords[0] as Record<string, unknown>;
        // Check if the returned object has break fields
        const hasBreakStart = 'breakStart' in testRecord || 'break_start' in testRecord;
        const hasBreakEnd = 'breakEnd' in testRecord || 'break_end' in testRecord;
        const hasBreakDuration = 'breakDuration' in testRecord || 'break_duration' in testRecord;
        const hasExceededBreak = 'exceededBreak' in testRecord || 'exceeded_break' in testRecord;
        
        status.breakColumns = {
          exists: hasBreakStart && hasBreakEnd && hasBreakDuration && hasExceededBreak,
          details: {
            breakStart: hasBreakStart,
            breakEnd: hasBreakEnd,
            breakDuration: hasBreakDuration,
            exceededBreak: hasExceededBreak,
          }
        };
      } else {
        status.breakColumns = { exists: true, details: 'No hay registros para verificar, pero la consulta no falló' };
      }
    } catch (err) {
      status.breakColumns = { exists: false, details: String(err).substring(0, 200) };
    }

    // Test sucursal tolerance column
    try {
      const testSucursales = await db.sucursal.findMany({ take: 1 });
      if (testSucursales && testSucursales.length > 0) {
        const testSucursal = testSucursales[0] as Record<string, unknown>;
        const hasTolerance = 'breakToleranceMinutes' in testSucursal || 'break_tolerance_minutes' in testSucursal;
        status.sucursalTolerance = {
          exists: hasTolerance,
          details: hasTolerance ? 'Columna encontrada' : 'Columna no encontrada'
        };
      } else {
        status.sucursalTolerance = { exists: true, details: 'No hay sucursales para verificar, pero la consulta no falló' };
      }
    } catch (err) {
      status.sucursalTolerance = { exists: false, details: String(err).substring(0, 200) };
    }

    // If columns are missing, provide SQL to add them
    const needsMigration = !(status.breakColumns as Record<string, unknown>).exists || !(status.sucursalTolerance as Record<string, unknown>).exists;
    
    return NextResponse.json({
      status,
      needsMigration,
      ...(needsMigration ? {
        sqlToRun: `-- Ejecute en el SQL Editor de Supabase:
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_start TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_end TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_duration INTEGER;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS exceeded_break BOOLEAN DEFAULT false;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS break_tolerance_minutes INTEGER DEFAULT 5;`
      } : {
        message: 'Todas las columnas necesarias existen en la base de datos ✅'
      })
    });
  } catch (error) {
    console.error('Migration check error:', error);
    return NextResponse.json({ error: 'Error al verificar migración', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'check';

    if (action === 'add-break-columns') {
      // Add break-related columns to production database
      const isVercel = !!process.env.VERCEL;
      
      // Try multiple connection methods
      const connectionStrings: string[] = [];
      
      if (process.env.DIRECT_DATABASE_URL) {
        connectionStrings.push(process.env.DIRECT_DATABASE_URL);
      }
      if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
        connectionStrings.push(process.env.DATABASE_URL);
      }
      
      // If on Vercel with Supabase, construct pooler URLs
      if (isVercel && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const ref = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
        const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
        if (dbPassword) {
          // Transaction pooler
          connectionStrings.push(`postgresql://postgres.${ref}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`);
          // Direct connection
          connectionStrings.push(`postgresql://postgres:${dbPassword}@db.${ref}.supabase.co:5432/postgres`);
        }
      }
      
      if (connectionStrings.length === 0) {
        return NextResponse.json({ 
          error: 'No hay cadena de conexión PostgreSQL disponible.',
          hint: 'Configure DIRECT_DATABASE_URL o SUPABASE_DB_PASSWORD en las variables de entorno de Vercel. O ejecute manualmente en el SQL Editor de Supabase:\n\nALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_start TEXT;\nALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_end TEXT;\nALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_duration INTEGER;\nALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS exceeded_break BOOLEAN DEFAULT false;\nALTER TABLE sucursales ADD COLUMN IF NOT EXISTS break_tolerance_minutes INTEGER DEFAULT 5;'
        }, { status: 500 });
      }

      const { Client } = await import('pg');
      const results: string[] = [];
      let connected = false;

      for (const connStr of connectionStrings) {
        const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
        try {
          await client.connect();
          results.push(`Connected using: ${connStr.substring(0, 40)}...`);
          connected = true;

          await client.query('ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_start TEXT');
          results.push('Added break_start to attendance_records');

          await client.query('ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_end TEXT');
          results.push('Added break_end to attendance_records');

          await client.query('ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_duration INTEGER');
          results.push('Added break_duration to attendance_records');

          await client.query('ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS exceeded_break BOOLEAN DEFAULT false');
          results.push('Added exceeded_break to attendance_records');

          await client.query('ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS break_tolerance_minutes INTEGER DEFAULT 5');
          results.push('Added break_tolerance_minutes to sucursales');

          await client.end();
          break; // Success, exit loop
        } catch (pgErr) {
          results.push(`Failed with ${connStr.substring(0, 40)}...: ${String(pgErr).substring(0, 100)}`);
          try { await client.end(); } catch { /* ignore */ }
        }
      }

      if (!connected) {
        return NextResponse.json({
          success: false,
          error: 'No se pudo conectar a PostgreSQL. Agregue las columnas manualmente en el SQL Editor de Supabase.',
          sqlToRun: `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_start TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_end TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_duration INTEGER;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS exceeded_break BOOLEAN DEFAULT false;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS break_tolerance_minutes INTEGER DEFAULT 5;`,
          attemptedConnections: results,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'add-break-columns',
        results,
        message: 'Columnas de descanso/comida agregadas exitosamente',
      });
    }

    if (action === 'fix-attendance-sucursal') {
      // Fix attendance records that have incorrect sucursal
      // Updates attendance_records.sucursal to match the employee's sucursal
      // for records where the attendance sucursal doesn't match the employee's sucursal
      
      // Get all employees with their sucursal
      const employees = await db.employee.findMany({
        select: { id: true, sucursal: true }
      });

      const employeeSucursalMap = new Map<string, string>();
      for (const emp of employees) {
        employeeSucursalMap.set(emp.id, emp.sucursal || 'Matriz');
      }

      // Get all attendance records
      const records = await db.attendanceRecord.findMany({
        select: { id: true, employeeId: true, sucursal: true }
      });

      let fixedCount = 0;
      for (const record of records) {
        const employeeSucursal = employeeSucursalMap.get(record.employeeId);
        if (employeeSucursal && record.sucursal !== employeeSucursal) {
          try {
            await db.attendanceRecord.update({
              where: { id: record.id },
              data: { sucursal: employeeSucursal }
            });
            fixedCount++;
          } catch (err) {
            console.error(`Failed to fix record ${record.id}:`, err);
          }
        }
      }

      return NextResponse.json({
        success: true,
        action: 'fix-attendance-sucursal',
        totalRecords: records.length,
        fixedCount,
        message: `Se corrigieron ${fixedCount} de ${records.length} registros de asistencia con sucursal incorrecta`,
      });
    }

    // Default action: check migration status
    return NextResponse.json({
      needsMigration: false,
      message: 'Usa action: "fix-attendance-sucursal" para corregir registros con sucursal incorrecta',
      availableActions: ['check', 'fix-attendance-sucursal', 'add-break-columns'],
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed', details: String(error) }, { status: 500 });
  }
}
