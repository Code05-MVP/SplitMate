
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  readAccessToken,
  saveAccessToken,
} from './tokenHandler';

const API_BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate instance prevents the refresh request from
// triggering the same response interceptor recursively.
const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface RefreshResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config) => {
  const token = readAccessToken();

  if (token && !config.headers.Authorization) {
  config.headers.Authorization = `Bearer ${token}`;
}

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;
    const requestUrl = originalRequest?.url ?? '';

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout')
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshApi
          .post<RefreshResponse>('/auth/refresh')
          .then((response) => {
            const token = response.data.accessToken;

            if (!token) {
              throw new Error(
                'Refresh response did not contain an access token.',
              );
            }

            saveAccessToken(token);

            return token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;

      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      window.dispatchEvent(new Event('splitmate:session-expired'));

      return Promise.reject(refreshError);
    }
  },
);

export default api;
