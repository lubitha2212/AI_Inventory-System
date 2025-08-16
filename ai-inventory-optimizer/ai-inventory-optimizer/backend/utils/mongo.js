// backend/utils/mongo.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'ai_inventory';

let client;
let db;

/**
 * Initialize a single MongoDB connection for the whole app
 */
async function initMongo() {
  if (!uri) {
    throw new Error('❌ MONGO_URI not set in environment variables');
  }

  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,            // limit concurrent connections
      serverSelectionTimeoutMS: 10000 // fail fast if DB not reachable
    });

    await client.connect();
    db = client.db(dbName);
    console.log(`✅ MongoDB connected to database: ${dbName}`);
  }

  return db;
}

/**
 * Get the active database instance
 */
function getDb() {
  if (!db) {
    throw new Error('❌ MongoDB not initialized. Call initMongo() first.');
  }
  return db;
}

/**
 * Save a prediction document into the `predictions` collection
 */
async function savePrediction(doc) {
  const database = getDb();
  const col = database.collection('predictions');

  const payload = {
    ...doc,
    timestamp: new Date()
  };

  const res = await col.insertOne(payload);
  return res;
}

/**
 * Close MongoDB connection (for cleanup in tests or shutdown)
 */
async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('ℹ️ MongoDB connection closed');
  }
}

module.exports = {
  initMongo,
  getDb,
  savePrediction,
  closeMongo
};
