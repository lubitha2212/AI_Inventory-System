// backend/models/Prediction.js
const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  salesFileName: { type: String, required: true },
  productsFileName: { type: String, required: true },
  predictions: { type: Array, required: true },   // All AI predictions
  chart_data: { type: Array, required: true },    // Chart data for frontend
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prediction', PredictionSchema);
