const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const User = require('../models/User');
const Plan = require('../models/Plan');
const emailService = require('../emailService');

// Initialize Razorpay SDK. Gracefully mock/fall back if env variables are not present.
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

/**
 * POST /api/admin/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({ msg: 'Admin credentials not configured in environment' });
    }

    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ msg: 'Invalid email or password' });
    }

    const payload = { role: 'superadmin' };
    const token = jwt.sign(payload, process.env.ADMIN_JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      expiresIn: 86400 // 1 day in seconds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during login' });
  }
});

/**
 * GET /api/admin/users
 * Query params: page, limit, search, status, plan, sortBy, sortOrder
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status;
    const plan = req.query.plan;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { salonName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.subscriptionStatus = status;
    }

    if (plan) {
      query.subscriptionPlan = plan;
    }

    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-passwordHash -emailVerifyCode -resetPasswordCode -resetPasswordExpires -emailVerifyExpires')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error retrieving users' });
  }
});

/**
 * GET /api/admin/users/expiring-soon
 */
router.get('/users/expiring-soon', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.daysAhead) || 7;
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const users = await User.find({
      subscriptionEndDate: { $gte: now, $lte: futureDate },
      subscriptionStatus: { $ne: 'terminated' }
    }).select('-passwordHash -emailVerifyCode -resetPasswordCode');

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error retrieving expiring users' });
  }
});

/**
 * GET /api/admin/users/:userId
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ userId }).select('-passwordHash -emailVerifyCode -resetPasswordCode');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error retrieving user details' });
  }
});

/**
 * PATCH /api/admin/users/:userId/subscription
 */
router.patch('/users/:userId/subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    const { subscriptionStatus, subscriptionPlan, subscriptionEndDate, adminNotes } = req.body;

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (subscriptionStatus !== undefined) user.subscriptionStatus = subscriptionStatus;
    if (subscriptionPlan !== undefined) user.subscriptionPlan = subscriptionPlan;
    if (subscriptionEndDate !== undefined) user.subscriptionEndDate = subscriptionEndDate ? new Date(subscriptionEndDate) : null;
    if (adminNotes !== undefined) user.adminNotes = adminNotes;

    console.log(`[ADMIN ACTION] Subscription updated for ${userId}: status=${subscriptionStatus}, plan=${subscriptionPlan}`);

    await user.save();

    const updatedUser = await User.findOne({ userId }).select('-passwordHash -emailVerifyCode -resetPasswordCode');
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error updating subscription' });
  }
});

/**
 * POST /api/admin/users/:userId/activate
 */
router.post('/users/:userId/activate', async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan, durationDays } = req.body;

    if (!plan || !durationDays) {
      return res.status(400).json({ msg: 'Plan and durationDays are required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + parseInt(durationDays));

    user.subscriptionStatus = 'active';
    user.subscriptionPlan = plan;
    user.subscriptionStartDate = now;
    user.subscriptionEndDate = endDate;
    user.isActive = true;

    user.notificationsSent.push({
      type: 'activated',
      message: 'Your subscription has been activated',
      sentAt: now,
      channel: 'in_app'
    });

    await user.save();

    // Send activation email
    try {
      await emailService.sendSubscriptionActivated(user, plan, endDate);
    } catch (emailErr) {
      console.error('SMTP activation email failed, fallback logged in emailService.js');
    }

    const updatedUser = await User.findOne({ userId }).select('-passwordHash -emailVerifyCode -resetPasswordCode');
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error activating subscription' });
  }
});

/**
 * POST /api/admin/users/:userId/terminate
 */
router.post('/users/:userId/terminate', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ msg: 'Termination reason is required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const now = new Date();

    user.subscriptionStatus = 'terminated';
    user.isActive = false;
    user.adminNotes = reason;

    user.notificationsSent.push({
      type: 'terminated',
      message: `Your account has been suspended. Reason: ${reason}`,
      sentAt: now,
      channel: 'in_app'
    });

    await user.save();

    // Send termination email
    try {
      await emailService.sendSubscriptionTerminated(user, reason);
    } catch (emailErr) {
      console.error('SMTP termination email failed, fallback logged in emailService.js');
    }

    const updatedUser = await User.findOne({ userId }).select('-passwordHash -emailVerifyCode -resetPasswordCode');
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error terminating subscription' });
  }
});

/**
 * POST /api/admin/users/:userId/notify
 */
router.post('/users/:userId/notify', async (req, res) => {
  try {
    const { userId } = req.params;
    const { message, channel, notificationType } = req.body;

    if (!message || !channel || !notificationType) {
      return res.status(400).json({ msg: 'Message, channel, and notificationType are required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const now = new Date();

    user.notificationsSent.push({
      type: notificationType,
      message,
      sentAt: now,
      channel
    });

    await user.save();

    // If channel is email or both, send email
    if (channel === 'email' || channel === 'both') {
      try {
        await emailService.sendCustomNotification(user, message);
      } catch (emailErr) {
        console.error('SMTP notification email failed');
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error sending notification' });
  }
});

/**
 * POST /api/admin/users/notify-bulk
 */
router.post('/users/notify-bulk', async (req, res) => {
  try {
    const { userIds, message, channel, notificationType, filter } = req.body;

    if (!message || !channel || !notificationType) {
      return res.status(400).json({ msg: 'Message, channel, and notificationType are required' });
    }

    let targetUsers = [];
    if (filter) {
      targetUsers = await User.find(filter);
    } else if (userIds && userIds.length > 0) {
      targetUsers = await User.find({ userId: { $in: userIds } });
    } else {
      return res.status(400).json({ msg: 'Either userIds or a filter must be provided' });
    }

    let sent = 0;
    let failed = 0;
    const now = new Date();

    for (const user of targetUsers) {
      try {
        user.notificationsSent.push({
          type: notificationType,
          message,
          sentAt: now,
          channel
        });
        await user.save();

        if (channel === 'email' || channel === 'both') {
          await emailService.sendCustomNotification(user, message);
        }
        sent++;
      } catch (err) {
        console.error(`Bulk notify failed for ${user.userId}:`, err);
        failed++;
      }
    }

    res.json({ sent, failed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error in bulk notification' });
  }
});

/**
 * GET /api/admin/razorpay/plans
 */
router.get('/razorpay/plans', async (req, res) => {
  try {
    const plans = await Plan.find({}).sort({ createdAt: -1 });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching plans' });
  }
});

/**
 * POST /api/admin/razorpay/create-plan
 * Body: { planName, amount, period ('monthly'|'yearly'), interval }
 */
router.post('/razorpay/create-plan', async (req, res) => {
  try {
    const { planName, amount, period, interval } = req.body;

    if (!planName || !amount || !period) {
      return res.status(400).json({ msg: 'planName, amount, and period are required' });
    }

    // Convert amount to paise for Razorpay
    const amountInPaise = Math.round(amount * 100);

    let planId;
    if (razorpay) {
      try {
        const rpPlan = await razorpay.plans.create({
          period: period, // monthly/yearly
          interval: parseInt(interval) || 1,
          item: {
            name: planName,
            amount: amountInPaise,
            currency: 'INR'
          }
        });
        planId = rpPlan.id;
      } catch (rpErr) {
        console.error('Razorpay Plan creation failed:', rpErr);
        return res.status(500).json({ msg: 'Razorpay Plan API error', error: rpErr.message });
      }
    } else {
      // Mock plan ID if no Razorpay configured
      planId = 'plan_mock_' + Math.random().toString(36).substr(2, 9);
    }

    const newPlan = new Plan({
      planId,
      name: planName,
      amount,
      period,
      interval: parseInt(interval) || 1
    });

    await newPlan.save();
    res.json(newPlan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error creating plan' });
  }
});

/**
 * POST /api/admin/users/:userId/create-subscription
 */
router.post('/users/:userId/create-subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId, totalCount } = req.body;

    if (!planId) {
      return res.status(400).json({ msg: 'planId is required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    let customerId = user.razorpayCustomerId;
    if (!customerId) {
      if (razorpay) {
        try {
          const customer = await razorpay.customers.create({
            name: user.name,
            email: user.email,
            contact: '9999999999'
          });
          customerId = customer.id;
        } catch (custErr) {
          console.error('Razorpay Customer creation failed:', custErr);
          return res.status(500).json({ msg: 'Razorpay Customer API error', error: custErr.message });
        }
      } else {
        customerId = 'cust_mock_' + Math.random().toString(36).substr(2, 9);
      }
      user.razorpayCustomerId = customerId;
      await user.save();
    }

    let subscriptionId;
    let shortUrl;

    if (razorpay) {
      try {
        const sub = await razorpay.subscriptions.create({
          plan_id: planId,
          customer_id: customerId,
          total_count: parseInt(totalCount) || 12,
          quantity: 1,
          customer_notify: 1
        });
        subscriptionId = sub.id;
        shortUrl = sub.short_url;
      } catch (subErr) {
        console.error('Razorpay Subscription creation failed:', subErr);
        return res.status(500).json({ msg: 'Razorpay Subscription API error', error: subErr.message });
      }
    } else {
      subscriptionId = 'sub_mock_' + Math.random().toString(36).substr(2, 9);
      shortUrl = `https://checkout.razorpay.com/v1/checkout.html?subscription_id=${subscriptionId}`;
    }

    user.razorpaySubscriptionId = subscriptionId;
    await user.save();

    res.json({ subscriptionId, shortUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error creating subscription' });
  }
});

/**
 * POST /api/admin/razorpay/webhook
 * Public endpoint (no adminAuthMiddleware)
 */
router.post('/razorpay/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return res.status(400).json({ msg: 'Missing signature header' });
    }

    // Verify webhook signature
    if (secret) {
      const shasum = crypto.createHmac('sha256', secret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        console.error('[WEBHOOK] Webhook signature verification failed');
        return res.status(400).json({ msg: 'Invalid signature' });
      }
    }

    const { event, payload } = req.body;
    console.log(`[WEBHOOK RECEIVED] Razorpay event: ${event}`);

    // Immediately respond with 200 OK
    res.status(200).json({ received: true });

    // Handle webhook event asynchronously
    if (event === 'payment.captured') {
      const payment = payload.payment.entity;
      const customerId = payment.customer_id;
      const subscriptionId = payment.subscription_id;
      const email = payment.email;

      const user = await User.findOne({
        $or: [
          { razorpaySubscriptionId: subscriptionId },
          { razorpayCustomerId: customerId },
          { email: email }
        ]
      });

      if (user) {
        user.subscriptionStatus = 'active';
        user.isActive = true;

        const now = new Date();
        const currentEnd = user.subscriptionEndDate && user.subscriptionEndDate > now ? user.subscriptionEndDate : now;
        // Extend subscription by 30 days
        user.subscriptionEndDate = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
        user.lastPaymentDate = now;
        user.lastPaymentAmount = payment.amount / 100;

        user.paymentHistory.push({
          razorpayPaymentId: payment.id,
          amount: payment.amount / 100,
          currency: payment.currency || 'INR',
          status: 'captured',
          plan: user.subscriptionPlan,
          paidAt: now
        });

        await user.save();
        await emailService.sendSubscriptionActivated(user, user.subscriptionPlan, user.subscriptionEndDate);
      }
    } else if (event === 'payment.failed') {
      const payment = payload.payment.entity;
      const customerId = payment.customer_id;
      const subscriptionId = payment.subscription_id;
      const email = payment.email;

      const user = await User.findOne({
        $or: [
          { razorpaySubscriptionId: subscriptionId },
          { razorpayCustomerId: customerId },
          { email: email }
        ]
      });

      if (user) {
        user.paymentHistory.push({
          razorpayPaymentId: payment.id,
          amount: payment.amount / 100,
          currency: payment.currency || 'INR',
          status: 'failed',
          plan: user.subscriptionPlan,
          paidAt: new Date()
        });

        user.notificationsSent.push({
          type: 'custom',
          message: `Your payment of ₹${payment.amount / 100} failed. Please verify your details.`,
          sentAt: new Date(),
          channel: 'in_app'
        });

        await user.save();
        await emailService.sendPaymentFailed(user, payment.amount / 100, `https://checkout.razorpay.com/v1/checkout.html?subscription_id=${subscriptionId}`);
      }
    } else if (event === 'subscription.cancelled' || event === 'subscription.completed') {
      const sub = payload.subscription.entity;
      const user = await User.findOne({ razorpaySubscriptionId: sub.id });

      if (user) {
        user.subscriptionStatus = 'expired';
        await user.save();
        await emailService.sendSubscriptionExpired(user, '');
      }
    }
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err);
    // Already responded 200, so we just log the error
  }
});

/**
 * GET /api/admin/analytics/overview
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const allUsers = await User.find({});
    
    let totalUsers = allUsers.length;
    let activeUsers = 0;
    let trialUsers = 0;
    let expiredUsers = 0;
    let terminatedUsers = 0;

    let mrr = 0;
    let planDistribution = { starter: 0, growth: 0, pro: 0 };
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    let newUsersThisMonth = 0;
    let churnedThisMonth = 0;
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;

    allUsers.forEach(u => {
      // Status counting
      if (u.subscriptionStatus === 'active') activeUsers++;
      else if (u.subscriptionStatus === 'trial') trialUsers++;
      else if (u.subscriptionStatus === 'expired') expiredUsers++;
      else if (u.subscriptionStatus === 'terminated') terminatedUsers++;

      // Plan distribution
      if (u.subscriptionPlan && planDistribution[u.subscriptionPlan] !== undefined) {
        planDistribution[u.subscriptionPlan]++;
      }

      // New users this month
      if (u.createdAt && u.createdAt >= startOfThisMonth) {
        newUsersThisMonth++;
      }

      // Churned this month
      if ((u.subscriptionStatus === 'expired' || u.subscriptionStatus === 'terminated') && u.subscriptionEndDate && u.subscriptionEndDate >= startOfThisMonth && u.subscriptionEndDate <= now) {
        churnedThisMonth++;
      }

      // Revenue and MRR calculations
      if (u.paymentHistory && u.paymentHistory.length > 0) {
        u.paymentHistory.forEach(pay => {
          if (pay.status === 'captured' && pay.paidAt) {
            const payDate = new Date(pay.paidAt);
            if (payDate >= thirtyDaysAgo) {
              mrr += pay.amount;
            }
            if (payDate >= startOfThisMonth) {
              revenueThisMonth += pay.amount;
            } else if (payDate >= startOfLastMonth && payDate < startOfThisMonth) {
              revenueLastMonth += pay.amount;
            }
          }
        });
      }
    });

    res.json({
      totalUsers,
      activeUsers,
      trialUsers,
      expiredUsers,
      terminatedUsers,
      mrr,
      arr: mrr * 12,
      newUsersThisMonth,
      churnedThisMonth,
      revenueThisMonth,
      revenueLastMonth,
      planDistribution
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error generating overview analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Query: period ('7d'|'30d'|'90d'|'1y')
 */
router.get('/analytics/revenue', async (req, res) => {
  try {
    const period = req.query.period || '30d';
    const allUsers = await User.find({});

    const dataPoints = [];
    const now = new Date();

    let count = 30;
    let format = 'daily';

    if (period === '7d') {
      count = 7;
      format = 'daily';
    } else if (period === '90d') {
      count = 90;
      format = 'daily';
    } else if (period === '1y') {
      count = 12;
      format = 'monthly';
    }

    if (format === 'daily') {
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dataPoints.push({ date: dateStr, revenue: 0, newSubscriptions: 0, cancellations: 0 });
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(now.getMonth() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        dataPoints.push({ date: dateStr, revenue: 0, newSubscriptions: 0, cancellations: 0 });
      }
    }

    allUsers.forEach(u => {
      // Track payments/subscriptions
      u.paymentHistory.forEach(pay => {
        if (pay.status === 'captured' && pay.paidAt) {
          const payDate = new Date(pay.paidAt);
          let key = '';
          if (format === 'daily') {
            key = payDate.toISOString().split('T')[0];
          } else {
            key = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;
          }

          const point = dataPoints.find(dp => dp.date === key);
          if (point) {
            point.revenue += pay.amount;
            // Treat the first captured payment in user's history as a new subscription
            const isFirst = u.paymentHistory
              .filter(p => p.status === 'captured')
              .sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt))[0]?.razorpayPaymentId === pay.razorpayPaymentId;
            if (isFirst) {
              point.newSubscriptions++;
            }
          }
        }
      });

      // Track cancellations
      if ((u.subscriptionStatus === 'expired' || u.subscriptionStatus === 'terminated') && u.subscriptionEndDate) {
        const endDate = new Date(u.subscriptionEndDate);
        let key = '';
        if (format === 'daily') {
          key = endDate.toISOString().split('T')[0];
        } else {
          key = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
        }
        const point = dataPoints.find(dp => dp.date === key);
        if (point) {
          point.cancellations++;
        }
      }
    });

    res.json(dataPoints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error generating revenue analytics' });
  }
});

module.exports = router;
