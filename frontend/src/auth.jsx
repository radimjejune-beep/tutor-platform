// auth.jsx — кто вошёл, вход и выход
import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // session: undefined — проверяем, null — не вошёл, объект — { user, students }
  const [session, setSession] = useState(getToken() ? undefined : null);

  const refresh = async () => {
    try {
      setSession(await api.me());
    } catch {
      setToken(null);
      setSession(null);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setSession(null);
    });
    if (getToken()) refresh();
  }, []);

  const login = async (loginName, password) => {
    const { token } = await api.login(loginName, password);
    setToken(token);
    await refresh();
  };

  const logout = () => {
    setToken(null);
    setSession(null);
    window.location.hash = '/';
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user, students: session?.students || [], login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
