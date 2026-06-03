'use client';

import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { RevenueDataPoint } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface RevenueChartProps {
  data: RevenueDataPoint[];
  loading?: boolean;
}

export default function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) {
    return (
      <div className="h-80 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-center text-gray-400 text-sm">
        No revenue details available for this timeline.
      </div>
    );
  }

  const formatYAxis = (value: number) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
    return `₹${value}`;
  };

  const formatTooltipDate = (label: any) => {
    return formatDate(String(label));
  };

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-md">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300">Revenue Progression</h4>
        <p className="text-xs text-gray-500">Timeline view of successful subscription charges</p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#21262d" 
              vertical={false} 
            />
            <XAxis 
              dataKey="date" 
              stroke="#8b949e" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
              tickFormatter={(tick) => {
                // If tick contains a dash (YYYY-MM-DD), extract just the day/month
                if (tick.includes('-')) {
                  const parts = tick.split('-');
                  if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}`;
                  }
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
              tickFormatter={formatYAxis}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px'
              }}
              formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
              labelFormatter={formatTooltipDate}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#6366f1" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#revenueGlow)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
