const express = require('express');
const router  = express.Router();
const Bill    = require('../models/Bill');
const { protect } = require('../middleware/authMiddleware');
const { validateBill } = require('../middleware/validators');

router.use(protect);

router.post('/', validateBill, async (req, res, next) => {
  try {
    const { clientName, items, subtotal, gst, grandTotal, paymentMethod } = req.body;
    const bill = await Bill.create({
      clientName, items, subtotal, gst, grandTotal,
      paymentMethod: paymentMethod || 'Cash',
      createdBy: req.user._id
    });
    res.status(201).json(bill);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { date, clientName } = req.query;
    let query = { createdBy: req.user._id };
    if (date) {
      const start = new Date(date);
      const end   = new Date(date);
      end.setDate(end.getDate() + 1);
      query.createdAt = { $gte: start, $lt: end };
    }
    if (clientName) {
      query.clientName = { $regex: clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    const bills = await Bill.find(query).sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) { next(err); }
});

router.get('/stats/today', async (req, res, next) => {
  try {
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    const bills = await Bill.find({ createdBy: req.user._id, createdAt: { $gte: start, $lte: end } });
    const totalSales = bills.reduce((s, b) => s + b.grandTotal, 0);
    const totalBills = bills.length;
    const avgBill    = totalBills > 0 ? Math.round(totalSales / totalBills) : 0;
    res.json({ totalSales, totalBills, avgBill });
  } catch (err) { next(err); }
});

router.get('/stats/summary', async (req, res, next) => {
  try {
    const bills = await Bill.find({ createdBy: req.user._id });
    const totalRevenue = bills.reduce((s, b) => s + b.grandTotal, 0);
    const totalBills   = bills.length;
    const avgBill      = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;
    const monthlyMap   = {};
    let serviceRevenue = 0, productRevenue = 0;
    bills.forEach(b => {
      const key = new Date(b.createdAt).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      monthlyMap[key] = (monthlyMap[key] || 0) + b.grandTotal;
      b.items.forEach(item => {
        if (item.type === 'Service') serviceRevenue += item.total;
        else productRevenue += item.total;
      });
    });
    res.json({ totalRevenue, totalBills, avgBill, serviceRevenue, productRevenue, monthlyMap });
  } catch (err) { next(err); }
});

module.exports = router;