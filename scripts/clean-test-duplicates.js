const mongoose = require('mongoose');
require('dotenv').config();
const Audio = require('../src/models/Audio');

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const deleted = await Audio.deleteMany({ title: { $regex: 'Master Audio Flow', $options: 'i' } });
  console.log('Deleted test duplicate audios:', deleted.deletedCount);
  const remaining = await Audio.find().sort({ order: 1, createdAt: 1 });
  console.log('Remaining authentic audios:');
  remaining.forEach((a, i) => console.log(`  Part ${i+1}: ${a.id} - ${a.title} (${a.duration})`));
  await mongoose.disconnect();
}
clean();

