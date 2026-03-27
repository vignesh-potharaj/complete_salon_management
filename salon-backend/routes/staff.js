const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');

// Validation middleware
const staffValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('role').trim().notEmpty().withMessage('Role is required'),
  body('commissionPct').isFloat({ min: 0, max: 100 }).withMessage('Commission must be 0-100')
];

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

    staff = await Staff.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
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
    const mongoose = require('mongoose');
    const staffId = new mongoose.Types.ObjectId(req.params.id);
    const userId = req.user.userId;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 1. Revenue & Commission Stats
    const billStats = await Bill.aggregate([
      { $match: { 
          staffId: staffId, 
          userId: userId, 
          date: { $gte: startOfMonth },
          deleted: { $ne: true }
      } },
      { $group: { 
          _id: null, 
          revenueThisMonth: { $sum: "$grandTotal" },
          count: { $sum: 1 }
      } }
    ]);

    const allTimeStats = await Bill.aggregate([
      { $match: { staffId: staffId, userId: userId, deleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } }
    ]);

    // 2. Appointments Stats
    const appointmentsThisMonth = await Appointment.countDocuments({
      staffId: req.params.id,
      userId: userId,
      date: { $gte: startOfMonth.toISOString().split('T')[0] }
    });

    // 3. Top Service
    const topServiceAgg = await Appointment.aggregate([
      { $match: { staffId: staffId, userId: userId } },
      { $group: { _id: "$serviceName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const staff = await Staff.findById(req.params.id);
    const revenueThisMonth = billStats[0]?.revenueThisMonth || 0;

    res.json({
      revenueThisMonth,
      revenueAllTime: allTimeStats[0]?.total || 0,
      commissionThisMonth: (revenueThisMonth * (staff?.commissionPct || 0)) / 100,
      appointmentsThisMonth,
      topService: topServiceAgg[0]?._id || 'None'
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;