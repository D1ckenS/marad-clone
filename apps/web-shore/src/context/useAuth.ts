import { useContext } from 'react';
import { AuthContext } from './AuthContext.js';
import type { AuthContextValue } from './AuthContext.js';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
