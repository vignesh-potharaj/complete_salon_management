const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Bill = require('../models/Bill');
const InventoryItem = require('../models/InventoryItem');
const Client = require('../models/Client');
const Staff = require('../models/Staff');

// GET /api/bills
router.get('/', auth, async (req, res) => {
  try {
    const bills = await Bill.find({ userId: req.user.userId }).sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/bills/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ msg: 'Bill not found' });
    if (bill.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    res.json(bill);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/bills/stats/today
router.get('/stats/today', auth, async (req, res) => {
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
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/bills/stats/range
router.get('/stats/range', auth, async (req, res) => {
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
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });

// POST /api/bills
router.post('/', auth, async (req, res) => {
  try {
    const newBill = new Bill({
      ...req.body,
      userId: req.user.userId
    });

    const bill = await newBill.save();

    // 1. Decrement inventory for every product used
    for (let item of bill.lineItems) {
        if (item.type === 'Product' && item.refId) {
            await InventoryItem.findOneAndUpdate(
                { _id: item.refId, userId: req.user.userId },
                { $inc: { stock: -item.qty } }
            );
        }
    }

    // 2. Update client's total spend + visit count
    if (bill.clientId) {
        await Client.findByIdAndUpdate(
            bill.clientId,
            { 
               $inc: { totalSpend: bill.grandTotal, totalVisits: 1 },
               $set: { lastVisit: new Date() }
            }
        );
    }

    // 3. Increment staff revenue counter isn't explicitly stored as a monolithic counter in Staff schema,
    // because it's calculated on-the-fly in `/staff/:id/performance` by aggregating Bills.

    res.json(bill);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;