const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Client = require('../models/Client');

// Validation
const appointmentValidation = [
  body('clientId').notEmpty().withMessage('Client is required'),
  body('staffId').notEmpty().withMessage('Staff member is required'),
  body('date').notEmpty().withMessage('Date is required'),
  body('time').notEmpty().withMessage('Time is required')
];

// GET /api/appointments
router.get('/', auth, async (req, res, next) => {
  try {
    const query = { userId: req.user.userId };
    if (req.query.date) {
      query.date = req.query.date;
    }
    const appointments = await Appointment.find(query).sort({ date: 1, time: 1 });
    res.json(appointments);
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments
router.post('/', [auth, appointmentValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const newAppointment = new Appointment({
      ...req.body,
      userId: req.user.userId
    });

    const appointment = await newAppointment.save();
    res.json(appointment);
  } catch (err) {
    next(err);
  }
});

// PUT /api/appointments/:id
router.put('/:id', [auth, appointmentValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    let appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    appointment = await Appointment.findOneAndUpdate({ _id: req.params.id, userId: req.user.userId }, { $set: req.body }, { new: true });
    res.json(appointment);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id/status
router.patch('/:id/status', auth, async (req, res, next) => {
  try {
    let appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    appointment.status = req.body.status;
    await appointment.save();
    
    res.json(appointment);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    await Appointment.deleteOne({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Appointment removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;