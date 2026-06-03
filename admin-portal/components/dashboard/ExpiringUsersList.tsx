'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { AdminUser } from '../../types';
import { adminApi } from '../../lib/api';
import { formatDate } from '../../lib/utils';

interface ExpiringUsersListProps {
  users: AdminUser[];
  onRefresh?: () => void;
}

export default function ExpiringUsersList({ users, onRefresh }: ExpiringUsersListProps) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [errorId, setErrorId] = useState<string | null>(null);

  const handleSendReminder = async (user: AdminUser) => {
    setSendingId(user.userId);
    setErrorId(null);
    try {
      await adminApi.notifyUser(user.userId, {
        message: `Your SalonPro ${user.subscriptionPlan.toUpperCase()} plan is expiring on ${formatDate(user.subscriptionEndDate)}. Please renew to avoid system downtime.`,
        channel: 'email',
        notificationType: 'renewal_reminder'
      });
      setSentIds(prev => [...prev, user.userId]);
      setTimeout(() => {
        setSentIds(prev => prev.filter(id => id !== user.userId));
        if (onRefresh) onRefresh();
      }, 3000);
    } catch (err) {
      console.error(err);
      setErrorId(user.userId);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-300">Expiring Subscriptions (7 Days)</h4>
          <p className="text-xs text-gray-500">Salons requiring billing renewal actions</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 text-xs font-semibold">
          {users.length} Salons
        </span>
      </div>

      {users.length === 0 ? (
        <div className="h-48 border border-dashed border-[#30363d] rounded-lg flex flex-col items-center justify-center text-gray-500 gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500/80" />
          <p className="text-xs font-medium">All systems green. No expiring subscriptions in view.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#21262d] text-gray-400 font-medium">
                <th className="py-3 px-2">Salon Name</th>
                <th className="py-3 px-2">Owner</th>
                <th className="py-3 px-2">Plan</th>
                <th className="py-3 px-2">Expiry Date</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]">
              {users.map((user) => {
                const isSent = sentIds.includes(user.userId);
                const isSending = sendingId === user.userId;
                const isError = errorId === user.userId;

                return (
                  <tr key={user.userId} className="hover:bg-[#161b22]/50 transition-colors">
                    <td className="py-3.5 px-2">
                      <div className="font-semibold text-white">{user.salonName}</div>
                      <div className="text-gray-500 font-mono text-[10px]">{user.userId}</div>
                    </td>
                    <td className="py-3.5 px-2">
                      <div className="text-gray-300">{user.name}</div>
                      <div className="text-gray-500 text-[10px]">{user.email}</div>
                    </td>
                    <td className="py-3.5 px-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {user.subscriptionPlan}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-gray-300">
                      {formatDate(user.subscriptionEndDate)}
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Go to user details */}
                        <Link 
                          href={`/users/${user.userId}`}
                          className="p-1.5 hover:bg-[#30363d] text-gray-400 hover:text-white rounded transition-colors"
                          title="View Salon details"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                        
                        {/* Quick Reminder */}
                        <button
                          onClick={() => handleSendReminder(user)}
                          disabled={isSending || isSent}
                          className={`px-2.5 py-1.5 rounded text-[10px] font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                            isSent
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : isError
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>
                            {isSending ? 'Sending...' : isSent ? 'Sent' : isError ? 'Retry' : 'Remind'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
