const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');

// Validation middleware
const staffValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').trim().notEmpty().withMessage('Role is required'),
  body('commissionPct').isFloat({ min: 0, max: 100 }).withMessage('Commission must be 0-100')
];

// GET /api/staff/all-services - BEFORE /:id
router.get('/all-services', auth, async (req, res, next) => {
  try {
    const activeStaff = await Staff.find({ userId: req.user.userId, active: true });
    const allServices = [];

    activeStaff.forEach(staff => {
      if (staff.services && staff.services.length > 0) {
        staff.services.forEach(svc => {
          allServices.push({
            staffId: staff._id,
            staffName: staff.name,
            serviceId: svc._id,
            serviceName: svc.name,
            price: svc.price,
            durationMins: svc.durationMins,
            category: svc.category,
            label: `${svc.name} — ${staff.name} (₹${svc.price})`
          });
        });
      }
    });

    res.json(allServices);
  } catch (err) {
    next(err);
  }
});

// GET /api/staff
router.get('/', auth, async (req, res, next) => {
  try {
    const staff = await Staff.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// POST /api/staff
router.post('/', [auth, staffValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const newStaff = new Staff({
      ...req.body,
      userId: req.user.userId
    });
    const staff = await newStaff.save();
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// PUT /api/staff/:id
router.put('/:id', [auth, staffValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    let staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    // Ensure full replacement of document array
    staff = await Staff.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/staff/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    await Staff.deleteOne({ _id: req.params.id });
    res.json({ message: 'Staff removed' });
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/:id/performance
router.get('/:id/performance', auth, async (req, res, next) => {
  try {
    const staffId = new mongoose.Types.ObjectId(req.params.id);
    const userId = req.user.userId;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const bills = await Bill.find({
      userId: userId,
      deleted: { $ne: true },
      "lineItems.staffId": String(staffId)
    });

    let revenueThisMonth = 0;
    let serviceRevenue = 0;
    let productRevenue = 0;
    let serviceCounts = {};
    let allTimeRevenue = 0;

    bills.forEach(bill => {
      const isThisMonth = new Date(bill.date || bill.createdAt) >= startOfMonth;
      
      allTimeRevenue += bill.grandTotal;
      if (isThisMonth) revenueThisMonth += bill.grandTotal;

      bill.lineItems.forEach(item => {
        if (item.staffId === String(staffId)) {
          const itemTotal = item.price * (item.qty || 1);
          if (item.type === 'Service') {
            if (isThisMonth) serviceRevenue += itemTotal;
            if (isThisMonth) serviceCounts[item.name] = (serviceCounts[item.name] || 0) + (item.qty || 1);
          } else if (item.type === 'Product') {
            if (isThisMonth) productRevenue += itemTotal;
          }
        }
      });
    });

    let topService = 'None';
    let maxCount = 0;
    for (const [name, count] of Object.entries(serviceCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topService = name;
      }
    }

    const appointmentsThisMonth = await Appointment.countDocuments({
      staffId: req.params.id,
      userId: userId,
      date: { $gte: startOfMonth.toISOString().split('T')[0] }
    });

    res.json({
      revenueThisMonth,
      revenueAllTime: allTimeRevenue,
      serviceRevenue,
      productRevenue,
      commissionThisMonth: (serviceRevenue * (staff.commissionPct || 0)) / 100,
      appointmentsThisMonth,
      topService
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;