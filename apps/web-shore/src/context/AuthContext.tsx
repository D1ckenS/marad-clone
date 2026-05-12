import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface JwtPayload {
  sub: string;
  tenantId: string;
  vesselId?: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: JwtPayload | null;
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string) => void;
  logout: () => void;
}

function decodePayload(token: string): JwtPayload {
  const part = token.split('.')[1];
  if (!part) throw new Error('Invalid token');
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
}

function loadInitial(): AuthState {
  const token = localStorage.getItem('access_token');
  if (!token) return { token: null, user: null };
  try {
    return { token, user: decodePayload(token) };
  } catch {
    localStorage.removeItem('access_token');
    return { token: null, user: null };
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitial);

  const login = useCallback((accessToken: string) => {
    localStorage.setItem('access_token', accessToken);
    setState({ token: accessToken, user: decodePayload(accessToken) });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setState({ token: null, user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
