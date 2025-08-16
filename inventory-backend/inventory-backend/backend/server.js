console.log('🚀 Starting server...');
require('dotenv').config();
console.log('🔧 MONGO_URI:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron'); // ✅ Added for scheduling
const sendToAI = require('./utils/sendToAI');
const generateCSV = require('./utils/generateCSV');
const Prediction = require('./models/Prediction');

const app = express();

// 🧩 Middleware
app.use(cors());
app.use(express.json());

// 🛣️ Log every request
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// 🔗 Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 🛣️ Import Routes
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const customerRoutes = require('./routes/customerRoutes');

// 🔌 Use Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customer', customerRoutes);

// 📤 Test AI connection with sample CSV
app.get('/api/test-ai', async (req, res) => {
  try {
    const salesCsv = path.join(__dirname, 'sample_data', 'sales.csv');
    const productsCsv = path.join(__dirname, 'sample_data', 'products.csv');

    const aiResponse = await sendToAI(salesCsv, productsCsv);
    res.json({
      success: true,
      message: 'AI Optimizer connected successfully',
      aiResponse
    });
  } catch (err) {
    console.error('❌ AI connection failed:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to AI Optimizer',
      details: err.message
    });
  }
});

// ⚡ Manual AI run from DB → CSV → AI → Save predictions
app.post('/api/ai/run', async (req, res) => {
  try {
    console.log('⚡ Manual AI trigger started...');
    const { salesPath, productsPath } = await generateCSV();
    const aiData = await sendToAI(salesPath, productsPath);

    const prediction = await Prediction.create({
      date: new Date(),
      predictions: aiData.predictions || []
    });

    res.status(200).json({
      success: true,
      message: 'AI run completed successfully',
      predictions: aiData,
      savedId: prediction._id
    });

  } catch (err) {
    console.error('❌ Error running AI manually:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 🕒 Schedule AI run every Sunday midnight
cron.schedule('0 0 * * 0', async () => {
  console.log('🕒 Scheduled AI run started (Sunday midnight)...');
  try {
    const { salesPath, productsPath } = await generateCSV();
    const aiData = await sendToAI(salesPath, productsPath);

    await Prediction.create({
      date: new Date(),
      predictions: aiData.predictions || []
    });

    console.log('✅ Scheduled AI run completed and predictions saved.');
  } catch (err) {
    console.error('❌ Scheduled AI run failed:', err.message);
  }
}, {
  timezone: 'Asia/Kolkata' // ✅ Your timezone
});

// 🏠 Root route
app.get('/', (req, res) => res.send('Retail API is running'));

// ❓ Catch-all for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 🚀 Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
