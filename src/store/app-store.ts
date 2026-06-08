import { create } from 'zustand';

export type AdminView = 'dashboard' | 'employees' | 'attendance' | 'reports' | 'audit' | 'qr-terminal' | 'manual' | 'sucursales';
export type EmployeeView = 'dashboard' | 'history' | 'my-qr';
export type AppView = AdminView | EmployeeView;

interface AppState {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
