import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export default function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className
}: MetricCardProps) {
  return (
    <div 
      className={cn(
        "bg-[#161b22] border border-[#21262d] rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:border-gray-700 group shadow-md",
        className
      )}
    >
      {/* Decorative Blur Glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-300"></div>

      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold mt-2 text-white font-mono leading-none tracking-tight">
            {value}
          </h3>
        </div>
        <div className="w-9 h-9 rounded-lg bg-[#21262d] flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors border border-[#30363d] shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(description || trend) && (
        <div className="flex items-center gap-2 mt-4 text-xs">
          {trend && (
            <span 
              className={cn(
                "font-semibold px-1.5 py-0.5 rounded",
                trend.isPositive 
                  ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              )}
            >
              {trend.value}
            </span>
          )}
          {description && <span className="text-gray-400">{description}</span>}
        </div>
      )}
    </div>
  );
}
