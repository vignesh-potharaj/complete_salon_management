import React from 'react';
import { cookies } from 'next/headers';
import { 
  Users, 
  UserCheck, 
  Clock, 
  UserX, 
  TrendingUp, 
  AlertTriangle 
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import MetricCard from '../../components/dashboard/MetricCard';
import RevenueChart from '../../components/dashboard/RevenueChart';
import PlanDistributionChart from '../../components/dashboard/PlanDistributionChart';
import ExpiringUsersList from '../../components/dashboard/ExpiringUsersList';
import { formatCurrency } from '../../lib/utils';
import { AnalyticsOverview, AdminUser, RevenueDataPoint } from '../../types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let overview: AnalyticsOverview | null = null;
  let expiringUsers: AdminUser[] = [];
  let revenueData: RevenueDataPoint[] = [];
  let errorMsg: string | null = null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('salonpro_admin_token')?.value;

    if (token) {
      overview = await adminApi.getAnalyticsOverview(token);
      expiringUsers = await adminApi.getExpiringSoon(7, token);
      revenueData = await adminApi.getRevenueAnalytics('30d', token);
    } else {
      errorMsg = 'Session token not found. Please log in again.';
    }
  } catch (err: any) {
    console.error('Server Component Fetch Error:', err.message);
    errorMsg = 'Backend API offline or unreachable. Displaying demo sandbox mode.';
    
    // Inject mock/demo data for compilation and offline testing
    overview = {
      totalUsers: 145,
      activeUsers: 84,
      trialUsers: 32,
      expiredUsers: 22,
      terminatedUsers: 7,
      mrr: 124500,
      arr: 1494000,
      newUsersThisMonth: 18,
      churnedThisMonth: 3,
      revenueThisMonth: 118000,
      revenueLastMonth: 98000,
      planDistribution: {
        starter: 48,
        growth: 24,
        pro: 12
      }
    };
    
    expiringUsers = [
      {
        _id: '1',
        userId: 'glow-salon',
        name: 'Jane Doe',
        salonName: 'Glow Premium Salon',
        email: 'jane@glowsalon.com',
        isEmailVerified: true,
        subscriptionStatus: 'active',
        subscriptionPlan: 'growth',
        subscriptionEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        paymentHistory: [],
        notificationsSent: [],
        createdAt: new Date().toISOString()
      },
      {
        _id: '2',
        userId: 'scissors-craft',
        name: 'John Smith',
        salonName: 'Scissors Craft Lab',
        email: 'contact@scissorscraft.com',
        isEmailVerified: true,
        subscriptionStatus: 'active',
        subscriptionPlan: 'starter',
        subscriptionEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        paymentHistory: [],
        notificationsSent: [],
        createdAt: new Date().toISOString()
      }
    ];

    revenueData = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return {
        date: d.toISOString().split('T')[0],
        revenue: 2500 + Math.round(Math.random() * 4000),
        newSubscriptions: Math.random() > 0.8 ? 1 : 0,
        cancellations: Math.random() > 0.95 ? 1 : 0
      };
    });
  }

  // Double fallback guard
  if (!overview) {
    overview = {
      totalUsers: 0, activeUsers: 0, trialUsers: 0, expiredUsers: 0, terminatedUsers: 0,
      mrr: 0, arr: 0, newUsersThisMonth: 0, churnedThisMonth: 0, revenueThisMonth: 0, revenueLastMonth: 0,
      planDistribution: { starter: 0, growth: 0, pro: 0 }
    };
  }

  const mrrGrowth = overview.revenueLastMonth > 0 
    ? ((overview.revenueThisMonth - overview.revenueLastMonth) / overview.revenueLastMonth) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Alert if using offline/mock mode */}
      {errorMsg && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Row 1: Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Salons"
          value={overview.totalUsers}
          icon={Users}
          description="Registered tenants"
        />
        <MetricCard
          title="Active Users"
          value={overview.activeUsers}
          icon={UserCheck}
          description="Active accounts"
          className="hover:shadow-green-500/5"
        />
        <MetricCard
          title="Trial Accounts"
          value={overview.trialUsers}
          icon={Clock}
          description="Under trial evaluation"
        />
        <MetricCard
          title="Expired & Suspended"
          value={overview.expiredUsers + overview.terminatedUsers}
          icon={UserX}
          description={`${overview.expiredUsers} expired, ${overview.terminatedUsers} suspended`}
        />
        <MetricCard
          title="MRR (₹)"
          value={formatCurrency(overview.mrr)}
          icon={TrendingUp}
          description="MRR / ARR track"
          trend={{
            value: `${mrrGrowth >= 0 ? '+' : ''}${mrrGrowth.toFixed(1)}%`,
            isPositive: mrrGrowth >= 0
          }}
          className="border-indigo-500/20"
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart data={revenueData} />
        </div>
        <div>
          <PlanDistributionChart data={overview.planDistribution} />
        </div>
      </div>

      {/* Row 3: Expiring soon list */}
      <div>
        <ExpiringUsersList users={expiringUsers} />
      </div>
    </div>
  );
}
