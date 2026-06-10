import { NextRequest, NextResponse } from 'next/server';

/**
 * Supabase Migration API
 * 
 * GET /api/supabase-migration - Check connection status
 * POST /api/supabase-migration?action=test - Test Supabase connection
 * POST /api/supabase-migration?action=export - Export all data from Supabase
 * POST /api/supabase-migration?action=import - Import data into local DB
 * POST /api/supabase-migration?action=export-sql - Generate SQL for Supabase setup
 */
export async function GET() {
  const config = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasDbUrl: !!process.env.DATABASE_URL,
    isVercel: !!process.env.VERCEL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL 
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` 
      : 'NOT SET',
  };

  const missing: string[] = [];
  if (!config.hasSupabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!config.hasAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!config.hasServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return NextResponse.json({
    status: missing.length === 0 ? 'READY' : 'NEEDS_CONFIG',
    config,
    missingVariables: missing,
    instructions: missing.length > 0 
      ? `Faltan las siguientes variables de entorno: ${missing.join(', ')}. Obtén los valores desde https://supabase.com/dashboard > Project Settings > API`
      : 'Todas las variables de entorno están configuradas. Usa POST ?action=test para verificar la conexión.',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test';
    const body = await request.json().catch(() => ({}));

    // Allow passing credentials directly for initial setup
    const supabaseUrl = body.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = body.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = body.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    switch (action) {
      case 'test':
        return await testConnection(supabaseUrl, serviceKey, anonKey);
      case 'export':
        return await exportFromSupabase(supabaseUrl, serviceKey);
      case 'import':
        return await importToLocalDb(body.data);
      case 'export-sql':
        return await generateSupabaseSQL();
      case 'setup-tables':
        return await setupSupabaseTables(supabaseUrl, serviceKey);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

async function testConnection(
  supabaseUrl?: string, 
  serviceKey?: string, 
  anonKey?: string
) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      success: false,
      error: 'Se requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY',
      hint: 'Puedes pasar las credenciales en el body: { supabaseUrl, serviceKey, anonKey }',
    }, { status: 400 });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const results: Record<string, unknown> = {};

    // Test service role key
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const tables = ['users', 'employees', 'work_schedules', 'attendance_records', 'audit_logs', 'dynamic_qrs', 'sucursales'];
    const tableResults: Record<string, unknown> = {};
    
    for (const table of tables) {
      try {
        const { data, error, count } = await adminClient
          .from(table)
          .select('*', { count: 'exact', head: false })
          .limit(1);
        
        if (error) {
          tableResults[table] = { exists: false, error: error.message };
        } else {
          tableResults[table] = { exists: true, rowCount: count || 0, sample: data?.[0] || null };
        }
      } catch (err) {
        tableResults[table] = { exists: false, error: String(err) };
      }
    }
    
    results.tables = tableResults;
    results.serviceKeyWorks = true;

    // Test anon key if provided
    if (anonKey) {
      try {
        const anonClient = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { error: anonError } = await anonClient.from('users').select('id').limit(1);
        results.anonKeyWorks = !anonError;
        if (anonError) results.anonKeyError = anonError.message;
      } catch (err) {
        results.anonKeyWorks = false;
        results.anonKeyError = String(err);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error al conectar con Supabase',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

async function exportFromSupabase(supabaseUrl?: string, serviceKey?: string) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      success: false,
      error: 'Se requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY',
    }, { status: 400 });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const data: Record<string, unknown[]> = {};
    
    // Export in order respecting foreign key dependencies
    const tables = [
      'sucursales',
      'users', 
      'employees',
      'work_schedules',
      'attendance_records',
      'audit_logs',
      'dynamic_qrs',
    ];

    for (const table of tables) {
      const { data: rows, error } = await client.from(table).select('*');
      if (error) {
        console.error(`Error exporting ${table}:`, error.message);
        data[table] = [];
      } else {
        data[table] = rows || [];
      }
    }

    const summary: Record<string, number> = {};
    for (const [table, rows] of Object.entries(data)) {
      summary[table] = rows.length;
    }

    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      summary,
      data,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error al exportar datos de Supabase',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

async function importToLocalDb(data: Record<string, unknown[]>) {
  if (!data) {
    return NextResponse.json({ error: 'No data provided' }, { status: 400 });
  }

  const { db } = await import('@/lib/db');
  const results: Record<string, { imported: number; errors: string[] }> = {};

  // Import in order respecting foreign key dependencies
  const importOrder = [
    { table: 'sucursales', model: 'sucursal' },
    { table: 'users', model: 'user' },
    { table: 'employees', model: 'employee' },
    { table: 'work_schedules', model: 'workSchedule' },
    { table: 'attendance_records', model: 'attendanceRecord' },
    { table: 'audit_logs', model: 'auditLog' },
    { table: 'dynamic_qrs', model: 'dynamicQR' },
  ];

  const fieldMap: Record<string, Record<string, string>> = {
    sucursales: { id: 'id', name: 'name', address: 'address', is_active: 'isActive', break_tolerance_minutes: 'breakToleranceMinutes', meal_tolerance_minutes: 'mealToleranceMinutes', rest_tolerance_minutes: 'restToleranceMinutes', created_at: 'createdAt', updated_at: 'updatedAt' },
    users: { id: 'id', email: 'email', password_hash: 'passwordHash', name: 'name', role: 'role', is_active: 'isActive', created_at: 'createdAt', updated_at: 'updatedAt' },
    employees: { id: 'id', employee_number: 'employeeNumber', position: 'position', department: 'department', sucursal: 'sucursal', user_id: 'userId', created_at: 'createdAt', updated_at: 'updatedAt' },
    work_schedules: { id: 'id', employee_id: 'employeeId', day_of_week: 'dayOfWeek', start_time: 'startTime', end_time: 'endTime', tolerance_minutes: 'toleranceMinutes', created_at: 'createdAt', updated_at: 'updatedAt' },
    attendance_records: { id: 'id', employee_id: 'employeeId', date: 'date', sucursal: 'sucursal', check_in_time: 'checkInTime', check_out_time: 'checkOutTime', check_in_latitude: 'checkInLatitude', check_in_longitude: 'checkInLongitude', check_out_latitude: 'checkOutLatitude', check_out_longitude: 'checkOutLongitude', check_in_method: 'checkInMethod', check_out_method: 'checkOutMethod', check_in_ip_address: 'checkInIpAddress', check_out_ip_address: 'checkOutIpAddress', meal_start: 'mealStart', meal_end: 'mealEnd', meal_duration: 'mealDuration', exceeded_meal: 'exceededMeal', rest_start: 'restStart', rest_end: 'restEnd', rest_duration: 'restDuration', exceeded_rest: 'exceededRest', break_start: 'breakStart', break_end: 'breakEnd', break_duration: 'breakDuration', exceeded_break: 'exceededBreak', status: 'status', notes: 'notes', is_locked: 'isLocked', created_at: 'createdAt' },
    audit_logs: { id: 'id', user_id: 'userId', action: 'action', entity_type: 'entityType', entity_id: 'entityId', ip_address: 'ipAddress', user_agent: 'userAgent', details: 'details', created_at: 'createdAt' },
    dynamic_qrs: { id: 'id', code: 'code', expires_at: 'expiresAt', used: 'used', created_at: 'createdAt' },
  };

  for (const { table, model } of importOrder) {
    const rows = data[table] as Record<string, unknown>[] | undefined;
    if (!rows || rows.length === 0) {
      results[table] = { imported: 0, errors: [] };
      continue;
    }

    let imported = 0;
    const errors: string[] = [];
    const mapping = fieldMap[table];

    for (const row of rows) {
      try {
        // Convert snake_case to camelCase using the mapping
        const mappedData: Record<string, unknown> = {};
        for (const [snakeKey, camelKey] of Object.entries(mapping)) {
          if (row[snakeKey] !== undefined) {
            mappedData[camelKey] = row[snakeKey];
          }
        }

        // Use upsert to handle existing records
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelClient = db[model as keyof typeof db] as any;

        // Check if record exists
        const existing = await modelClient.findUnique({ where: { id: mappedData.id } });
        
        if (existing) {
          // Update existing record
          const { id, ...updateData } = mappedData;
          await modelClient.update({ where: { id }, data: updateData });
        } else {
          // Create new record
          await modelClient.create({ data: mappedData });
        }
        
        imported++;
      } catch (err) {
        errors.push(`Row ${row.id || 'unknown'}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    results[table] = { imported, errors };
  }

  return NextResponse.json({ success: true, results });
}

async function generateSupabaseSQL() {
  const sql = `
-- ============================================================
-- Control de Asistencia - Supabase Database Setup
-- Run this in the Supabase SQL Editor to create all tables
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sucursales (Branches)
CREATE TABLE IF NOT EXISTS sucursales (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  break_tolerance_minutes INTEGER DEFAULT 5,
  meal_tolerance_minutes INTEGER DEFAULT 5,
  rest_tolerance_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN', 'EMPLOYEE')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_number TEXT UNIQUE NOT NULL,
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  sucursal TEXT DEFAULT 'Matriz',
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Work Schedules
CREATE TABLE IF NOT EXISTS work_schedules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  tolerance_minutes INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, day_of_week)
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sucursal TEXT DEFAULT 'Matriz',
  check_in_time TEXT,
  check_out_time TEXT,
  check_in_latitude DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  check_out_latitude DOUBLE PRECISION,
  check_out_longitude DOUBLE PRECISION,
  check_in_method TEXT,
  check_out_method TEXT,
  check_in_ip_address TEXT,
  check_out_ip_address TEXT,
  meal_start TEXT,
  meal_end TEXT,
  meal_duration INTEGER,
  exceeded_meal BOOLEAN DEFAULT false,
  rest_start TEXT,
  rest_end TEXT,
  rest_duration INTEGER,
  exceeded_rest BOOLEAN DEFAULT false,
  break_start TEXT,
  break_end TEXT,
  break_duration INTEGER,
  exceeded_break BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'ABSENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE')),
  notes TEXT,
  is_locked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dynamic QR Codes
CREATE TABLE IF NOT EXISTS dynamic_qrs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_qrs ENABLE ROW LEVEL SECURITY;

-- Anon key policies
CREATE POLICY "Allow anon read on sucursales" ON sucursales FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on employees" ON employees FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on work_schedules" ON work_schedules FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on attendance_records" ON attendance_records FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read on audit_logs" ON audit_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert on users" ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on users" ON users FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon insert on employees" ON employees FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on employees" ON employees FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon insert on work_schedules" ON work_schedules FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on work_schedules" ON work_schedules FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon insert on attendance_records" ON attendance_records FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on attendance_records" ON attendance_records FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon insert on audit_logs" ON audit_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert on sucursales" ON sucursales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on sucursales" ON sucursales FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon all on dynamic_qrs" ON dynamic_qrs FOR ALL TO anon USING (true);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_id ON work_schedules(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date ON attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_dynamic_qrs_expires ON dynamic_qrs(expires_at);
`.trim();

  return NextResponse.json({ sql });
}

async function setupSupabaseTables(supabaseUrl?: string, serviceKey?: string) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({
      success: false,
      error: 'Se requiere supabaseUrl y serviceKey',
    }, { status: 400 });
  }

  try {
    const sqlResponse = await generateSupabaseSQL();
    const { sql } = await sqlResponse.json();

    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
    if (!dbPassword) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere SUPABASE_DB_PASSWORD para ejecutar SQL directamente',
        sql,
        hint: 'Copia el SQL y ejecútalo manualmente en el SQL Editor de Supabase: https://supabase.com/dashboard > SQL Editor',
      }, { status: 400 });
    }

    const ref = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    const connectionStrings = [
      `postgresql://postgres:${dbPassword}@db.${ref}.supabase.co:5432/postgres`,
      `postgresql://postgres.${ref}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    ];

    const { Client } = await import('pg');
    const results: string[] = [];
    let connected = false;

    for (const connStr of connectionStrings) {
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        results.push(`Connected using: ${connStr.substring(0, 50)}...`);
        connected = true;

        const statements = sql.split(';').filter(s => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) {
            try {
              await client.query(stmt);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              if (!errMsg.includes('already exists')) {
                results.push(`Warning: ${errMsg.substring(0, 100)}`);
              }
            }
          }
        }

        await client.end();
        break;
      } catch (err) {
        results.push(`Failed with ${connStr.substring(0, 50)}...: ${String(err).substring(0, 100)}`);
        try { await client.end(); } catch { /* ignore */ }
      }
    }

    if (!connected) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a PostgreSQL',
        sql,
        hint: 'Copia el SQL y ejecútalo manualmente en el SQL Editor de Supabase',
        results,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error al configurar tablas',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
