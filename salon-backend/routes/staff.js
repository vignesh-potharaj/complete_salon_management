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
    const staffId = req.params.id;
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    const startDate = new Date();
    startDate.setDate(1); 
    startDate.setHours(0,0,0,0);
    
    const bills = await Bill.find({
      staffId: staffId,
      userId: req.user.userId,
      date: { $gte: startDate }
    });

    const revenueThisMonth = bills.reduce((acc, bill) => acc + bill.grandTotal, 0);
    const commissionThisMonth = (revenueThisMonth * staff.commissionPct) / 100;

    const startOfWeek = new Date();
    const day = startOfWeek.getDay(), diff = startOfWeek.getDate() - day + (day === 0 ? -6:1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0,0,0,0);
    
    const isoStartOfWeek = startOfWeek.toISOString().split('T')[0];

    const appointmentsThisWeek = await Appointment.countDocuments({
      staffId: staffId,
      userId: req.user.userId,
      date: { $gte: isoStartOfWeek }
    });

    res.json({
      revenueThisMonth,
      commissionThisMonth,
      appointmentsThisWeek
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;