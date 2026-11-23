// auth.jsx — кто вошёл, вход и выход
import { setDraftUser, ErrorBox } from './ui';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // session: undefined — проверяем, null — не вошёл, объект — { user, students }
  const [session, setSession] = useState(getToken() ? undefined : null);
  const [error, setError] = useState(null);

  const refresh = async () => {
    const token = getToken();
    setError(null);
    try {
      const next = await api.me();
      if (token === getToken()) setSession(next);
    } catch (err) {
      if (token !== getToken()) return;
      if (err.status === 401) {
        setToken(null);
        setSession(null);
      } else {
        setError(err);
        throw err;
      }
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setSession(null);
    });
    if (getToken()) refresh().catch(() => {});
    const changed=e=>{if(e.key!=='tp_token')return;if(getToken())refresh().catch(()=>{});else setSession(null);};
    window.addEventListener('storage',changed);
    return () => {window.removeEventListener('storage',changed);setUnauthorizedHandler(() => {});};
  }, []);

  const login = async (loginName, password) => {
    const { token } = await api.login(loginName, password);
    setToken(token);
    await refresh();
  };

  const register = async (data, learner=false) => {
    const { token } = await (learner?api.registerLearner(data):api.register(data));
    setToken(token);
    await refresh();
  };

  const switchProfile = async mode => {
    const {token} = await api.switchProfile(mode);
    setToken(token);
    await refresh();
  };

  const logout = () => {
    setError(null);
    setToken(null);
    setSession(null);
    window.location.hash = '/';
  };

  setDraftUser(session?.user?.id); // черновики форм хранятся отдельно для каждого пользователя
  if (session === undefined && error) return <main className="page"><ErrorBox error={error} onRetry={() => refresh().catch(() => {})} /><button type="button" className="btn btn-secondary" onClick={logout}>На страницу входа</button></main>;
  return (
    <AuthContext.Provider value={{ session, user: session?.user, students: session?.students || [], login, register, logout, refresh, switchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
