const mongoose = require('mongoose');
(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/salonpro');
    const db = mongoose.connection.db;
    const services = await db.collection('services').find({}).toArray();
    const staff = await db.collection('staffs').find({}).toArray();
    const appointments = await db.collection('appointments').find({}).toArray();
    const bills = await db.collection('bills').find({}).toArray();
    console.log('--- DATABASE STATE ---');
    console.log('Services:', services.length);
    console.log('Staff:', staff.length);
    console.log('Appointments:', appointments.length);
    console.log('Bills:', bills.length);
    console.log('First Service:', services[0]?.name);
    console.log('First Staff:', staff[0]?.name);
    process.exit(0);
  } catch(e) {
    console.error('DB Check Failed:', e);
    process.exit(1);
  }
})();
