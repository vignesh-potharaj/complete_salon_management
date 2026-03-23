const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Client = require('../models/Client');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');

// GET /api/clients
router.get('/', auth, async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/clients
router.post('/', auth, async (req, res) => {
  try {
    const newClient = new Client({
      ...req.body,
      userId: req.user.userId
    });
    const client = await newClient.save();
    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/clients/:id
router.put('/:id', auth, async (req, res) => {
  try {
    let client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ msg: 'Client not found' });
    if (client.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    client = await Client.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/clients/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ msg: 'Client not found' });
    if (client.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    await Client.findByIdAndRemove(req.params.id);
    res.json({ msg: 'Client removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/clients/:id/history
router.get('/:id/history', auth, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ msg: 'Client not found' });
    if (client.userId !== req.user.userId) return res.status(401).json({ msg: 'Not authorized' });

    const appointments = await Appointment.find({ clientId: req.params.id, userId: req.user.userId }).sort({ date: -1, time: -1 });
    const bills = await Bill.find({ clientId: req.params.id, userId: req.user.userId }).sort({ date: -1 });

    res.json({ appointments, bills });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;