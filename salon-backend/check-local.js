const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const LOCAL_URI = 'mongodb://localhost:27017/salonpro';

async function checkLocalData() {
  try {
    await mongoose.connect(LOCAL_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to local MongoDB.');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections.`);
    
    for (let col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
    }
    
    process.exit(0);
  } catch (err) {
    console.log('No local MongoDB running or accessible at ' + LOCAL_URI);
    process.exit(0);
  }
}

checkLocalData();
