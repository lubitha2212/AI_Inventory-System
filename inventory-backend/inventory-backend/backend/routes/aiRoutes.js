const express = require('express');
const router = express.Router();
const generateCSV = require('../utils/generateCSV');
const sendToAI = require('../utils/sendToAI');
const Prediction = require('../models/Prediction');

// POST /api/ai/run → Manually trigger CSV generation + AI predictions
router.post('/run', async (req, res) => {
  try {
    console.log('⚡ Manual AI trigger started...');

    // 1️⃣ Generate CSV files
    const { salesPath, productsPath } = await generateCSV();
    console.log(`📂 CSV files generated: 
      Sales → ${salesPath} 
      Products → ${productsPath}`);

    // 2️⃣ Send CSV files to AI Optimizer
    const aiData = await sendToAI(salesPath, productsPath);

    if (!aiData || !aiData.predictions) {
      throw new Error('AI Optimizer did not return predictions');
    }

    // 3️⃣ Save predictions in MongoDB
    const prediction = await Prediction.create({
      date: new Date(),
      predictions: aiData.predictions
    });

    console.log('✅ Predictions saved in DB with ID:', prediction._id);

    // 4️⃣ Send response
    res.status(200).json({
      success: true,
      message: 'AI run completed successfully',
      predictions: aiData.predictions,
      savedId: prediction._id
    });

  } catch (err) {
    console.error('❌ Error running AI manually:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

module.exports = router;
