'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import axios from 'axios';

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't render Topbar on login page
  if (pathname === '/login') return null;

  const getPageTitle = () => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard Overview';
    if (pathname.startsWith('/users/')) return 'User Details & Management';
    if (pathname.startsWith('/users')) return 'Salon Directory';
    if (pathname.startsWith('/notifications')) return 'Broadcast Messages';
    if (pathname.startsWith('/revenue')) return 'Revenue Analytics';
    if (pathname.startsWith('/settings')) return 'Admin Settings';
    return 'Admin Panel';
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      // Hard fallback: erase cookie client-side and redirect
      document.cookie = 'salonpro_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      router.push('/login');
    }
  };

  return (
    <header className="h-16 border-b border-[#21262d] bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6 select-none">
      {/* Page Title */}
      <h1 className="text-xl font-semibold text-white tracking-tight font-sans">
        {getPageTitle()}
      </h1>

      {/* Admin Profile Area */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#161b22] border border-[#21262d]">
          <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-gray-300">Super Admin</span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-[#21262d]"></div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg border border-red-500/20 transition-all cursor-pointer"
          title="Sign out of Admin Session"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
