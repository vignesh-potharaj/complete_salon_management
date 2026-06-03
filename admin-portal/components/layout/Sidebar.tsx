'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Bell, 
  CreditCard, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Scissors
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isCollapsed?: boolean;
  setIsCollapsed?: (val: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const pathname = usePathname();

  const collapsed = isCollapsed !== undefined ? isCollapsed : localCollapsed;
  const toggleCollapse = () => {
    if (setIsCollapsed) {
      setIsCollapsed(!collapsed);
    } else {
      setLocalCollapsed(!localCollapsed);
    }
  };

  // If we are on the login page, don't render the sidebar
  if (pathname === '/login') return null;

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Revenue', href: '/revenue', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside 
      className={cn(
        "h-screen fixed top-0 left-0 bg-[#0d1117] border-r border-[#21262d] text-gray-300 transition-all duration-300 z-30 flex flex-col justify-between select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div>
        {/* Header Branding */}
        <div className="h-16 flex items-center px-4 border-b border-[#21262d] overflow-hidden whitespace-nowrap">
          <Link href="/dashboard" className="flex items-center gap-2 text-white font-bold">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Scissors className="w-4.5 h-4.5 text-white" />
            </div>
            <span className={cn(
              "font-sans text-lg tracking-wide bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent transition-opacity duration-200",
              collapsed ? "opacity-0 w-0" : "opacity-100"
            )}>
              SalonPro Admin
            </span>
          </Link>
        </div>

        {/* Menu Items */}
        <nav className="mt-6 px-2 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                  isActive 
                    ? "bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 rounded-l-none" 
                    : "text-gray-400 hover:bg-[#161b22] hover:text-white"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105",
                  isActive ? "text-indigo-400" : "text-gray-400 group-hover:text-white"
                )} />
                <span className={cn(
                  "transition-opacity duration-200",
                  collapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
                )}>
                  {item.name}
                </span>

                {/* Collapsed Tooltip */}
                {collapsed && (
                  <div className="absolute left-16 bg-[#161b22] text-white text-xs px-2.5 py-1.5 rounded border border-[#21262d] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap shadow-xl z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t border-[#21262d] flex items-center justify-center">
        <button
          onClick={toggleCollapse}
          className="w-full py-2 flex items-center justify-center hover:bg-[#161b22] text-gray-400 hover:text-white rounded-lg border border-[#21262d] transition-colors cursor-pointer"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
