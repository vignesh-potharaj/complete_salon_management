const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const InventoryItem = require('../models/InventoryItem');
const Client = require('../models/Client');
const Staff = require('../models/Staff');

// Validation middleware
const billValidation = [
  body('clientId').notEmpty().withMessage('Client ID is required'),
  body('staffId').notEmpty().withMessage('Staff ID is required'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('grandTotal').isFloat({ min: 0 }).withMessage('Total must be non-negative')
];

// GET /api/bills
router.get('/', auth, async (req, res, next) => {
  try {
    const bills = await Bill.find({ userId: req.user.userId }).sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    next(err);
  }
});

// GET /api/bills/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    res.json(bill);
  } catch (err) {
    next(err);
  }
});

// GET /api/bills/stats/today
// GET /api/bills/stats/today
router.get('/stats/today', auth, async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const stats = await Bill.aggregate([
      { $match: { 
          userId: req.user.userId, 
          date: { $gte: startOfDay },
          deleted: { $ne: true }
      } },
      { $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalBills: { $sum: 1 },
          avgBillValue: { $avg: "$grandTotal" },
          cash: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Cash"] }, 1, 0] } },
          card: { $sum: { $cond: [{ $eq: ["$paymentMethod", "Card"] }, 1, 0] } },
          upi: { $sum: { $cond: [{ $eq: ["$paymentMethod", "UPI"] }, 1, 0] } }
      } }
    ]);

    if (stats.length === 0) {
      return res.json({ totalSales: 0, totalBills: 0, avgBillValue: 0, paymentBreakdown: { Cash: 0, Card: 0, UPI: 0 } });
    }

    const s = stats[0];
    res.json({
      totalSales: s.totalSales,
      totalBills: s.totalBills,
      avgBillValue: Math.round(s.avgBillValue),
      paymentBreakdown: { Cash: s.cash, Card: s.card, UPI: s.upi }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/bills/stats/range
router.get('/stats/range', auth, async (req, res, next) => {
  try {
    let { from, to } = req.query;
    const now = new Date();
    const defaultFrom = new Date(now.setDate(now.getDate() - 30));
    
    const startDate = from ? new Date(from) : defaultFrom;
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const matchQuery = { 
      userId: req.user.userId, 
      date: { $gte: startDate, $lte: endDate },
      deleted: { $ne: true }
    };

    const [bills, analytics] = await Promise.all([
      Bill.find(matchQuery).sort({ date: -1 }),
      Bill.aggregate([
        { $match: matchQuery },
        { $facet: {
            summary: [
              { $group: {
                  _id: null,
                  totalRevenue: { $sum: "$grandTotal" },
                  totalBills: { $sum: 1 }
              } }
            ],
            byMonth: [
              { $group: {
                  _id: { $dateToString: { format: "%b", date: "$date" } },
                  value: { $sum: "$grandTotal" }
              } }
            ],
            byStaff: [
              { $group: {
                  _id: "$staffName",
                  value: { $sum: "$grandTotal" }
              } }
            ],
            byPayment: [
              { $group: {
                  _id: "$paymentMethod",
                  value: { $sum: "$grandTotal" }
              } }
            ],
            byService: [
              { $unwind: "$lineItems" },
              { $match: { "lineItems.type": "Service" } },
              { $group: {
                  _id: "$lineItems.name",
                  value: { $sum: "$lineItems.subtotal" }
              } }
            ]
        } }
      ])
    ]);

    const a = analytics[0];
    const revenueByMonth = {};
    const revenueByStaff = {};
    const revenueByPaymentMethod = {};
    const revenueByService = {};

    a.byMonth.forEach(i => revenueByMonth[i._id] = i.value);
    a.byStaff.forEach(i => revenueByStaff[i._id] = i.value);
    a.byPayment.forEach(i => revenueByPaymentMethod[i._id] = i.value);
    a.byService.forEach(i => revenueByService[i._id] = i.value);

    res.json({
      bills,
      totalRevenue: a.summary[0]?.totalRevenue || 0,
      totalBills: a.summary[0]?.totalBills || 0,
      revenueByMonth,
      revenueByService,
      revenueByStaff,
      revenueByPaymentMethod
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bills/:id (Soft-delete)
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.deleted) return res.status(400).json({ message: 'Bill already voided' });

    bill.deleted = true;
    await bill.save();

    // Reverse stock changes
    for (let item of bill.lineItems) {
      if (item.type === 'Product' && item.refId) {
        await InventoryItem.findOneAndUpdate(
          { _id: item.refId, userId: req.user.userId },
          { $inc: { stock: item.qty } }
        );
      }
    }

    res.json({ message: 'Bill voided' });
  } catch (err) {
    next(err);
  }
});

// POST /api/bills
router.post('/', [auth, billValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const newBill = new Bill({
      ...req.body,
      userId: req.user.userId
    });

    const bill = await newBill.save();

    for (let item of bill.lineItems) {
        if (item.type === 'Product' && item.refId) {
            await InventoryItem.findOneAndUpdate(
                { _id: item.refId, userId: req.user.userId },
                { $inc: { stock: -item.qty } }
            );
        }
    }

    if (bill.clientId) {
        await Client.findByIdAndUpdate(
            bill.clientId,
            { 
               $inc: { totalSpend: bill.grandTotal, totalVisits: 1 },
               $set: { lastVisit: new Date() }
            }
        );
    }

    res.json(bill);
  } catch (err) {
    next(err);
  }
});

module.exports = router;