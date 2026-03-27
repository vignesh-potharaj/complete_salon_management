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
router.get('/stats/today', auth, async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const bills = await Bill.find({
      userId: req.user.userId,
      date: { $gte: startOfDay }
    });

    const totalSales = bills.reduce((acc, bill) => acc + bill.grandTotal, 0);
    res.json({ totalSales });
  } catch (err) {
    next(err);
  }
});

// GET /api/bills/stats/range
router.get('/stats/range', auth, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const query = { userId: req.user.userId };
    
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23,59,59,999);
        query.date.$lte = toDate;
      }
    }
    
    const bills = await Bill.find(query).sort({ date: 1 });
    res.json(bills);
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