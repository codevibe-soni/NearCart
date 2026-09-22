import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
 timeout: 86400000, // 24 hours,
});

// Response interceptor for error handling without crashing application
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const formattedError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      status: error.response?.status || 500,
      success: false,
    };
    return Promise.reject(formattedError);
  }
);

export const checkHealth = async () => {
  try {
    const data = await api.get('/health');
    return data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { success: false, message: error.message || 'API Server unreachable' };
  }
};

export default api;
