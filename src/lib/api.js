import axios from "axios";

/**
 * Client API centralisé avec fix UTF-8 définitif
 * 
 * Force le parsing manuel pour éviter les problèmes d'encodage
 * causés par la détection automatique d'axios
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/ecom",
  responseType: "text",
  transformResponse: [(data) => {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }],
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  }
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
