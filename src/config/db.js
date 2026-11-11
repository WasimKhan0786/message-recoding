require('dotenv').config();
const mongoose = require('mongoose');

// Mask sensitive credentials in MongoDB connection string for safe logging
function maskMongoUri(uri) {
  if (!uri) return '[NOT CONFIGURED]';
  return uri.replace(/(:\/\/)([^:@]+):([^@]+)@/, '$1$2:****@');
}

/**
 * Connects to MongoDB with safe configuration and event handling.
 * 
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/audioflow';
  const maskedUri = maskMongoUri(uri);

  const options = {
    dbName: process.env.MONGODB_DB_NAME || 'audioflow',
    serverSelectionTimeoutMS: 5000, // Timeout fast after 5s if server unreachable
    autoIndex: true
  };

  try {
    const conn = await mongoose.connect(uri, options);
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ MongoDB Connection Notice: Could not connect to ${maskedUri}`);
    console.warn(`   Reason: ${error.message}`);
    console.warn(`   Tip: Set MONGODB_URI in your .env to a running local MongoDB or MongoDB Atlas cluster.`);
    return null;
  }
}

/**
 * Returns the current MongoDB connection state and diagnostic info.
 */
function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  return {
    isConnected,
    state: states[readyState] || 'unknown',
    readyState,
    host: isConnected ? mongoose.connection.host : null,
    name: isConnected ? mongoose.connection.name : null,
    uri: maskMongoUri(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/audioflow')
  };
}

// Graceful connection shutdown
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
  }
});

module.exports = {
  connectDB,
  getConnectionStatus,
  maskMongoUri
};
