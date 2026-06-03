'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Plus, 
  CreditCard, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { RazorpayPlan } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

export default function SettingsPage() {
  const [plans, setPlans] = useState<RazorpayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Plan Creator Form State
  const [planName, setPlanName] = useState('Starter Monthly');
  const [amount, setAmount] = useState('999');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [interval, setInterval] = useState('1');
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadPlans = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getRazorpayPlans();
      setPlans(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not connect to Razorpay plan storage. Displaying offline sandbox records.');
      setPlans([
        { _id: '1', planId: 'plan_starter_monthly', name: 'Starter Monthly Plan', amount: 999, period: 'monthly', interval: 1, createdAt: new Date().toISOString() },
        { _id: '2', planId: 'plan_growth_monthly', name: 'Growth Monthly Plan', amount: 2999, period: 'monthly', interval: 1, createdAt: new Date().toISOString() },
        { _id: '3', planId: 'plan_pro_monthly', name: 'Pro Monthly Plan', amount: 5999, period: 'monthly', interval: 1, createdAt: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccessMsg('');

    try {
      await adminApi.createRazorpayPlan({
        planName,
        amount: parseFloat(amount),
        period,
        interval: parseInt(interval)
      });
      setSuccessMsg('Razorpay plan registered and synchronized successfully!');
      setPlanName('');
      setAmount('');
      loadPlans();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.msg || 'Failed to submit plan register request to API.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fallback Banner */}
      {error && (
        <div className="p-3 bg-amber-500/10 border border-[#b91c1c]/25 text-amber-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid Layout: Composer on Left, Plans List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Column: Plan Creator (4 columns) */}
        <div className="lg:col-span-4 bg-[#161b22] border border-[#21262d] rounded-xl p-6 shadow-md h-fit">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-4.5 h-4.5 text-indigo-400" />
            <span>Create Razorpay Plan</span>
          </h3>
          <p className="text-[11px] text-gray-500 mb-5 leading-normal">
            Registering a plan immediately syncs it to your Razorpay business dashboard to issue payment links.
          </p>

          <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Plan Display Name
              </label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Starter Monthly"
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Amount (₹ INR)
              </label>
              <input
                type="number"
                min="10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2999"
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Billing Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Interval Frequency
                </label>
                <input
                  type="number"
                  min="1"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21262d] text-white rounded-lg focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer mt-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering Plan...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Submit Plan</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Plans List (6 columns) */}
        <div className="lg:col-span-6 bg-[#161b22] border border-[#21262d] rounded-xl p-6 shadow-md">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-indigo-400" />
            <span>Synchronized Plans</span>
          </h3>

          {loading ? (
            <div className="h-60 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              No Razorpay subscription plans synchronized in system records.
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div 
                  key={plan._id} 
                  className="p-4 bg-[#0d1117] border border-[#21262d] rounded-xl hover:border-gray-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">{plan.name}</h4>
                    <p className="text-[10px] text-gray-500 font-mono">ID: {plan.planId}</p>
                    <p className="text-[10px] text-indigo-400">Created: {formatDate(plan.createdAt, true)}</p>
                  </div>

                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase">Pricing</p>
                      <p className="text-sm font-bold text-white font-mono">{formatCurrency(plan.amount)}</p>
                      <p className="text-[9px] text-indigo-400 capitalize">
                        Every {plan.interval} {plan.period}(s)
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
