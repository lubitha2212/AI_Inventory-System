// backend/app.js
require('dotenv').config(); // Load environment variables first

const express = require('express');
const cors = require('cors');
const predictionRoutes = require('./routes/predictionRoutes');
const { initMongo } = require('./utils/mongo'); // MongoDB helper

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend server is running',
    time: new Date().toISOString()
  });
});

// Prediction routes
app.use('/api', predictionRoutes);

// Start server and connect to MongoDB
(async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await initMongo(); // waits for mongoose.connect() to finish
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, () => {
      console.log(`✅ Backend server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1); // exit if DB connection fails
  }
})();
