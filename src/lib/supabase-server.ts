import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client with admin access (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Type definitions matching our database schema
export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbEmployee {
  id: string;
  employee_number: string;
  position: string;
  department: string;
  sucursal: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkSchedule {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  tolerance_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface DbAttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  sucursal: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_in_method: string | null;
  check_out_method: string | null;
  check_in_ip_address: string | null;
  check_out_ip_address: string | null;
  break_start: string | null;
  break_end: string | null;
  break_duration: number | null;
  exceeded_break: boolean;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE';
  notes: string | null;
  is_locked: boolean;
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

export interface DbDynamicQR {
  id: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface DbSucursal {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  break_tolerance_minutes: number;
  created_at: string;
  updated_at: string;
}
