import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 60000 });

// ---- Farmer registration / sign in ----
export const registerFarmer = (data) => api.post('/farmers/register', data);
export const getFarmer = (phone) => api.get(`/farmers/${encodeURIComponent(phone)}`);

// ---- Market advisory query ----
export const askTextQuery = (data) => api.post('/query/text', data);
export const askVoiceQuery = (formData) =>
  api.post('/query/voice', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getHistory = (phone, limit = 20) =>
  api.get(`/query/history/${encodeURIComponent(phone)}`, { params: { limit } });

// ---- Market prices + weather ----
export const getMarketSnapshot = (phone) => api.get(`/market/snapshot/${encodeURIComponent(phone)}`);

// ---- Disease detection ----
export const detectDisease = (formData) =>
  api.post('/disease/detect', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// ---- Crop calendar / to-do ----
export const getTasks = (phone) => api.get(`/calendar/${encodeURIComponent(phone)}/tasks`);
export const getVoiceReminder = (phone) => api.get(`/calendar/${encodeURIComponent(phone)}/reminder`);
export const completeTask = (taskId) => api.patch(`/calendar/task/${taskId}/complete`);
export const reopenTask = (taskId) => api.patch(`/calendar/task/${taskId}/reopen`);

// ---- Notifications ----
export const sendEmailReminder = (phone) => api.post(`/notify/${encodeURIComponent(phone)}/email`);

export default api;