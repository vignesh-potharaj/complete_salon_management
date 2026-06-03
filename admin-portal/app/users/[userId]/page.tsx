'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  User as UserIcon, 
  Calendar, 
  CreditCard, 
  Bell, 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  Trash2, 
  Send, 
  Link2,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { adminApi } from '../../../lib/api';
import { AdminUser, PaymentRecord, NotificationRecord } from '../../../types';
import { formatDate, formatCurrency, cn } from '../../../lib/utils';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  // Data Loading States
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal Visibility States
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [isPaymentLinkOpen, setIsPaymentLinkOpen] = useState(false);

  // Form States
  // 1. Activate Form
  const [activatePlan, setActivatePlan] = useState('starter');
  const [activateDuration, setActivateDuration] = useState('30');
  const [customDays, setCustomDays] = useState('');
  const [submittingActivate, setSubmittingActivate] = useState(false);

  // 2. Terminate Form
  const [terminateReason, setTerminateReason] = useState('');
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [submittingTerminate, setSubmittingTerminate] = useState(false);

  // 3. Notify Form
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyChannel, setNotifyChannel] = useState<'email' | 'in_app' | 'both'>('in_app');
  const [notifyType, setNotifyType] = useState('custom');
  const [submittingNotify, setSubmittingNotify] = useState(false);

  // 4. Payment Link Form
  const [linkPlanId, setLinkPlanId] = useState('');
  const [linkCycles, setLinkCycles] = useState('12');
  const [plansList, setPlansList] = useState<any[]>([]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [submittingLink, setSubmittingLink] = useState(false);

  // Load User Details
  const loadUserDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getUserById(userId);
      setUser(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch user from API. Showing sandboxed mock details.');
      
      // Fallback user details for build & standalone testing
      setUser({
        _id: '1',
        userId: userId,
        name: 'Jane Doe',
        salonName: 'Glow Premium Salon',
        email: 'jane@glowsalon.com',
        isEmailVerified: true,
        subscriptionStatus: 'active',
        subscriptionPlan: 'growth',
        subscriptionStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        subscriptionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        razorpayCustomerId: 'cust_Glow1234',
        razorpaySubscriptionId: 'sub_GlowSub5678',
        lastPaymentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        lastPaymentAmount: 2999,
        isActive: true,
        adminNotes: 'Requested direct premium support setup',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        paymentHistory: [
          {
            razorpayPaymentId: 'pay_capture_111',
            amount: 2999,
            currency: 'INR',
            status: 'captured',
            plan: 'growth',
            paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            razorpayPaymentId: 'pay_fail_222',
            amount: 2999,
            currency: 'INR',
            status: 'failed',
            plan: 'growth',
            paidAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString()
          }
        ],
        notificationsSent: [
          {
            type: 'activated',
            message: 'Your subscription has been activated',
            sentAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            channel: 'in_app'
          },
          {
            type: 'custom',
            message: 'Welcome to SalonPro platform!',
            sentAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            channel: 'both'
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserDetails();
    // Load Razorpay plans list for link generation
    adminApi.getRazorpayPlans()
      .then(data => setPlansList(data))
      .catch(() => setPlansList([
        { planId: 'plan_starter_monthly', name: 'Starter Monthly', amount: 999 },
        { planId: 'plan_growth_monthly', name: 'Growth Monthly', amount: 2999 },
        { planId: 'plan_pro_monthly', name: 'Pro Monthly', amount: 5999 }
      ]));
  }, [userId]);

  // Actions Handlers
  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingActivate(true);
    const duration = activateDuration === 'custom' ? parseInt(customDays) : parseInt(activateDuration);

    try {
      const updated = await adminApi.activateSubscription(userId, {
        plan: activatePlan,
        durationDays: duration
      });
      setUser(updated);
      setIsActivateOpen(false);
    } catch (err) {
      console.error(err);
      alert('Manual activation api failed. Refreshed fallback.');
    } finally {
      setSubmittingActivate(false);
    }
  };

  const handleTerminateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmTerminate) return;
    setSubmittingTerminate(true);

    try {
      const updated = await adminApi.terminateSubscription(userId, {
        reason: terminateReason
      });
      setUser(updated);
      setIsTerminateOpen(false);
      setTerminateReason('');
      setConfirmTerminate(false);
    } catch (err) {
      console.error(err);
      alert('Manual termination api failed.');
    } finally {
      setSubmittingTerminate(false);
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingNotify(true);

    try {
      await adminApi.notifyUser(userId, {
        message: notifyMessage,
        channel: notifyChannel,
        notificationType: notifyType
      });
      setIsNotifyOpen(false);
      setNotifyMessage('');
      loadUserDetails(); // reload history timeline
    } catch (err) {
      console.error(err);
      alert('Notification api dispatch failed.');
    } finally {
      setSubmittingNotify(false);
    }
  };

  const handleGeneratePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkPlanId) return;
    setSubmittingLink(true);
    setGeneratedLink('');

    try {
      const res = await adminApi.createRazorpaySubscription(userId, {
        planId: linkPlanId,
        totalCount: parseInt(linkCycles)
      });
      setGeneratedLink(res.shortUrl);
      // reload user info (customer id, sub id updated)
      loadUserDetails();
    } catch (err) {
      console.error(err);
      alert('Razorpay Subscription Link API call failed.');
    } finally {
      setSubmittingLink(false);
    }
  };

  // Helper computations
  const getDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) return 0;
    const end = new Date(endDateStr);
    const diffTime = end.getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
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

  if (loading) {
    return (
      <div className="min-h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>User details could not be found or loaded.</span>
      </div>
    );
  }

  const daysLeft = getDaysRemaining(user.subscriptionEndDate);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/users')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Salon Directory</span>
        </button>
      </div>

      {/* Fallback Banner */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Split Layout: 60% Left, 40% Right */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* LEFT PANEL (60% / 6 columns) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* SECTION 1: PROFILE */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-[#21262d] pb-2 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-indigo-400" />
              <span>Salon Profile Details</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-gray-500">Salon Name</p>
                <p className="text-white font-medium mt-0.5">{user.salonName}</p>
              </div>
              <div>
                <p className="text-gray-500">Owner Name</p>
                <p className="text-white font-medium mt-0.5">{user.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Email Address</p>
                <p className="text-white font-medium mt-0.5">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Client ID / Slug</p>
                <p className="text-white font-mono mt-0.5">{user.userId}</p>
              </div>
              <div>
                <p className="text-gray-500">Registered Date</p>
                <p className="text-white mt-0.5">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-500">System Access</p>
                <span className={cn(
                  "inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-1",
                  user.isActive ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                )}>
                  {user.isActive ? 'Access Active' : 'Access Blocked'}
                </span>
              </div>
            </div>
            
            {user.adminNotes && (
              <div className="mt-4 p-3 bg-[#0d1117] border border-[#21262d] rounded-lg">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Administrative Notes</p>
                <p className="text-gray-300 text-xs">{user.adminNotes}</p>
              </div>
            )}
          </div>

          {/* SECTION 2: SUBSCRIPTION STATUS */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-[#21262d] pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Subscription & Billing Status</span>
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={cn("px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider", getStatusBadge(user.subscriptionStatus))}>
                  {user.subscriptionStatus === 'terminated' ? 'suspended' : user.subscriptionStatus}
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Subscription Plan</h4>
                  <p className="text-sm font-bold text-white uppercase">{user.subscriptionPlan}</p>
                </div>
              </div>

              {user.subscriptionStatus === 'active' && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-2 text-right shrink-0">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">Remaining Days</p>
                  <p className="text-lg font-mono font-bold text-indigo-400 mt-0.5">{daysLeft} Days</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs border-t border-[#21262d]/40">
              <div>
                <p className="text-gray-500">Subscription Start Date</p>
                <p className="text-white mt-0.5">{formatDate(user.subscriptionStartDate)}</p>
              </div>
              <div>
                <p className="text-gray-500">Subscription End / Expiry Date</p>
                <p className="text-white mt-0.5">{formatDate(user.subscriptionEndDate)}</p>
              </div>
              <div>
                <p className="text-gray-500">Razorpay Customer ID</p>
                <p className="text-white font-mono mt-0.5">{user.razorpayCustomerId || 'No Customer Connected'}</p>
              </div>
              <div>
                <p className="text-gray-500">Razorpay Subscription ID</p>
                <p className="text-white font-mono mt-0.5">{user.razorpaySubscriptionId || 'No Subscription Link Created'}</p>
              </div>
            </div>
          </div>

          {/* SECTION 3: PAYMENT LOGS */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-[#21262d] pb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Captured & Attempted Payments</span>
            </h3>

            {!user.paymentHistory || user.paymentHistory.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs">
                No billing statements found in user record history.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#21262d] text-gray-500 font-medium">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Statement ID</th>
                      <th className="py-2.5">Plan</th>
                      <th className="py-2.5">Amount</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d]/50">
                    {user.paymentHistory.map((payment, i) => (
                      <tr key={payment.razorpayPaymentId || i} className="hover:bg-[#161b22]/30">
                        <td className="py-2.5 text-gray-300">
                          {formatDate(payment.paidAt, true)}
                        </td>
                        <td className="py-2.5 text-gray-400 font-mono text-[10px]">
                          {payment.razorpayPaymentId}
                        </td>
                        <td className="py-2.5 text-white uppercase font-medium">
                          {payment.plan}
                        </td>
                        <td className="py-2.5 text-white font-mono">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize",
                            payment.status === 'captured' 
                              ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                              : payment.status === 'failed'
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          )}>
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 4: NOTIFICATIONS LOG */}
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-[#21262d] pb-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span>Administrative Logs & Sent Notifications</span>
            </h3>

            {!user.notificationsSent || user.notificationsSent.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs">
                No alerts or notifications dispatched.
              </div>
            ) : (
              <div className="relative border-l border-[#21262d] pl-4 ml-2 space-y-5 py-2 text-xs">
                {user.notificationsSent.slice().reverse().map((notif, index) => (
                  <div key={index} className="relative">
                    {/* Circle Dot Marker */}
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#161b22] border-2 border-indigo-500 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-white uppercase text-[10px] tracking-wide bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">
                          {notif.type}
                        </span>
                        <span className="text-[10px] text-gray-500">{formatDate(notif.sentAt, true)}</span>
                      </div>
                      <p className="text-gray-300 mt-1.5 leading-relaxed">{notif.message}</p>
                      <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2 uppercase tracking-widest">
                        <span>Channel:</span>
                        <strong className="text-gray-400">{notif.channel}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT ACTION PANEL (40% / 4 columns) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 shadow-sm space-y-4 lg:sticky lg:top-20">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#21262d] pb-2">
              Management Desk
            </h3>

            <div className="flex flex-col gap-3">
              {/* Activate Subscription Button */}
              <button
                onClick={() => setIsActivateOpen(true)}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Activate Subscription</span>
              </button>

              {/* Generate Payment Link Button */}
              <button
                onClick={() => {
                  setGeneratedLink('');
                  setIsPaymentLinkOpen(true);
                }}
                className="w-full py-3 px-4 bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d] font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Link2 className="w-4 h-4 text-indigo-400" />
                <span>Generate Billing Link</span>
              </button>

              {/* Send Notification Button */}
              <button
                onClick={() => setIsNotifyOpen(true)}
                className="w-full py-3 px-4 bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d] font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Bell className="w-4 h-4 text-yellow-400" />
                <span>Send Alert / Message</span>
              </button>

              {/* Terminate Account Button */}
              <button
                onClick={() => setIsTerminateOpen(true)}
                disabled={user.subscriptionStatus === 'terminated'}
                className="w-full py-3 px-4 bg-red-600/10 hover:bg-red-600 hover:text-white border border-red-500/20 text-red-400 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Suspend Account</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: ACTIVATE MANUAL SUBSCRIPTION */}
      {isActivateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-4">Manual Activation Bypass</h3>
            
            <form onSubmit={handleActivateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Select Subscription Plan
                </label>
                <select
                  value={activatePlan}
                  onChange={(e) => setActivatePlan(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="starter">Starter Plan</option>
                  <option value="growth">Growth Plan</option>
                  <option value="pro">Pro Plan</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Duration Period
                </label>
                <select
                  value={activateDuration}
                  onChange={(e) => setActivateDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="30">30 Days (1 Month)</option>
                  <option value="90">90 Days (3 Months)</option>
                  <option value="180">180 Days (6 Months)</option>
                  <option value="365">365 Days (1 Year)</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>

              {activateDuration === 'custom' && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Custom Number of Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="Enter validity period in days"
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsActivateOpen(false)}
                  className="flex-1 py-2 border border-[#30363d] text-gray-300 hover:bg-[#21262d] hover:text-white rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingActivate}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  {submittingActivate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Activate Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TERMINATE / SUSPEND SUBSCRIPTION */}
      {isTerminateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-red-400 mb-2">Suspend Account Access</h3>
            <p className="text-xs text-gray-500 mb-4">
              This action terminates subscription status and locks dashboard tools for <strong>{user.salonName}</strong> immediately.
            </p>
            
            <form onSubmit={handleTerminateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Suspension Reason
                </label>
                <textarea
                  rows={3}
                  value={terminateReason}
                  onChange={(e) => setTerminateReason(e.target.value)}
                  placeholder="Specify violation, non-payment, or custom reason..."
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-red-500 resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex items-center gap-2 bg-[#0d1117] p-2.5 rounded-lg border border-[#21262d]">
                <input
                  type="checkbox"
                  id="confirm-term"
                  checked={confirmTerminate}
                  onChange={(e) => setConfirmTerminate(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-900 text-red-600 focus:ring-red-500 cursor-pointer"
                  required
                />
                <label htmlFor="confirm-term" className="text-[10px] font-medium text-gray-400 cursor-pointer select-none">
                  Confirm immediate suspension order
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsTerminateOpen(false)}
                  className="flex-1 py-2 border border-[#30363d] text-gray-300 hover:bg-[#21262d] hover:text-white rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTerminate || !confirmTerminate}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-red-600/10"
                >
                  {submittingTerminate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Suspend Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND CUSTOM NOTIFICATION */}
      {isNotifyOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-4">Send Alert Message</h3>
            
            <form onSubmit={handleNotifySubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Notification Type
                </label>
                <select
                  value={notifyType}
                  onChange={(e) => setNotifyType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="custom">General Custom Notification</option>
                  <option value="expiry_warning">Expiry warning alert</option>
                  <option value="renewal_reminder">Renewal invoice reminder</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Delivery Channels
                </label>
                <select
                  value={notifyChannel}
                  onChange={(e) => setNotifyChannel(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="in_app">In-App Banner Alert Only</option>
                  <option value="email">Email Inbox Message Only</option>
                  <option value="both">Both (Email and In-App)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  placeholder="Type alert dispatch details here..."
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsNotifyOpen(false)}
                  className="flex-1 py-2 border border-[#30363d] text-gray-300 hover:bg-[#21262d] hover:text-white rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNotify || !notifyMessage.trim()}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  {submittingNotify && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Dispatch Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE BILLING LINK */}
      {isPaymentLinkOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-4">Generate Razorpay Payment Link</h3>

            {generatedLink ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                  <p className="text-gray-400">Successfully generated. Share this URL with the salon owner:</p>
                  <div className="flex items-center gap-2 bg-[#0d1117] p-2 rounded border border-[#21262d] overflow-hidden">
                    <span className="text-indigo-400 font-mono select-all truncate flex-1">{generatedLink}</span>
                    <button
                      onClick={() => copyToClipboard(generatedLink)}
                      className="p-1 hover:bg-[#21262d] rounded text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setIsPaymentLinkOpen(false)}
                  className="w-full py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded-lg font-semibold cursor-pointer border border-[#30363d]"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleGeneratePaymentLink} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Select Razorpay Subscription Plan
                  </label>
                  <select
                    value={linkPlanId}
                    onChange={(e) => setLinkPlanId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                    required
                  >
                    <option value="">-- Select Active Plan --</option>
                    {plansList.map(plan => (
                      <option key={plan.planId} value={plan.planId}>
                        {plan.name} — ₹{plan.amount} ({plan.period})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Billing Cycle Counts
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={linkCycles}
                    onChange={(e) => setLinkCycles(e.target.value)}
                    placeholder="Enter number of payments to issue (e.g. 12)"
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPaymentLinkOpen(false)}
                    className="flex-1 py-2 border border-[#30363d] text-gray-300 hover:bg-[#21262d] hover:text-white rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLink || !linkPlanId}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                  >
                    {submittingLink && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Generate Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
