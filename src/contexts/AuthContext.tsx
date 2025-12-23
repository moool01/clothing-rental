import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

type Role = 'staff' | 'manager' | 'admin' | null;

interface AuthContextType {
  role: Role;
  setRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'app_role_v1';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // ✅ 최초 로드 시 localStorage에서 role 복구
  const [role, _setRole] = useState<Role>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'staff' || saved === 'manager' || saved === 'admin') return saved;
    return null;
  });

  // ✅ setRole을 래핑해서 저장까지 같이
  const setRole = (next: Role) => {
    _setRole(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  };

  // ✅ (선택) 다른 탭에서 로그인/로그아웃 했을 때 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === 'staff' || v === 'manager' || v === 'admin') _setRole(v);
      else _setRole(null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};