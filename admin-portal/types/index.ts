export interface PaymentRecord {
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  status: 'captured' | 'failed' | 'refunded';
  plan: string;
  paidAt: string;
}

export interface NotificationRecord {
  type: 'renewal_reminder' | 'expiry_warning' | 'terminated' | 'activated' | 'custom';
  message: string;
  sentAt: string;
  channel: 'email' | 'in_app' | 'both';
}

export interface AdminUser {
  _id: string;
  userId: string; // unique slug
  email: string;
  name: string;
  salonName: string;
  isEmailVerified: boolean;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'terminated';
  subscriptionPlan: 'starter' | 'growth' | 'pro';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  paymentHistory: PaymentRecord[];
  notificationsSent: NotificationRecord[];
  isActive: boolean;
  adminNotes?: string;
  createdAt: string;
}

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  trialUsers: number;
  expiredUsers: number;
  terminatedUsers: number;
  mrr: number;
  arr: number;
  newUsersThisMonth: number;
  churnedThisMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  planDistribution: {
    starter: number;
    growth: number;
    pro: number;
  };
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  newSubscriptions: number;
  cancellations: number;
}

export interface RazorpayPlan {
  _id: string;
  planId: string;
  name: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  createdAt: string;
}
