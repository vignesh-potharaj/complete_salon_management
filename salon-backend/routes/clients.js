const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Client = require('../models/Client');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');

// Validation middleware
const clientValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required')
              .matches(/^[0-9+\-\s]{7,15}$/).withMessage('Invalid phone number')
];

// GET /api/clients
router.get('/', auth, async (req, res, next) => {
  try {
    const clients = await Client.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

// POST /api/clients
router.post('/', [auth, clientValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const newClient = new Client({
      ...req.body,
      userId: req.user.userId
    });
    const client = await newClient.save();
    res.json(client);
  } catch (err) {
    next(err);
  }
});

// PUT /api/clients/:id
router.put('/:id', [auth, clientValidation], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    let client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    client = await Client.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(client);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clients/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    await Client.deleteOne({ _id: req.params.id });
    res.json({ message: 'Client removed' });
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id/history
router.get('/:id/history', auth, async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.userId !== req.user.userId) return res.status(401).json({ message: 'Not authorized' });

    const appointments = await Appointment.find({ clientId: req.params.id, userId: req.user.userId }).sort({ date: -1, time: -1 });
    const bills = await Bill.find({ clientId: req.params.id, userId: req.user.userId }).sort({ date: -1 });

    res.json({ appointments, bills });
  } catch (err) {
    next(err);
  }
});

module.exports = router;