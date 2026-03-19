import axios from "axios";
import { getStoredToken, setStoredAuthData, clearStoredAuthData } from "@/utils/authStorage";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const hasToken = !!getStoredToken();
      if (!hasToken) {
        return Promise.reject(error);
      }

      if (!hasToken && typeof window !== "undefined" && window.location.pathname.startsWith("/auth/login")) {
        return Promise.reject(error);
      }

      if (isRefreshing) {

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const newAccessToken = res.data?.accessToken || res.data?.data?.accessToken;
        
        if (!newAccessToken) {
           throw new Error("No access token returned from refresh");
        }

        setStoredAuthData(newAccessToken, null);

        processQueue(null, newAccessToken);
        
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
        
      } catch (err) {
        processQueue(err, null);
        clearStoredAuthData();
        if (typeof window !== "undefined" && window.location.pathname !== "/auth/login" && !window.location.pathname.startsWith("/auth/login")) {
          window.location.href = "/auth/login";
        }
        return Promise.reject(err);
      } finally {

        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
