'use client';

import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface PlanDistributionChartProps {
  data: {
    starter: number;
    growth: number;
    pro: number;
  };
  loading?: boolean;
}

export default function PlanDistributionChart({ data, loading }: PlanDistributionChartProps) {
  if (loading) {
    return (
      <div className="h-80 bg-[#161b22] border border-[#21262d] rounded-xl flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const chartData = [
    { name: 'Starter', value: data.starter || 0 },
    { name: 'Growth', value: data.growth || 0 },
    { name: 'Pro', value: data.pro || 0 }
  ].filter(item => item.value > 0);

  const COLORS = ['#6366f1', '#a855f7', '#10b981'];

  const hasData = chartData.length > 0;

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-md">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-300">Plan Allocation</h4>
        <p className="text-xs text-gray-500">Breakdown of active subscription levels</p>
      </div>

      <div className="h-72 w-full flex items-center justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#161b22" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161b22',
                  borderColor: '#30363d',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px'
                }}
                formatter={(value: any) => [value, 'Salons']}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconSize={10} 
                iconType="circle"
                wrapperStyle={{
                  fontSize: '11px',
                  color: '#8b949e'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-400 text-xs">No active plans distributed yet.</div>
        )}
      </div>
    </div>
  );
}
