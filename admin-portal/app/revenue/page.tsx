'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  DollarSign, 
  CreditCard, 
  Users, 
  TrendingUp, 
  ArrowUpDown,
  Search,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { AdminUser, PaymentRecord } from '../../types';
import { formatCurrency, formatDate, cn } from '../../lib/utils';

export default function RevenuePage() {
  const [salons, setSalons] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Aggregated Stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [arpu, setArpu] = useState(0);
  const [allPayments, setAllPayments] = useState<any[]>([]);

  // Period / Date range selection
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [search, setSearch] = useState('');
  
  // Table Sorting
  const [sortField, setSortField] = useState<'paidAt' | 'amount'>('paidAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Chart data state
  const [chartData, setChartData] = useState<any[]>([]);

  const loadRevenueData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getUsers({ limit: 1000 }); // get all users
      setSalons(data.users);

      // Extract all payment history records
      const payments: any[] = [];
      let totalSum = 0;
      let mrrSum = 0;
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      data.users.forEach(u => {
        if (u.paymentHistory) {
          u.paymentHistory.forEach(pay => {
            const payDate = new Date(pay.paidAt);
            payments.push({
              ...pay,
              salonName: u.salonName,
              ownerName: u.name,
              userId: u.userId
            });

            if (pay.status === 'captured') {
              totalSum += pay.amount;
              if (payDate >= thirtyDaysAgo) {
                mrrSum += pay.amount;
              }
            }
          });
        }
      });

      // Sort payments initially by date desc
      payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      setAllPayments(payments);
      setTotalRevenue(totalSum);
      setMrr(mrrSum);

      const activeSalonsCount = data.users.filter(u => u.subscriptionStatus === 'active').length;
      setArpu(activeSalonsCount > 0 ? totalSum / activeSalonsCount : 0);

      // Load monthly chart data points
      const revenuePoints = await adminApi.getRevenueAnalytics(period);
      setChartData(revenuePoints);
    } catch (err: any) {
      console.error(err);
      setError('Could not establish backend session. Showing fallback sandbox metrics.');
      
      // Inject Mock Fallbacks for testing
      const mockPayments = [
        { razorpayPaymentId: 'pay_001', amount: 2999, currency: 'INR', status: 'captured', plan: 'growth', paidAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), salonName: 'Glow Premium Salon', userId: 'glow-salon' },
        { razorpayPaymentId: 'pay_002', amount: 999, currency: 'INR', status: 'captured', plan: 'starter', paidAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), salonName: 'Scissors Craft Lab', userId: 'scissors-craft' },
        { razorpayPaymentId: 'pay_003', amount: 5999, currency: 'INR', status: 'captured', plan: 'pro', paidAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(), salonName: 'Imperial Barber Shop', userId: 'barber-shop' },
        { razorpayPaymentId: 'pay_004', amount: 2999, currency: 'INR', status: 'failed', plan: 'growth', paidAt: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(), salonName: 'The Hair Affair', userId: 'hair-affair' }
      ];
      setAllPayments(mockPayments);
      setTotalRevenue(9997);
      setMrr(9997);
      setArpu(4998);

      // Chart mock data points
      const mockPoints = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return {
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          revenue: 5000 + Math.round(Math.random() * 15000),
          newSubscriptions: 1 + Math.round(Math.random() * 3),
          cancellations: Math.round(Math.random() * 1)
        };
      });
      setChartData(mockPoints);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenueData();
  }, [period]);

  const handleSortTable = (field: 'paidAt' | 'amount') => {
    const isAsc = sortField === field && sortDirection === 'asc';
    setSortField(field);
    setSortDirection(isAsc ? 'desc' : 'asc');

    const sorted = [...allPayments].sort((a, b) => {
      if (field === 'paidAt') {
        const valA = new Date(a.paidAt).getTime();
        const valB = new Date(b.paidAt).getTime();
        return isAsc ? valA - valB : valB - valA;
      } else {
        return isAsc ? a.amount - b.amount : b.amount - a.amount;
      }
    });
    setAllPayments(sorted);
  };

  // Filter list by search query
  const filteredPayments = allPayments.filter(p => 
    p.salonName?.toLowerCase().includes(search.toLowerCase()) ||
    p.razorpayPaymentId?.toLowerCase().includes(search.toLowerCase()) ||
    p.plan?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: Revenue Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Revenue</p>
              <h3 className="text-2xl font-bold mt-2 text-white font-mono leading-none">{formatCurrency(totalRevenue)}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4 uppercase">Cumulative historical billing</p>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Recurring (MRR)</p>
              <h3 className="text-2xl font-bold mt-2 text-white font-mono leading-none">{formatCurrency(mrr)}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4 uppercase">Successful charges in last 30d</p>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Annual Run Rate (ARR)</p>
              <h3 className="text-2xl font-bold mt-2 text-white font-mono leading-none">{formatCurrency(mrr * 12)}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4 uppercase">Projected annualized run-rate</p>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Rev Per User (ARPU)</p>
              <h3 className="text-2xl font-bold mt-2 text-white font-mono leading-none">{formatCurrency(arpu)}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 border border-yellow-500/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4 uppercase">Average collections per active salon</p>
        </div>
      </div>

      {/* Row 2: Graph & Period Select */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-300">Revenue Distribution Timeline</h4>
            <p className="text-xs text-gray-500 font-normal">Income performance sorted by period</p>
          </div>
          <div className="flex bg-[#0d1117] border border-[#21262d] rounded-lg p-0.5 select-none text-[10px] font-semibold">
            {(['7d', '30d', '90d', '1y'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer uppercase ${
                  period === p
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#8b949e" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                  tickFormatter={(tick) => {
                    if (tick.includes('-')) {
                      const parts = tick.split('-');
                      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                      return tick; // return YYYY-MM
                    }
                    return tick;
                  }}
                />
                <YAxis 
                  stroke="#8b949e" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161b22',
                    borderColor: '#30363d',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Collections']}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#6366f1" className="hover:opacity-80 transition-opacity" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Transaction logs table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden shadow-md">
        {/* Table Controls */}
        <div className="p-4 bg-[#161b22] border-b border-[#21262d] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-300">Transaction History Log</h4>
            <p className="text-xs text-gray-500 font-normal">Statements of invoice payments received</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search ID, Salon or Plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#0d1117] border border-[#21262d] text-white focus:outline-none focus:border-indigo-500 rounded-lg text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="h-60 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs">
            No transaction records found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#21262d] text-gray-400 font-semibold select-none bg-[#161b22]/80">
                  <th className="py-3 px-4">Salon Name</th>
                  <th className="py-3 px-4">Statement ID</th>
                  <th className="py-3 px-4">Plan Level</th>
                  <th 
                    onClick={() => handleSortTable('amount')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center">Amount <ArrowUpDown className="w-3 h-3 ml-1" /></span>
                  </th>
                  <th 
                    onClick={() => handleSortTable('paidAt')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center">Captured At <ArrowUpDown className="w-3 h-3 ml-1" /></span>
                  </th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]/50">
                {filteredPayments.map((pay, i) => (
                  <tr key={pay.razorpayPaymentId || i} className="hover:bg-[#161b22]/50">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div>{pay.salonName}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{pay.userId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 font-mono text-[10px]">
                      {pay.razorpayPaymentId}
                    </td>
                    <td className="py-3.5 px-4 text-gray-300 uppercase font-semibold">
                      {pay.plan}
                    </td>
                    <td className="py-3.5 px-4 text-white font-mono font-medium">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {formatDate(pay.paidAt, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold capitalize",
                        pay.status === 'captured'
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : pay.status === 'failed'
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                      )}>
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
