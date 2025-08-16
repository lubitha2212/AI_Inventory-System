// backend/routes/predictionRoutes.js
const express = require('express');
const router = express.Router();
const { upload, uploadFile } = require('../controllers/predictionController');
const { getDb } = require('../utils/mongo');

// POST /api/predict  (files -> python -> save to Mongo)
router.post('/predict', upload, uploadFile);

// GET /api/predictions  (fetch history from MongoDB)
router.get('/predictions', async (req, res) => {
  try {
    const db = getDb();
    const predictions = await db
      .collection('predictions')
      .find()
      .sort({ timestamp: -1 }) // newest first
      .toArray();

    res.json({ success: true, data: predictions });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ success: false, error: 'Error fetching predictions' });
  }
});

module.exports = router;
