'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Mail, 
  Loader2, 
  AlertTriangle,
  X,
  Send,
  MessageSquare
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { AdminUser } from '../../types';
import { formatDate, formatCurrency, cn } from '../../lib/utils';

export default function UsersPage() {
  // Query States
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Bulk Selection States
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkChannel, setBulkChannel] = useState<'email' | 'in_app' | 'both'>('in_app');
  const [bulkNotificationType, setBulkNotificationType] = useState('custom');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null);

  // Fetch Users
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getUsers({
        page,
        limit: 20,
        search,
        status: status || undefined,
        plan: plan || undefined,
        sortBy,
        sortOrder
      });
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      console.error(err);
      setError('Unable to fetch salons from server. Displaying mock listings.');
      
      // Fallback sandbox users if backend is unavailable
      const mockUsers: AdminUser[] = [
        {
          _id: '1',
          userId: 'glow-salon',
          name: 'Jane Doe',
          salonName: 'Glow Premium Salon',
          email: 'jane@glowsalon.com',
          isEmailVerified: true,
          subscriptionStatus: 'active',
          subscriptionPlan: 'growth',
          subscriptionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          lastPaymentDate: new Date().toISOString(),
          lastPaymentAmount: 2999,
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
          subscriptionStatus: 'trial',
          subscriptionPlan: 'starter',
          subscriptionEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          paymentHistory: [],
          notificationsSent: [],
          createdAt: new Date().toISOString()
        },
        {
          _id: '3',
          userId: 'hair-affair',
          name: 'Sarah Connor',
          salonName: 'The Hair Affair',
          email: 'sarah@hairaffair.com',
          isEmailVerified: false,
          subscriptionStatus: 'expired',
          subscriptionPlan: 'starter',
          subscriptionEndDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: false,
          paymentHistory: [],
          notificationsSent: [],
          createdAt: new Date().toISOString()
        },
        {
          _id: '4',
          userId: 'barber-shop',
          name: 'Marcus Aurelius',
          salonName: 'Imperial Barber Shop',
          email: 'marcus@barbershop.com',
          isEmailVerified: true,
          subscriptionStatus: 'terminated',
          subscriptionPlan: 'pro',
          subscriptionEndDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          adminNotes: 'Repeated billing failure',
          isActive: false,
          paymentHistory: [],
          notificationsSent: [],
          createdAt: new Date().toISOString()
        }
      ];
      setUsers(mockUsers);
      setTotal(mockUsers.length);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, status, plan, sortBy, sortOrder]);

  // Debounced search trigger
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setPage(1);
      fetchUsers();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Bulk Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUserIds(users.map(u => u.userId));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectOne = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  // Submit Broadcast Notification
  const handleSendBulkNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkMessage.trim()) return;

    setSendingBulk(true);
    setBulkResult(null);

    try {
      const res = await adminApi.notifyBulk({
        userIds: selectedUserIds,
        message: bulkMessage,
        channel: bulkChannel,
        notificationType: bulkNotificationType
      });
      setBulkResult(res);
      setSelectedUserIds([]);
      setBulkMessage('');
    } catch (err) {
      console.error(err);
      setBulkResult({ sent: 0, failed: selectedUserIds.length });
    } finally {
      setSendingBulk(false);
    }
  };

  // Status badge classes mapping
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'trial':
        return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
      case 'expired':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'terminated':
        return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Control Bar */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Left Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search owners, salons, emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21262d] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all rounded-lg text-sm"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Select */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#0d1117] border border-[#21262d] text-gray-300 text-xs rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="terminated">Suspended</option>
          </select>

          {/* Plan Select */}
          <select
            value={plan}
            onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-[#0d1117] border border-[#21262d] text-gray-300 text-xs rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
          </select>

          {/* Bulk Action Trigger */}
          {selectedUserIds.length > 0 && (
            <button
              onClick={() => {
                setBulkResult(null);
                setIsBulkModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Broadcast ({selectedUserIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden shadow-md">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-2">
            <AlertTriangle className="w-8 h-8 text-gray-600" />
            <p className="text-sm font-medium">No salons match current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#21262d] text-gray-400 font-medium select-none bg-[#161b22]/80">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedUserIds.length === users.length && users.length > 0}
                      className="rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th 
                    onClick={() => handleSort('salonName')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center">Salon Name {renderSortIcon('salonName')}</span>
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center">Owner {renderSortIcon('name')}</span>
                  </th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th 
                    onClick={() => handleSort('subscriptionEndDate')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center">Expiry Date {renderSortIcon('subscriptionEndDate')}</span>
                  </th>
                  <th 
                    onClick={() => handleSort('lastPaymentDate')}
                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center">Last Payment {renderSortIcon('lastPaymentDate')}</span>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]">
                {users.map((user) => {
                  const isSelected = selectedUserIds.includes(user.userId);
                  return (
                    <tr 
                      key={user.userId} 
                      className={cn(
                        "hover:bg-[#161b22]/70 transition-colors",
                        isSelected && "bg-indigo-600/5 hover:bg-indigo-600/10"
                      )}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(user.userId, e.target.checked)}
                          className="rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div>{user.salonName}</div>
                        <div className="text-gray-500 font-mono text-[10px] mt-0.5">{user.userId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-gray-300">{user.name}</div>
                        <div className="text-gray-500 text-[10px]">{user.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#21262d] text-gray-300 border border-[#30363d]">
                          {user.subscriptionPlan}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold capitalize", getStatusBadge(user.subscriptionStatus))}>
                          {user.subscriptionStatus === 'terminated' ? 'suspended' : user.subscriptionStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">
                        {formatDate(user.subscriptionEndDate)}
                      </td>
                      <td className="py-3.5 px-4">
                        {user.lastPaymentDate ? (
                          <div>
                            <div className="text-gray-300 font-mono">{formatCurrency(user.lastPaymentAmount)}</div>
                            <div className="text-[10px] text-gray-500">{formatDate(user.lastPaymentDate)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/users/${user.userId}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white rounded-lg border border-[#30363d] transition-all cursor-pointer font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#161b22]/50 border-t border-[#21262d] flex items-center justify-between text-xs text-gray-400">
          <div>
            Showing <strong className="text-white">{users.length}</strong> of{' '}
            <strong className="text-white">{total}</strong> salons
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="p-1.5 bg-[#21262d] hover:bg-[#30363d] rounded-lg border border-[#30363d] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="p-1.5 bg-[#21262d] hover:bg-[#30363d] rounded-lg border border-[#30363d] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Notification Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-scaleUp">
            <button 
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-[#21262d] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <span>Broadcast Custom Notification</span>
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Sending to <strong className="text-indigo-400">{selectedUserIds.length}</strong> selected salons.
            </p>

            {bulkResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                  <p className="font-bold mb-1">Broadcast Completed</p>
                  <p>Successfully processed: {bulkResult.sent} emails/alerts</p>
                  {bulkResult.failed > 0 && <p className="text-red-400 mt-1">Failed deliveries: {bulkResult.failed}</p>}
                </div>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="w-full py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg text-xs font-semibold cursor-pointer border border-[#30363d]"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendBulkNotification} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Notification Type
                  </label>
                  <select
                    value={bulkNotificationType}
                    onChange={(e) => setBulkNotificationType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-gray-300 text-xs rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="custom">Custom Message</option>
                    <option value="expiry_warning">Expiry warning</option>
                    <option value="renewal_reminder">Renewal reminder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Delivery Channel
                  </label>
                  <select
                    value={bulkChannel}
                    onChange={(e) => setBulkChannel(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-gray-300 text-xs rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="in_app">In-App Alert Only</option>
                    <option value="email">Email Only</option>
                    <option value="both">Both (Email & In-App)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    <span>Message Body</span>
                    <span className={cn(bulkMessage.length > 500 ? "text-red-400" : "text-gray-500")}>
                      {bulkMessage.length}/500 chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    placeholder="Enter broadcast contents to deliver..."
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white text-xs rounded-lg focus:outline-none focus:border-indigo-500 resize-none font-sans"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={sendingBulk || !bulkMessage.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  {sendingBulk ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Broadcast...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Notifications</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
