const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Client = require('./models/Client');
const Staff = require('./models/Staff');
const Service = require('./models/Service');
const Appointment = require('./models/Appointment');
const Bill = require('./models/Bill');
const InventoryItem = require('./models/InventoryItem');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected for Seeding'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

const USER_ID = 'aditya';

async function seed() {
  try {
    console.log(`\n🧹 Step 1: Clearing existing data for User ID: ${USER_ID}...`);
    await User.deleteMany({ userId: USER_ID });
    await Client.deleteMany({ userId: USER_ID });
    await Staff.deleteMany({ userId: USER_ID });
    await Service.deleteMany({ userId: USER_ID });
    await Appointment.deleteMany({ userId: USER_ID });
    await Bill.deleteMany({ userId: USER_ID });
    await InventoryItem.deleteMany({ userId: USER_ID });

    console.log(`👤 Step 2: Creating User ${USER_ID} (Password: 123456)...`);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('123456', salt);

    const user = new User({
      userId: USER_ID,
      name: 'Aditya',
      salonName: "Aditya's Premium Salon",
      email: 'demo@salonpro.com',
      passwordHash,
      isEmailVerified: true
    });
    await user.save();

    console.log(`✂️ Step 3: Generating Services...`);
    const servicesData = [
      { name: 'Classic Haircut', category: 'Hair', durationMins: 30, defaultPrice: 50 },
      { name: 'Creative Styling', category: 'Hair', durationMins: 45, defaultPrice: 80 },
      { name: 'Global Hair Color', category: 'Color', durationMins: 120, defaultPrice: 200 },
      { name: 'Premium Keratin', category: 'Treatment', durationMins: 150, defaultPrice: 300 },
      { name: 'Signature Facial', category: 'Skin', durationMins: 60, defaultPrice: 120 },
      { name: 'Spa Pedicure', category: 'Nails', durationMins: 45, defaultPrice: 40 }
    ];
    const services = await Service.insertMany(servicesData.map(s => ({ ...s, userId: USER_ID })));

    console.log(`👨‍🎨 Step 4: Generating Staff...`);
    // Map defaultPrice to price for Staff schema
    const staffServices = servicesData.map(s => ({ ...s, price: s.defaultPrice }));

    const staffData = [
      { name: 'Sarah (Senior Stylist)', role: 'Senior Stylist', phone: '555-0101', commissionPct: 40, services: staffServices },
      { name: 'Michael (Colorist)', role: 'Color Expert', phone: '555-0102', commissionPct: 35, services: staffServices.filter(s => s.category === 'Color' || s.category === 'Hair') },
      { name: 'Priya (Esthetician)', role: 'Senior Esthetician', phone: '555-0103', commissionPct: 30, services: staffServices.filter(s => s.category === 'Skin' || s.category === 'Nails') },
      { name: 'Leo (Junior Stylist)', role: 'Junior Stylist', phone: '555-0104', commissionPct: 20, services: staffServices.filter(s => s.category === 'Hair') }
    ];
    const staff = await Staff.insertMany(staffData.map(s => ({ ...s, userId: USER_ID })));

    console.log(`🤝 Step 5: Generating Clients...`);
    const clientData = [
      { name: 'Emily Chen', phone: '4143946038', totalVisits: 12, totalSpend: 1500, loyaltyPoints: 150 },
      { name: 'David Smith', phone: '3035546033', totalVisits: 4, totalSpend: 250, loyaltyPoints: 25 },
      { name: 'Sophia Patel', phone: '8005392010', totalVisits: 25, totalSpend: 4200, loyaltyPoints: 420 }, // VIP
      { name: 'James Wilson', phone: '3809888735', totalVisits: 1, totalSpend: 50, loyaltyPoints: 5 },
      { name: 'Olivia Martin', phone: '4143946038', totalVisits: 8, totalSpend: 800, loyaltyPoints: 80 },
      { name: 'Liam Garcia', phone: '4143946038', totalVisits: 3, totalSpend: 120, loyaltyPoints: 12 },
      { name: 'Isabella Lee', phone: '4143946038', totalVisits: 15, totalSpend: 2100, loyaltyPoints: 210 }, // VIP
      { name: 'Lucas White', phone: '4143946038', totalVisits: 2, totalSpend: 100, loyaltyPoints: 10 },
      { name: 'Mia Thompson', phone: '4143946038', totalVisits: 5, totalSpend: 450, loyaltyPoints: 45 },
      { name: 'Ethan Davis', phone: '3035546033', totalVisits: 0, totalSpend: 0, loyaltyPoints: 0 } // New
    ];
    const clients = await Client.insertMany(clientData.map(c => ({ ...c, userId: USER_ID })));

    console.log(`📦 Step 6: Generating Inventory (with Low Stock)...`);
    const inventoryData = [
      { name: 'L\'Oreal Color Developer 20V', category: 'Color', unit: 'Bottle', stock: 15, minStock: 5, costPrice: 15, sellPrice: 0 },
      { name: 'Olaplex No. 4 Shampoo', category: 'Retail', unit: 'Bottle', stock: 2, minStock: 5, costPrice: 14, sellPrice: 28 }, // Low stock!
      { name: 'Kerastase Hair Mask', category: 'Retail', unit: 'Jar', stock: 1, minStock: 4, costPrice: 25, sellPrice: 55 }, // Low stock!
      { name: 'Spa Pedicure Salts', category: 'Supplies', unit: 'Box', stock: 12, minStock: 3, costPrice: 5, sellPrice: 0 },
      { name: 'Moroccanoil Treatment', category: 'Retail', unit: 'Bottle', stock: 8, minStock: 6, costPrice: 22, sellPrice: 44 }
    ];
    await InventoryItem.insertMany(inventoryData.map(i => ({ ...i, userId: USER_ID })));

    console.log(`📅 Step 7: Generating Appointments...`);
    const today = new Date();

    // Formatting helpers
    const formatDate = (date) => date.toISOString().split('T')[0];

    // Generate dates: yesterday, today, tomorrow
    const yesterdayDate = new Date(today); yesterdayDate.setDate(today.getDate() - 1);
    const tomorrowDate = new Date(today); tomorrowDate.setDate(today.getDate() + 1);

    const appointmentsToCreate = [
      // Yesterday (Completed)
      { clientId: clients[0]._id, clientName: clients[0].name, serviceId: services[0]._id, serviceName: services[0].name, staffId: staff[0]._id, staffName: staff[0].name, date: formatDate(yesterdayDate), time: '10:00', duration: services[0].durationMins, status: 'Completed' },
      { clientId: clients[1]._id, clientName: clients[1].name, serviceId: services[1]._id, serviceName: services[1].name, staffId: staff[3]._id, staffName: staff[3].name, date: formatDate(yesterdayDate), time: '14:30', duration: services[1].durationMins, status: 'Completed' },

      // Today (Various statuses)
      { clientId: clients[2]._id, clientName: clients[2].name, serviceId: services[2]._id, serviceName: services[2].name, staffId: staff[1]._id, staffName: staff[1].name, date: formatDate(today), time: '09:00', duration: services[2].durationMins, status: 'Completed' },
      { clientId: clients[4]._id, clientName: clients[4].name, serviceId: services[4]._id, serviceName: services[4].name, staffId: staff[2]._id, staffName: staff[2].name, date: formatDate(today), time: '11:00', duration: services[4].durationMins, status: 'Completed' },
      { clientId: clients[5]._id, clientName: clients[5].name, serviceId: services[0]._id, serviceName: services[0].name, staffId: staff[0]._id, staffName: staff[0].name, date: formatDate(today), time: '13:00', duration: services[0].durationMins, status: 'Upcoming' },
      { clientId: clients[6]._id, clientName: clients[6].name, serviceId: services[3]._id, serviceName: services[3].name, staffId: staff[0]._id, staffName: staff[0].name, date: formatDate(today), time: '15:30', duration: services[3].durationMins, status: 'Upcoming' },
      { clientId: clients[7]._id, clientName: clients[7].name, serviceId: services[5]._id, serviceName: services[5].name, staffId: staff[2]._id, staffName: staff[2].name, date: formatDate(today), time: '18:00', duration: services[5].durationMins, status: 'Upcoming' },

      // Tomorrow (Upcoming)
      { clientId: clients[8]._id, clientName: clients[8].name, serviceId: services[1]._id, serviceName: services[1].name, staffId: staff[3]._id, staffName: staff[3].name, date: formatDate(tomorrowDate), time: '10:30', duration: services[1].durationMins, status: 'Upcoming' },
      { clientId: clients[2]._id, clientName: clients[2].name, serviceId: services[4]._id, serviceName: services[4].name, staffId: staff[2]._id, staffName: staff[2].name, date: formatDate(tomorrowDate), time: '14:00', duration: services[4].durationMins, status: 'Upcoming' },
    ];
    await Appointment.insertMany(appointmentsToCreate.map(a => ({ ...a, userId: USER_ID })));

    console.log(`🧾 Step 8: Generating Bills (for 30-Day Reports)...`);
    const billsData = [];

    // Create random bills over the last 30 days to build a beautiful revenue chart
    for (let i = 0; i < 30; i++) {
      const billDate = new Date(today);
      billDate.setDate(today.getDate() - Math.floor(Math.random() * 30)); // random day within last 30 days

      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      const randomStaff = staff[Math.floor(Math.random() * staff.length)];
      const randomService = services[Math.floor(Math.random() * services.length)];

      // Some bills have multiple items (Service + Product)
      const lineItems = [
        { type: 'Service', refId: randomService._id, name: randomService.name, qty: 1, unitPrice: randomService.defaultPrice, subtotal: randomService.defaultPrice }
      ];

      let grandTotal = randomService.defaultPrice;

      // 30% chance they bought a retail product too
      if (Math.random() > 0.7) {
        const product = inventoryData[1]; // Olaplex
        lineItems.push({
          type: 'Product', refId: new mongoose.Types.ObjectId(), name: product.name, qty: 1, unitPrice: product.sellPrice, subtotal: product.sellPrice
        });
        grandTotal += product.sellPrice;
      }

      billsData.push({
        userId: USER_ID,
        clientId: randomClient._id,
        clientName: randomClient.name,
        staffId: randomStaff._id,
        staffName: randomStaff.name,
        date: billDate,
        lineItems,
        subtotal: grandTotal,
        taxPct: 0,
        taxAmount: 0,
        grandTotal: grandTotal,
        paymentMethod: ['Cash', 'Card', 'UPI'][Math.floor(Math.random() * 3)]
      });
    }

    await Bill.insertMany(billsData);

    console.log(`\n🎉 SEEDING COMPLETE!`);
    console.log(`User ID: ${USER_ID}`);
    console.log(`Password: 123456\n`);

    process.exit(0);

  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
}

seed();
