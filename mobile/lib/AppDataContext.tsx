import { createContext, useContext, ReactNode } from 'react';
import { useAppData } from './useAppData';

type AppDataContextValue = ReturnType<typeof useAppData>;

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const data = useAppData();
  return <AppDataContext.Provider value={data}>{children}</AppDataContext.Provider>;
}

export function useSharedAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useSharedAppData must be used inside AppDataProvider');
  return ctx;
}
