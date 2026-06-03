import axios from 'axios';
import { getCookie } from './auth';
import { 
  AdminUser, 
  AnalyticsOverview, 
  RevenueDataPoint, 
  RazorpayPlan 
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically add bearer token on browser requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getCookie('salonpro_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Helper for server-side requests (injects token)
const getHeaders = (token?: string) => {
  if (token) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  return {};
};

export const adminApi = {
  // Authentication
  login: async (email: string, password: string) => {
    const res = await api.post('/admin/login', { email, password });
    return res.data; // returns { token, expiresIn }
  },

  // Users Management
  getUsers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    plan?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }, token?: string) => {
    const res = await api.get('/admin/users', { 
      params,
      ...getHeaders(token)
    });
    return res.data as { users: AdminUser[]; total: number; page: number; totalPages: number };
  },

  getUserById: async (userId: string, token?: string) => {
    const res = await api.get(`/admin/users/${userId}`, getHeaders(token));
    return res.data as AdminUser;
  },

  updateSubscription: async (userId: string, data: {
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    subscriptionEndDate?: string | null;
    adminNotes?: string;
  }, token?: string) => {
    const res = await api.patch(`/admin/users/${userId}/subscription`, data, getHeaders(token));
    return res.data as AdminUser;
  },

  activateSubscription: async (userId: string, data: {
    plan: string;
    durationDays: number;
  }, token?: string) => {
    const res = await api.post(`/admin/users/${userId}/activate`, data, getHeaders(token));
    return res.data as AdminUser;
  },

  terminateSubscription: async (userId: string, data: {
    reason: string;
  }, token?: string) => {
    const res = await api.post(`/admin/users/${userId}/terminate`, data, getHeaders(token));
    return res.data as AdminUser;
  },

  notifyUser: async (userId: string, data: {
    message: string;
    channel: 'email' | 'in_app' | 'both';
    notificationType: string;
  }, token?: string) => {
    const res = await api.post(`/admin/users/${userId}/notify`, data, getHeaders(token));
    return res.data as { success: boolean };
  },

  notifyBulk: async (data: {
    userIds?: string[];
    message: string;
    channel: 'email' | 'in_app' | 'both';
    notificationType: string;
    filter?: Record<string, any>;
  }, token?: string) => {
    const res = await api.post('/admin/users/notify-bulk', data, getHeaders(token));
    return res.data as { sent: number; failed: number };
  },

  getExpiringSoon: async (daysAhead = 7, token?: string) => {
    const res = await api.get(`/admin/users/expiring-soon?daysAhead=${daysAhead}`, getHeaders(token));
    return res.data as AdminUser[];
  },

  // Analytics
  getAnalyticsOverview: async (token?: string) => {
    const res = await api.get('/admin/analytics/overview', getHeaders(token));
    return res.data as AnalyticsOverview;
  },

  getRevenueAnalytics: async (period = '30d', token?: string) => {
    const res = await api.get(`/admin/analytics/revenue?period=${period}`, getHeaders(token));
    return res.data as RevenueDataPoint[];
  },

  // Razorpay setup
  getRazorpayPlans: async (token?: string) => {
    const res = await api.get('/admin/razorpay/plans', getHeaders(token));
    return res.data as RazorpayPlan[];
  },

  createRazorpayPlan: async (data: {
    planName: string;
    amount: number;
    period: 'monthly' | 'yearly';
    interval?: number;
  }, token?: string) => {
    const res = await api.post('/admin/razorpay/create-plan', data, getHeaders(token));
    return res.data as RazorpayPlan;
  },

  createRazorpaySubscription: async (userId: string, data: {
    planId: string;
    totalCount?: number;
  }, token?: string) => {
    const res = await api.post(`/admin/users/${userId}/create-subscription`, data, getHeaders(token));
    return res.data as { subscriptionId: string; shortUrl: string };
  }
};
