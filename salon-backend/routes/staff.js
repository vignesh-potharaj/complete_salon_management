const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');

// GET /api/staff
router.get('/', auth, async (req, res) => {
  try {
    const staff = await Staff.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(staff);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/staff
router.post('/', auth, async (req, res) => {
  try {
    const newStaff = new Staff({
      ...req.body,
      userId: req.user.userId
    });
    const staff = await newStaff.save();
    res.json(staff);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/staff/:id
router.put('/:id', auth, async (req, res) => {
  try {
    let staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ msg: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    staff = await Staff.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(staff);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/staff/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ msg: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    await Staff.findByIdAndRemove(req.params.id);
    res.json({ msg: 'Staff removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/staff/:id/performance
router.get('/:id/performance', auth, async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ msg: 'Staff not found' });
    if (staff.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    const startDate = new Date();
    startDate.setDate(1); // 1st of current month
    startDate.setHours(0,0,0,0);
    
    // Revenue this month
    const bills = await Bill.find({
      staffId: staffId,
      userId: req.user.userId,
      date: { $gte: startDate }
    });

    const revenueThisMonth = bills.reduce((acc, bill) => acc + bill.grandTotal, 0);
    const commissionThisMonth = (revenueThisMonth * staff.commissionPct) / 100;

    // Appointments this week (rough estimate starting Monday)
    const startOfWeek = new Date();
    const day = startOfWeek.getDay(), diff = startOfWeek.getDate() - day + (day === 0 ? -6:1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0,0,0,0);
    
    // We store appointment dates as YYYY-MM-DD
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
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;