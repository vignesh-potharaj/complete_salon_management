const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Bill = require('../models/Bill');
const Appointment = require('../models/Appointment');
const InventoryItem = require('../models/InventoryItem');
const Client = require('../models/Client');

// GET /api/dashboard/summary
router.get('/summary', auth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const todayStr = new Date().toISOString().split('T')[0];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayStatsArr, appointmentsToday, lowStockItems, totalClients, recentClients] = await Promise.all([
      // Today's Stats
      Bill.aggregate([
        { $match: { userId, date: { $gte: startOfDay }, deleted: { $ne: true } } },
        { $group: {
            _id: null,
            totalSales: { $sum: "$grandTotal" },
            totalBills: { $sum: 1 },
            avgBillValue: { $avg: "$grandTotal" }
        } }
      ]),
      // Today's Appointments
      Appointment.find({ userId, date: todayStr }).sort({ time: 1 }),
      // Low Stock
      InventoryItem.find({ userId, $expr: { $lte: ["$stock", "$minStock"] } }).select('name stock minStock category'),
      // Total Clients
      Client.countDocuments({ userId }),
      // Recent Clients
      Client.find({ userId }).sort({ createdAt: -1 }).limit(3)
    ]);

    const s = todayStatsArr[0] || { totalSales: 0, totalBills: 0, avgBillValue: 0 };

    res.json({
      todayStats: {
        totalSales: s.totalSales,
        totalBills: s.totalBills,
        avgBillValue: Math.round(s.avgBillValue)
      },
      appointmentsToday,
      lowStockItems,
      totalClients,
      recentClients
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
