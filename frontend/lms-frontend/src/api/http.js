import axios from "axios";
import { getToken } from "../auth/token";
import { translateUiMessage } from "../utils/uiError";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const http = axios.create({
  baseURL: API_BASE_URL,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.data) {
      if (typeof error.response.data.error === "string") {
        error.response.data.error = translateUiMessage(error.response.data.error, error.response.data.error);
      }
      if (typeof error.response.data.message === "string") {
        error.response.data.message = translateUiMessage(error.response.data.message, error.response.data.message);
      }
    }

    if (typeof error?.message === "string") {
      error.message = translateUiMessage(error.message, error.message);
    }

    return Promise.reject(error);
  }
);
