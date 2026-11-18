import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiGet } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sanitizeCachedUser(raw: User | null): User | null {
  if (!raw) return null;
  if (raw.username === 'admin' && raw.fullName?.includes('Quản Trị Viên Tối Cao')) {
    return { ...raw, fullName: 'Admin' };
  }
  return raw;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? sanitizeCachedUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiGet('/auth/me')
      .then((res: { user?: User }) => {
        if (!cancelled && res?.user) {
          const fresh = sanitizeCachedUser(res.user);
          if (fresh) {
            localStorage.setItem('user', JSON.stringify(fresh));
            setUser(fresh);
          }
        }
      })
      .catch(() => {
        // 401 is already handled by api.ts; ignore transient offline errors
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    const clean = sanitizeCachedUser(newUser)!;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(clean));
    setToken(newToken);
    setUser(clean);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
