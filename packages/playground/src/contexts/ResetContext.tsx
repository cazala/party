import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ResetContextType {
  isResetting: boolean;
  setIsResetting: (resetting: boolean) => void;
}

const ResetContext = createContext<ResetContextType | null>(null);

export function ResetProvider({ children }: { children: ReactNode }) {
  const [isResetting, setIsResetting] = useState(false);

  return (
    <ResetContext.Provider value={{ isResetting, setIsResetting }}>
      {children}
    </ResetContext.Provider>
  );
}

export function useReset() {
  const context = useContext(ResetContext);
  if (!context) {
    throw new Error('useReset must be used within a ResetProvider');
  }
  return context;
}