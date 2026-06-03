'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AuthGuard from './AuthGuard';
import { cn } from '../../lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-[#0d1117] flex items-center justify-center">
          {children}
        </main>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0d1117] text-gray-200 flex">
        {/* Collapsible Sidebar */}
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        {/* Main Content Area with dynamic padding matching sidebar width */}
        <div 
          className={cn(
            "flex-1 flex flex-col min-w-0 transition-all duration-300",
            isCollapsed ? "pl-16" : "pl-64"
          )}
        >
          <Topbar />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
