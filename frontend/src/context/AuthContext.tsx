
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import api, { initializeCsrf } from '../api/axios';
import { configureTokenHandler } from '../api/tokenHandler';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  updateAccessToken: (token: string) => void;
  logout: () => Promise<void>;
}

interface LoginEventDetail {
  accessToken: string;
  user: AuthUser;
}

interface RefreshResponse {
  data: {
    accessToken: string;
    user: AuthUser;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let refreshPromise: Promise<RefreshResponse> | null = null;

function refreshSession(): Promise<RefreshResponse> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<RefreshResponse['data']>('/auth/refresh')
      .then((response) => ({ data: response.data }))
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function login(token: string, loggedInUser: AuthUser) {
    setAccessToken(token);
    setUser(loggedInUser);
  }

  function updateAccessToken(token: string) {
    setAccessToken(token);
  }

  useEffect(() => {
    configureTokenHandler(
      () => accessToken,
      (token) => setAccessToken(token),
    );
  }, [accessToken]);

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local authentication even if the server is unavailable.
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  // Listen for successful login events.
  useEffect(() => {
    function handleLogin(event: Event) {
      const detail = (event as CustomEvent<LoginEventDetail>).detail;

      if (detail?.accessToken && detail?.user) {
        login(detail.accessToken, detail.user);
      }
    }

    window.addEventListener('splitmate:login', handleLogin);

    return () => {
      window.removeEventListener('splitmate:login', handleLogin);
    };
  }, []);

  // Clear local authentication when refreshing the session fails.
  useEffect(() => {
    function handleSessionExpired() {
      setAccessToken(null);
      setUser(null);
    }

    window.addEventListener(
      'splitmate:session-expired',
      handleSessionExpired,
    );

    return () => {
      window.removeEventListener(
        'splitmate:session-expired',
        handleSessionExpired,
      );
    };
  }, []);

  // Restore the user's session when the application starts.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
            try {
        await api.get('/auth/csrf');

        await initializeCsrf();

          const response = await refreshSession();
        const { accessToken: token, user: loggedInUser } = response.data;

        if (token && loggedInUser && !cancelled) {
          login(token, loggedInUser);
        }
      } catch {
        // No valid refresh session; remain logged out.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: Boolean(accessToken && user),
        isLoading,
        login,
        updateAccessToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
