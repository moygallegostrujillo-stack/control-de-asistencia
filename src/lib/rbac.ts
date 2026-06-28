// ============================================================
// RBAC — Helper de permisos
// ============================================================

import type { AuthUser } from './auth';
import { Role } from '@prisma/client';

export type Permission =
  | 'dashboard:global'
  | 'dashboard:sucursal'
  | 'attendance:own'
  | 'employees:create'
  | 'employees:edit'
  | 'employees:delete'
  | 'employees:transfer'
  | 'sucursales:create'
  | 'sucursales:edit'
  | 'sucursales:delete'
  | 'users:manage'
  | 'company:manage'
  | 'holidays:manage'
  | 'vacations:approve'
  | 'vacations:request'
  | 'audit:global'
  | 'audit:sucursal'
  | 'reports:comparative'
  | 'reports:sucursal'
  | 'attendance:correct'
  | 'qr:generate'
  | 'kiosco:quick-login';

const PERMISSIONS: Record<Role, Permission[]> = {
  GENERAL_ADMIN: [
    'dashboard:global',
    'dashboard:sucursal',
    'attendance:own',
    'employees:create',
    'employees:edit',
    'employees:delete',
    'employees:transfer',
    'sucursales:create',
    'sucursales:edit',
    'sucursales:delete',
    'users:manage',
    'company:manage',
    'holidays:manage',
    'vacations:approve',
    'vacations:request',
    'audit:global',
    'audit:sucursal',
    'reports:comparative',
    'reports:sucursal',
    'attendance:correct',
    'qr:generate',
    'kiosco:quick-login',
  ],
  SUCURSAL_ADMIN: [
    'dashboard:sucursal',
    'employees:create',
    'employees:edit',
    'sucursales:edit', // solo SU sucursal (validado en API)
    'vacations:approve',
    'audit:sucursal',
    'reports:sucursal',
    'attendance:correct',
    'qr:generate',
    'kiosco:quick-login',
  ],
  EMPLOYEE: ['attendance:own', 'vacations:request'],
};

export function can(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false;
  return PERMISSIONS[user.role as Role]?.includes(permission) ?? false;
}

/**
 * Devuelve el rol en español para mostrar en UI.
 */
export function roleLabel(role: string): string {
  switch (role) {
    case 'GENERAL_ADMIN':
      return 'Administrador General';
    case 'SUCURSAL_ADMIN':
      return 'Admin de Sucursal';
    case 'EMPLOYEE':
      return 'Empleado';
    default:
      return role;
  }
}

/**
 * Devuelve el nombre display de una sucursal con su código de local.
 */
export function sucursalLabel(name: string, codigoLocal?: string | null): string {
  return codigoLocal ? `Local ${codigoLocal} — ${name}` : name;
}
