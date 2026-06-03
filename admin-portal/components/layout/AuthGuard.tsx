'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCookie, isTokenExpired } from '../../lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Skip auth guard check for login page
    if (pathname === '/login') {
      setAuthorized(true);
      return;
    }

    const token = getCookie('salonpro_admin_token');
    
    if (!token || isTokenExpired(token)) {
      setAuthorized(false);
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [pathname, router]);

  if (!authorized && pathname !== '/login') {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="text-sm text-gray-400">Verifying session credentials...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
