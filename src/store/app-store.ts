// ============================================================
// App Store (Zustand) — vista activa en admin/employee layout
// ============================================================

import { create } from 'zustand';

export type AdminView =
  | 'dashboard'
  | 'employees'
  | 'sucursales'
  | 'users'
  | 'vacations'
  | 'history'
  | 'reports'
  | 'audit'
  | 'qr-terminal'
  | 'company'
  | 'documentation'
  | 'settings'
  | 'nom-035';

export type EmployeeView = 'attendance' | 'history' | 'vacations' | 'qr';

interface AppState {
  adminView: AdminView;
  employeeView: EmployeeView;
  sidebarCollapsed: boolean;
  preselectedEmployeeId: string | null;
  setAdminView: (v: AdminView) => void;
  setEmployeeView: (v: EmployeeView) => void;
  toggleSidebar: () => void;
  setPreselectedEmployeeId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  adminView: 'dashboard',
  employeeView: 'attendance',
  sidebarCollapsed: false,
  preselectedEmployeeId: null,
  setAdminView: (v) => set({ adminView: v }),
  setEmployeeView: (v) => set({ employeeView: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPreselectedEmployeeId: (id) => set({ preselectedEmployeeId: id }),
}));
