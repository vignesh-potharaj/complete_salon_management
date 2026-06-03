'use client';

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  History, 
  Users, 
  Mail, 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Calendar,
  MessageSquare
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { AdminUser, NotificationRecord } from '../../types';
import { formatDate } from '../../lib/utils';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');
  const [salons, setSalons] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form States
  const [targetType, setTargetType] = useState<'all' | 'status' | 'plan'>('all');
  const [targetStatus, setTargetStatus] = useState('active');
  const [targetPlan, setTargetPlan] = useState('starter');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'email' | 'in_app' | 'both'>('in_app');
  const [notificationType, setNotificationType] = useState('custom');

  // Confirmation Modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  // History timeline compiled state
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Fetch Salons list for compilation
  const loadSalonsData = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers({ limit: 1000 }); // get all users
      setSalons(data.users);
      
      // Compile notification history from all users
      const compiledNotifs: any[] = [];
      data.users.forEach(u => {
        if (u.notificationsSent) {
          u.notificationsSent.forEach(n => {
            compiledNotifs.push({
              ...n,
              salonName: u.salonName,
              ownerName: u.name,
              userId: u.userId
            });
          });
        }
      });

      // Sort by date desc
      compiledNotifs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      setHistoryList(compiledNotifs);
    } catch (err) {
      console.error(err);
      setError('Could not establish backend session. Displaying sandbox logs.');
      
      // Fallback sandbox history
      const mockHistory = [
        {
          type: 'activated',
          message: 'Your Growth subscription was activated successfully.',
          sentAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          channel: 'in_app',
          salonName: 'Glow Premium Salon',
          userId: 'glow-salon'
        },
        {
          type: 'expiry_warning',
          message: 'Your Starter subscription will expire in 7 days. Please check invoice details.',
          sentAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          channel: 'email',
          salonName: 'Scissors Craft Lab',
          userId: 'scissors-craft'
        }
      ];
      setHistoryList(mockHistory);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalonsData();
  }, []);

  // Compute recipient list based on active targets
  const getRecipients = () => {
    if (targetType === 'all') {
      return salons;
    }
    if (targetType === 'status') {
      return salons.filter(s => s.subscriptionStatus === targetStatus);
    }
    if (targetType === 'plan') {
      return salons.filter(s => s.subscriptionPlan === targetPlan);
    }
    return [];
  };

  const recipients = getRecipients();

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || recipients.length === 0) return;
    setShowConfirm(true);
  };

  const triggerDispatch = async () => {
    setSending(true);
    setResult(null);

    const filterObj: Record<string, any> = {};
    if (targetType === 'status') filterObj.subscriptionStatus = targetStatus;
    if (targetType === 'plan') filterObj.subscriptionPlan = targetPlan;

    try {
      const res = await adminApi.notifyBulk({
        message,
        channel,
        notificationType,
        filter: targetType !== 'all' ? filterObj : {}
      });
      
      setResult(res);
      setMessage('');
      loadSalonsData(); // reload log history
    } catch (err) {
      console.error(err);
      setResult({ sent: 0, failed: recipients.length });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-[#21262d] gap-2 select-none">
        <button
          onClick={() => { setActiveTab('send'); setResult(null); }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'send'
              ? 'border-indigo-500 text-white bg-indigo-500/5'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Compose Broadcast</span>
        </button>
        <button
          onClick={() => { setActiveTab('history'); loadSalonsData(); }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'border-indigo-500 text-white bg-indigo-500/5'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Broadcast History</span>
        </button>
      </div>

      {activeTab === 'send' ? (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Form Composer (6 columns) */}
          <div className="lg:col-span-6 bg-[#161b22] border border-[#21262d] rounded-xl p-6 shadow-md relative">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-indigo-400" />
              <span>Broadcast Composer</span>
            </h3>

            {result ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                  <p className="font-bold mb-1">Broadcast Completed</p>
                  <p>Successfully processed: {result.sent} messages/alerts</p>
                  {result.failed > 0 && <p className="text-red-400 mt-1">Failed deliveries: {result.failed}</p>}
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  Write Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendSubmit} className="space-y-5 text-xs">
                {/* Target Type */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      targetType === 'all'
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : 'border-[#21262d] bg-[#0d1117] text-gray-400 hover:text-white'
                    }`}
                  >
                    All Salons
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('status')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      targetType === 'status'
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : 'border-[#21262d] bg-[#0d1117] text-gray-400 hover:text-white'
                    }`}
                  >
                    Filter by Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('plan')}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      targetType === 'plan'
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                        : 'border-[#21262d] bg-[#0d1117] text-gray-400 hover:text-white'
                    }`}
                  >
                    Filter by Plan
                  </button>
                </div>

                {/* Target Details */}
                {targetType === 'status' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Select Salon Status
                    </label>
                    <select
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="trial">Trial Accounts</option>
                      <option value="active">Active Members</option>
                      <option value="expired">Expired Members</option>
                      <option value="terminated">Suspended Accounts</option>
                    </select>
                  </div>
                )}

                {targetType === 'plan' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Select Salon Plan
                    </label>
                    <select
                      value={targetPlan}
                      onChange={(e) => setTargetPlan(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="starter">Starter Plan</option>
                      <option value="growth">Growth Plan</option>
                      <option value="pro">Pro Plan</option>
                    </select>
                  </div>
                )}

                {/* Delivery Channel */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Delivery Methods
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="in_app">In-App Banner Alert Only</option>
                    <option value="email">Email Inbox Message Only</option>
                    <option value="both">Both (Email and In-App)</option>
                  </select>
                </div>

                {/* Alert Type */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Notification Category
                  </label>
                  <select
                    value={notificationType}
                    onChange={(e) => setNotificationType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="custom">General Custom Notification</option>
                    <option value="expiry_warning">Expiry warning alert</option>
                    <option value="renewal_reminder">Renewal invoice reminder</option>
                  </select>
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    <span>Message Body</span>
                    <span className={message.length > 500 ? 'text-red-400' : 'text-gray-500'}>
                      {message.length}/500 chars
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    maxLength={500}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide alert content description..."
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 resize-none font-sans"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={!message.trim() || recipients.length === 0}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Send to Targets</span>
                </button>
              </form>
            )}
          </div>

          {/* Recipients Preview Area (4 columns) */}
          <div className="lg:col-span-4 bg-[#161b22] border border-[#21262d] rounded-xl p-6 shadow-md text-xs space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#21262d] pb-2 flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-indigo-400" />
              <span>Target Summary</span>
            </h3>

            <div className="p-4 bg-[#0d1117] border border-[#21262d] rounded-xl">
              <p className="text-gray-500">Recipient Count</p>
              <h4 className="text-3xl font-bold text-white mt-1 font-mono">{recipients.length}</h4>
              <p className="text-[10px] text-indigo-400 mt-2">Salons matching selected criteria</p>
            </div>

            {recipients.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider">Preview list:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-[#21262d] rounded-lg p-2 bg-[#0d1117]/50 divide-y divide-[#21262d]/50">
                  {recipients.map(salon => (
                    <div key={salon.userId} className="pt-2 first:pt-0">
                      <div className="font-semibold text-gray-200">{salon.salonName}</div>
                      <div className="text-[10px] text-gray-500">{salon.email}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Timeline Tab */
        <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-6 shadow-md">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-indigo-400" />
            <span>Broadcast log records</span>
          </h3>

          {historyList.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              No recorded alerts found in user history log.
            </div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#21262d] text-gray-400 font-semibold select-none pb-2">
                    <th className="py-2.5">Sent At</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5">Salon</th>
                    <th className="py-2.5">Channel</th>
                    <th className="py-2.5">Message Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262d]/40">
                  {historyList.map((log, idx) => (
                    <tr key={idx} className="hover:bg-[#161b22]/50">
                      <td className="py-3 text-gray-400">
                        {formatDate(log.sentAt, true)}
                      </td>
                      <td className="py-3">
                        <span className="px-1.5 py-0.5 rounded uppercase text-[10px] font-semibold bg-indigo-500/10 text-indigo-400">
                          {log.type}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-white">{log.salonName}</div>
                        <div className="text-[10px] text-gray-500">{log.userId}</div>
                      </td>
                      <td className="py-3 text-gray-300 uppercase font-mono text-[10px]">
                        {log.channel}
                      </td>
                      <td className="py-3 text-gray-300 max-w-sm truncate" title={log.message}>
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-xs">
            <h3 className="text-base font-bold text-white mb-2">Send Broadcast Confirmation</h3>
            <p className="text-gray-400 leading-relaxed">
              Are you sure you want to broadcast this message to <strong className="text-indigo-400">{recipients.length}</strong> selected salons?
            </p>
            <div className="p-3 bg-[#0d1117] rounded-lg border border-[#21262d] my-4 text-gray-300 italic max-h-32 overflow-y-auto">
              "{message}"
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 border border-[#30363d] text-gray-300 hover:bg-[#21262d] hover:text-white rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  triggerDispatch();
                }}
                disabled={sending}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
