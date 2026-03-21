const express     = require('express');
const router      = express.Router();
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/authMiddleware');
const { validateAppointment } = require('../middleware/validators');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;
    let query = { createdBy: req.user._id };
    if (date) {
      const start = new Date(date);
      const end   = new Date(date);
      end.setDate(end.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }
    const appointments = await Appointment.find(query)
      .populate('staff', 'name')
      .sort({ time: 1 });
    res.json(appointments);
  } catch (err) { next(err); }
});

router.post('/', validateAppointment, async (req, res, next) => {
  try {
    const appt = await Appointment.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(appt);
  } catch (err) { next(err); }
});

router.put('/:id', validateAppointment, async (req, res, next) => {
  try {
    const appt = await Appointment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true }
    );
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.json(appt);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Appointment.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    res.json({ message: 'Appointment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;